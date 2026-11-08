(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const panel = byId("theMindPanel");
  const surface = byId("tmSurface");
  const header = byId("theMindHeaderActions");
  const helpButton = byId("theMindHelpBtn");
  const explainButton = byId("theMindExplainBtn");
  const dialog = byId("theMindDialog");
  const tooltip = byId("tmTooltip");
  if (!panel || !surface) return;

  let view = null;
  let signature = null;
  let pending = false;
  let pendingTimer = null;
  let explaining = false;
  let logOpen = false;
  let tipTimer = null;
  let pointerStart = null;
  let blockedClick = null;
  let returnFocus = null;
  let touchMode = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const connected = () => typeof socket === "undefined" || socket.connected;
  const can = type => !!view && (view.legal_actions || []).includes(type);
  const seatIndex = pid => Math.max(0, (view?.players || []).findIndex(entry => entry.player_id === pid));
  const seatClass = pid => "tm-seat-" + (seatIndex(pid) % 4);
  const member = pid => (view?.players || []).find(entry => entry.player_id === pid);
  const playerName = pid => member(pid)?.name || "Player";
  const isSelf = pid => pid === view?.you;
  const count = (total, word) => total + " " + word + (total === 1 ? "" : "s");
  const PHASES = {focus: "FOCUS", playing: "PLAYING", star_vote: "STAR VOTE", round_end: "LEVEL REVIEW", game_over: "GAME OVER"};

  const EXPLAIN = {
    level: "Level n of the run. At level n every player holds n private cards, and the team must play all of them in ascending order.",
    lives: "Lives (❤️). The team loses one whenever a played card is higher than a card someone still holds. Zero lives ends the run.",
    stars: "Throwing stars (🌟). Spend one so every player discards their lowest card face up. Every seat must agree. Maximum 3.",
    rail: "Level track. Filled segments are cleared levels; the bright segment is the level you are playing now.",
    seats: "Seats. Each seat shows cards left in hand, Ready (🖐️) state and star votes. Your own seat is highlighted.",
    pile: "Open pile. The last card the team played and how many cards are on the pile in this level.",
    trail: "Recent plays in order, coloured by seat, so everyone can follow what the team just did.",
    discarded: "Cards discarded face up in this level: red came from a mistake, gold from a throwing star.",
    notice: "What just happened to the whole team.",
    ready: "Ready (🖐️) confirms that you are focused for this level, or again after a mistake, a Stop or a throwing star.",
    play: "Play the lowest card in your hand. The server checks the order and handles a mistake for the whole team.",
    pause: "Stop (⏸️) pauses the level so everyone can refocus. It discards nothing and costs no Life (❤️).",
    request_star: "Request a Throwing star (🌟). This starts a unanimous vote and reveals no card value.",
    vote_star: "Vote on the requested Throwing star (🌟). The star is spent only when every seat agrees.",
    next_round: "Next Round confirms that you have read the level review. The next level starts once every seat confirms.",
    hand: "Your private hand, sorted ascending. Only the highlighted lowest card can be played.",
    log: "Shared log of public actions in this run. It never contains card values that are still private.",
    review: "Level review: what each seat played, missed through a mistake, or discarded with a throwing star."
  };

  const pips = (icon, total) => total > 0
    ? '<span class="tm-pips">' + icon.repeat(total) + "</span>"
    : '<span class="tm-pips-empty">—</span>';
  const stat = (value, label, key, tip) =>
    '<span class="tm-stat" tabindex="0" data-tm-explain="' + key + '" data-tm-tip="' + esc(tip) + '">' + value + "<small>" + label + "</small></span>";
  const chip = (entry, extra) =>
    '<span class="tm-chip ' + seatClass(entry.player_id) + (extra ? " " + extra : "") + '">' + entry.card + "</span>";
  const button = (label, type, enabled, extra, key) =>
    '<button type="button" class="tm-btn ' + (extra || "") + '" data-tm-action="' + type + '" data-tm-explain="' + key + '"'
    + (enabled && !pending ? "" : " disabled") + ">" + label + "</button>";

  function eventText(entry) {
    const who = playerName(entry.player_id);
    if (entry.kind === "play") return who + " played " + entry.card + ".";
    if (entry.kind === "mistake") return "Mistake: " + count(entry.cards.length, "lower card") + " discarded. ❤️ Life lost.";
    if (entry.kind === "star") return "🌟 Throwing star used; every seat discarded its lowest card.";
    if (entry.kind === "pause") return who + " called Stop (⏸️). Everyone refocuses.";
    if (entry.kind === "request_star") return who + " requested a Throwing star (🌟).";
    if (entry.kind === "star_declined") return who + " declined the Throwing star (🌟).";
    if (entry.kind === "new_level") return "Level " + entry.level + " begins.";
    if (entry.kind === "level_complete") return "Level " + entry.level + " complete.";
    if (entry.kind === "victory") return "All levels complete. The team wins!";
    if (entry.kind === "defeat") return "The team ran out of lives.";
    return "The team updated the table.";
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.hidden = true;
  }

  function showTip(target, autoHide) {
    if (!target?.dataset.tmTip || explaining || dialog.open) return;
    hideTip();
    tooltip.textContent = target.dataset.tmTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, bounds.left)) + "px";
    tooltip.style.top = Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, bounds.bottom + 8)) + "px";
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }

  function setExplain(enabled) {
    explaining = enabled;
    hideTip();
    surface.classList.toggle("tm-explaining", enabled);
    explainButton?.setAttribute("aria-pressed", String(enabled));
  }

  function openDialog(title, html) {
    returnFocus = document.activeElement;
    dialog.querySelector("#tmDialogTitle").textContent = title;
    dialog.querySelector("#tmDialogBody").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }

  function showHelp() {
    openDialog("Help · 心意相通 / The Mind", [
      "<p>🎯 <b>Goal</b> — clear every level together by playing cards 1–100 in ascending order, without talking.</p>",
      "<h3>🖐️ Ready</h3>",
      "<p>At level <b>n</b> every player receives n private cards. Everyone presses Ready (🖐️) to focus; once all seats are ready, anyone may play. There are no turns and no countdown.</p>",
      "<h3>▶️ Play</h3>",
      "<p>You may only play the lowest card in your hand. If someone still holds a lower card, the team loses one Life (❤️) and every lower card is discarded face up. Then everyone focuses again and the same level continues.</p>",
      "<h3>⏸️ Stop</h3>",
      "<p>Any player may call Stop (⏸️) to pause the level and refocus. It discards nothing and costs no Life (❤️).</p>",
      "<h3>🌟 Throwing star</h3>",
      "<p>Any player may request a Throwing star (🌟). Every seat must agree and a single decline cancels it. If approved, one star is spent and each player discards their lowest card face up. Maximum 3 stars.</p>",
      "<h3>❤️ Lives and rewards</h3>",
      "<p>Levels 2 / 5 / 8 reward a Throwing star (🌟); levels 3 / 6 / 9 reward a Life (❤️), maximum 5. Two players play 12 levels, three play 10, four play 8. Zero lives ends the run.</p>",
      "<h3>Online notes</h3>",
      "<p>Card values stay private and there is no countdown. Never share values, count down, or agree on secret signals. Use Explain to inspect any control; press Esc or click outside a dialog to close it.</p>"
    ].join(""));
  }

  function explain(target) {
    const description = EXPLAIN[target?.dataset.tmExplain];
    if (!description) return;
    openDialog("Explain", "<p>" + esc(description) + "</p>");
    setExplain(false);
  }

  function explainAtPoint(event) {
    const direct = event.target.closest?.("[data-tm-explain]");
    if (direct) return direct;
    return [...surface.querySelectorAll("[data-tm-explain]")].find(node => {
      const bounds = node.getBoundingClientRect();
      return bounds.width && bounds.height && event.clientX >= bounds.left && event.clientX <= bounds.right
        && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    }) || null;
  }

  function renderHeader() {
    if (header) header.style.display = "flex";
    const active = !!view && connected() && !pending && (view.legal_actions || []).length > 0;
    document.body.classList.toggle("tm-needs-action", active);
  }

  function renderBar() {
    const phaseTip = {
      focus: "Focus phase: every seat must press Ready (🖐️) before anyone may play.",
      playing: "Playing phase: anyone may play their lowest card whenever it feels right.",
      star_vote: "Star vote: play is frozen until every seat votes on the Throwing star (🌟).",
      round_end: "Level review: read the result, then every seat confirms Next Round.",
      game_over: "The run is over."
    }[view.phase] || "Current phase of the level.";
    return '<div class="tm-bar">'
      + stat("<b>" + view.level + "/" + view.max_level + "</b>", "LEVEL", "level",
        "Level " + view.level + " of " + view.max_level + ". At level n every player holds n cards.")
      + stat(pips("❤️", view.lives), "LIVES", "lives",
        "Lives (❤️) left: " + view.lives + ". One is lost whenever a played card is higher than a card someone still holds.")
      + stat(pips("🌟", view.stars), "STARS", "stars",
        "Throwing stars (🌟) left: " + view.stars + ". Spend one so every player discards their lowest card.")
      + '<span class="tm-phase' + (view.phase === "playing" ? " tm-phase-live" : "") + '" tabindex="0" data-tm-tip="'
      + esc(phaseTip) + '">' + (PHASES[view.phase] || "TABLE") + "</span></div>";
  }

  function renderRail() {
    const segments = Array.from({length: view.max_level}, (unused, index) => {
      const level = index + 1;
      const state = level < view.level ? "tm-done" : level === view.level ? "tm-now" : "";
      return '<i class="' + state + '"></i>';
    }).join("");
    return '<div class="tm-rail" tabindex="0" data-tm-explain="rail" data-tm-tip="'
      + esc("Level track: " + (view.level - 1) + " cleared, now playing level " + view.level + " of " + view.max_level + ".")
      + '">' + segments + "</div>";
  }

  function renderSeats() {
    const seats = view.players.map(entry => {
      let state = "";
      let waiting = false;
      if (view.phase === "focus") {
        const ready = view.ready.includes(entry.player_id);
        state = ready ? "✓ Ready" : "🖐️ Focusing";
        waiting = !ready;
      } else if (view.phase === "star_vote") {
        const vote = view.star_votes[entry.player_id];
        state = vote === undefined ? "… Voting" : vote ? "✓ Agreed" : "✕ Declined";
        waiting = vote === undefined;
      } else if (view.phase === "round_end") {
        const done = view.next_ready.includes(entry.player_id);
        state = done ? "✓ Confirmed" : "… Reading";
        waiting = !done;
      } else if (view.phase === "game_over") {
        state = view.won ? "🏆 Winner" : "💔 Out";
      }
      return '<article class="tm-seat ' + seatClass(entry.player_id) + (isSelf(entry.player_id) ? " tm-self" : "") + '">'
        + '<span class="tm-seat-dot"></span>'
        + '<strong class="tm-seat-name">' + esc(entry.name) + (isSelf(entry.player_id) ? " · You" : "")
        + (entry.is_bot ? " 🤖" : "") + "</strong>"
        + '<span class="tm-seat-line"><span><i class="tm-cardicon"></i>' + count(entry.hand_count, "card") + "</span>"
        + (state ? '<span class="tm-seat-state' + (waiting ? " tm-wait" : "") + '">' + state + "</span>" : "")
        + "</span></article>";
    }).join("");
    return '<div class="tm-seats" data-tm-explain="seats">' + seats + "</div>";
  }

  function renderNotice() {
    const notice = view.notice;
    if (!notice) return "";
    if (notice.kind === "mistake") {
      return '<div class="tm-notice" data-tm-explain="notice"><b>⚠️ Mistake</b><span>'
        + esc(playerName(notice.played.player_id)) + " played " + notice.played.card + ", so "
        + count(notice.cards.length, "lower card") + " were discarded. One Life (❤️) lost.</span>"
        + '<div class="tm-chips">' + notice.cards.map(entry => chip(entry, "tm-missed")).join("") + "</div></div>";
    }
    if (notice.kind === "star") {
      return '<div class="tm-notice tm-notice-star" data-tm-explain="notice"><b>🌟 Throwing star used</b>'
        + "<span>Every seat discarded its lowest card.</span>"
        + '<div class="tm-chips">' + notice.cards.map(entry => chip(entry, "tm-starred")).join("") + "</div></div>";
    }
    return '<div class="tm-notice tm-notice-pause" data-tm-explain="notice"><b>'
      + (notice.kind === "star_declined" ? "✕ Star declined" : "⏸️ Stop") + "</b><span>"
      + esc(playerName(notice.player_id))
      + (notice.kind === "star_declined"
        ? " declined, so no star was spent. Refocus to continue."
        : " paused the level. Everyone refocuses.")
      + "</span></div>";
  }

  function renderFelt() {
    const pile = view.pile || [];
    const last = pile.length ? pile[pile.length - 1].card : "—";
    const recent = pile.slice(-8);
    const discarded = view.discarded || [];
    const shown = discarded.slice(-8);
    const trail = recent.length
      ? recent.map((entry, index) => chip(entry, index === recent.length - 1 ? "tm-chip-last" : "")).join("")
      : '<span class="tm-more">No card played yet.</span>';
    const discardChips = shown.length
      ? shown.map(entry => chip(entry, entry.reason === "star" ? "tm-starred" : "tm-missed")).join("")
        + (discarded.length > shown.length ? '<span class="tm-more">+' + (discarded.length - shown.length) + " more</span>" : "")
      : '<span class="tm-more">Nothing discarded.</span>';
    return '<section class="tm-felt" data-tm-explain="pile">'
      + '<div class="tm-pile" tabindex="0" data-tm-tip="' + esc("Open pile: the last card played by the team this level.")
      + '"><small>OPEN PILE</small><b>' + last + "</b><small>" + count(pile.length, "card") + " played</small></div>"
      + '<div class="tm-felt-info">'
      + '<div class="tm-row" data-tm-explain="trail"><span class="tm-label">RECENT PLAYS</span>'
      + '<div class="tm-chips" tabindex="0" data-tm-tip="' + esc("Recent plays in order, coloured by seat.") + '">' + trail + "</div></div>"
      + '<div class="tm-row" data-tm-explain="discarded"><span class="tm-label">DISCARDED</span>'
      + '<div class="tm-chips" tabindex="0" data-tm-tip="' + esc("Face-up discards: red from a mistake, gold from a throwing star.") + '">' + discardChips + "</div></div>"
      + renderNotice()
      + "</div></section>";
  }

  function renderReview() {
    const summary = view.round_summary;
    if (!summary || (view.phase !== "round_end" && view.phase !== "game_over")) return "";
    const reward = summary.reward;
    const rewardRow = !reward ? ""
      : reward.amount > 0
        ? '<div class="tm-reward">' + (reward.resource === "stars" ? "🌟" : "❤️") + " Reward: +1 "
          + (reward.resource === "stars" ? "Throwing star (🌟)" : "Life (❤️)") + "</div>"
        : '<div class="tm-reward">' + (reward.resource === "stars" ? "🌟" : "❤️") + " Reward skipped: already at the maximum.</div>";
    const rows = summary.players.map(entry => {
      const row = (label, cards, extra) => cards.length
        ? '<div class="tm-chips"><span class="tm-label">' + label + "</span>"
          + cards.map(card => '<span class="tm-chip ' + (extra || "") + '">' + card + "</span>").join("") + "</div>"
        : "";
      return '<div class="tm-review-row ' + seatClass(entry.player_id) + (isSelf(entry.player_id) ? " tm-self" : "") + '">'
        + "<strong>" + esc(playerName(entry.player_id)) + (isSelf(entry.player_id) ? " · You" : "") + "</strong>"
        + row("PLAYED", entry.played)
        + row("MISSED", entry.missed, "tm-missed")
        + row("🌟 STAR", entry.starred, "tm-starred")
        + "</div>";
    }).join("");
    return '<section class="tm-review" data-tm-explain="review"><div class="tm-subhead"><h3>LEVEL '
      + summary.level + " REVIEW</h3><span>"
      + (summary.lost_lives || summary.stars_used
        ? "❤️ −" + summary.lost_lives + " · 🌟 " + summary.stars_used + " used"
        : "No Life (❤️) lost")
      + "</span></div>"
      + rewardRow + rows + "</section>";
  }

  function renderAction() {
    if (view.phase === "focus") {
      const reason = {
        new_level: "Focus on level " + view.level + ".",
        mistake: "A mistake happened. Remove distractions and refocus.",
        pause: "Stop was called. Everyone refocuses.",
        star: "The throwing star is resolved. Refocus before continuing.",
        star_declined: "The star vote was declined. Refocus before continuing."
      }[view.focus_reason] || "Focus together before playing.";
      const waiting = view.players.filter(entry => !view.ready.includes(entry.player_id)).map(entry => esc(entry.name));
      return '<div class="tm-action" aria-live="polite"><p class="tm-hint">' + reason + "</p>"
        + (can("ready")
          ? button("🖐️ Ready", "ready", true, "tm-primary tm-play", "ready")
          : '<p class="tm-hint">Waiting for ' + (waiting.join(", ") || "the team") + "…</p>")
        + "</div>";
    }
    if (view.phase === "playing") {
      const hasHand = view.hand.length > 0;
      return '<div class="tm-action" aria-live="polite">'
        + (hasHand
          ? button("▶️ Play " + view.hand[0], "play", can("play"), "tm-primary tm-play", "play")
          : '<p class="tm-hint">Your hand is empty. Watch the cards your team still holds.</p>')
        + '<div class="tm-btnrow">'
        + button("⏸️ Stop", "pause", can("pause"), "", "pause")
        + (view.stars > 0 ? button("🌟 Request star", "request_star", can("request_star"), "", "request_star") : "")
        + "</div></div>";
    }
    if (view.phase === "star_vote") {
      const voted = view.star_votes[view.you] !== undefined;
      const waiting = view.players.filter(entry => view.star_votes[entry.player_id] === undefined).map(entry => esc(entry.name));
      return '<div class="tm-action" aria-live="polite"><p class="tm-hint">'
        + esc(playerName(view.star_requester)) + " requested a Throwing star (🌟). Every seat must agree.</p>"
        + (voted
          ? '<p class="tm-hint">Your vote is recorded. Waiting for ' + (waiting.join(", ") || "the team") + "…</p>"
          : '<div class="tm-btnrow">'
            + button("🌟 Agree", "vote_star:yes", true, "tm-primary", "vote_star")
            + button("✕ Decline", "vote_star:no", true, "", "vote_star")
            + "</div>")
        + "</div>";
    }
    if (view.phase === "round_end") {
      return '<div class="tm-action" aria-live="polite"><p class="tm-hint">Level ' + view.level
        + " cleared. Read the review, then continue. (" + view.next_ready.length + "/" + view.players.length
        + " confirmed)</p>"
        + button("Next Round", "next_round", can("next_round"), "tm-primary tm-play", "next_round") + "</div>";
    }
    if (view.phase === "game_over") {
      return '<div class="tm-action" aria-live="polite"><div class="tm-banner' + (view.won ? "" : " tm-lost") + '">'
        + (view.won ? "🏆 The whole team wins! Every level is cleared." : "💔 The team ran out of lives.")
        + "</div></div>";
    }
    return "";
  }

  function renderHand() {
    if (!view.hand.length) {
      if (view.phase === "round_end" || view.phase === "game_over") return "";
      return '<section class="tm-hand-area" data-tm-explain="hand"><div class="tm-subhead"><h3>YOUR HAND · PRIVATE</h3>'
        + "<span>0 cards</span></div>"
        + '<div class="tm-empty">No cards left in your hand. Keep following the table.</div></section>';
    }
    const cards = view.hand.map((card, index) =>
      '<div class="tm-card' + (index === 0 ? " tm-lowest" : "") + '"><b>' + card + "</b><small>"
      + (index === 0 ? "PLAY" : "HOLD") + "</small></div>").join("");
    return '<section class="tm-hand-area" data-tm-explain="hand"><div class="tm-subhead"><h3>YOUR HAND · PRIVATE</h3>'
      + "<span>" + count(view.hand.length, "card") + "</span></div>"
      + '<div class="tm-hand" tabindex="0" data-tm-tip="'
      + esc("Your cards are private. Only the highlighted lowest card can be played.") + '">' + cards + "</div></section>";
  }

  function renderLog() {
    const entries = (view.log || []).slice(-24).reverse();
    const rows = entries.length
      ? entries.map(entry => '<p class="' + (isSelf(entry.player_id) ? "tm-own" : "") + '">' + esc(eventText(entry)) + "</p>").join("")
      : "<p>The shared log is empty.</p>";
    return '<details class="tm-logbox" data-tm-explain="log"' + (logOpen ? " open" : "") + ">"
      + "<summary><span>SHARED LOG</span><span>" + entries.length + " entries</span></summary>"
      + '<div class="tm-log">' + rows + "</div></details>";
  }

  function render() {
    if (!view) return;
    const logbox = surface.querySelector(".tm-logbox");
    if (logbox) logOpen = logbox.open;
    renderHeader();
    surface.innerHTML = renderBar() + renderRail() + renderSeats()
      + '<div class="tm-body"><div class="tm-main">'
      + renderFelt() + renderReview() + renderAction() + renderHand()
      + '</div><aside class="tm-side">' + renderLog() + "</aside></div>";
  }

  function submit(fields) {
    if (!view || pending || explaining || !connected() || !view.legal_actions.includes(fields.type)) return;
    pending = true;
    render();
    sendAction({...fields, game_token: view.game_token, window_id: view.window_id});
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 4000);
  }

  surface.addEventListener("click", event => {
    const target = event.target.closest("button[data-tm-action]");
    if (!target || explaining) return;
    const [type, choice] = target.dataset.tmAction.split(":");
    if (type === "play") submit({type, card: view.hand[0]});
    else if (type === "vote_star") submit({type, agree: choice === "yes"});
    else submit({type});
  });

  const exempt = target => target.closest?.("#theMindHelpBtn, #theMindExplainBtn, #theMindDialog");
  document.addEventListener("pointerdown", event => {
    touchMode = event.pointerType !== "mouse";
    if ((!view && !explaining) || exempt(event.target)) return;
    pointerStart = {
      x: event.clientX, y: event.clientY, id: event.pointerId, moved: false,
      target: explaining ? explainAtPoint(event) : event.target.closest?.("[data-tm-tip]"),
      explaining, touch: event.pointerType !== "mouse"
    };
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
    } else if (start.touch && start.target) {
      showTip(start.target, true);
    }
  }, true);
  document.addEventListener("click", event => {
    if (blockedClick && event.detail && performance.now() - blockedClick.at < 700
        && Math.hypot(event.clientX - blockedClick.x, event.clientY - blockedClick.y) < 12) {
      blockedClick = null;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explaining || exempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.detail) explain(event.target.closest?.("[data-tm-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setExplain(false);
      hideTip();
      if (dialog.open) dialog.close();
    }
    if (explaining && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      explain(event.target.closest?.("[data-tm-explain]"));
    }
  }, true);
  panel.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") showTip(event.target.closest?.("[data-tm-tip]"), false);
  });
  panel.addEventListener("pointerout", hideTip);
  panel.addEventListener("focusin", event => showTip(event.target.closest?.("[data-tm-tip]"), touchMode));
  panel.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => { hideTip(); if (pointerStart) pointerStart.moved = true; }, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", () => { hideTip(); pointerStart = null; });
  helpButton?.addEventListener("click", showHelp);
  explainButton?.addEventListener("click", () => setExplain(!explaining));
  dialog?.querySelector("#tmDialogClose")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog?.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  function clearState() {
    view = null;
    signature = null;
    pending = false;
    logOpen = false;
    pointerStart = null;
    blockedClick = null;
    clearTimeout(pendingTimer);
    setExplain(false);
    hideTip();
    document.body.classList.remove("tm-needs-action");
    if (dialog?.open) dialog.close();
    surface.innerHTML = '<p class="tm-waiting">Waiting to start</p>';
  }

  window.renderTheMindGameState = data => {
    if (data?.view?.game_id !== "the_mind" || currentGameType !== "the_mind") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = data.room_id + ":" + data.view.game_token + ":" + data.view.window_id + ":" + data.view.you;
    if (next !== signature) { hideTip(); setExplain(false); }
    if (next !== signature || view?.revision !== data.view.revision) {
      pending = false;
      clearTimeout(pendingTimer);
    }
    signature = next;
    view = data.view;
    render();
  };
  window.showTheMindHeaderActions = visible => {
    if (header) header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };

  function syncRoom(state) {
    if (state?.game_type !== "the_mind" || state.status === "lobby") clearState();
  }

  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "the_mind") {
      window.renderTheMindGameState(lastGameStatePayload);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
