// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const DARE_WORDS_HELP_CONFIG = {
  gameId: "dare_words",
  title: { zh: "胆敢造词 · Dare to Make Words", en: "Dare to Make Words" },
  basic: {
    win: {
      zh: "收走字卡最多的玩家获胜，字卡数量就是分数，并列时共享胜利。",
      en: "Whoever collects the most character cards wins, since each card you take is one point, and a tie is a shared victory."
    },
    turn: {
      zh: "轮到你时翻开 1 张字卡(🀄)，它会接到桌面字列的末尾，然后把翻牌权交给下一位。",
      en: "On your turn you flip one character card (🀄) onto the end of the table row and then hand the flipping duty to the next seat."
    },
    key: {
      zh: "抢答(🗣)不看回合，任何人都能随时发起，但你只能用桌面上已经翻开的字，而且每个字卡在一次词句里最多用一次。",
      en: "Claiming (🗣) ignores turn order and anyone may start one at any time, but you may only use characters already on the table and each card at most once per phrase."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "流程", en: "Flow" },
      html: {
        zh: "<p>牌堆里全是单字卡，把字翻到桌面上，谁先用桌面上的字凑出一句通顺的话，谁就把那些字卡收走。</p>"
          + "<ol>"
          + "<li>翻牌权按座位顺时针轮转，轮到的人翻 1 张字卡(🀄)，接到桌面字列末尾。</li>"
          + "<li>任何人包括刚刚翻牌的人都可以随时发起抢答(🗣)。</li>"
          + "<li>抢答者以外的所有玩家投票，认可(✅)或不认可(❌)。</li>"
          + "<li>结算(📣)之后所有人点 Next 才进入下一轮。</li>"
          + "</ol>"
          + "<p>牌堆可以选择 Full 共 100 张，或者 Short 共 60 张。字卡越少，一局结束得越快。</p>",
        en: "<p>The deck holds nothing but single-character cards. Characters reach the table one at a time, and the first player to build a readable phrase out of them takes those cards.</p>"
          + "<ol>"
          + "<li>The flipping duty rotates clockwise, and the player on duty flips one character card (🀄) onto the end of the table row.</li>"
          + "<li>Anyone, including the player who just flipped, may start a claim (🗣) at any moment.</li>"
          + "<li>Every player except the claimer votes accept (✅) or reject (❌).</li>"
          + "<li>After the result (📣) everyone presses Next before the next round begins.</li>"
          + "</ol>"
          + "<p>The deck comes in Full with 100 cards or Short with 60 cards. A smaller deck simply makes the game shorter.</p>"
      }
    },
    {
      id: "claim",
      label: { zh: "抢答与用字", en: "Claiming" },
      html: {
        zh: "<p>一次合法的抢答至少要用 3 个字，最多 24 个字，而且只能使用汉字，标点、字母和数字都不行。</p>"
          + "<p>词句里的每一个字都必须来自桌面字列，同一个字卡在一次词句里只能用一次，桌上有两张同样的字才可以用两次。</p>"
          + "<p>词句只能靠点桌面字卡(🀄)拼出来，没有任何输入框，手机和电脑都不需要打字。</p>"
          + "<p>点一次字卡就把它接到词句末尾，再点一次同一张卡可以取回；点已选字卡区里的字同样可以取回，点面板空白处清空全部。</p>"
          + "<p>凑够 3 个字且不超过 24 个字时，抢答按钮才会亮起。</p>",
        en: "<p>A legal claim uses at least three characters and at most twenty four, and every one of them must be a Chinese character. Punctuation, letters and digits are rejected.</p>"
          + "<p>Each character in the phrase must come from the table row, and one card can only be spent once per phrase, so using the same character twice needs two copies of it on the table.</p>"
          + "<p>The phrase is built only by tapping the character cards (🀄) on the table. There is no input box, so neither a phone nor a desktop ever needs the keyboard.</p>"
          + "<p>One tap appends a card to the end of the phrase and a second tap on the same card returns it. Tapping a character in the picked area also returns it, and tapping empty space on the panel clears everything.</p>"
          + "<p>The claim button lights up once the phrase has at least three characters and no more than twenty four.</p>"
      }
    },
    {
      id: "vote",
      label: { zh: "表决与结算", en: "Voting and scoring" },
      html: {
        zh: "<p>抢答者以外的所有玩家都要投票。认可(✅)票数多于不认可(❌)票数时抢答才算成立，平票视为不成立。</p>"
          + "<p>抢答成立时，抢答者收走词句用到的全部字卡，每张记 1 分。</p>"
          + "<p>抢答不成立时，字卡留在桌上，抢答者必须等桌面上再翻出 1 张新牌之后才能再次抢答。</p>"
          + "<p>投票期间只显示已投人数，结算(📣)之后才公开每个人的票。结算画面会一直保留到所有人点 Next。</p>",
        en: "<p>Every player except the claimer casts a vote. The claim succeeds only when accept (✅) votes outnumber reject (❌) votes, and a tie counts as a failure.</p>"
          + "<p>A successful claim lets the claimer take every card the phrase used, scoring one point for each.</p>"
          + "<p>A failed claim leaves the cards on the table, and the claimer must wait until one more card is flipped before claiming again.</p>"
          + "<p>During voting only the number of votes cast is visible. Individual votes are revealed in the result (📣), which stays on screen until everyone presses Next.</p>"
      }
    },
    {
      id: "ending",
      label: { zh: "结束与胜负", en: "Ending" },
      html: {
        zh: "<p>牌堆翻完而且桌面上剩下的字不足 3 个时，本局自动结束。</p>"
          + "<p>牌堆已经空了但桌上还够凑词时，可以按结束本局(🏁)提前结算。</p>"
          + "<p>结束时字卡最多的玩家获胜，出现并列时这些人共享胜利。</p>"
          + "<p>本局结束后可以按 Play Again 用同样的牌堆配置立刻再来一局。</p>",
        en: "<p>The game ends automatically once the deck is empty and fewer than three characters remain on the table.</p>"
          + "<p>When the deck is empty but the table can still form a phrase, anyone may press Finish (🏁) to score the game early.</p>"
          + "<p>The player holding the most character cards wins, and several players share the victory when they tie.</p>"
          + "<p>After the game ends you may press Play Again to start a fresh game with the same deck setting.</p>"
      }
    },
    {
      id: "icons",
      label: { zh: "图标速查", en: "Icons" },
      html: {
        zh: "<p>字卡与牌堆(🀄) · 抢答(🗣) · 认可(✅) · 不认可(❌) · 结算(📣) · 结束本局(🏁) · 获胜(🏆) · 当前翻牌玩家(▶) · 机器人(🤖)</p>"
          + "<p>牌堆图标后面的数字是还没翻开的字卡数量，桌面字列标题后面的数字是桌上现有的字卡数量。</p>",
        en: "<p>Cards and deck (🀄) · Claim (🗣) · Accept (✅) · Reject (❌) · Result (📣) · Finish (🏁) · Winner (🏆) · Current flipper (▶) · Bot (🤖)</p>"
          + "<p>The number beside the deck icon counts cards that are still face down, and the number beside the table heading counts the cards currently on the table.</p>"
      }
    }
  ]
};

const DARE_WORDS_EXPLAIN = {
  turn: {
    zh: "当前阶段。翻牌权按座位顺时针轮转，而抢答随时可以发起，不看回合。",
    en: "The current phase. The flipping duty rotates clockwise, while a claim may be started at any time regardless of whose turn it is."
  },
  row: {
    zh: "桌面字列。抢答只能使用这里的字，每张字卡在一次词句里最多用一次。点字卡可以把它加进你的词句。",
    en: "The row of characters on the table. A claim may only use these characters and each card at most once. Tap a card to add it to your phrase."
  },
  flip: {
    zh: "轮到你时翻 1 张字卡，它会接到桌面字列末尾，然后翻牌权交给下一位。",
    en: "Flip one character card onto the end of the table row, then pass the flipping duty to the next seat."
  },
  finish: {
    zh: "牌堆已经翻完时，如果桌面上再也凑不出合法词句，可以结束本局并结算分数。",
    en: "Once the deck is empty and the table can no longer form a legal phrase, end the game and score it."
  },
  claim: {
    zh: "凑出至少 3 个字、只用桌面上的字的词语、短语或短句，就可以抢答。是否通顺由其他玩家投票决定。",
    en: "Claim with a word, phrase or short sentence of at least three characters taken only from the table. The other players vote on whether it reads well."
  },
  phrase: {
    zh: "已选字卡区。点桌面字卡按顺序拼词，这里按顺序显示你选的字和序号；再点一次桌面上的同一张卡、或点这里的字都能取回，点面板空白处清空全部。",
    en: "Your picked cards. Tap table cards to build the phrase in order; this area shows the picked characters with their order. Tap the same table card again or tap a character here to return it, and tap empty space to clear everything."
  },
  claim_btn: {
    zh: "抢答按钮。词句合法时才能按下，抢答之后其他人会投票，认可票更多才算成功。",
    en: "The claim button. It only becomes pressable once the phrase is legal, and after the claim the others vote, with more accept votes needed to succeed."
  },
  vote: {
    zh: "表决区。抢答者以外的所有玩家都要投票，认可票多于不认可票时抢答者收走用到的字卡，否则字卡留在桌上。",
    en: "The voting area. Everyone except the claimer votes, and the claimer takes the cards only when accept votes outnumber reject votes."
  },
  accept: {
    zh: "投认可票，表示你认为这个词句通顺合理。",
    en: "Vote to accept, meaning you find the phrase readable and reasonable."
  },
  reject: {
    zh: "投不认可票，表示你认为这个词句不通顺。",
    en: "Vote to reject, meaning you find the phrase unreadable."
  },
  result: {
    zh: "本轮结算。展示词句、每个人的投票和得分变化，所有玩家点 Next 之后才继续。",
    en: "The result of this round. It shows the phrase, every vote and the score change, and the game continues only after everyone presses Next."
  },
  next: {
    zh: "确认看完结算。所有玩家都点过之后才进入下一轮。",
    en: "Confirm that you have read the result. The next round starts only after every player has pressed it."
  },
  scores: {
    zh: "玩家分数。每人收走的字卡数量就是分数，获胜(🏆)标记本局赢家，翻牌(▶)标记当前翻牌玩家。",
    en: "Player scores. Each card collected is one point, the winner mark (🏆) shows who won, and the flipper mark (▶) shows who flips next."
  },
  history: {
    zh: "抢答记录。按时序列出每一次抢答的词句、抢答者和结果。",
    en: "The claim history, listing every claim in order with its phrase, the claimer and the outcome."
  }
};

let dareWordsHelpWidget = null;
let dareWordsExplainWidget = null;

function initDareWordsHelpExplain() {
  if (dareWordsHelpWidget || typeof window.obgCreateHelp !== "function") return;
  dareWordsHelpWidget = window.obgCreateHelp(DARE_WORDS_HELP_CONFIG);
  dareWordsExplainWidget = window.obgCreateExplain({
    gameId: "dare_words",
    attribute: "data-dw-explain",
    explanations: DARE_WORDS_EXPLAIN,
    button: document.getElementById("dareWordsExplainBtn"),
    root: () => document.getElementById("dareWordsPanel"),
    bypass: ["#dareWordsHelpBtn", "#dareWordsExplainBtn"]
  });
  document.getElementById("dareWordsHelpBtn")?.addEventListener("click", () => {
    dareWordsExplainWidget?.exit();
    dareWordsHelpWidget.open();
  });
  document.getElementById("dareWordsExplainBtn")?.addEventListener("click", () => dareWordsExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDareWordsHelpExplain);
} else {
  initDareWordsHelpExplain();
}

(() => {
  const GAME_ID = "dare_words";
  const id = (name) => document.getElementById(`dareWords${name}`);
  const panel = id("Panel");
  let view = null;
  let activeRoom = null;
  let pending = false;
  let selection = [];
  let tipTimer = null;
  let touchTipGesture = null;
  let configSignature = null;

  const ownId = () => view?.you || (typeof playerId !== "undefined" ? playerId : null);
  const active = () => typeof currentGameType === "undefined" || currentGameType === GAME_ID;
  const connected = () => typeof socket !== "undefined" && socket.connected
    && (typeof roomSessionReady === "undefined" || roomSessionReady);
  const can = (type) => connected() && !pending && Boolean(view?.legal_actions?.includes(type));
  const setText = (name, value) => { const element = id(name); if (element) element.textContent = value; };
  const node = (tag, cls, value) => {
    const element = document.createElement(tag);
    element.className = cls;
    if (value != null) element.textContent = value;
    return element;
  };
  const nameFor = (pid) => view?.players?.find((player) => player.player_id === pid)?.name || pid || "—";
  const rowCards = () => view?.row || [];
  const cardById = (cardId) => rowCards().find((card) => card.card_id === cardId);
  const minChars = () => view?.min_chars || 3;
  const maxChars = () => view?.max_chars || 24;
  const isHan = (character) => /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(character);
  let phraseEmptyNode = null;
  const phraseEmpty = () => {
    if (!phraseEmptyNode) phraseEmptyNode = id("PhraseEmpty");
    return phraseEmptyNode;
  };
  // The phrase is built by tapping table cards only, so the characters are always
  // legal by construction and only the length limits remain as client checks.
  const phraseText = () => selection.map((cardId) => cardById(cardId)?.char || "").join("");

  // Help and Explain now live in the shared widgets above.
  function checkPhrase(text) {
    const characters = (text || "").replace(/\s+/g, "");
    if (!characters.length) return { ok: false, message: "" };
    if (characters.length < minChars()) return { ok: false, message: `至少 ${minChars()} 个字。` };
    if (characters.length > maxChars()) return { ok: false, message: `最多 ${maxChars()} 个字。` };
    for (const character of characters) {
      if (!isHan(character)) return { ok: false, message: "只能用汉字，不能加标点、字母或数字。" };
    }
    const available = new Map();
    rowCards().forEach((card) => available.set(card.char, (available.get(card.char) || 0) + 1));
    for (const character of characters) {
      const left = available.get(character) || 0;
      if (left <= 0) {
        const onTable = rowCards().some((card) => card.char === character);
        return { ok: false, message: onTable ? `「${character}」不够用。` : `「${character}」不在桌面上。` };
      }
      available.set(character, left - 1);
    }
    return { ok: true, message: `✓ ${characters.length} 个字，全部来自桌面` };
  }

  function updateConfig(state) {
    const box = id("ConfigBox");
    const select = id("DeckSelect");
    const visible = state?.game_type === GAME_ID;
    box.classList.toggle("hidden", !visible);
    box.setAttribute("aria-hidden", String(!visible));
    if (!visible) {
      configSignature = null;
      return;
    }
    const config = state.status !== "lobby" && view ? view.config || {} : state.game_config || {};
    const signature = JSON.stringify([state.room_id, config.deck_size || "full"]);
    if (signature !== configSignature) {
      select.value = config.deck_size === "short" ? "short" : "full";
      configSignature = signature;
    }
    select.disabled = !connected() || state.status !== "lobby";
  }

  function renderRow() {
    const container = id("Row");
    const cards = rowCards();
    const claimable = can("claim");
    id("RowEmpty").hidden = cards.length > 0;
    setText("RowCount", `${cards.length} 张`);
    // Rebuild only when the table itself changed. Tapping a card must keep the
    // other buttons alive so fast taps and keyboard focus are not dropped.
    const children = [...container.children];
    const sameOrder = children.length === cards.length
      && cards.every((card, index) => Number(children[index].dataset.cardId) === card.card_id);
    const existing = new Map(sameOrder ? children.map((child) => [Number(child.dataset.cardId), child]) : []);
    if (!sameOrder) container.replaceChildren();
    cards.forEach((card) => {
      let button = existing.get(card.card_id);
      if (!button) {
        button = node("button", "dare-words-card", card.char);
        button.type = "button";
        button.dataset.cardId = String(card.card_id);
        button.setAttribute("aria-label", `字卡 ${card.char}`);
        container.append(button);
      }
      const order = selection.indexOf(card.card_id);
      button.classList.toggle("is-selected", order >= 0);
      button.classList.toggle("is-order", order >= 0);
      if (order >= 0) button.dataset.order = String(order + 1);
      else delete button.dataset.order;
      button.setAttribute("aria-pressed", String(order >= 0));
      button.classList.toggle("is-locked", !claimable && order < 0);
    });
  }

  function renderStatus() {
    const phase = view?.phase;
    const flipper = view?.flipper;
    let status = "等待开始";
    if (view) {
      if (phase === "game_over") {
        const winners = (view.winner || []).map(nameFor);
        status = winners.length ? `🏆 ${winners.join("、")} 获胜` : "🏁 本局结束";
      } else if (phase === "voting") {
        status = view.claim?.is_you ? "等待大家表决…" : `${nameFor(view.claim?.player_id)} 抢答中，请表决`;
      } else if (phase === "reveal") {
        status = "结算完成，点 Next 继续";
      } else if (!view.deck_remaining) {
        status = "牌堆已空 · 只能抢答或结束本局";
      } else if (flipper === ownId()) {
        status = "轮到你翻牌 · 你也可以直接抢答";
      } else {
        status = `${nameFor(flipper)} 翻牌中 · 你可以随时抢答`;
      }
    }
    setText("Status", status);
    id("Status").parentElement.classList.toggle("is-your-turn",
      Boolean(view && view.phase === "flipping" && flipper === ownId()));
    setText("DeckCount", view ? `🀄 牌堆 ${view.deck_remaining} / ${view.deck_total}` : "🀄 牌堆 —");
  }

  function renderFlip() {
    const flip = id("FlipBtn");
    const finish = id("FinishBtn");
    flip.disabled = !can("flip");
    finish.hidden = !view?.legal_actions?.includes("finish_game");
    finish.disabled = !can("finish_game");
    let hint = "";
    if (view) {
      if (view.phase === "flipping" && view.deck_remaining) {
        hint = view.flipper === ownId() ? "轮到你翻 1 张字卡" : `等待 ${nameFor(view.flipper)} 翻牌`;
      } else if (view.phase === "flipping") {
        hint = "牌堆已空";
      }
    }
    setText("FlipHint", hint);
  }

  function renderPhrase(check, claimable) {
    const container = id("Phrase");
    const empty = phraseEmpty();
    container.replaceChildren();
    container.classList.toggle("is-ready", Boolean(check.ok));
    container.classList.toggle("is-locked", !claimable);
    if (!selection.length) {
      empty.hidden = false;
      container.append(empty);
      return;
    }
    empty.hidden = true;
    selection.forEach((cardId, index) => {
      const card = cardById(cardId);
      if (!card) return;
      const pick = node("button", "dare-words-pick", card.char);
      pick.type = "button";
      pick.dataset.cardId = String(cardId);
      pick.dataset.order = String(index + 1);
      pick.setAttribute("aria-label", `移除第 ${index + 1} 个字 ${card.char}`);
      container.append(pick);
    });
  }

  function renderClaim() {
    const button = id("ClaimBtn");
    const feedback = id("Feedback");
    const claimable = can("claim");
    const check = checkPhrase(phraseText());
    renderPhrase(check, claimable);
    button.disabled = !claimable || !check.ok;
    button.textContent = pending ? "…" : "🗣 抢答";
    setText("ClaimHint", selection.length
      ? `已选 ${selection.length} 个字 · 点已选的字可以取回`
      : "点桌面字卡，按顺序拼词");
    if (view && !view.legal_actions?.includes("claim") && view.phase === "flipping") {
      const me = view.players?.find((player) => player.player_id === ownId());
      feedback.classList.remove("is-ok");
      feedback.textContent = rowCards().length < minChars()
        ? `桌面不足 ${minChars()} 张字卡，先翻牌。`
        : me?.blocked ? "抢答失败后需要等桌上再翻出 1 张牌。" : "";
      return;
    }
    feedback.classList.toggle("is-ok", check.ok);
    if (!feedback.dataset.error) feedback.textContent = check.message;
  }

  function renderVote() {
    const section = id("Vote");
    const claim = view?.claim;
    section.hidden = !claim;
    if (!claim) return;
    setText("VoteName", claim.is_you ? "你" : claim.player_name);
    id("VotePhrase").textContent = claim.phrase;
    const accept = id("AcceptBtn");
    const reject = id("RejectBtn");
    const voted = claim.your_vote != null;
    accept.disabled = !can("vote");
    reject.disabled = !can("vote");
    accept.setAttribute("aria-pressed", String(claim.your_vote === true));
    reject.setAttribute("aria-pressed", String(claim.your_vote === false));
    setText("VoteProgress", claim.is_you
      ? `等待其他人表决 ${claim.votes_cast} / ${claim.votes_needed}`
      : voted
        ? `已投票 · 等待其他人 ${claim.votes_cast} / ${claim.votes_needed}`
        : `请表决 ${claim.votes_cast} / ${claim.votes_needed}`);
  }

  function renderResult() {
    const section = id("Result");
    const result = view?.last_result;
    const visible = Boolean(view && result && ["reveal", "game_over"].includes(view.phase));
    section.hidden = !visible;
    if (!visible) return;
    section.classList.toggle("is-win", Boolean(result.accepted));
    section.classList.toggle("is-lose", !result.accepted && !result.ended);
    if (result.ended) {
      setText("ResultTitle", "🏁 本局结束");
      id("ResultPhrase").textContent = "牌堆已空";
      setText("ResultScore", "");
    } else {
      setText("ResultTitle", result.accepted ? "✅ 抢答成功" : "❌ 抢答失败");
      id("ResultPhrase").textContent = `${result.player_name}：${result.phrase}`;
      setText("ResultScore", result.accepted ? `+${result.cards} 张字卡` : "字卡留在桌上");
    }
    const votes = id("ResultVotes");
    votes.replaceChildren();
    if (result.ended) {
      votes.append(node("span", "dare-words-vote-chip", "按字卡数量结算"));
    } else {
      (view.players || []).filter((player) => player.player_id !== result.player_id).forEach((player) => {
        const accepted = result.votes?.[player.player_id];
        const chip = node("span", "dare-words-vote-chip",
          `${player.name} ${accepted ? "✅" : "❌"}`);
        chip.classList.add(accepted ? "is-accept" : "is-reject");
        votes.append(chip);
      });
    }
    const next = id("NextBtn");
    const gameOver = view.phase === "game_over";
    next.textContent = gameOver ? "🔁 Play Again" : pending ? "…" : "Next ▶";
    next.disabled = gameOver ? !can("play_again") : !can("next_round");
    setText("NextHint", gameOver
      ? ""
      : `已确认 ${(view.ready || []).length} / ${(view.players || []).length}`);
  }

  function renderScoreboard() {
    const board = id("Scoreboard");
    board.replaceChildren();
    (view?.players || []).forEach((player) => {
      const chip = node("div", "dare-words-player");
      chip.classList.toggle("is-you", player.is_you);
      chip.classList.toggle("is-flipper", player.is_flipper);
      chip.classList.toggle("is-winner", Boolean(view.game_over && view.winner?.includes(player.player_id)));
      const name = node("div", "dare-words-player-name");
      const marks = [
        player.is_flipper ? "▶" : "",
        view.game_over && view.winner?.includes(player.player_id) ? "🏆" : "",
        player.is_bot ? "🤖" : "",
        player.is_you ? "You" : "",
      ].filter(Boolean).join(" ");
      name.append(node("span", "", `${marks ? marks + " " : ""}${player.name}`));
      chip.append(name, node("span", "dare-words-player-score", String(player.score)));
      board.append(chip);
    });
  }

  function renderHistory() {
    const list = id("History");
    const entries = (view?.history || []).slice().reverse();
    list.replaceChildren();
    setText("HistoryCount", String(entries.length));
    if (!entries.length) {
      list.append(node("div", "dare-words-history-empty", "还没有抢答记录。"));
      return;
    }
    entries.forEach((entry) => {
      const row = node("div", "dare-words-history-row");
      row.append(
        node("span", "dare-words-history-mark", entry.ended ? "🏁" : entry.accepted ? "✅" : "❌"),
        node("span", "dare-words-history-phrase", entry.ended ? "本局结束" : entry.phrase),
        node("span", "dare-words-history-meta",
          entry.ended ? entry.player_name : `${entry.player_name} · ${entry.accepted ? "+" + entry.cards : "0"}`),
      );
      list.append(row);
    });
  }

  function render() {
    updateConfig(typeof currentRoomState === "undefined" ? null : currentRoomState);
    renderStatus();
    renderRow();
    renderFlip();
    renderClaim();
    renderVote();
    renderResult();
    renderScoreboard();
    renderHistory();
  }

  function clearSelection() {
    selection = [];
    id("Feedback").dataset.error = "";
    id("Feedback").textContent = "";
  }

  function send(type, extra = {}) {
    if (!view || !can(type)) return;
    pending = true;
    id("Feedback").dataset.error = "";
    render();
    sendAction({ type, game_token: view.game_token, window_id: view.window_id, ...extra });
  }

  function submitClaim() {
    const phrase = phraseText();
    if (!checkPhrase(phrase).ok) return;
    send("claim", { phrase });
  }

  function hideTip() {
    clearTimeout(tipTimer);
    id("Tooltip").hidden = true;
  }

  const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, label, [role='button']";

  // Interactive elements explain themselves when used, so they never raise a
  // floating tip; only the surrounding static labels do.
  function tipAnchor(target) {
    if (!target || typeof target.closest !== "function") return null;
    if (target.closest(INTERACTIVE_SELECTOR)) return null;
    const anchor = target.closest("[data-dw-tip]");
    return anchor && !anchor.matches(INTERACTIVE_SELECTOR) ? anchor : null;
  }

  function showTip(target) {
    hideTip();
    if (!target?.dataset.dwTip) return;
    const tip = id("Tooltip");
    tip.textContent = target.dataset.dwTip;
    tip.hidden = false;
    const rect = target.getBoundingClientRect();
    const margin = 12;
    const left = Math.max(margin, Math.min(innerWidth - tip.offsetWidth - margin, rect.left));
    const coversControl = (top) => {
      const right = left + tip.offsetWidth;
      const bottom = top + tip.offsetHeight;
      return [...panel.querySelectorAll("button")].some((button) => {
        if (button.contains(target)) return false;
        const other = button.getBoundingClientRect();
        if (!other.width || !other.height) return false;
        return left < other.right && right > other.left && top < other.bottom && bottom > other.top;
      });
    };
    // Prefer below the anchor, then above, then the viewport edge. A tip that
    // would still land on a button is dropped instead of covering it.
    const candidates = [
      rect.bottom + 8,
      rect.top - tip.offsetHeight - 8,
      Math.max(margin, innerHeight - tip.offsetHeight - margin),
    ];
    const top = candidates.find((value) => value >= margin && !coversControl(value));
    if (top == null) {
      tip.hidden = true;
      return;
    }
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tipTimer = setTimeout(hideTip, 3000);
  }

  id("Row").addEventListener("click", (event) => {
    const button = event.target.closest(".dare-words-card");
    if (!button || !can("claim")) return;
    const cardId = Number(button.dataset.cardId);
    const index = selection.indexOf(cardId);
    const feedback = id("Feedback");
    feedback.dataset.error = "";
    if (index >= 0) {
      selection.splice(index, 1);
    } else if (cardById(cardId)) {
      if (selection.length >= maxChars()) {
        feedback.classList.remove("is-ok");
        feedback.textContent = `最多 ${maxChars()} 个字。`;
        return;
      }
      selection.push(cardId);
    }
    renderRow();
    renderClaim();
  });

  id("Phrase").addEventListener("click", (event) => {
    const pick = event.target.closest(".dare-words-pick");
    if (!pick || !can("claim")) return;
    const index = selection.indexOf(Number(pick.dataset.cardId));
    if (index < 0) return;
    selection.splice(index, 1);
    id("Feedback").dataset.error = "";
    renderRow();
    renderClaim();
  });
  id("FlipBtn").addEventListener("click", () => send("flip"));
  id("FinishBtn").addEventListener("click", () => send("finish_game"));
  id("ClaimBtn").addEventListener("click", submitClaim);
  id("AcceptBtn").addEventListener("click", () => send("vote", { accept: true }));
  id("RejectBtn").addEventListener("click", () => send("vote", { accept: false }));
  id("NextBtn").addEventListener("click", () => send(view?.phase === "game_over" ? "play_again" : "next_round"));
  id("DeckSelect").addEventListener("change", () => {
    if (typeof updateRoomActionButtons === "function") updateRoomActionButtons();
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("button, label, summary, details, a")) return;
    if (!selection.length) return;
    clearSelection();
    renderRow();
    renderClaim();
  });

  panel.addEventListener("pointerover", (event) => {
    if (event.pointerType === "mouse") showTip(tipAnchor(event.target));
  });
  panel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    touchTipGesture = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      target: tipAnchor(event.target), started: performance.now(), moved: false,
    };
    hideTip();
  });
  document.addEventListener("pointermove", (event) => {
    if (touchTipGesture?.pointerId === event.pointerId
        && Math.hypot(event.clientX - touchTipGesture.x, event.clientY - touchTipGesture.y) > 8) {
      touchTipGesture.moved = true;
    }
  });
  document.addEventListener("pointerup", (event) => {
    const gesture = touchTipGesture;
    touchTipGesture = null;
    if (event.pointerType === "mouse" || !gesture || gesture.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (!gesture.moved && moved <= 8 && performance.now() - gesture.started <= 600
        && gesture.target && gesture.target === tipAnchor(event.target)) {
      showTip(gesture.target);
    }
  });
  document.addEventListener("pointercancel", () => { touchTipGesture = null; });
  panel.addEventListener("pointerout", (event) => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", (event) => { if (!touchTipGesture) showTip(tipAnchor(event.target)); });
  panel.addEventListener("focusout", hideTip);
  document.addEventListener("scroll", () => {
    if (touchTipGesture) touchTipGesture.moved = true;
    hideTip();
  }, true);
  window.getDareWordsConfig = () => ({ deck_size: id("DeckSelect").value === "short" ? "short" : "full" });
  window.renderDareWordsGameState = (data) => {
    if (!active()) return;
    if (data?.game_type && data.game_type !== GAME_ID) return;
    if (data?.room_id && data.room_id !== currentRoomState?.room_id) return;
    const next = data?.view || data;
    if (!next || (next.game_id && next.game_id !== GAME_ID)) return;
    const previousPhase = view?.phase;
    view = next;
    pending = false;
    if (previousPhase !== view.phase) clearSelection();
    selection = selection.filter((cardId) => Boolean(cardById(cardId)));
    render();
  };
  window.showDareWordsHeaderActions = (visible) => {
    id("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) {
      view = null;
      pending = false;
      clearSelection();
    }
    render();
  };

  function syncRoom(state) {
    if (state?.game_type !== GAME_ID) {
      activeRoom = null;
      updateConfig(state);
      view = null;
      clearSelection();
      render();
      return;
    }
    if (state.room_id !== activeRoom || state.status === "lobby") {
      view = null;
      clearSelection();
    }
    activeRoom = state.room_id;
    updateConfig(state);
    render();
  }

  function initialize() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", (error) => {
      if (!active() || !pending) return;
      pending = false;
      const message = typeof error === "string" ? error : error?.message || "操作失败，请重试。";
      const feedback = id("Feedback");
      feedback.dataset.error = "1";
      feedback.classList.remove("is-ok");
      feedback.textContent = message;
      render();
    });
    socket.on("disconnect", () => { pending = false; if (active()) render(); });
    socket.on("connect", () => { if (active()) render(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME_ID) {
      window.renderDareWordsGameState(lastGameStatePayload);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
