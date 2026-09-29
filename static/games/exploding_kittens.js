(() => {
  "use strict";
  const panel = document.getElementById("explodingKittensPanel");
  const header = document.getElementById("explodingKittensHeaderActions");
  const dialog = document.getElementById("explodingKittensDialog");
  const $ = suffix => document.getElementById(`ek${suffix}`);
  const helpButton = document.getElementById("explodingKittensHelpBtn");
  const explainButton = document.getElementById("explodingKittensExplainBtn");
  const tooltip = $("Tooltip");
  let view = null, selected = [], busy = false, explaining = false, signature = null;
  let tipTimer, busyTimer, suppressTimer, suppressClick = false, focusBeforeDialog;
  const singles = ["attack", "skip", "favor", "shuffle", "see_future"];
  const effects = {
    exploding_kitten: "立即展示。没有 Defuse（🧯，拆弹）就淘汰；使用拆弹后秘密放回牌堆。",
    defuse: "抽到 Exploding Kitten（💥，爆炸猫）时弃掉一张拆弹，再秘密选择爆炸猫的插入位置。完成一个回合，不能被否决。",
    nope: "取消尚未执行的牌或组合；可在别人回合打出，也可否决另一张 Nope（🙅），偶数张恢复原效果。不能否决抽牌、爆炸猫或拆弹。",
    attack: "不抽牌，将行动交给下一位并让其连续进行 2 回合。若自己正在受攻击，转交所有剩余回合再加 2；剩 1 回合也会变为 3。",
    skip: "不抽牌，结束一个回合。受攻击时只减少 1 个剩余回合。",
    favor: "选择另一个有手牌的存活玩家，让对方自行选 1 张牌交给你。交牌内容不公开。",
    shuffle: "随机重洗整个抽牌堆。所有已查看的未来预览失效，之后仍是你的回合。",
    see_future: "只给自己查看牌堆顶至多 3 张，保持原顺序。Continue 后继续自己回合；抽牌、洗牌或插入爆炸猫使预览失效。",
    cat: "单独没有效果。两张同名牌可随机偷 1 张；三张同名牌可指定索取一种牌，有则得到一张，没有则落空。",
  };
  const hints = {defuse: "Survive a kitten", nope: "Cancel an effect", attack: "Pass on 2 turns", skip: "End 1 turn", favor: "Ask for 1 card", shuffle: "Mix the draw pile", see_future: "Peek at top 3", exploding_kitten: "Defuse or explode"};
  const explanations = {
    deck: ["Draw pile（🂠）", "抽牌堆的牌面和顺序隐藏。数字表示剩余牌数。使用 Draw Card 从牌顶抽一张，结束一个回合；可能抽到 Exploding Kitten（💥，爆炸猫）。"],
    draw: ["Draw Card（🂠）", "结束一个回合并抽牌。可以不出牌就抽牌。抽到爆炸猫（💥）必须拆弹（🧯）或被淘汰。攻击中每抽一次只完成一个回合。"],
    discard: ["Discard pile · 弃牌堆", "这里的牌全部公开。点击可以查看完整弃牌；即使被 Nope（🙅，否决），已经打出的牌也留在弃牌堆。"],
    kittens: ["Exploding Kittens（💥）", "仍在游戏中的爆炸猫数量，也包含当前被抽出、等待拆弹的一张。每淘汰一人移除一张爆炸猫；最后存活者获胜。"],
    turns: ["Turns（⚡）", "显示当前玩家仍需完成的回合数。抽牌或 Skip（⏭️，跳过）消耗一个；Attack（⚡，攻击）将未完成的攻击回合再加 2 交给下一位。"],
    player: ["Players · 玩家", "显示玩家名字、公开手牌数量（🃏）与存活情况。Turn 表示当前行动者；Out 表示已淘汰；Ready 表示已确认；You / Bot 标识本人或机器人。"],
    hand: ["Hand（🔒）· 私人手牌", "只有你能看到自己的牌。点选 1 张功能牌或 2／3 张同名牌，再点击 Play Selected。点击空白或 Esc 取消选择。牌数没有上限；其他人只看到数量。"],
    play: ["Play Selected", "打出选中的牌。单张可用攻击、跳过、索取、洗牌、预知未来；两张／三张任意同名牌（包括拆弹与否决）可作为组合使用。组合只执行组合效果。"],
    reaction: ["Reaction · 否决响应", "尚未执行的效果等待所有存活玩家确认 Pass。出牌者默认确认。任何存活玩家均可打 Nope（🙅），即使已经 Pass；每次 Nope 重新开放响应，否决者默认确认。全员确认后执行偶数层效果、取消奇数层效果。"],
    pass: ["Pass", "确认当前否决窗口。如果所有存活玩家都确认，马上结算该效果。这不会抽牌，也不是结束你的游戏回合。"],
    give: ["Give Selected（🎁）", "索取的目标自行选择一张手牌（可以是拆弹）交出。牌面只对双方可见；效果已经开始，不能再否决此次交牌。"],
    future: ["Private peek（🔮）", "牌顶至多 3 张仅自己可见，按顶到底排列。点击 Continue 才继续；别人无法替你关闭预览。"],
    reinsert: ["Place Secretly（💥）", "秘密选择一个间隙插入爆炸猫，0 是牌顶，最大位置是牌底。After N cards 表示上面有 N 张牌。牌堆其他牌顺序不变，插入位置绝不广播。"],
    next: ["Next Round", "确认已看完淘汰结果。包括刚淘汰的玩家在内，全员确认才继续下一位行动；机器人自动确认，真人断线后需要重连确认。"],
    winner: ["Winner（🏆）", "最后一名存活者获胜。最终结果停留在页面，房间控制可开始新游戏。"],
  };

  function el(tag, cls, content) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  }
  function text(id, content) { $(id).textContent = content; }
  function show(id, visible) { $(id).classList.toggle("hidden", !visible); }
  function label(kind) {
    const item = view?.card_types[kind];
    return item ? `${item.emoji} ${item.name} · ${item.zh}` : kind;
  }
  function info(kind) {
    return explanations[kind] || [label(kind), effects[kind] || effects.cat];
  }
  function annotate(node, key, description) {
    node.dataset.ekExplain = key;
    if (description) node.dataset.ekTip = description;
    if (node.tagName !== "BUTTON") node.tabIndex = 0;
    return node;
  }
  function name(id) { return view?.players.find(player => player.player_id === id)?.name || id || "—"; }
  function can(kind) { return !!(view && !busy && socket.connected && view.legal_actions.includes(kind)); }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function tip(target, autoHide = false) {
    if (!target || explaining || dialog.open) return;
    hideTip();
    tooltip.textContent = target.dataset.ekTip;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 15 < innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - box.height - 6)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) {
    explaining = value;
    panel.classList.toggle("ek-explaining", value);
    explainButton.setAttribute("aria-pressed", String(value));
    hideTip();
  }
  function openDialog(title, content) {
    hideTip(); focusBeforeDialog = document.activeElement;
    text("DialogTitle", title);
    $("DialogBody").replaceChildren(typeof content === "string" ? el("p", "", content) : content);
    if (!dialog.open) dialog.showModal();
    $("DialogClose").focus();
  }
  function explain(target) {
    if (!target) return;
    const [title, description] = info(target.dataset.ekExplain);
    setExplain(false);
    openDialog(title, description);
  }
  function send(kind, fields = {}) {
    if (explaining || !can(kind)) return;
    busy = true; hideTip(); renderActions();
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => { busy = false; renderActions(); }, 4000);
    sendAction({type: kind, game_token: view.game_token, window_id: view.window_id, ...fields});
  }
  function selectedCards() { return selected.map(id => view.hand.find(card => card.id === id)).filter(Boolean); }
  function selectionInfo() {
    const cards = selectedCards(), count = cards.length, kind = cards[0]?.kind;
    const matching = cards.every(card => card.kind === kind);
    const targeted = count > 1 || kind === "favor";
    const valid = count > 0 && (count === 1 ? singles.includes(kind) : count <= 3 && matching)
      && (!targeted || !!$("Target").value);
    return {cards, count, kind, targeted, valid};
  }
  function renderActions() {
    document.body.classList.toggle("ek-needs-action", !!view && ["draw", "pass", "give", "continue", "defuse", "reinsert", "next_round"].some(can));
    const s = view ? selectionInfo() : {count: 0, valid: false};
    $("Play").disabled = !can("play") || !s.valid;
    $("Draw").disabled = !can("draw");
    $("Give").disabled = !can("give") || s.count !== 1;
    for (const [id, kind] of [["Pass", "pass"], ["Nope", "nope"], ["Continue", "continue"], ["Defuse", "defuse"], ["Reinsert", "reinsert"], ["Next", "next_round"]]) $(id).disabled = !can(kind);
    $("Top").disabled = $("Bottom").disabled = $("Position").disabled = !can("reinsert");
    show("TargetRow", !!s.count && s.targeted);
    show("RequestRow", s.count === 3);
    const same = s.cards?.every(card => card.kind === s.kind);
    text("SelectionLabel", !s.count ? "Select cards below, or draw." : !same ? "Choose matching cards for a combo." : s.count === 1 ? label(s.kind) : `${s.count === 2 ? "Pair · steal a random card" : "Triple · request a card"} · ${label(s.kind)}`);
    text("Play", s.count === 2 ? "Play Pair" : s.count === 3 ? "Play Triple" : "Play Selected");
    text("Next", view?.ready.includes(view.you) ? "Ready ✓" : "Next Round");
    for (const button of $("Hand").querySelectorAll("button")) {
      button.classList.toggle("is-selected", selected.includes(button.dataset.cardId));
      button.setAttribute("aria-pressed", String(selected.includes(button.dataset.cardId)));
      button.disabled = !(can("play") || can("give"));
    }
  }
  function clearSelection() { selected = []; renderActions(); }
  function selectCard(card) {
    if (!can("play") && !can("give")) return;
    if (selected.includes(card.id)) selected = selected.filter(id => id !== card.id);
    else if (can("give")) selected = [card.id];
    else if (selected.length < 3) selected.push(card.id);
    renderActions();
  }
  function renderHand() {
    const container = $("Hand"), scroll = container.scrollTop;
    const focused = document.activeElement?.dataset.cardId;
    container.replaceChildren();
    const own = view.players.find(player => player.player_id === view.you);
    text("HandTitle", own ? `YOUR HAND · ${view.hand.length}` : "SPECTATING");
    if (!view.hand.length) container.append(el("div", "ek-empty", !own ? "Private hands are hidden." : own.alive ? "No cards in hand. You can still draw." : "You are out. Stay to watch the table."));
    for (const card of view.hand) {
      const item = view.card_types[card.kind];
      const button = annotate(el("button", "ek-card"), card.kind);
      button.type = "button"; button.dataset.cardId = card.id; button.dataset.kind = card.kind;
      button.setAttribute("aria-label", label(card.kind));
      button.append(el("span", "ek-card-icon", item.emoji), el("strong", "ek-card-name", item.name), el("span", "ek-card-zh", item.zh), el("span", "ek-card-hint", hints[card.kind] || "Match 2 or 3"));
      button.addEventListener("click", () => selectCard(card));
      container.append(button);
    }
    if (focused) [...container.children].find(node => node.dataset.cardId === focused)?.focus({preventScroll: true});
    container.scrollTop = scroll;
  }
  function renderPlayers() {
    const container = $("Players"); container.replaceChildren();
    for (const player of view.players) {
      const item = annotate(el("article", "ek-player"), "player", "Players：🃏 是公开手牌数量；Out 已淘汰，Turn 当前行动，Ready 已确认。");
      item.classList.toggle("is-current", player.player_id === view.current_turn);
      item.classList.toggle("is-out", !player.alive);
      item.classList.toggle("is-winner", view.winner_ids.includes(player.player_id));
      item.append(el("strong", "ek-player-name", player.name));
      const meta = el("div", "ek-player-meta");
      const badges = [`🃏 ${player.hand_count}`, player.player_id === view.you ? "You" : player.is_bot ? "Bot" : "", !player.alive ? "Out" : player.player_id === view.current_turn ? "Turn" : "", view.winner_ids.includes(player.player_id) ? "🏆 Winner" : "", (view.pending?.passed || view.ready).includes(player.player_id) ? "Ready" : ""];
      for (const badge of badges.filter(Boolean)) meta.append(el("span", "", badge));
      item.append(meta); container.append(item);
    }
  }
  function renderOptions() {
    const previousTarget = $("Target").value;
    $("Target").replaceChildren();
    for (const player of view.players.filter(p => p.player_id !== view.you && p.alive && p.hand_count)) $("Target").append(new Option(player.name, player.player_id));
    if ([...$("Target").options].some(option => option.value === previousTarget)) $("Target").value = previousTarget;
    if (!$("Request").options.length) {
      for (const [kind] of Object.entries(view.card_types)) if (kind !== "exploding_kitten") $("Request").append(new Option(label(kind), kind));
      $("Request").value = "defuse";
    }
    const positionKey = `${view.game_token}:${view.window_id}:${view.deck_count}`;
    if (view.phase === "reinsert" && $("Position").dataset.key !== positionKey) {
      $("Position").replaceChildren();
      for (let i = 0; i <= view.deck_count; i++) $("Position").append(new Option(i === 0 ? "0 · Top of pile" : i === view.deck_count ? `${i} · Bottom of pile` : `${i} · After ${i} cards`, String(i)));
      $("Position").dataset.key = positionKey;
    }
  }
  function logText(row) {
    const who = name(row.player_id);
    switch (row.type) {
      case "draw": return `${who} drew a card.`;
      case "play": return `${who} played ${row.count} × ${label(row.card_kind)}${row.target_id ? ` → ${name(row.target_id)}` : ""}${row.requested_kind ? ` · requests ${label(row.requested_kind)}` : ""}.`;
      case "nope": return `${who}: 🙅 ${row.cancelled ? "Nope · effect cancelled" : "Yup · effect restored"}.`;
      case "cancelled": return `${who}'s effect was cancelled.`;
      case "resolved": return `${who}'s ${row.effect === "pair" ? "Pair" : row.effect === "triple" ? "Triple" : label(row.effect)} resolved.`;
      case "given": return `${who} gave a card to ${name(row.target_id)}.`;
      case "stolen": return `${who} took ${row.requested_kind ? label(row.requested_kind) : "a private card"} from ${name(row.target_id)}.`;
      case "missed": return `${name(row.target_id)} had no ${label(row.requested_kind)}. No card taken.`;
      case "kitten": return `${who} drew an Exploding Kitten 💥.`;
      case "defused": return `${who} used Defuse 🧯.`;
      case "reinserted": return `${who} secretly returned the kitten.`;
      case "exploded": return `${who} exploded 💥 and is out.`;
      case "winner": return `🏆 ${who} wins!`;
      default: return who;
    }
  }
  function render() {
    if (!view) return;
    const mine = view.current_turn === view.you, own = view.players.find(p => p.player_id === view.you);
    text("DeckCount", view.deck_count); text("KittenCount", `💥 ${view.kitten_count} in play`);
    text("TurnNumber", `Turn ${view.turn_number}`);
    text("Debt", view.game_over ? "🏆 Finished" : `⚡ ${view.turns_left} ${view.turns_left === 1 ? "turn" : "turns"} left`);
    const last = view.discard.at(-1), lastType = view.card_types[last?.kind];
    text("DiscardEmoji", lastType?.emoji || "—");
    text("DiscardName", lastType?.name || "No cards yet");
    text("DiscardCount", `${view.discard.length} cards · View all`);
    text("Status", view.game_over ? "Game complete" : view.phase === "elimination_review" ? "Table paused · review the result" : view.phase === "reaction" ? "Reaction window · Pass or Nope" : mine ? "Your turn" : `Waiting for ${name(view.current_turn)}`);
    text("DecisionTitle", view.game_over ? "LAST CAT STANDING" : view.phase === "reaction" ? "A CHANCE TO SAY NOPE" : "YOUR NEXT MOVE");
    const prompts = {
      playing: mine ? "Play a little. Push your luck." : `${name(view.current_turn)} is choosing a move.`,
      reaction: view.pending?.passed.includes(view.you) ? "You passed. Waiting for the table." : "Let it happen, or play a Nope.",
      favor: view.favor?.target_id === view.you ? `Choose a card to give ${name(view.favor.actor)}.` : `${name(view.favor?.target_id)} is choosing a card to give.`,
      future: mine ? "Your future is private. Take a look." : `${name(view.current_turn)} is peeking at the future.`,
      defuse: mine ? "💥 A kitten! You have a Defuse." : `${name(view.current_turn)} drew a kitten and can defuse it.`,
      reinsert: mine ? "Choose where the kitten hides." : `${name(view.current_turn)} is hiding the kitten.`,
      elimination_review: `${name(view.review_player)} exploded. Take a moment.`,
      game_over: "One survivor. Everyone else exploded.",
    };
    text("Prompt", prompts[view.phase] || "Waiting for the table.");
    if (own && !own.alive && !["elimination_review", "game_over"].includes(view.phase)) text("Prompt", `You are out. Watching ${name(view.current_turn)}.`);
    show("Composer", view.phase === "playing" && mine);
    show("Pending", !!view.pending);
    show("ReactionActions", view.phase === "reaction" && !!own?.alive);
    show("GiveArea", view.phase === "favor" && view.favor?.target_id === view.you);
    show("Continue", view.phase === "future" && mine);
    show("Defuse", view.phase === "defuse" && mine);
    show("InsertArea", view.phase === "reinsert" && mine);
    show("Review", view.phase === "elimination_review" && !!own);
    show("Result", view.game_over);
    if (view.pending) {
      const p = view.pending, waiting = view.players.filter(player => player.alive && !p.passed.includes(player.player_id));
      const effect = p.effect === "pair" ? "Pair · random steal" : p.effect === "triple" ? `Triple · ${label(p.requested_kind)}` : label(p.effect);
      $("Pending").replaceChildren(el("strong", "", `${name(p.actor)} · ${effect}`), el("div", "", `${p.target_id ? `Target: ${name(p.target_id)} · ` : ""}${p.nope_count % 2 ? "Cancelled" : "Will resolve"} · ${p.nope_count} Nope`), el("small", "", `Waiting: ${waiting.map(p => p.name).join(", ")}`));
    }
    show("Future", view.future.length > 0);
    $("FutureCards").replaceChildren();
    view.future.forEach((card, index) => {
      const item = view.card_types[card.kind];
      const node = annotate(el("div", "ek-mini"), card.kind, `${label(card.kind)}：${effects[card.kind] || effects.cat}`);
      node.append(el("small", "", index === 0 ? "1 · NEXT DRAW" : String(index + 1)), el("span", "", item.emoji), el("strong", "", item.name));
      $("FutureCards").append(node);
    });
    text("Ready", `${view.ready.length} / ${view.players.length} ready`);
    text("Result", `🏆 ${view.winner_ids.map(name).join(" & ")} wins!`);
    const scroll = $("Log").scrollTop;
    $("Log").replaceChildren(...[...view.history].reverse().map(row => el("li", "", logText(row))));
    if (!view.history.length) $("Log").append(el("li", "", "No moves yet."));
    $("Log").scrollTop = scroll;
    renderOptions(); renderPlayers(); renderHand(); renderActions();
  }

  function help() {
    const body = el("div");
    const sections = [
      ["目标与准备", "2–5 人，最后存活者为 Winner（🏆）。每人 1 张 Defuse（🧯）和 7 张普通牌，再加入人数减 1 张 Exploding Kitten（💥）。2–3 人只放回 2 张额外拆弹，4–5 人放回其余拆弹。起始玩家随机，之后按座位顺序行动。"],
      ["你的回合", "任意出牌或不出牌，然后从 Draw pile（🂠）抽 1 张结束一个回合。牌可以连续出，没有手牌上限。抽到爆炸猫（💥）时必须拆弹（🧯）才可存活；拆弹后秘密放回任意位置，这次抽牌仍完成一个回合。没有拆弹则弃掉全部手牌、淘汰出局。"],
      ["Attack（⚡）与 Skip（⏭️）", "普通回合打攻击：不抽牌，下家连续做 2 回合。被攻击时再打攻击：把所有尚未完成的回合加 2 转给下家（例如 2 → 4；已完成一个则 1 → 3）。每次跳过或抽牌仅完成一个回合；死亡不把剩余攻击债务传给下家。"],
      ["Nope（🙅）与线上响应", "除爆炸猫、拆弹与抽牌外，出牌和组合在结算前都可否决。原出牌者默认 Pass；其他存活者无论有无 Nope 都要确认。窗口开放时任何存活者可打 Nope，含已 Pass 者；每次 Nope 翻转效果，并重新等待所有其他存活者确认。奇数层取消，偶数层恢复。原牌和 Nope 全部留在弃牌堆。效果开始执行后不能再否决。"],
      ["Pairs / Triples · 同名组合", "任意两张同名牌（包括功能牌）可随机偷另一位存活玩家 1 张手牌；任意三张同名牌可以点名一种牌，对方有则必须给一张，否则落空。选牌、目标、请求牌名后确认。组合不执行卡牌原效果。五种猫咪（🌮 🍉 🥔 🧔 🌈）单张无效；本实现采用 2022 原版规则，没有旧版五种不同牌组合或扩展牌。"],
      ["牌与图标", "以下是原版全部牌类（括号内为整盒数量）；实际入局的爆炸猫与拆弹数量取决于玩家数。"],
    ];
    for (const [title, content] of sections) body.append(el("h3", "", title), el("p", "", content));
    const rules = [
      ["exploding_kitten", "Exploding Kitten（💥，爆炸猫，4 张）"], ["defuse", "Defuse（🧯，拆弹，6 张）"],
      ["nope", "Nope（🙅，否决，5 张）"], ["attack", "Attack（⚡，攻击，4 张）"],
      ["skip", "Skip（⏭️，跳过，4 张）"], ["favor", "Favor（🎁，索取，4 张）"],
      ["shuffle", "Shuffle（🔀，洗牌，4 张）"], ["see_future", "See the Future（🔮，预知未来，5 张）"],
      ["cat", "Tacocat（🌮，墨西哥卷猫）、Cattermelon（🍉，西瓜猫）、Hairy Potato Cat（🥔，毛毛土豆猫）、Beard Cat（🧔，胡子猫）、Rainbow-Ralphing Cat（🌈，彩虹猫），各 4 张"],
    ];
    for (const [kind, title] of rules) body.append(el("p", "", `${title}：${effects[kind]}`));
    body.append(el("h3", "", "保密、回顾与操作"), el("p", "", "Hand（🔒）只有本人可见，Players 的 Cards（🃏）只公开数量；弃牌全部公开。Future（🔮）只给本人查看，Continue 才继续。秘密交牌、偷牌结果和插入位置不公开。非最终淘汰后暂停，全员（包括淘汰者）点击 Next Round 继续，机器人自动确认。最终结果保留，通过房间控制重新开局。"), el("p", "", "选牌后点空白或 Esc 可取消，滚动手牌不影响选中状态。Help 查看规则；Explain 后点目标查看解释，禁用按钮也可解释，Esc 退出。电脑悬停显示图标说明，手机点击后浮层 3 秒自动消失。机器人只根据自己的手牌和可见信息决策。"));
    const source = el("a", "", "Official Original Edition rules · 2022");
    source.href = "https://dumekj556jp75.cloudfront.net/exploding-kittens/English.pdf";
    source.target = "_blank"; source.rel = "noopener noreferrer";
    body.append(source);
    return body;
  }
  $("Play").addEventListener("click", () => {
    const s = selectionInfo(); if (!s.valid) return;
    send("play", {card_ids: [...selected], ...(s.targeted ? {target_id: $("Target").value} : {}), ...(s.count === 3 ? {requested_kind: $("Request").value} : {})});
  });
  $("Target").addEventListener("change", renderActions);
  $("Give").addEventListener("click", () => { if (selected.length === 1) send("give", {card_id: selected[0]}); });
  $("Reinsert").addEventListener("click", () => send("reinsert", {position: Number($("Position").value)}));
  $("Top").addEventListener("click", () => { $("Position").value = "0"; });
  $("Bottom").addEventListener("click", () => { $("Position").value = String(view.deck_count); });
  for (const [id, kind] of [["Draw", "draw"], ["Pass", "pass"], ["Nope", "nope"], ["Continue", "continue"], ["Defuse", "defuse"], ["Next", "next_round"]]) $(id).addEventListener("click", () => send(kind));
  $("Discard").addEventListener("click", () => {
    const list = el("div", "ek-discard-list");
    for (const card of [...(view?.discard || [])].reverse()) list.append(el("div", "", label(card.kind)));
    if (!list.children.length) list.append(el("p", "", "No discarded cards yet."));
    openDialog("Discard pile · newest first", list);
  });
  helpButton.addEventListener("click", () => { setExplain(false); openDialog("Exploding Kittens · Rules", help()); });
  explainButton.addEventListener("click", () => setExplain(!explaining));
  $("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  dialog.addEventListener("click", event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
  const exempt = target => target.closest("#explodingKittensHelpBtn, #explodingKittensExplainBtn, #explodingKittensDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target.closest("[data-ek-explain]") || [...panel.querySelectorAll("[data-ek-explain]")].find(node => {
      const r = node.getBoundingClientRect();
      return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
    suppressClick = true; clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 750);
    explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    explain(event.target.closest("[data-ek-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); clearSelection(); return; }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    explain(event.target.closest("[data-ek-explain]"));
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") tip(event.target.closest("[data-ek-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => tip(event.target.closest("[data-ek-tip]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-ek-tip]");
    if (target) tip(target, true); else hideTip();
    if (!event.target.closest("button, select, input, label, #ekComposer, #ekGiveArea")) clearSelection();
  });
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);

  function clearState() {
    view = null; selected = []; busy = false; signature = null;
    clearTimeout(busyTimer); setExplain(false); hideTip();
    if (dialog.open) dialog.close();
    for (const id of ["Players", "Hand", "Log", "FutureCards", "Pending", "Position", "Target"]) $(id).replaceChildren();
    for (const id of ["Composer", "ReactionActions", "GiveArea", "Continue", "Defuse", "InsertArea", "Review", "Result", "Future", "Pending"]) show(id, false);
    text("Status", "Waiting to start"); text("Prompt", "Waiting for the table.");
    text("DeckCount", "—"); text("DiscardName", "No cards yet"); text("DiscardEmoji", "—");
    text("DiscardCount", "View discard pile"); text("Debt", "⚡ —"); text("KittenCount", "💥 —");
    text("TurnNumber", "Turn —"); text("HandTitle", "YOUR HAND"); renderActions();
  }
  window.renderExplodingKittensGameState = data => {
    if (data?.view?.game_id !== "exploding_kittens" || currentGameType !== "exploding_kittens") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
    if (next !== signature) { selected = []; hideTip(); }
    if (next !== signature || view?.revision !== data.view.revision) { busy = false; clearTimeout(busyTimer); }
    signature = next; view = data.view;
    selected = selected.filter(id => view.hand.some(card => card.id === id)); render();
  };
  window.showExplodingKittensHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function syncRoom(state) {
    if (state?.game_type !== "exploding_kittens" || state.status === "lobby") clearState();
  }
  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { busy = false; clearTimeout(busyTimer); renderActions(); });
    socket.on("disconnect", () => { busy = false; clearTimeout(busyTimer); hideTip(); renderActions(); });
    socket.on("connect", renderActions);
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "exploding_kittens") window.renderExplodingKittensGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
