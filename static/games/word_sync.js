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
  const freeForAll = () => view.mode === "free_for_all";
  const teamNumber = team => view.teams.findIndex(entry => entry.team_id === team.team_id) + 1;
  const player = playerId => view.players.find(entry => entry.player_id === playerId);
  const winners = () => view.players.filter(member => view.winner.includes(member.player_id));
  const connected = () => socket.connected && roomSessionReady;
  const normalizedDraft = () => input.value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const explanations = {
    round: "🔁 Round counts simultaneous word reveals, not seconds. Every unfinished team gets the same number of attempts.",
    word: "Write one word privately, up to 24 Unicode characters. Think freely on round one; afterwards, use your team's previous two words as inspiration. Reusing a word is allowed.",
    submit: "Lock word (🔒) submits once, without showing your word to anyone else. It cannot be changed. All words are revealed together once every remaining player has submitted.",
    next_round: "Next Round confirms that you have read the reveal. Every player must confirm. No second confirmation dialog is needed.",
    pairing: "Adjacent room seats form fixed pairs: 1 + 2, 3 + 4, 5 + 6, 7 + 8, 9 + 10. Only your own locked word is visible before the shared reveal.",
    ranking: "Match (✓) means both teammates wrote the same word. Fewer rounds rank higher; equal rounds tie. The game finishes when every team matches. With two players, record your cooperative round count.",
    history: "History contains only words already revealed to everyone, newest first. Your team's entries are highlighted. Opening it never reveals pending words.",
    free_for_all: "Free-for-all has no teams. Everyone writes one word each round, and the round ends the game the moment two or more players write the same word."
  };
  const freeForAllExplanations = {
    round: "🔁 Round counts simultaneous word reveals, not seconds. Every round gives all players exactly one attempt.",
    word: "Write one word privately, up to 24 Unicode characters. Your goal is to write the word another player will also write. Last round's words are shown as inspiration.",
    ranking: "🏆 The moment two or more players write the same word, the game ends and all of them win together. Everyone else loses; submission speed never breaks a tie.",
    history: "History contains only words already revealed to everyone, newest round first. Words that matched are highlighted."
  };
  const explanationFor = key => (freeForAll() && freeForAllExplanations[key]) || explanations[key];

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
    const description = explanationFor(target?.dataset.wsExplain);
    if (description) openDialog("Explain", `<p>${escapeHtml(description)}</p>`);
  }

  function teamHelp() {
    return `
      <p><b>Word Sync</b> · Two minds, one word. A team association game for <b>2 / 4 / 6 / 8 / 10 players</b>.</p>
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
      <p>Practice bots start with simple words, then reuse a consistent word from their team's previous public reveal. They never inspect hidden submissions and are not semantic AI partners. History is public and scrollable. Explain inspects controls without playing; Esc closes dialogs or exits Explain.</p>`;
  }

  function freeForAllHelp() {
    return `
      <p><b>Word Sync · Free-for-all</b> · No teams, no partners. An association duel for <b>2 to 10 players</b>.</p>
      <h3>Write what someone else will write</h3>
      <p>Every round, each player privately writes one word. You win by writing the same word as at least one other player, so pick the most obvious word you can think of. Last round's words are shown as inspiration.</p>
      <h3>🔒 Lock → reveal</h3>
      <p>Lock word (🔒) is final and nobody can see it. Once every player has submitted, all words appear together. The moment two or more players wrote the same word, the game ends immediately and <b>all of them win</b> (🏆). Everyone else loses. If several different words each appear twice or more, every player in those groups wins.</p>
      <p>If nobody collides, all players press <b>Next Round</b> and try again. There is no timer and no round limit. Submission speed never decides anything.</p>
      <h3>What counts as the same word?</h3>
      <p>Up to 24 Unicode characters after normalization, containing at least one letter or number. We normalize compatibility / full-width forms, trim outer spaces, collapse inner spaces, and ignore letter case. Synonyms, different punctuation, and simplified / traditional Chinese are not automatically equal. Only words written in the <b>same round</b> can match. Control / invisible formatting characters are rejected.</p>
      <h3>Practice & controls</h3>
      <p>Practice bots start with simple words, then converge on a word from the previous public reveal. They never inspect hidden submissions and are not semantic AI partners. History is public and scrollable. Explain inspects controls without playing; Esc closes dialogs or exits Explain.</p>`;
  }

  function showHelp() {
    openDialog("Help · 同频共词", freeForAll() ? freeForAllHelp() : teamHelp());
  }

  function cardMarkup(team, playerId, position, total) {
    const member = player(playerId);
    const own = playerId === view.you;
    const matched = team.matched_round !== null;
    const reveal = freeForAll() ? view.phase !== "guess" : view.phase !== "guess" || matched;
    const latest = team.history[team.history.length - 1];
    const word = reveal ? latest?.words[position] : own ? view.your_word : null;
    const status = reveal
      ? freeForAll() ? (matched ? "🏆 Same word!" : "Revealed")
        : (matched ? `✓ Matched in ${team.matched_round}` : "Revealed")
      : member.submitted ? (own ? "🔒 Only you can see this" : "🔒 Word locked") : "Thinking…";
    const tip = reveal ? "Revealed words · Everyone can see these words."
      : "🔒 Locked words stay private until everyone submits.";
    const role = own ? "YOU" : freeForAll() ? "PLAYER" : "TEAMMATE";
    return `<article class="ws-card ${own ? "ws-own" : ""} ${matched && reveal ? "ws-match" : ""}" data-ws-explain="${freeForAll() ? "free_for_all" : "pairing"}">
      <div><div class="ws-card-top"><span>${role}</span><span>${position + 1} / ${total}</span></div><div class="ws-card-name">${escapeHtml(member.name)}</div></div>
      <strong class="ws-word ${word === null || word === undefined ? "ws-hidden-word" : ""}">${word === null || word === undefined ? "?" : escapeHtml(word)}</strong>
      <span class="ws-card-status" tabindex="0" data-ws-tip="${tip}">${status}</span>
    </article>`;
  }

  function boardRow(row) {
    const team = view.teams.find(entry => entry.team_id === row.team_id);
    const matched = team.matched_round !== null;
    const reveal = freeForAll() ? view.phase !== "guess" : view.phase !== "guess" || matched;
    const latest = team.history[team.history.length - 1];
    const mine = team.team_id === view.your_team_id;
    const title = freeForAll()
      ? `${escapeHtml(player(team.player_ids[0]).name)}${mine ? " · You" : ""}`
      : `Team ${teamNumber(team)}${mine ? " · You" : ""}`;
    const rank = freeForAll()
      ? (matched ? "Winner" : view.game_over ? "No match" : "Playing")
      : (row.rank === null ? "In progress" : `#${row.rank} · ${row.rounds} ${row.rounds === 1 ? "round" : "rounds"}`);
    const tip = freeForAll()
      ? "Any players who write the same word win together and the game ends."
      : "Fewer rounds rank higher. Equal rounds tie.";
    return `<article class="ws-team ${mine ? "ws-your-team" : ""} ${view.game_over && row.rank === 1 ? "ws-winner" : ""}" data-ws-team="${team.team_id}">
      <div class="ws-team-heading"><strong>${title}</strong><span class="ws-rank" tabindex="0" data-ws-explain="ranking" data-ws-tip="${tip}">${view.game_over && row.rank === 1 ? "🏆 " : ""}${rank}</span></div>
      <div class="ws-team-pair ${freeForAll() ? "ws-solo" : ""}">${team.player_ids.map((playerId, index) => {
        const member = player(playerId);
        const text = reveal ? latest?.words[index] : member.submitted ? "🔒 Locked" : "Thinking…";
        // Free-for-all already names the player in the row heading.
        const name = freeForAll() ? "" : `<span>${escapeHtml(member.name)}</span>`;
        return `<div class="ws-team-player">${name}<b>${escapeHtml(text ?? "")}</b></div>`;
      }).join("")}</div></article>`;
  }

  function renderBoard() {
    const matched = view.teams.filter(team => team.matched_round !== null).length;
    element("BoardTitle").textContent = freeForAll() ? "PLAYERS" : "THE TEAMS";
    element("Progress").textContent = freeForAll()
      ? (view.game_over ? `🏆 ${matched} / ${view.players.length}` : `${view.players.length} players`)
      : `✓ ${matched} / ${view.teams.length}`;
    element("Teams").innerHTML = view.standings.map(boardRow).join("");
  }

  function renderHistory() {
    if (freeForAll()) {
      const rounds = (view.teams[0]?.history || []).map(entry => entry.round).reverse();
      element("HistoryCount").textContent = `${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`;
      element("HistoryRows").innerHTML = rounds.length ? rounds.map(round => {
        const chips = view.teams.map(team => {
          const entry = team.history[round - 1];
          const member = player(team.player_ids[0]);
          return `<span class="ws-chip ${entry?.matched ? "ws-chip-match" : ""} ${member.player_id === view.you ? "ws-chip-own" : ""}"><b>${escapeHtml(member.name)}</b>${escapeHtml(entry?.words[0] ?? "")}</span>`;
        }).join("");
        return `<li class="ws-history-row"><small>Round ${round}</small><div class="ws-history-chips">${chips}</div></li>`;
      }).join("") : "<li>No words revealed yet.</li>";
      return;
    }
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

  function titleText() {
    if (!view.game_over) {
      if (!freeForAll()) return view.phase === "reveal" ? "A little closer together." : "Find your wavelength.";
      return view.phase === "reveal" ? "No collision this round." : "Find a twin word.";
    }
    if (!freeForAll()) {
      if (view.teams.length === 1) return "Two minds. One word.";
      const teams = view.teams.filter(team => view.winning_team_ids.includes(team.team_id));
      return teams.length === 1 ? `Team ${teamNumber(teams[0])} wins!` : `Teams ${teams.map(teamNumber).join(" + ")} tie!`;
    }
    const names = winners();
    if (names.length === view.players.length) return "Everyone found a twin!";
    return names.length > 3 ? `${names.length} players win!` : `${names.map(member => member.name).join(" + ")} win!`;
  }

  function finalStatus(ownTeam) {
    if (!freeForAll()) {
      return `✓ All words revealed. ${ownTeam ? `Your team matched in ${ownTeam.matched_round} ${ownTeam.matched_round === 1 ? "round" : "rounds"}.` : "Final standings are shown."}`;
    }
    if (!ownTeam) return `${winners().length} players wrote the same word. Final result is shown.`;
    return view.winner.includes(view.you)
      ? `🏆 You wrote the same word in round ${ownTeam.matched_round}. ${winners().length} ${winners().length === 1 ? "winner" : "winners"} in total.`
      : "Nobody wrote your word. Try a more obvious one next game.";
  }

  function statusText(ownTeam, locked, total) {
    if (!connected()) return "Disconnected. Use Reconnect to return to your seat.";
    if (view.game_over) return finalStatus(ownTeam);
    if (view.phase === "reveal") return "Read the words. Everyone confirms before the next round.";
    if (!ownTeam) return `${locked} / ${total} words locked. Spectators cannot submit.`;
    if (freeForAll()) {
      return view.your_word ? `Your word is locked. ${locked} / ${total} locked; reveal together.`
        : `${locked} / ${total} words locked. Write what someone else will write.`;
    }
    if (ownTeam.matched_round) return `Your team is in sync. ${locked} / ${total} words locked by the remaining teams.`;
    return view.your_word ? `Your word is locked. ${locked} / ${total} words locked; reveal together.`
      : `${locked} / ${total} words locked. Keep yours a surprise.`;
  }

  function render() {
    if (!view) return;
    element("Waiting").hidden = true;
    element("Content").hidden = false;
    document.body.classList.toggle("ws-needs-action", connected() && view.legal_actions.length > 0 && !pending);
    const ownTeam = view.teams.find(team => team.team_id === view.your_team_id);
    const shownTeam = ownTeam || view.teams[0];
    const latest = shownTeam.history[shownTeam.history.length - 1];
    element("Eyebrow").textContent = freeForAll() ? "MANY MINDS. ONE WORD." : "TWO MINDS. ONE WORD.";
    element("Title").textContent = titleText();
    element("Round").innerHTML = `<small>ROUND</small><strong>${view.round}</strong>`;
    element("TeamTitle").textContent = freeForAll() ? "YOUR WORD"
      : ownTeam ? `YOUR TEAM · ${teamNumber(ownTeam)}` : "SPECTATING · TEAM 1";
    element("Stage").textContent = view.game_over ? (freeForAll() ? "Winners decided" : "All teams in sync")
      : freeForAll() ? (view.phase === "reveal" ? "Words revealed" : "Guess privately")
      : shownTeam.matched_round ? `✓ Matched in ${shownTeam.matched_round}`
      : view.phase === "reveal" ? "Words revealed" : "Guess privately";
    element("Pair").classList.toggle("ws-single", freeForAll());
    element("Pair").innerHTML = freeForAll()
      ? cardMarkup(shownTeam, shownTeam.player_ids[0], 0, view.players.length)
      : shownTeam.player_ids.map((playerId, position) => cardMarkup(shownTeam, playerId, position, 2)).join("");
    element("Previous").hidden = view.phase !== "guess" || !latest || (!freeForAll() && shownTeam.matched_round !== null);
    element("Previous").innerHTML = !latest ? "" : freeForAll()
      ? `<span>Last round</span>${view.teams.map(team => `<strong>${escapeHtml(team.history[team.history.length - 1].words[0])}</strong>`).join("<span>·</span>")}`
      : `<span>Last round</span><strong>${escapeHtml(latest.words[0])}</strong><span>+</span><strong>${escapeHtml(latest.words[1])}</strong>`;
    form.hidden = !view.legal_actions.includes("submit_word");
    input.disabled = Boolean(pending) || !connected();
    element("Submit").textContent = pending?.type === "submit_word" ? "Locking…" : "Lock word";
    updateDraft();
    element("Review").hidden = view.phase !== "reveal" || !ownTeam;
    element("Next").disabled = !view.legal_actions.includes("next_round") || Boolean(pending) || !connected();
    element("Next").textContent = view.next_ready.includes(view.you) ? "Ready ✓" : pending?.type === "next_round" ? "Sending…" : "Next Round";
    element("Ready").textContent = `${view.next_ready.length} / ${view.players.length} ready`;
    const activePlayers = freeForAll() ? view.players.map(member => member.player_id)
      : view.teams.filter(team => team.matched_round === null).flatMap(team => team.player_ids);
    const locked = view.players.filter(member => activePlayers.includes(member.player_id) && member.submitted).length;
    element("Status").textContent = statusText(ownTeam, locked, activePlayers.length);
    renderBoard();
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
