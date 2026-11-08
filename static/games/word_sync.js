(() => {
  "use strict";
  const element = suffix => document.getElementById(`wordSync${suffix}`);
  const panel = element("Panel");
  const header = element("HeaderActions");
  const input = element("Word");
  const form = element("Form");
  const tooltip = element("Tooltip");
  const explainButton = element("ExplainBtn");
  let view = null;
  let roomKey = null;
  let signature = null;
  let pending = null;
  let pendingTimer = null;
  let composing = false;
  let pointerStart = null;
  let tipTimer = null;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const freeForAll = () => view.mode === "free_for_all";
  const teamNumber = team => view.teams.findIndex(entry => entry.team_id === team.team_id) + 1;
  const player = playerId => view.players.find(entry => entry.player_id === playerId);
  const winners = () => view.players.filter(member => view.winner.includes(member.player_id));
  const connected = () => socket.connected && roomSessionReady;
  const normalizedDraft = () => input.value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const WORD_SYNC_HELP_CONFIG = {
    gameId: "word_sync",
    title: { zh: "同频共词 · Word Sync", en: "Word Sync" },
    basic: {
      win: {
        zh: "组队模式里两位队友要写出同一个词，用掉的轮数越少排名越高。自由混战里只要和另一位玩家写出同一个词，就立刻一起获胜。",
        en: "In team mode a pair has to write the same word, and needing fewer rounds means a better rank. In free-for-all you win together the moment you write the same word as another player."
      },
      turn: {
        zh: "每一轮你私下写一个词并按 Lock word(🔒)，所有还在猜的人都锁定后一起公开，然后每个人按 Next Round 进入下一轮。",
        en: "Each round you write one word privately and press Lock word (🔒). Every word is revealed together once all remaining players have locked in, and then everyone presses Next Round."
      },
      key: {
        zh: "你唯一能参考的是已经公开的词，所以要猜出队友或者对手心里最可能浮现的那一个词。",
        en: "The revealed words are your only clue, so you have to guess the single word your teammate or your rivals are most likely to think of."
      }
    },
    sections: [
      {
        id: "modes",
        label: { zh: "模式与配对", en: "Modes and pairing" },
        html: {
          zh: "<p>房间创建时选择模式。组队模式支持 2、4、6、8、10 人，自由混战支持 2 到 10 人。</p>"
            + "<p>组队模式下相邻座位自动成为固定队友：1 号和 2 号、3 号和 4 号，依此类推。</p>"
            + "<p>自由混战没有队伍，每个人各自为战，只和其他玩家比谁写得更大众。</p>",
          en: "<p>The mode is chosen when the room is created. Team mode supports 2, 4, 6, 8 and 10 players, while free-for-all supports 2 to 10.</p>"
            + "<p>In team mode adjacent seats become fixed partners: seat 1 with seat 2, seat 3 with seat 4, and so on.</p>"
            + "<p>Free-for-all has no teams. Everyone plays alone and simply competes to write the most obvious word.</p>"
        }
      },
      {
        id: "flow",
        label: { zh: "锁定与公开", en: "Lock and reveal" },
        html: {
          zh: "<p>每一轮，还在猜的玩家私下写一个词。按下 Lock word(🔒) 之后就不能修改，其他人也看不到它。</p>"
            + "<p>等所有还在猜的玩家都锁定，所有词会同时公开给全场。</p>"
            + "<p>公开之后所有人都要按 Next Round，包括已经成功的队伍，全部确认后才会进入下一轮。</p>"
            + "<p>游戏没有倒计时，也没有轮数上限，最后一次公开的结果会一直留在桌面上。</p>",
          en: "<p>Each round the players who are still guessing write one word privately. Once you press Lock word (🔒) it cannot be changed and nobody else can see it.</p>"
            + "<p>As soon as every remaining player has locked a word, all of the words are revealed together.</p>"
            + "<p>After the reveal everybody presses Next Round, including the teams that already matched, and the next round only begins once all of them have confirmed.</p>"
            + "<p>There is no timer and no round limit, and the final reveal stays on the table.</p>"
        }
      },
      {
        id: "team_win",
        label: { zh: "组队模式胜负", en: "Winning in team mode" },
        html: {
          zh: "<p>两位队友写出同一个词时，这一队就算达成 Match(✓)，之后不再写词，只等别的队伍。</p>"
            + "<p>所有队伍都达成之后游戏结束，用掉轮数最少的队伍获胜(🏆)，轮数相同的队伍并列。</p>"
            + "<p>只有两个人时没有对手，可以当作合作挑战，记录自己一共用了几轮。</p>",
          en: "<p>When both teammates write the same word the team scores a Match (✓), stops writing, and simply waits for the other teams.</p>"
            + "<p>The game ends once every team has matched. The team that needed the fewest rounds wins (🏆), and teams that matched in the same round tie.</p>"
            + "<p>With only two players there is no rival, so you can treat it as a cooperative challenge and record how many rounds you needed.</p>"
        }
      },
      {
        id: "ffa_win",
        label: { zh: "自由混战胜负", en: "Winning in free-for-all" },
        html: {
          zh: "<p>自由混战里每个人都是一个独立单位，胜利条件是写出和至少一位其他玩家完全相同的词。</p>"
            + "<p>一旦有两个人以上写出同一个词，游戏立刻结束，这些玩家全部获胜(🏆)，其他人落败。</p>"
            + "<p>如果同时有好几组不同的词各自重复，每一组里的玩家都算获胜，提交先后完全不影响结果。</p>",
          en: "<p>In free-for-all every player stands alone, and you win by writing exactly the same word as at least one other player.</p>"
            + "<p>The moment two or more players write the same word the game ends at once, all of them win (🏆), and everyone else loses.</p>"
            + "<p>If several different words each appear more than once, every player in those groups wins. Submitting early or late never changes the result.</p>"
        }
      },
      {
        id: "same_word",
        label: { zh: "什么算同一个词", en: "What counts as the same word" },
        html: {
          zh: "<p>一个词最多 24 个字符，并且必须至少含有一个字母或者数字。</p>"
            + "<p>比较之前会先统一化：全角和兼容字符转成半角，首尾空格去掉，连续空格合并成一个，字母大小写不计入差别。</p>"
            + "<p>同义词、标点不同、简繁不同都不会自动算作同一个词，而且只有同一轮里写的词才能配对。</p>"
            + "<p>重复使用以前写过的词是允许的，但控制字符和不可见的格式字符会被拒绝。</p>",
          en: "<p>A word is at most 24 characters long and has to contain at least one letter or number.</p>"
            + "<p>Words are normalised before they are compared: full width and compatibility characters become half width, outer spaces are trimmed, runs of spaces collapse into one, and letter case is ignored.</p>"
            + "<p>Synonyms, different punctuation and simplified versus traditional Chinese are never treated as the same word, and only words written in the same round can match.</p>"
            + "<p>Reusing a word you wrote before is allowed, while control characters and invisible formatting characters are rejected.</p>"
        }
      },
      {
        id: "controls",
        label: { zh: "操作与练习", en: "Controls and practice" },
        html: {
          zh: "<p>History 里只有已经公开给所有人的词，最新的排在最前面，你自己的队伍会高亮。</p>"
            + "<p>练习用的 bot 会先写简单的词，之后固定复用上一轮公开过的词。它们看不到任何隐藏提交，也不是真正的语义 AI 队友。</p>"
            + "<p>打开 Explain 之后再点任意控件，可以在不真正行动的情况下查看它的说明。按 Esc 可以关闭对话框或者退出 Explain。</p>",
          en: "<p>History only contains words that have already been revealed to everyone, newest first, with your own team highlighted.</p>"
            + "<p>Practice bots start with simple words and then keep reusing a word from the previous public reveal. They never inspect hidden submissions and are not semantic AI partners.</p>"
            + "<p>Turn on Explain and then tap any control to read what it does without taking a real action. Press Esc to close a dialog or to leave Explain.</p>"
        }
      }
    ]
  };

  const WORD_SYNC_EXPLAIN = {
    round: { zh: "当前是第几轮。一轮指一次同时公开，不是秒钟数，每一轮里还在猜的人都只有一次机会。", en: "Which round is being played. A round counts simultaneous reveals rather than seconds, and every player still guessing gets exactly one attempt in it." },
    word: { zh: "在这里私下写一个词，最多 24 个字符。第一轮可以自由发挥，之后请用已经公开的词作为灵感，重复使用旧词也允许。", en: "Write one word privately here, up to 24 characters. Think freely in round one and afterwards use the revealed words as inspiration. Reusing an old word is allowed." },
    submit: { zh: "Lock word(🔒) 只会提交一次，不会把你的词显示给任何人，提交之后也不能修改。所有还在猜的人都锁定后，所有词会一起公开。", en: "Lock word (🔒) submits once without showing your word to anyone else, and it cannot be changed afterwards. Every word is revealed together once all remaining players have locked in." },
    next_round: { zh: "Next Round 表示你已经看完这一轮的公开结果。所有玩家都确认之后才会进入下一轮，不需要再点一次确认。", en: "Next Round confirms that you have read the reveal. The next round only starts once every player has confirmed, and no second confirmation dialog is needed." },
    pairing: { zh: "相邻座位组成固定队伍：1 + 2、3 + 4、5 + 6，依此类推。在同时公开之前，你只能看到自己锁定的那个词。", en: "Adjacent room seats form fixed pairs: 1 + 2, 3 + 4, 5 + 6, and so on. Before the shared reveal you can only see your own locked word." },
    ranking: { zh: "Match(✓) 表示两位队友写了同一个词。组队模式下轮数越少排名越高，轮数相同则并列。自由混战里只要有人写出重复的词，游戏就结束，写出同一个词的人一起获胜。", en: "Match (✓) means both teammates wrote the same word. In team mode fewer rounds rank higher and equal rounds tie. In free-for-all the game ends as soon as any word repeats, and everyone who wrote it wins together." },
    history: { zh: "History 里只有已经公开给所有人的词，最新的排在最前面，你自己的队伍会高亮。打开它不会泄露任何还没公开的词。", en: "History contains only the words already revealed to everyone, newest first, with your own team highlighted. Opening it never reveals a pending word." },
    free_for_all: { zh: "自由混战没有队伍。每个人每一轮写一个词，只要有两个人写出同一个词，这一轮就立刻结束游戏。", en: "Free-for-all has no teams. Everyone writes one word each round, and the round ends the game the moment two or more players write the same word." }
  };

  let wordSyncHelpWidget = null;
  let wordSyncExplainWidget = null;

  function initWordSyncHelpExplain() {
    if (wordSyncHelpWidget || typeof window.obgCreateHelp !== "function") return;
    wordSyncHelpWidget = window.obgCreateHelp(WORD_SYNC_HELP_CONFIG);
    wordSyncExplainWidget = window.obgCreateExplain({
      gameId: "word_sync",
      attribute: "data-ws-explain",
      explanations: WORD_SYNC_EXPLAIN,
      button: explainButton,
      root: () => panel,
      bypass: ["#wordSyncHelpBtn", "#wordSyncExplainBtn"]
    });
    element("HelpBtn")?.addEventListener("click", () => {
      wordSyncExplainWidget?.exit();
      wordSyncHelpWidget.open();
    });
    explainButton?.addEventListener("click", () => wordSyncExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWordSyncHelpExplain, {once: true});
  } else {
    initWordSyncHelpExplain();
  }

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
    if (!target?.dataset.wsTip || document.body.classList.contains("obg-explaining")) return;
    hideTip();
    tooltip.textContent = target.dataset.wsTip;
    tooltip.hidden = false;
    const bounds = target.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - tooltip.offsetWidth - 8, bounds.left))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, bounds.bottom + 8))}px`;
    tipTimer = setTimeout(hideTip, 3000);
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
    if (!view || pending || composing || !connected() || !view.legal_actions.includes(type)) return;
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
    composing = false;
    input.value = "";
    clearPending();
    setError();
    wordSyncExplainWidget?.exit();
    document.body.classList.remove("ws-needs-action");
    element("Content").hidden = true;
    element("Waiting").hidden = false;
    element("History").open = false;
  }

  document.addEventListener("pointerdown", event => {
    if (!view) return;
    pointerStart = {x: event.clientX, y: event.clientY, id: event.pointerId, moved: false,
      target: event.target.closest?.("[data-ws-tip]"), touch: event.pointerType !== "mouse"};
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
    if (start.touch && start.target) showTip(start.target);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") hideTip();
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

  window.renderWordSyncGameState = data => {
    if (data?.view?.game_id !== "word_sync" || currentGameType !== "word_sync"
        || data.room_id !== currentRoomState?.room_id) return;
    const nextSignature = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
    if (signature !== nextSignature) {
      input.value = "";
      composing = false;
      clearPending();
      setError();
      wordSyncExplainWidget?.exit();
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
