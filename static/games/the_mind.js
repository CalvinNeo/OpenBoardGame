(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const panel = byId("theMindPanel");
  const surface = byId("tmSurface");
  const header = byId("theMindHeaderActions");
  const helpButton = byId("theMindHelpBtn");
  const explainButton = byId("theMindExplainBtn");
  const tooltip = byId("tmTooltip");
  if (!panel || !surface) return;

  let view = null;
  let signature = null;
  let pending = false;
  let pendingTimer = null;
  let logOpen = false;
  let tipTimer = null;
  let pointerStart = null;
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

  const THE_MIND_HELP_CONFIG = {
    gameId: "the_mind",
    title: { zh: "心意相通 · The Mind", en: "The Mind" },
    basic: {
      win: {
        zh: "全队把所有关卡的牌按从小到大全部打完，就算共同获胜。",
        en: "The whole team wins together by clearing every level, playing all cards from the lowest to the highest."
      },
      turn: {
        zh: "这里没有回合顺序，所有人按下 Ready(🖐️) 之后，任何人都可以随时打出自己手里最小的那张牌。",
        en: "There is no turn order here. Once every seat has pressed Ready (🖐️), anyone may play their own lowest card whenever it feels right."
      },
      key: {
        zh: "牌面全程保密，你要凭感觉判断队友手里还有没有更小的牌，而且绝不能开口报数或者约定暗号。",
        en: "Card values stay private, so you have to sense whether a teammate still holds something lower, and you must never say numbers aloud or agree on secret signals."
      }
    },
    sections: [
      {
        id: "focus",
        label: { zh: "发牌与专注", en: "Dealing and focus" },
        html: {
          zh: "<p>第 n 关开始时，每位玩家会拿到 n 张只有自己看得见的牌，数字取自 1 到 100。</p>"
            + "<p>所有人先按 Ready(🖐️) 表示自己已经专注，等每个座位都准备好，这一关才真正开始，全程没有任何倒计时。</p>"
            + "<p>出现失误、有人叫停或者用掉一颗飞星(🌟) 之后，全队都要重新按一次 Ready(🖐️) 才能继续。</p>",
          en: "<p>At level n every player receives n cards that only they can see, drawn from the numbers 1 to 100.</p>"
            + "<p>Everyone first presses Ready (🖐️) to confirm they are focused, and the level only begins once every seat is ready. There is no countdown at any point.</p>"
            + "<p>After a mistake, a Stop (⏸️) or a spent Throwing star (🌟), the whole team presses Ready (🖐️) again before play continues.</p>"
        }
      },
      {
        id: "play",
        label: { zh: "出牌与失误", en: "Playing and mistakes" },
        html: {
          zh: "<p>你只能打出手里最小的那张牌，服务器会替全队检查顺序。</p>"
            + "<p>如果这时还有别人手里握着更小的牌，就算出现一次失误：这些更小的牌会全部明着弃掉，全队失去一点生命(❤️)，然后所有人重新专注，继续打同一关。</p>"
            + "<p>任何人都可以按 Stop(⏸️) 暂停本关，让全队重新集中注意力。它不会弃掉任何牌，也不消耗生命(❤️)。</p>",
          en: "<p>You may only play the lowest card in your hand, and the server checks the order for the whole team.</p>"
            + "<p>If somebody still holds a lower card, that counts as a mistake. Every lower card is discarded face up, the team loses one Life (❤️), and everyone refocuses before the same level continues.</p>"
            + "<p>Any player may press Stop (⏸️) to pause the level and let the team settle again. It discards nothing and costs no Life (❤️).</p>"
        }
      },
      {
        id: "star",
        label: { zh: "飞星表决", en: "Throwing star vote" },
        html: {
          zh: "<p>任何人都可以申请一颗飞星(🌟)，申请者自动算作同意，其余座位都要表态。</p>"
            + "<p>只要有一个人拒绝，这次申请就作废，不会消耗飞星(🌟)，全队重新专注即可。</p>"
            + "<p>全票通过时会用掉一颗飞星(🌟)，每位玩家都把自己手里最小的牌明着弃掉。飞星(🌟) 最多持有 3 颗。</p>",
          en: "<p>Any player may request a Throwing star (🌟). The requester counts as agreeing, and every other seat has to vote.</p>"
            + "<p>A single decline cancels the request. No Throwing star (🌟) is spent and the team simply refocuses.</p>"
            + "<p>When every seat agrees, one Throwing star (🌟) is spent and each player discards their lowest card face up. The team can hold at most 3 Throwing stars (🌟).</p>"
        }
      },
      {
        id: "rewards",
        label: { zh: "生命与关卡奖励", en: "Lives and level rewards" },
        html: {
          zh: "<p>生命(❤️) 的初始数量等于玩家人数，上限是 5 点。生命(❤️) 归零时，本次挑战立刻失败。</p>"
            + "<p>飞星(🌟) 初始为 1 颗，上限是 3 颗。</p>"
            + "<p>通过第 2、5、8 关各奖励一颗飞星(🌟)，通过第 3、6、9 关各奖励一点生命(❤️)，已经到上限时奖励会跳过。</p>"
            + "<p>两人玩 12 关，三人玩 10 关，四人玩 8 关。打完最后一关，全队共同获胜。</p>",
          en: "<p>Lives (❤️) start equal to the number of players and are capped at 5. Reaching zero Lives (❤️) ends the run at once.</p>"
            + "<p>Throwing stars (🌟) start at 1 and are capped at 3.</p>"
            + "<p>Clearing levels 2, 5 and 8 rewards one Throwing star (🌟), while clearing levels 3, 6 and 9 rewards one Life (❤️). A reward is skipped when you already sit at the cap.</p>"
            + "<p>Two players play 12 levels, three play 10 and four play 8. Clearing the final level wins the run for the whole team.</p>"
        }
      },
      {
        id: "online",
        label: { zh: "回顾与线上约定", en: "Review and online rules" },
        html: {
          zh: "<p>每一关结束后牌桌会停在本关回顾，你可以看到每个人打出了什么、因为失误错过了什么、用飞星(🌟) 弃掉了什么。</p>"
            + "<p>看完之后按 Next Round，所有座位都确认后才会发下一关的牌。</p>"
            + "<p>线上版不显示倒计时，也不公开任何人的手牌。请不要报数、倒数或者约定暗号，专注感受队友的节奏就好。</p>",
          en: "<p>When a level ends the table stops on a level review, where you can read what each seat played, what a mistake made them miss, and what a Throwing star (🌟) discarded.</p>"
            + "<p>Press Next Round once you have read it. The next level is only dealt after every seat confirms.</p>"
            + "<p>The online version shows no countdown and never reveals anyone's hand. Do not count down, call out numbers or agree on signals. Just focus and feel the rhythm of your team.</p>"
        }
      }
    ]
  };

  const THE_MIND_EXPLAIN = {
    table: { zh: "整张牌桌。开始之后这里会显示关卡、生命(❤️)、飞星(🌟)、座位和已经打出的牌。", en: "The whole table. Once the run starts it shows the level, Lives (❤️), Throwing stars (🌟), the seats and the cards already played." },
    level: { zh: "当前是第几关。第 n 关每人手里有 n 张牌，全队要把它们按从小到大全部打完。", en: "Which level of the run is being played. At level n every player holds n private cards, and the team must play all of them in ascending order." },
    phase: { zh: "当前阶段。FOCUS 是等待所有人专注，PLAYING 是可以出牌，STAR VOTE 是飞星(🌟) 表决，LEVEL REVIEW 是本关回顾。", en: "The current phase. FOCUS waits for every seat, PLAYING means cards may be played, STAR VOTE is a Throwing star (🌟) ballot and LEVEL REVIEW shows the finished level." },
    lives: { zh: "生命(❤️)。只要有人打出的牌比队友手里最小的牌还大，全队就失去一点。归零时本次挑战结束。", en: "Lives (❤️). The team loses one whenever a played card is higher than a card someone still holds. Zero lives ends the run." },
    stars: { zh: "飞星(🌟)。用掉一颗可以让所有人把手里最小的牌明着弃掉，需要全票同意，最多持有 3 颗。", en: "Throwing stars (🌟). Spend one so every player discards their lowest card face up. Every seat must agree and you can hold at most 3." },
    rail: { zh: "关卡进度条。已经点亮的格子是通过的关卡，最亮的那一格是正在打的关卡。", en: "The level track. Filled segments are cleared levels and the bright segment is the level you are playing now." },
    seats: { zh: "座位。每个座位显示这位玩家手里还剩几张牌、是否按下 Ready(🖐️) 以及飞星(🌟) 投票，你自己的座位会高亮。", en: "The seats. Each seat shows the cards left in hand, the Ready (🖐️) state and star votes. Your own seat is highlighted." },
    pile: { zh: "明牌堆。这里是全队最近打出的一张牌，以及本关已经打出的牌数。", en: "The open pile. It shows the last card the team played and how many cards are on the pile in this level." },
    trail: { zh: "最近打出的牌，按顺序排列并用座位颜色区分，方便所有人跟上全队的节奏。", en: "The most recent plays in order, coloured by seat, so everyone can follow what the team just did." },
    discarded: { zh: "本关明着弃掉的牌。红色来自失误，金色来自飞星(🌟)。", en: "The cards discarded face up in this level. Red ones come from a mistake and gold ones from a Throwing star (🌟)." },
    notice: { zh: "刚刚发生在全队身上的事情，例如一次失误、有人叫停或者用掉了飞星(🌟)。", en: "What just happened to the whole team, such as a mistake, a Stop (⏸️) or a spent Throwing star (🌟)." },
    ready: { zh: "Ready(🖐️) 表示你已经专注，可以开始这一关。出现失误、叫停或者用掉飞星(🌟) 之后需要再按一次。", en: "Ready (🖐️) confirms that you are focused for this level, and you press it again after a mistake, a Stop (⏸️) or a Throwing star (🌟)." },
    play: { zh: "打出你手里最小的那张牌。服务器会替全队检查顺序，并处理随之而来的失误。", en: "Play the lowest card in your hand. The server checks the order and handles a mistake for the whole team." },
    pause: { zh: "Stop(⏸️) 暂停本关，让所有人重新集中注意力。它不会弃掉任何牌，也不消耗生命(❤️)。", en: "Stop (⏸️) pauses the level so everyone can refocus. It discards nothing and costs no Life (❤️)." },
    request_star: { zh: "申请一颗飞星(🌟)。这会发起一次全票表决，并且不会泄露任何牌面。", en: "Request a Throwing star (🌟). This starts a unanimous vote and reveals no card value." },
    vote_star: { zh: "对这次飞星(🌟) 申请表态。只有所有座位都同意，飞星(🌟) 才会被用掉。", en: "Vote on the requested Throwing star (🌟). The star is only spent when every seat agrees." },
    next_round: { zh: "Next Round 表示你已经看完本关回顾。所有座位都确认后才会开始下一关。", en: "Next Round confirms that you have read the level review. The next level starts once every seat confirms." },
    hand: { zh: "你的私有手牌，按从小到大排列。只有高亮的那张最小牌可以打出。", en: "Your private hand, sorted ascending. Only the highlighted lowest card can be played." },
    log: { zh: "本次挑战的公开日志，只记录所有人都能看到的行为，不会出现仍然保密的牌面。", en: "The shared log of public actions in this run. It never contains card values that are still private." },
    review: { zh: "本关回顾：每个人打出了什么、因为失误错过了什么、用飞星(🌟) 弃掉了什么。", en: "The level review: what each seat played, missed through a mistake, or discarded with a Throwing star (🌟)." }
  };

  let tmHelpWidget = null;
  let tmExplainWidget = null;

  function initTheMindHelpExplain() {
    if (tmHelpWidget || typeof window.obgCreateHelp !== "function") return;
    tmHelpWidget = window.obgCreateHelp(THE_MIND_HELP_CONFIG);
    tmExplainWidget = window.obgCreateExplain({
      gameId: "the_mind",
      attribute: "data-tm-explain",
      explanations: THE_MIND_EXPLAIN,
      button: explainButton,
      root: () => panel,
      bypass: ["#theMindHelpBtn", "#theMindExplainBtn"]
    });
    helpButton?.addEventListener("click", () => {
      tmExplainWidget?.exit();
      tmHelpWidget.open();
    });
    explainButton?.addEventListener("click", () => tmExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheMindHelpExplain, {once: true});
  } else {
    initTheMindHelpExplain();
  }

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
    if (!target?.dataset.tmTip || document.body.classList.contains("obg-explaining")) return;
    hideTip();
    tooltip.textContent = target.dataset.tmTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, bounds.left)) + "px";
    tooltip.style.top = Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, bounds.bottom + 8)) + "px";
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
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
      + '<span class="tm-phase' + (view.phase === "playing" ? " tm-phase-live" : "") + '" tabindex="0" data-tm-explain="phase" data-tm-tip="'
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
    if (!view || pending || !connected() || !view.legal_actions.includes(fields.type)) return;
    pending = true;
    render();
    sendAction({...fields, game_token: view.game_token, window_id: view.window_id});
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 4000);
  }

  surface.addEventListener("click", event => {
    const target = event.target.closest("button[data-tm-action]");
    if (!target) return;
    const [type, choice] = target.dataset.tmAction.split(":");
    if (type === "play") submit({type, card: view.hand[0]});
    else if (type === "vote_star") submit({type, agree: choice === "yes"});
    else submit({type});
  });

  document.addEventListener("pointerdown", event => {
    touchMode = event.pointerType !== "mouse";
    if (!view) return;
    pointerStart = {
      x: event.clientX, y: event.clientY, id: event.pointerId, moved: false,
      target: event.target.closest?.("[data-tm-tip]"),
      touch: event.pointerType !== "mouse"
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
    if (start.touch && start.target) showTip(start.target, true);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hideTip();
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
  function clearState() {
    view = null;
    signature = null;
    pending = false;
    logOpen = false;
    pointerStart = null;
    clearTimeout(pendingTimer);
    tmExplainWidget?.exit();
    hideTip();
    document.body.classList.remove("tm-needs-action");
    surface.innerHTML = '<p class="tm-waiting" data-tm-explain="table">Waiting to start</p>';
  }

  window.renderTheMindGameState = data => {
    if (data?.view?.game_id !== "the_mind" || currentGameType !== "the_mind") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = data.room_id + ":" + data.view.game_token + ":" + data.view.window_id + ":" + data.view.you;
    if (next !== signature) { hideTip(); tmExplainWidget?.exit(); }
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
