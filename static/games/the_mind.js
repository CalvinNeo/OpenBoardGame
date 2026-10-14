(() => {
  "use strict";
  const panel = document.getElementById("theMindPanel");
  const surface = document.getElementById("tmSurface");
  const header = document.getElementById("theMindHeaderActions");
  const helpButton = document.getElementById("theMindHelpBtn");
  const explainButton = document.getElementById("theMindExplainBtn");
  const dialog = document.getElementById("theMindDialog");
  const tooltip = document.getElementById("tmTooltip");
  let view = null, signature = null, busy = false, busyTimer = null, explaining = false;
  let tipTimer = null, returnFocus = null, suppressClick = false;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
  const playerName = pid => view?.players.find(p => p.player_id === pid)?.name || "Player";
  const card = n => `<span class="tm-chip">${esc(n)}</span>`;
  const action = (label, type, enabled, klass = "", explanation = "") => `<button type="button" data-tm-action="${type}" data-tm-explain="${explanation}" class="${klass}" ${enabled && !busy ? "" : "disabled"}>${label}</button>`;
  const isSelf = pid => pid === view?.you;
  const eventText = entry => {
    const who = playerName(entry.player_id);
    if (entry.kind === "play") return `${who} played a card.`;
    if (entry.kind === "mistake") return `A card was too high; ${entry.cards.length} lower card${entry.cards.length === 1 ? "" : "s"} discarded. ❤️ Life lost.`;
    if (entry.kind === "star") return `🌟 Throwing star used; lowest cards were discarded.`;
    if (entry.kind === "pause") return `${who} called Stop. Everyone refocuses.`;
    if (entry.kind === "request_star") return `${who} requested a throwing star.`;
    if (entry.kind === "star_declined") return `${who} declined the throwing star.`;
    if (entry.kind === "new_level") return `Level ${entry.level} begins.`;
    if (entry.kind === "level_complete") return `Level ${entry.level} complete.`;
    if (entry.kind === "victory") return "All levels complete. The team wins!";
    if (entry.kind === "defeat") return "The team ran out of lives.";
    return "The team updated the table.";
  };
  function showTip(target, force = false) {
    if (!target?.dataset.tmTip) return;
    tooltip.textContent = target.dataset.tmTip;
    tooltip.hidden = false;
    const r = target.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, r.left))}px`;
    tooltip.style.top = `${Math.min(innerHeight - tooltip.offsetHeight - 8, r.bottom + 8)}px`;
    clearTimeout(tipTimer);
    if (force || !target.matches(":hover")) tipTimer = setTimeout(() => { tooltip.hidden = true; }, 3000);
  }
  const hideTip = () => { clearTimeout(tipTimer); tooltip.hidden = true; };
  function help() {
    returnFocus = document.activeElement;
    dialog.querySelector("#tmDialogTitle").textContent = "Help · 心意相通 / The Mind";
    dialog.querySelector("#tmDialogBody").innerHTML = `
      <p>🎯 <b>Goal</b>: work together to clear every level by playing cards from 1 to 100 in ascending order.</p>
      <h3>How a level works</h3>
      <p>At level <b>n</b>, every player receives n private cards. Stay silent: no card values, timing counts, or secret signals. Press Ready to focus; once everyone is ready, anyone may play their lowest card.</p>
      <h3>❤️ Lives and mistakes</h3>
      <p>If a played card is higher than a card someone still holds, the team loses one Life (❤️). All lower held cards are discarded, then everyone focuses again and continues the same level. Zero lives ends the game.</p>
      <h3>🌟 Throwing star</h3>
      <p>Any player may request a star. Everyone must agree. If approved, each player discards their lowest remaining card face up, then the team focuses again. Stars are limited to 3.</p>
      <h3>Rewards and ending</h3>
      <p>2/5/8 reward a star; 3/6/9 reward a Life (maximum 5). Players confirm Next Round after the review. Two players play 12 levels, three play 10, and four play 8.</p>
      <p>Online play keeps cards private and has no countdown. Use Explain to inspect an action; press Esc or click outside a dialog to close.</p>`;
    dialog.showModal();
  }
  function setExplain(value) {
    explaining = value;
    surface.classList.toggle("tm-explaining", value);
    explainButton?.setAttribute("aria-pressed", String(value));
    document.body.classList.toggle("tm-explaining", value);
  }
  function explain(target) {
    if (!target?.dataset.tmExplain) return;
    const texts = {
      ready: "Ready (🖐️) confirms that you are focused for this level or after a mistake.",
      play: "Play the lowest card in your hand. The server checks the order and handles a mistake for the whole team.",
      pause: "Stop pauses the level so everyone can refocus. It does not discard cards or cost a Life.",
      request_star: "Request 🌟 starts a unanimous vote. No value or private card is revealed.",
      vote_star: "Vote Yes or No on the requested 🌟. The star is used only when every seat agrees.",
      next_round: "Next Round confirms you have read the public level review. Everyone must confirm.",
      hand: "Your private hand. Cards are sorted so the leftmost card is the only legal play.",
    };
    dialog.querySelector("#tmDialogTitle").textContent = "Explain";
    dialog.querySelector("#tmDialogBody").innerHTML = `<p>${esc(texts[target.dataset.tmExplain] || "This control advances the current shared game state.")}</p>`;
    setExplain(false); dialog.showModal();
  }
  function explainAtPoint(event) {
    const direct = event.target.closest?.("[data-tm-explain]");
    if (direct) return direct;
    return [...surface.querySelectorAll("[data-tm-explain]")].find(el => {
      const rect = el.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }) || null;
  }
  function renderHeader() {
    if (header) header.style.display = view ? "flex" : "none";
    document.body.classList.toggle("tm-needs-action", !!view?.legal_actions?.length);
  }
  function renderPlayers() {
    return `<div class="tm-players">${view.players.map(p => `<article class="tm-player ${isSelf(p.player_id) ? "tm-self" : ""}">
      <strong class="tm-player-name">${esc(p.name)}${isSelf(p.player_id) ? " · You" : ""}</strong>
      <small>🂠 ${p.hand_count} card${p.hand_count === 1 ? "" : "s"}</small>
      <span class="tm-player-status">${view.phase === "focus" && view.ready.includes(p.player_id) ? "✓ Ready" : view.phase === "star_vote" && view.star_votes[p.player_id] !== undefined ? (view.star_votes[p.player_id] ? "✓ Agreed" : "✕ Declined") : ""}</span>
    </article>`).join("")}</div>`;
  }
  function renderProgress() {
    return `<div class="tm-progress">${Array.from({length: view.max_level}, (_, i) => `<span class="tm-level ${i + 1 < view.level ? "tm-passed" : ""} ${i + 1 === view.level ? "tm-current" : ""}">${i + 1}</span>`).join("")}</div>`;
  }
  function renderHand() {
    if (!view.hand.length) return `<div class="tm-empty">No cards left in your hand.</div>`;
    return `<div class="tm-hand" data-tm-tip="Your cards are private. The highlighted card is the only legal play.">${view.hand.map((n, i) => `<button type="button" class="tm-card ${i === 0 ? "tm-lowest" : ""}" data-tm-explain="hand" ${i ? "disabled" : ""}><b>${n}</b><small>${i === 0 ? "LOWEST" : "HOLD"}</small></button>`).join("")}</div>`;
  }
  function renderReview() {
    const summary = view.round_summary;
    if (!summary) return "";
    return `<section class="tm-review"><div class="tm-section-title"><h3>LEVEL REVIEW</h3><span>${view.next_ready.length}/${view.players.length} ready</span></div>
      ${summary.players.map(p => `<div class="tm-review-row ${isSelf(p.player_id) ? "tm-self" : ""}"><strong>${esc(playerName(p.player_id))}${isSelf(p.player_id) ? " · You" : ""}</strong><div class="tm-review-cards"><span>Played</span>${p.played.length ? p.played.map(card).join("") : "—"}</div>${p.missed.length ? `<div class="tm-review-cards tm-missed"><span>Missed</span>${p.missed.map(x => card(x)).join("")}</div>` : ""}${p.starred.length ? `<div class="tm-review-cards tm-starred"><span>🌟</span>${p.starred.map(x => card(x)).join("")}</div>` : ""}</div>`).join("")}</section>`;
  }
  function renderDecision() {
    const legal = view.legal_actions || [];
    let content = "";
    const can = type => legal.includes(type);
    if (view.phase === "focus") {
      const reason = {new_level: "Focus on the next level.", mistake: "A mistake happened. Remove distractions and refocus.", pause: "Stop called. Everyone refocuses.", star: "The star effect is complete. Refocus before continuing.", star_declined: "The star vote was declined. Refocus before continuing."}[view.focus_reason] || "Focus together before playing.";
      content = `<div class="tm-decision"><p class="tm-caption">${reason}</p>${can("ready") ? action("🖐️ Ready", "ready", true, "tm-primary", "ready") : `<p class="tm-caption">Waiting for ${view.players.filter(p => !view.ready.includes(p.player_id)).map(p => esc(p.name)).join(", ")}…</p>`}</div>`;
    } else if (view.phase === "playing") {
      const hasHand = view.hand.length > 0;
      content = `<div class="tm-decision">${hasHand ? `<button type="button" class="tm-play tm-primary" data-tm-action="play" data-tm-explain="play" ${can("play") && !busy ? "" : "disabled"}>Play ${view.hand[0]} ↑</button>` : `<p class="tm-caption">Your hand is empty. Watch the team’s remaining cards.</p>`}<div class="tm-actions">${action("Stop & Refocus", "pause", can("pause"), "", "pause")}${view.stars > 0 ? action("Request 🌟", "request_star", can("request_star"), "", "request_star") : ""}</div></div>`;
    } else if (view.phase === "star_vote") {
      const voted = view.star_votes[view.you] !== undefined;
      content = `<div class="tm-decision"><p class="tm-caption">${esc(playerName(view.star_requester))} requested a throwing star. Everyone must agree.</p>${voted ? `<p class="tm-caption">Vote recorded. Waiting for the team…</p>` : `<div class="tm-actions">${action("Agree · use 🌟", "vote_star:yes", true, "tm-primary", "vote_star")}${action("Decline", "vote_star:no", true, "", "vote_star")}</div>`}</div>`;
    } else if (view.phase === "round_end") {
      content = `<div class="tm-decision"><p class="tm-caption">${view.level < view.max_level ? `Level ${view.level} complete. Read the review, then continue.` : "All levels complete!"}</p>${view.level < view.max_level ? action("Next Round", "next_round", can("next_round"), "tm-primary", "next_round") : ""}</div>`;
    } else if (view.phase === "game_over") {
      content = `<div class="tm-decision"><p class="tm-caption">${view.won ? "🏆 The whole team wins!" : "💔 The team ran out of lives."}</p>`;
    }
    return content;
  }
  function renderLog() {
    return `<div class="tm-log">${(view.log || []).slice(-24).reverse().map(e => `<p class="${isSelf(e.player_id) ? "tm-own-log" : ""}">${esc(eventText(e))}</p>`).join("") || "<p>Shared log is empty.</p>"}</div>`;
  }
  function render() {
    if (!view) return;
    renderHeader();
    const topNotice = view.notice ? `<div class="tm-notice ${view.notice.kind === "star" ? "tm-star-notice" : ""}"><b>${view.notice.kind === "mistake" ? "⚠️ Mistake" : view.notice.kind === "star" ? "🌟 Throwing star" : "⏸️ Refocus"}</b><span>${view.notice.kind === "mistake" ? `${view.notice.cards.length} lower card${view.notice.cards.length === 1 ? "" : "s"} discarded. One Life lost.` : view.notice.kind === "star" ? "Each player discarded their lowest card." : "Everyone must press Ready before continuing."}</span></div>` : "";
    const last = view.pile.length ? view.pile[view.pile.length - 1].card : "—";
    surface.innerHTML = `<div class="tm-top"><div class="tm-brand"><span class="tm-eyebrow">COOPERATIVE SYNCHRONIZATION</span><h2>心意相通</h2><p class="tm-subtitle">The Mind · silently play the next number</p></div><div class="tm-stats"><span class="tm-stat">${view.level}/${view.max_level}<small>LEVEL</small></span><span class="tm-stat">❤️ ${view.lives}<small>LIVES</small></span><span class="tm-stat">🌟 ${view.stars}<small>STARS</small></span></div></div>
      ${renderPlayers()}<div class="tm-grid"><main class="tm-main"><section class="tm-table"><div class="tm-stage"><span>${view.phase === "playing" ? "PLAYING TOGETHER" : view.phase.replace("_", " ").toUpperCase()}</span><b>Last card: ${last}</b></div><div class="tm-center"><div class="tm-stack"><small>OPEN PILE</small><b>${last}</b><small>${view.pile.length} played</small></div><div class="tm-center-copy"><h3>${view.phase === "playing" ? "Feel the moment." : view.phase === "focus" ? "Get in sync." : view.phase === "star_vote" ? "One team, one decision." : view.won ? "Together, we did it." : view.phase === "game_over" ? "The run is over." : "Review the level."}</h3><p>${view.phase === "playing" ? "No turns. No countdown. Play only your lowest card when it feels right." : "Keep every card value private."}</p></div></div>${topNotice}${renderDecision()}</section><section class="tm-hand-area"><div class="tm-section-title"><h3>YOUR HAND · PRIVATE</h3><span>${view.hand.length} card${view.hand.length === 1 ? "" : "s"}</span></div>${renderHand()}</section>${view.phase === "round_end" || view.phase === "game_over" ? renderReview() : ""}</main><aside class="tm-aside"><div class="tm-section-title"><h3>LEVEL TRACK</h3><span>🖐️ ${view.ready.length}/${view.players.length}</span></div>${renderProgress()}<div class="tm-section-title"><h3>SHARED LOG</h3><span>public</span></div>${renderLog()}</aside></div>`;
    surface.querySelectorAll("[data-tm-tip]").forEach(el => { el.addEventListener("pointerover", e => { if (e.pointerType === "mouse") showTip(el); }); el.addEventListener("pointerout", hideTip); el.addEventListener("focusin", () => showTip(el, true)); el.addEventListener("focusout", hideTip); });
  }
  function submit(fields) {
    if (busy || !view) return;
    busy = true; render();
    sendAction({...fields, game_token: view.game_token, window_id: view.window_id});
    clearTimeout(busyTimer); busyTimer = setTimeout(() => { busy = false; render(); }, 4000);
  }
  surface.addEventListener("click", event => {
    const button = event.target.closest("button[data-tm-action]");
    if (!button || explaining || busy) return;
    const [type, choice] = button.dataset.tmAction.split(":");
    if (type === "play") submit({type, card: view.hand[0]});
    else if (type === "vote_star") submit({type, agree: choice === "yes"});
    else submit({type});
  });
  document.addEventListener("pointerdown", event => {
    if (!explaining || event.target.closest("#theMindHelpBtn, #theMindExplainBtn, #theMindDialog")) return;
    const target = explainAtPoint(event);
    if (target) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = true; explain(target); }
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || event.target.closest("#theMindHelpBtn, #theMindExplainBtn, #theMindDialog")) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(explainAtPoint(event));
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { setExplain(false); hideTip(); if (dialog.open) dialog.close(); else if (!busy) render(); }
    if (explaining && ["Enter", " "].includes(event.key) && !event.target.closest("#theMindHelpBtn, #theMindExplainBtn, #theMindDialog")) { event.preventDefault(); explain(event.target.closest("[data-tm-explain]")); }
  }, true);
  helpButton?.addEventListener("click", help);
  explainButton?.addEventListener("click", () => setExplain(!explaining));
  dialog?.querySelector("#tmDialogClose")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog?.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip); document.addEventListener("scroll", hideTip, true);
  function clearState() { view = null; signature = null; busy = false; clearTimeout(busyTimer); setExplain(false); hideTip(); document.body.classList.remove("tm-needs-action"); if (dialog?.open) dialog.close(); if (surface) surface.innerHTML = '<p class="tm-waiting">Waiting to start</p>'; }
  window.renderTheMindGameState = data => {
    if (data?.view?.game_id !== "the_mind" || currentGameType !== "the_mind") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
    if (next !== signature) { hideTip(); setExplain(false); }
    if (next !== signature || view?.revision !== data.view.revision) { busy = false; clearTimeout(busyTimer); }
    signature = next; view = data.view; render();
  };
  window.showTheMindHeaderActions = visible => { if (header) header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
  function syncRoom(state) { if (state?.game_type !== "the_mind" || state.status === "lobby") clearState(); }
  function sync() { socket.on("room:state", syncRoom); socket.on("system:error", () => { busy = false; clearTimeout(busyTimer); render(); }); socket.on("disconnect", () => { busy = false; render(); }); if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState); if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "the_mind") window.renderTheMindGameState(lastGameStatePayload); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true}); else sync();
})();
