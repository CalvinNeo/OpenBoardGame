(() => {
  "use strict";
  const element = suffix => document.getElementById(`wordSync${suffix}`);
  const panel = element("Panel");
  const header = element("HeaderActions");
  const input = element("Word");
  const form = element("Form");
  const dialog = element("Dialog");
  const tooltip = element("Tooltip");
  const explainButton = element("ExplainBtn");
  let view = null;
  let roomKey = null;
  let signature = null;
  let pending = null;
  let pendingTimer = null;
  let explaining = false;
  let composing = false;
  let pointerStart = null;
  let blockedClick = null;
  let tipTimer = null;
  let returnFocus = null;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const teamNumber = team => view.teams.findIndex(entry => entry.team_id === team.team_id) + 1;
  const player = playerId => view.players.find(entry => entry.player_id === playerId);
  const connected = () => socket.connected && roomSessionReady;
  const normalizedDraft = () => input.value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const explanations = {
    round: "🔁 Round counts simultaneous word reveals, not seconds. Every unfinished team gets the same number of attempts.",
    word: "Write one word privately, up to 24 Unicode characters. Think freely on round one; afterwards, use your team's previous two words as inspiration. Reusing a word is allowed.",
    submit: "Lock word (🔒) submits once, without showing your word to anyone else. It cannot be changed. Everyone's words are revealed together after all unfinished teams submit.",
    next_round: "Next Round confirms that you have read the reveal. Every player, including already matched teams, must confirm. No second confirmation dialog is needed.",
    pairing: "Adjacent room seats form fixed pairs: 1 + 2, 3 + 4, 5 + 6, 7 + 8. Only your own locked word is visible before the shared reveal.",
    ranking: "Match (✓) means both teammates wrote the same word. Fewer rounds rank higher; equal rounds tie. The game finishes when every team matches. With two players, record your cooperative round count.",
    history: "History contains only words already revealed to everyone, newest first. Your team's entries are highlighted. Opening it never reveals pending words."
  };

  function setError(message = "") {
    element("Error").textContent = message;
    element("Error").hidden = !message;
  }

  function clearPending() {
    pending = null;
    clearTimeout(pendingTimer);
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.hidden = true;
  }

  function showTip(target) {
    if (!target?.dataset.wsTip || explaining || dialog.open) return;
    hideTip();
    tooltip.textContent = target.dataset.wsTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, bounds.left))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, bounds.bottom + 8))}px`;
    tipTimer = setTimeout(hideTip, 3000);
  }

  function setExplain(enabled) {
    explaining = enabled;
    hideTip();
    document.body.classList.toggle("ws-explaining", enabled);
    explainButton.setAttribute("aria-pressed", String(enabled));
  }

  function openDialog(title, html) {
    returnFocus = document.activeElement;
    setExplain(false);
    element("DialogTitle").textContent = title;
    element("DialogBody").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }

  function explain(target) {
    const description = explanations[target?.dataset.wsExplain];
    if (description) openDialog("Explain", `<p>${escapeHtml(description)}</p>`);
  }

  function showHelp() {
    openDialog("Help · 同频共词", `
      <p><b>Word Sync</b> · Two minds, one word. A team association game for <b>2 / 4 / 6 / 8 players</b>.</p>
      <h3>Pair up & think</h3>
      <p>Adjacent room seats are teammates: 1 + 2, 3 + 4, and so on. Each player privately writes one word. Start with any word; in later rounds, use your team's previous two words as inspiration. Do not agree on answers through chat, voice, or signals.</p>
      <h3>🔒 Lock → reveal → repeat</h3>
      <p>Lock word (🔒) is final. Your teammate and the other teams cannot see it. Once every unfinished team has submitted, all words appear together. Match (✓) happens when both teammates write the same word; that team stops guessing.</p>
      <p>After every reveal, <b>all players</b>, including matched teams, press <b>Next Round</b> before unfinished teams continue. There is no timer or round limit. The final reveal stays on screen.</p>
      <h3>🔁 Rounds & 🏆 ranking</h3>
      <p>Continue until every team matches. The team with the fewest Rounds (🔁) wins (🏆); teams matching in the same round tie, regardless of submission speed. With two players, you play cooperatively for a round-count record.</p>
      <h3>What counts as the same word?</h3>
      <p>Up to 24 Unicode characters after normalization, containing at least one letter or number. We normalize compatibility / full-width forms, trim outer spaces, collapse inner spaces, and ignore letter case. Synonyms, different punctuation, and simplified / traditional Chinese are not automatically equal. Repeated words are allowed. Control / invisible formatting characters are rejected.</p>
      <h3>Practice & controls</h3>
      <p>Practice bots start with simple words, then reuse a consistent word from their team's previous public reveal. They never inspect hidden submissions and are not semantic AI partners. History is public and scrollable. Explain inspects controls without playing; Esc closes dialogs or exits Explain.</p>`);
  }

  function cardMarkup(team, playerId, position) {
    const member = player(playerId);
    const own = playerId === view.you;
    const latest = team.history[team.history.length - 1];
    const reveal = view.phase !== "guess" || team.matched_round !== null;
    const word = reveal ? latest?.words[position] : own ? view.your_word : null;
    const status = reveal ? (team.matched_round ? `✓ Matched in ${team.matched_round}` : "Revealed")
      : member.submitted ? (own ? "🔒 Only you can see this" : "🔒 Word locked") : "Thinking…";
    const tip = reveal ? "Revealed words · Everyone can see these words."
      : "🔒 Locked words stay private until all unfinished teams submit.";
    return `<article class="ws-card ${own ? "ws-own" : ""} ${team.matched_round ? "ws-match" : ""}" data-ws-explain="pairing">
      <div><div class="ws-card-top"><span>${own ? "YOU" : "TEAMMATE"}</span><span>${position + 1} / 2</span></div><div class="ws-card-name">${escapeHtml(member.name)}</div></div>
      <strong class="ws-word ${word === null || word === undefined ? "ws-hidden-word" : ""}">${word === null || word === undefined ? "?" : escapeHtml(word)}</strong>
      <span class="ws-card-status" tabindex="0" data-ws-tip="${tip}">${status}</span>
    </article>`;
  }

  function renderTeams() {
    element("Progress").textContent = `✓ ${view.teams.filter(team => team.matched_round !== null).length} / ${view.teams.length}`;
    element("Teams").innerHTML = view.standings.map(row => {
      const team = view.teams.find(entry => entry.team_id === row.team_id);
      const latest = team.history[team.history.length - 1];
      const reveal = view.phase !== "guess" || team.matched_round !== null;
      const rank = row.rank === null ? "In progress" : `#${row.rank} · ${row.rounds} ${row.rounds === 1 ? "round" : "rounds"}`;
      return `<article class="ws-team ${team.team_id === view.your_team_id ? "ws-your-team" : ""} ${view.game_over && row.rank === 1 ? "ws-winner" : ""}" data-ws-team="${team.team_id}">
        <div class="ws-team-heading"><strong>Team ${teamNumber(team)}${team.team_id === view.your_team_id ? " · You" : ""}</strong><span class="ws-rank" tabindex="0" data-ws-explain="ranking" data-ws-tip="Fewer rounds rank higher. Equal rounds tie.">${view.game_over && row.rank === 1 ? "🏆 " : ""}${rank}</span></div>
        <div class="ws-team-pair">${team.player_ids.map((playerId, index) => {
          const member = player(playerId);
          const text = reveal ? latest?.words[index] : member.submitted ? "🔒 Locked" : "Thinking…";
          return `<div class="ws-team-player"><span>${escapeHtml(member.name)}</span><b>${escapeHtml(text)}</b></div>`;
        }).join("")}</div></article>`;
    }).join("");
  }

  function renderHistory() {
    const rows = view.teams.flatMap(team => team.history.map(entry => ({...entry, team})))
      .sort((first, second) => second.round - first.round || teamNumber(first.team) - teamNumber(second.team));
    element("HistoryCount").textContent = `${rows.length} reveals`;
    element("HistoryRows").innerHTML = rows.length ? rows.map(entry => `<li class="ws-history-row ${entry.team.team_id === view.your_team_id ? "ws-own-history" : ""}">
      <small>Round ${entry.round} · Team ${teamNumber(entry.team)}</small><div class="ws-history-words"><b>${escapeHtml(entry.words[0])}</b><span aria-label="${entry.matched ? "match" : "different"}">${entry.matched ? "=" : "↔"}</span><b>${escapeHtml(entry.words[1])}</b></div></li>`).join("") : "<li>No words revealed yet.</li>";
  }

  function updateDraft() {
    element("Count").textContent = `${Array.from(normalizedDraft()).length} / 24`;
    element("Submit").disabled = !view?.legal_actions.includes("submit_word") || !connected() || Boolean(pending) || !normalizedDraft();
  }

  function render() {
    if (!view) return;
    element("Waiting").hidden = true;
    element("Content").hidden = false;
    document.body.classList.toggle("ws-needs-action", connected() && view.legal_actions.length > 0 && !pending);
    const ownTeam = view.teams.find(team => team.team_id === view.your_team_id);
    const shownTeam = ownTeam || view.teams[0];
    const latest = shownTeam.history[shownTeam.history.length - 1];
    const winners = view.teams.filter(team => view.winning_team_ids.includes(team.team_id));
    element("Title").textContent = view.game_over
      ? view.teams.length === 1 ? "Two minds. One word." : winners.length === 1 ? `Team ${teamNumber(winners[0])} wins!` : `Teams ${winners.map(teamNumber).join(" + ")} tie!`
      : view.phase === "reveal" ? "A little closer together." : "Find your wavelength.";
    element("Round").innerHTML = `<small>ROUND</small><strong>${view.round}</strong>`;
    element("TeamTitle").textContent = ownTeam ? `YOUR TEAM · ${teamNumber(ownTeam)}` : "SPECTATING · TEAM 1";
    element("Stage").textContent = view.game_over ? "All teams in sync" : shownTeam.matched_round ? `✓ Matched in ${shownTeam.matched_round}` : view.phase === "reveal" ? "Words revealed" : "Guess privately";
    element("Pair").innerHTML = shownTeam.player_ids.map((playerId, position) => cardMarkup(shownTeam, playerId, position)).join("");
    element("Previous").hidden = view.phase !== "guess" || !latest || shownTeam.matched_round !== null;
    element("Previous").innerHTML = latest ? `<span>Last round</span><strong>${escapeHtml(latest.words[0])}</strong><span>+</span><strong>${escapeHtml(latest.words[1])}</strong>` : "";
    form.hidden = !view.legal_actions.includes("submit_word");
    input.disabled = Boolean(pending) || !connected();
    element("Submit").textContent = pending?.type === "submit_word" ? "Locking…" : "Lock word";
    updateDraft();
    element("Review").hidden = view.phase !== "reveal" || !ownTeam;
    element("Next").disabled = !view.legal_actions.includes("next_round") || Boolean(pending) || !connected();
    element("Next").textContent = view.next_ready.includes(view.you) ? "Ready ✓" : pending?.type === "next_round" ? "Sending…" : "Next Round";
    element("Ready").textContent = `${view.next_ready.length} / ${view.players.length} ready`;
    const activePlayers = view.teams.filter(team => team.matched_round === null).flatMap(team => team.player_ids);
    const locked = view.players.filter(member => activePlayers.includes(member.player_id) && member.submitted).length;
    element("Status").textContent = !connected() ? "Disconnected. Use Reconnect to return to your seat."
      : view.game_over ? `✓ All words revealed. ${ownTeam ? `Your team matched in ${ownTeam.matched_round} ${ownTeam.matched_round === 1 ? "round" : "rounds"}.` : "Final standings are shown."}`
      : view.phase === "reveal" ? "Read the words. Everyone confirms before the next round."
      : !ownTeam ? `${locked} / ${activePlayers.length} words locked. Spectators cannot submit.`
      : ownTeam.matched_round ? `Your team is in sync. ${locked} / ${activePlayers.length} words locked by the remaining teams.`
      : view.your_word ? `Your word is locked. ${locked} / ${activePlayers.length} words locked; reveal together.`
      : `${locked} / ${activePlayers.length} words locked. Keep yours a surprise.`;
    renderTeams();
    const historyScroll = element("HistoryRows").scrollTop;
    renderHistory();
    element("HistoryRows").scrollTop = historyScroll;
  }

  function submit(type) {
    if (!view || pending || explaining || composing || !connected() || !view.legal_actions.includes(type)) return;
    const fields = {type, game_token: view.game_token, window_id: view.window_id};
    if (type === "submit_word") {
      const word = normalizedDraft();
      if (!word || Array.from(word).length > 24 || !/[\p{L}\p{N}]/u.test(word) || /\p{C}/u.test(input.value)) {
        setError("Use up to 24 characters with letters or numbers, without invisible control characters.");
        input.focus();
        return;
      }
      fields.word = input.value;
    }
    setError();
    pending = {type};
    render();
    pendingTimer = setTimeout(() => {
      clearPending();
      setError("No acknowledgement yet. Reconnect or try again.");
      render();
    }, 8000);
    sendAction(fields);
  }

  function clearState() {
    view = null;
    signature = null;
    roomKey = null;
    pointerStart = null;
    blockedClick = null;
    composing = false;
    input.value = "";
    clearPending();
    setError();
    setExplain(false);
    document.body.classList.remove("ws-needs-action");
    if (dialog.open) dialog.close();
    element("Content").hidden = true;
    element("Waiting").hidden = false;
    element("History").open = false;
  }

  function explainAtPoint(event) {
    const direct = event.target.closest?.("[data-ws-explain]");
    if (direct) return direct;
    return Array.from(panel.querySelectorAll("[data-ws-explain]")).find(target => {
      const bounds = target.getBoundingClientRect();
      return bounds.width && bounds.height && event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    });
  }

  const exempt = target => target.closest?.("#wordSyncHelpBtn, #wordSyncExplainBtn, #wordSyncDialog");
  document.addEventListener("pointerdown", event => {
    if ((!view && !explaining) || exempt(event.target)) return;
    pointerStart = {x: event.clientX, y: event.clientY, id: event.pointerId, moved: false,
      target: explaining ? explainAtPoint(event) : event.target.closest?.("[data-ws-tip]"),
      explaining, touch: event.pointerType !== "mouse"};
  }, true);
  document.addEventListener("pointermove", event => {
    if (pointerStart && pointerStart.id === event.pointerId
        && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) pointerStart.moved = true;
  }, true);
  document.addEventListener("pointercancel", () => { pointerStart = null; }, true);
  document.addEventListener("pointerup", event => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || start.id !== event.pointerId || start.moved
        || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    if (start.explaining && explaining && start.target) {
      event.preventDefault();
      event.stopImmediatePropagation();
      blockedClick = {x: event.clientX, y: event.clientY, at: performance.now()};
      explain(start.target);
    } else if (start.touch && start.target) showTip(start.target);
  }, true);
  document.addEventListener("click", event => {
    if (blockedClick && event.detail && performance.now() - blockedClick.at < 700
        && Math.hypot(event.clientX - blockedClick.x, event.clientY - blockedClick.y) < 8) {
      blockedClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining || exempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.detail) explain(event.target.closest?.("[data-ws-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setExplain(false);
      if (dialog.open) dialog.close();
    }
    if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      explain(event.target.closest?.("[data-ws-explain]"));
    }
  }, true);
  panel.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") showTip(event.target.closest?.("[data-ws-tip]"));
  });
  panel.addEventListener("pointerout", hideTip);
  panel.addEventListener("focusin", event => showTip(event.target.closest?.("[data-ws-tip]")));
  panel.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => { hideTip(); if (pointerStart) pointerStart.moved = true; }, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", () => { hideTip(); pointerStart = null; });
  input.addEventListener("input", () => { setError(); updateDraft(); });
  input.addEventListener("compositionstart", () => { composing = true; });
  input.addEventListener("compositionend", () => { composing = false; updateDraft(); });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
  });
  form.addEventListener("submit", event => { event.preventDefault(); submit("submit_word"); });
  element("Next").addEventListener("click", () => submit("next_round"));
  element("HelpBtn").addEventListener("click", showHelp);
  explainButton.addEventListener("click", () => setExplain(!explaining));
  element("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    const focusNeedsRestore = document.activeElement === document.body || dialog.contains(document.activeElement);
    if (focusNeedsRestore && returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
  });

  window.renderWordSyncGameState = data => {
    if (data?.view?.game_id !== "word_sync" || currentGameType !== "word_sync"
        || data.room_id !== currentRoomState?.room_id) return;
    const nextSignature = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
    if (signature !== nextSignature) {
      input.value = "";
      composing = false;
      clearPending();
      setError();
      setExplain(false);
    } else if (pending && !data.view.legal_actions.includes(pending.type)) clearPending();
    roomKey = data.room_id;
    signature = nextSignature;
    view = data.view;
    render();
  };
  window.showWordSyncHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function syncRoom(state) {
    if (state?.game_type !== "word_sync" || state.status === "lobby" || (roomKey && roomKey !== state.room_id)) clearState();
  }
  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", data => {
      if (!view || currentGameType !== "word_sync") return;
      clearPending();
      setError(data?.message || "Action failed. Please try again.");
      render();
    });
    socket.on("disconnect", () => { clearPending(); render(); });
    socket.on("room:session_replaced", () => { clearPending(); render(); });
    socket.on("system:info", () => { if (view && connected()) render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "word_sync") window.renderWordSyncGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, {once: true});
  else initialize();
})();
