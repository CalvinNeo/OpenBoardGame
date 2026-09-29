(() => {
  const byId = suffix => document.getElementById(`theCrew${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  const missionDialog = byId("MissionDialog");
  const helperId = "__the_crew_helper__";
  const suits = {blue:["🔵", "◆", "Blue"], green:["🟢", "▲", "Green"], yellow:["🟡", "●", "Yellow"], pink:["🩷", "✦", "Pink"], trump:["🚀", "⬟", "Trump"]};
  const markers = {highest:"↑ Highest", lowest:"↓ Lowest", only:"＝ Only", unknown:"? Hidden"};
  const phases = {tokens:"Arrange task markers", responses:"Crew responses", assign:"Captain's decision", volunteer:"Choose a volunteer", draft:"Choose mission tasks", predict:"Lock your prediction", preflight:"Ready for departure", distress_vote:"Distress signal vote", exchange:"Choose a card to exchange", playing:"Play a card", trick_review:"Trick complete", mission_review:"Mission debrief", game_over:"Mission complete"};
  const explanations = {
    restart:["Restart · 重新选关", "房主可在当前版本内重新选关。确认后重新发牌、清空本局进度，所有成员留在原房间；取消或 Esc 保留当前游戏。"],
    mission:["Mission · 任务", "全队共同完成所有目标；任何一项失败就需要重试。失败后所有人确认才重新发牌，成功后所有人确认才进入下一关。"],
    trick:["Trick · 墩", "从领出者开始，每席打一张。必须跟随领出的颜色；没有该颜色才可出其他牌。王牌（🚀／⚓）大于彩色牌，同类数值大的赢；没有王牌时，领出颜色数值大的赢。胜者收取整墩并领出下一墩。"],
    hand:["Hand · 手牌", "只有你能看到自己的手牌。蓝（🔵◆）、绿（🟢▲）、黄（🟡●）、粉（🩷✦）各 1–9，王牌（🚀／⚓）1–4。点选合法牌后 Play；空白或 Esc 取消选择。"],
    play:["Play · 出牌", "确认打出已选牌，出牌后不能撤回。灰色牌不能在当前状态使用：可能尚未轮到你、必须跟色，或正等待全员确认。"],
    helper:["Helper · 双人助手", "双人游戏增加 JARVIS／Tonoja。七列各一暗一明，指挥官代选任务和出牌；只可用明牌跟色，下方牌在整墩结束后才翻开。不能查看暗牌或替助手通讯。换牌时指挥官选择一张明牌。"],
    captain:["Captain · 指挥官 👑", "起手持有王牌 4 的成员。指挥官先选任务、领出第一墩，特殊任务中负责分配；双人时还操控助手。"],
    tasks:["Tasks · 任务 📋", "每张任务都有负责人，必须由该成员满足条件。1 代收取指定牌；2 代包含收牌、避牌、墩数、首末墩、预测等 96 张任务，难度按 3／4／5 席计算。精确数量、回避、比较等条件通常要到手牌打完才确认成功。"],
    order:["Order · 次序", "数字 1、2、3…表示在所有任务中的完成名次；>、>>、>>>、>>>>只限制这些标记之间的相对次序；Ω 必须最后完成。同墩收取多个任务允许选择合法的完成次序。"],
    draft:["Choose task · 选任务", "通常从指挥官起顺时针每次领取一张。1 代不能 Pass。2 代仅初始任务少于席位时可跳过，且必须在一圈内分完；比较指挥官墩数的任务不能由指挥官领取。自由分配关卡可选择自己或自己操控的助手。"],
    communication:["Communication · 通讯 📡", "任务分完后、每墩领出前可以通讯。选一张非王牌，标为该颜色最高 ↑、最低 ↓ 或唯一 ＝；若只有一张，只能标唯一。通常每人一次。标记固定，出掉该牌后仍标记为已出。Hidden 隐藏标记；Shared 全队共用次数；延迟或禁用以当前关卡为准。"],
    ready:["Ready / Next Round", "全员确认后才继续。你确认后仍可查看结果；断线真人也需要重连确认。新的通讯会取消已有确认，让每个人有机会看到新信息。"],
    distress:["Distress · 求救 🆘", "选任务后、首次通讯和出牌前，全员同意才启动。每席秘密选择一张非王牌，统一向左或向右同时传递。每次尝试至多交换一次；同一关一旦启动求救，之后重试仍保留标记，成功计次额外 +1。"],
    exchange:["Exchange · 换牌", "选择一张非王牌并提交。所有席位提交后同时交换，别人看不到你选择的牌。助手只能选明牌。"],
    respond:["Response · 回答", "仅通过 Yes / No 表达意愿，不透露手牌。普通指定任务由指挥官参考回复决定；志愿关卡顺序询问，最后剩余成员必须接受。"],
    assign:["Assign · 指定成员", "指挥官在合法成员中选择。请依据大家的意愿，不讨论具体手牌。逐张分配关卡要求最后每人的任务数最多相差 1。"],
    predict:["Prediction · 预测", "根据自己的手牌预测最终赢墩数。Lock 后不能更改；秘密预测仅本人可见，任务结束才公开。双人助手的预测由指挥官提交。"],
    handover:["Handover · 转交任务", "1 代五人从第 25 关起，全队每次尝试可让一位成员转交一个任务。须在第一墩开始前完成。"],
    tokens:["Arrange markers · 调整标记", "第 23 关可交换两个任务的标记；第 40 关可把一个标记移到无标记的任务上。也可以 Keep markers。调整完成后才开始分配任务。"],
  };
  const help = `<h3>共同航行</h3><p>宇航员是限制交流的合作吃墩游戏。1 代《第九行星任务》共 50 关；2 代《深海任务》共 32 关、96 张不同条件的任务。所有目标达成才全队成功，任意目标失败则重试。游戏中不能自由谈论自己的牌，只能用规则允许的通讯和 Yes / No。</p><h3>牌与吃墩</h3><p>蓝（🔵◆）、绿（🟢▲）、黄（🟡●）、粉（🩷✦）各 1–9；1 代火箭（🚀）、2 代潜艇（⚓）是王牌 1–4。持王牌 4 的指挥官（👑 Captain）领出第一墩。必须跟随领出的花色，无该色才可垫牌或出王牌。王牌最大，否则领出色最大者赢墩、收取所有牌并领出下一墩。三席打 13 墩，多的一张不出。</p><h3>领取任务（📋 Tasks）</h3><p>通常从指挥官起轮流取一张。1 代必须由目标负责人收取指定牌；数字标记规定所有任务中的完成名次，箭头 &gt;、&gt;&gt; 等只限制相互次序，Ω 要最后完成。同墩完成多个任务时自动判断是否存在合法次序。2 代按人数精确凑齐总难度，目标涉及牌、墩数、比较、顺序和预测。初始任务少于席位时才可以 Pass，且一圈内必须分完。比较指挥官的任务禁止指挥官领取。特殊关卡会提供对应分配操作。</p><h3>通讯（📡 Communication）</h3><p>任务分完后、两墩之间，每人通常可公开一张彩色牌，标记当前该色最高（↑ Highest）、最低（↓ Lowest）或唯一（＝ Only）。只有一张时必须选 Only；不能通讯王牌。牌仍属于手牌，标记不会因后来手牌变化而更新。Hidden 只展示牌不展示标记，Shared 共用剩余次数。已打出的通讯牌会变淡。任务卡的秘密预测只能自己查看。</p><h3>双人助手（🂠 Helper）</h3><p>两位真人加 JARVIS／Tonoja，按三席计算难度。助手有七列牌，每列一暗一明；王牌 4 始终发给真人。指挥官代选任务及出牌，只看明牌跟色，整墩结束后才翻开下方牌。助手不能通讯，自己不需点击 Ready。</p><h3>求救（🆘 Distress）</h3><p>任务分配后、通讯和出牌前，可以提议统一向左或右交换一张非王牌。全员同意后秘密提交，同时结算。助手由指挥官选择明牌。每次尝试最多一次；本关后续重试仍保留求救标记，成功计次额外加 1。1 代五人第 25 关起另可转交一张任务。</p><h3>回顾与操作</h3><p>每墩和每关结束都等全员点击 Next Round／Continue／Retry；断线成员需重连。只提供最近一墩供回顾；尚未完成任务相关的收牌可以公开计数。点牌后再 Play，点空白或 Esc 取消。Help 集中规则；Explain 可点选查看说明，Esc 退出。静态图标悬停或手机点击显示提示。</p><h3>线上约定</h3><p>深海 14–16、26 关采用官方不限时替代条件。失败后重新洗手牌和任务牌；编号战役与 Custom 自由任务分开。机器人只看自己的手牌和公共信息，是练习队友，不保证最优合作。</p>`;
  let view = null, selected = null, signature = null, pending = false, pendingTimer, tipTimer, suppressTimer;
  let explaining = false, suppressClick = false, focusBeforeDialog = null, choices = {}, edition = 1;
  let missionContext = null, focusBeforeMission = null;
  const missionHelp = "<h3>选关与 Restart</h3><p>建房先选 1 / 2。全员准备后，房主点击 Start Game 选择战役关卡或自定义任务，再点击 Start Mission 发牌。游戏中房主可用 Restart 重新选关；确认后清空本局进度并重新发牌，成员和座位保留。取消或 Esc 不影响当前游戏。版本固定，切换版本需另建房间。</p>";
  const el = (tag, cls = "", value = "") => { const node = document.createElement(tag); node.className = cls; node.textContent = value; return node; };
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
  const cardLabel = c => `${c.suit === "trump" ? (view?.config.edition === 2 ? "⚓" : "🚀") : suits[c.suit][0]} ${c.rank}`;
  const cardFromId = id => { const [suit, rank] = id.split("_"); return {id, suit, rank:Number(rank)}; };
  const can = kind => !!view && !pending && socket.connected && view.legal_actions.includes(kind);
  function tip(node, value, key) { node.dataset.tcTip = value; if (key) node.dataset.tcExplain = key; node.tabIndex = 0; return node; }
  function button(label, kind, callback, enabled = true) {
    const node = el("button", "", label); node.type = "button"; node.dataset.tcExplain = kind; node.disabled = !enabled;
    node.addEventListener("click", callback); return node;
  }
  function select(key, options) {
    const node = el("select"); node.setAttribute("aria-label", key);
    options.forEach(([value, label]) => { const opt = el("option", "", label); opt.value = value; node.append(opt); });
    if (options.some(([value]) => String(value) === String(choices[key]))) node.value = choices[key];
    choices[key] = node.value;
    node.addEventListener("change", () => { choices[key] = node.value; }); return node;
  }
  function dispatch(kind, fields = {}) {
    if (explaining || !can(kind)) return;
    pending = true; clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 2500);
    sendAction({type:kind, ...fields, ...Object.fromEntries(["game_token", "attempt_id", "step"].map(k => [k, view[k]]))});
    render();
  }
  function makeCard(card, actor = null) {
    if (!card) return tip(el("div", "the-crew-card the-crew-back", "🂠"), "Covered（🂠）：本墩结束后翻开；不能查看或打出。", "helper");
    const node = el(actor ? "button" : "div", `the-crew-card ${card.suit}`);
    const glyph = card.suit === "trump" ? (view?.config.edition === 2 ? "⚓" : "🚀") : suits[card.suit][1];
    node.append(el("span", "the-crew-suit", glyph), el("strong", "", card.rank), el("span", "the-crew-color-name", suits[card.suit][2]));
    node.dataset.tcExplain = "hand"; node.setAttribute("aria-label", `${suits[card.suit][2]} ${card.rank}`);
    if (!actor) return tip(node, `${cardLabel(card)} · ${suits[card.suit][2]} ${card.rank}`, "trick");
    node.type = "button"; node.dataset.cardId = card.id; node.dataset.actor = actor;
    const playable = can("play") && view.current_turn === actor && view.legal_card_ids.includes(card.id);
    const communicable = actor === view.you && can("communicate") && view.communication_options.some(o => o.card_id === card.id);
    const exchangeable = can("exchange") && view.exchange_pending.includes(actor) && card.suit !== "trump";
    node.disabled = !(playable || communicable || exchangeable);
    const chosen = selected?.id === card.id && selected?.actor === actor;
    node.classList.toggle("is-selected", chosen); node.setAttribute("aria-pressed", String(chosen));
    node.addEventListener("click", () => { selected = chosen ? null : {...card, actor}; renderHands(); });
    return node;
  }
  function renderHands() {
    const hand = byId("Hand"); hand.replaceChildren();
    text("HandTitle", view.players.some(p => p.player_id === view.you) ? "Your hand" : "Spectating");
    text("HandHint", view.hand.length ? `${view.hand.length} cards · private` : "");
    view.hand.forEach(c => hand.append(makeCard(c, view.you)));
    if (!view.hand.length) hand.append(el("span", "the-crew-task-progress", "No cards to show."));
    const helper = byId("Helper"); helper.replaceChildren();
    byId("HelperArea").classList.toggle("hidden", !view.helper.length); text("HelperTitle", name(helperId));
    view.helper.forEach(col => {
      const node = el("div", "the-crew-helper-column");
      if (col.card) node.append(makeCard(col.card, helperId));
      else if (col.covered) node.append(makeCard(null));
      else { node.append(tip(el("div", "the-crew-card the-crew-back", "—"), "Empty：该列两张牌都已打出。", "helper")); }
      node.append(tip(el("small", "", col.covered ? "🂠 +1" : "—"), col.covered ? "下方还有一张暗牌。" : "下方没有暗牌。", "helper")); helper.append(node);
    });
    const options = byId("SelectedActions"); options.replaceChildren();
    byId("Selection").classList.toggle("hidden", !selected);
    if (!selected) return;
    text("SelectedLabel", `${cardLabel(selected)} · ${name(selected.actor)}`);
    if (view.phase === "playing") options.append(button("Play", "play", () => dispatch("play", {card_id:selected.id}), can("play") && view.current_turn === selected.actor && view.legal_card_ids.includes(selected.id)));
    if (selected.actor === view.you) {
      const comm = view.communication_options.find(o => o.card_id === selected.id);
      comm?.markers.forEach(marker => options.append(button(`📡 ${markers[marker]}`, "communication", () => dispatch("communicate", {card_id:selected.id, marker}), can("communicate"))));
    }
    if (view.exchange_pending.includes(selected.actor)) options.append(button("Submit card", "exchange", () => dispatch("exchange", {actor:selected.actor, card_id:selected.id}), can("exchange") && selected.suit !== "trump"));
  }
  function renderPlayers() {
    const box = byId("Players"); box.replaceChildren();
    view.players.forEach(p => {
      const node = el("article", "the-crew-player"); node.classList.toggle("is-current", p.player_id === view.current_turn);
      node.append(tip(el("strong", "", `${p.player_id === view.captain ? "👑 " : ""}${p.name}`), `${p.name}${p.player_id === view.captain ? " · Captain（👑 指挥官）" : ""}`, p.player_id === view.captain ? "captain" : "hand"));
      const flags = [p.player_id === view.you ? "You" : "", p.helper ? `Helper · ${name(view.captain)}` : p.is_bot ? "Bot" : "", view.ready.includes(p.player_id) ? "Ready ✓" : ""].filter(Boolean).join(" · ");
      node.append(el("small", "", flags || "Crew"));
      const stats = el("div", "the-crew-player-stats");
      stats.append(tip(el("span", "", `🂠 ${p.hand_count}`), "Cards（🂠）：剩余牌数。", p.helper ? "helper" : "hand"), tip(el("span", "", `🏆 ${p.won}`), "Tricks（🏆）：本次已经赢得的墩数。", "trick"));
      node.append(stats); box.append(node);
    });
  }
  function renderTrick() {
    const box = byId("Trick"); box.replaceChildren();
    const review = ["trick_review", "mission_review", "game_over"].includes(view.phase);
    const shown = review ? view.trick_result : view.trick.length ? {plays:view.trick} : null;
    text("TableTitle", review ? "Last trick" : "Flight deck");
    text("Lead", shown?.plays.length ? `${cardLabel(shown.plays[0].card)} led` : "");
    if (shown) shown.plays.forEach(p => {
      const node = el("div", "the-crew-table-seat"), card = makeCard(p.card);
      card.classList.toggle("is-winner", p.player_id === shown.winner);
      node.append(card, el("small", "", `${p.player_id === shown.winner ? "🏆 " : ""}${name(p.player_id)}`)); box.append(node);
    });
    else { const empty = el("div", "the-crew-empty"); empty.append(el("span", "the-crew-empty-symbol", view.config.edition === 1 ? "🪐" : "🌊"), el("span", "", view.phase === "playing" ? `${name(view.current_turn)} leads this trick.` : "Plan together. Keep your cards private.")); box.append(empty); }
    byId("Review").classList.toggle("hidden", !review);
    text("Result", view.result ? `${view.result.success ? "✓ Mission accomplished" : "↻ Try again"}` : shown?.winner ? `${name(shown.winner)} wins the trick` : "");
    text("Reason", view.result ? `${view.result.reason} · Counted attempts: ${view.result.counted_attempts}` : "The table stays until everyone is ready.");
  }
  function renderTasks() {
    const box = byId("Tasks"), scroll = box.scrollTop; box.replaceChildren();
    text("TaskCount", `${view.tasks.filter(t => t.status === "complete").length} / ${view.tasks.length} ✓`);
    const assignment = view.target ? `指定成员：${name(view.target)}` : view.selected_members.length ? view.selected_members.map((p, i) => `${i ? "末墩" : "前四墩"}：${name(p)}`).join("；") : view.volunteers.length ? `志愿者：${view.volunteers.map(name).join("、")}` : "";
    const rule = `${view.spec.text}${assignment ? `\n${assignment}` : ""}`;
    text("MissionRule", rule); byId("MissionRule").dataset.tcTip = rule;
    view.tasks.forEach((t, index) => {
      const node = el("article", `the-crew-task is-${t.status || "hidden"}`); node.dataset.taskId = t.id;
      if (t.hidden) { node.append(tip(el("p", "", "🂠 Hidden task"), "指挥官指定成员后公开；逐张分配时只展示当前任务。", "assign")); box.append(node); return; }
      const meta = el("div", "the-crew-task-meta");
      meta.append(el("strong", "", t.owner ? name(t.owner) : "Unassigned"), tip(el("span", "", t.token ? `${t.token === "omega" ? "Ω" : t.token} · Order` : t.cost ? `◆ ${t.cost}` : `#${index + 1}`), t.token ? "Order：次序标记。" : t.cost ? "Difficulty（◆）：按当前席位数计算的难度。" : "Task（#）：目标编号，不代表完成次序。", t.token ? "order" : "tasks"));
      const desc = tip(el("p", "", `${t.status === "complete" ? "✓ " : t.status === "failed" ? "✕ " : ""}${t.text}`), t.text, "tasks"); desc.dataset.tcDetail = t.text;
      node.append(meta, desc);
      if (t.kind === "predictTricks") node.append(tip(el("div", "the-crew-task-progress", t.prediction_locked ? `🔒 ${t.prediction === undefined ? "Secret prediction locked" : `Prediction: ${t.prediction}`}` : "Prediction required"), "Lock（🔒）：预测提交后不可更改。", "predict"));
      if (t.progress?.length) node.append(tip(el("div", "the-crew-task-progress", `Collected: ${t.progress.map(cardLabel).join(" · ")}`), "尚未完成目标的相关收牌，按规则公开保留。", "tasks"));
      if (view.phase === "draft" && !t.owner) {
        const row = el("div", "the-crew-buttons"), free = ["free", "two_volunteers"].includes(view.spec.special);
        Object.entries(view.task_choices).forEach(([actor, ids]) => {
          if (ids.includes(t.id) && (free || actor === view.current_turn)) row.append(button(actor === helperId ? `Take for ${name(actor)}` : "Take task", "draft", () => dispatch("take_task", {task_id:t.id, actor}), can("take_task")));
        }); node.append(row);
      }
      box.append(node);
    });
    if (!view.tasks.length) box.append(tip(el("p", "the-crew-task-progress", "Follow this mission's special objective."), view.spec.text, "mission"));
    box.scrollTop = scroll;
  }
  function renderSignals() {
    const comm = view.communication;
    const label = comm === "shared" ? `Shared · ${view.shared_tokens} left` : comm === "normal" ? "1 per member" : comm === "hidden" ? "Hidden marker" : comm === "none" ? "Unavailable" : `From trick ${comm.slice(-1)}`;
    text("CommCount", label); byId("CommCount").dataset.tcTip = `Communication（📡）：${label}`;
    const box = byId("Signals"); box.replaceChildren();
    Object.entries(view.communications).forEach(([pid, signals]) => signals.forEach(m => {
      const node = tip(el("div", `the-crew-signal${m.played ? " is-played" : ""}`), `${name(pid)} · ${cardLabel(m.card)} · ${markers[m.marker]}${m.played ? " · 已打出" : ""}`, "communication");
      node.append(el("span", "", name(pid)), el("span", "", `${cardLabel(m.card)} ${markers[m.marker]}${m.played ? " ✓" : ""}`)); box.append(node);
    }));
    if (!box.children.length) box.append(el("div", "the-crew-task-progress", "No signals yet."));
    const log = byId("Log"), scroll = log.scrollTop; log.replaceChildren();
    [...view.journal].reverse().forEach(r => log.append(el("li", "", `M${r.mission} · Attempt ${r.attempt} · ${r.success ? "✓" : "↻"} ${r.reason}`)));
    view.status_notes.forEach(note => log.append(el("li", "", note))); log.scrollTop = scroll;
  }
  function renderControls() {
    const box = byId("Controls"); box.replaceChildren();
    const add = (label, kind, fields = {}, key = kind) => box.append(button(label, key, () => dispatch(kind, fields), can(kind)));
    if (!view.players.some(p => p.player_id === view.you)) { box.append(el("p", "", "Spectating · hands remain private.")); return; }
    if (view.game_over) { box.append(el("p", "", "Mission complete. Use room controls to start another game.")); return; }
    if (view.phase === "tokens" && view.current_controller === view.you) {
      const opts = view.tasks.map((t, i) => [i, `#${i + 1} · ${t.token || "—"} · ${t.text}`]);
      const first = select("From task", opts), second = select("To task", opts);
      box.append(first, second, button("Apply markers", "tokens", () => dispatch("tokens", {first:Number(first.value), second:Number(second.value)}), can("tokens"))); add("Keep markers", "keep_tokens", {}, "tokens");
    } else if (["responses", "volunteer"].includes(view.phase) && can("respond")) {
      const actors = view.phase === "volunteer" ? [view.current_turn] : view.controlled_seats.filter(p => !(p in view.responses));
      actors.forEach(actor => {
        const sick = view.spec.special === "sick";
        const row = el("div", "the-crew-control-row"); row.append(el("strong", "", `${name(actor)} · ${sick ? "How do you feel?" : "Willing?"}`));
        const need = (view.spec.special === "two_volunteers" ? 2 : 1) - view.volunteers.length;
        row.append(button(sick ? "Good" : "Yes", "respond", () => dispatch("respond", {actor, yes:true})), button(sick ? "Bad" : "No", "respond", () => dispatch("respond", {actor, yes:false}), view.phase !== "volunteer" || view.volunteer_remaining > need)); box.append(row);
      });
    } else if (view.phase === "assign" && view.assignable.length) {
      box.append(el("p", "", view.spec.special === "relay" ? (view.selected_members.length ? "Choose who wins only the last trick." : "Choose who wins only tricks 1–4.") : "Choose a crew member."));
      const row = el("div", "the-crew-buttons");
      view.assignable.forEach(pid => row.append(button(`${name(pid)}${pid in view.responses ? view.responses[pid] ? " · Yes" : " · No" : ""}`, "assign", () => dispatch("assign", {player_id:pid}), can("assign")))); box.append(row);
    } else if (view.phase === "predict") {
      view.tasks.filter(t => t.kind === "predictTricks" && view.controlled_seats.includes(t.owner) && !t.prediction_locked).forEach(t => {
        const row = el("div", "the-crew-control-row"), input = select(`Prediction ${t.id}`, Array.from({length:view.total_tricks + 1}, (_, i) => [i, `${i} tricks`]));
        row.append(el("span", "", name(t.owner)), input, button("Lock prediction", "predict", () => dispatch("predict", {task_id:t.id, value:Number(input.value)}), can("predict"))); box.append(row);
      });
    } else if (view.phase === "distress_vote") {
      box.append(el("p", "", `🆘 Exchange ${view.proposal.direction} · ${Object.keys(view.proposal.votes).length} agreed`));
      if (can("distress_vote")) { const row = el("div", "the-crew-buttons"); row.append(button("Agree", "distress", () => dispatch("distress_vote", {yes:true})), button("Decline", "distress", () => dispatch("distress_vote", {yes:false}))); box.append(row); }
    } else if (view.phase === "exchange") {
      box.append(el("p", "", view.exchange_pending.length ? `Choose a non-trump card for ${view.exchange_pending.map(name).join(" / ")}.` : "Submitted. Waiting for the other crew members."));
    } else if (view.phase === "draft") {
      box.append(el("p", "", can("take_task") ? "Choose an available task in the mission panel." : `Waiting for ${name(view.current_turn)} to choose.`));
      if (view.legal_actions.includes("pass_task")) add("Pass task", "pass_task", {}, "draft");
    } else if (["preflight", "trick_review", "mission_review"].includes(view.phase)) {
      const kind = view.phase === "preflight" ? "ready" : view.phase === "trick_review" ? "next_round" : "next_mission";
      const label = view.ready.includes(view.you) ? "Ready ✓" : kind === "ready" ? "Ready to begin" : kind === "next_round" ? "Next Round" : view.result.success ? "Continue" : "Retry mission";
      const row = el("div", "the-crew-control-row");
      const next = button(label, "ready", () => dispatch(kind), can(kind)); next.id = "theCrewNext";
      row.append(next, el("span", "", `${view.ready.length} / ${view.players.filter(p => !p.helper).length} ready`)); box.append(row);
      if (view.legal_actions.includes("distress")) {
        const details = el("details"); details.append(el("summary", "", "🆘 Distress signal")); const row = el("div", "the-crew-buttons");
        ["left", "right"].forEach(direction => row.append(button(`Propose ${direction}`, "distress", () => dispatch("distress", {direction}), can("distress")))); details.append(row); box.append(details);
      }
      if (view.legal_actions.includes("handover")) {
        const details = el("details"); details.append(el("summary", "", "Handover one task"));
        const task = select("Handover task", view.tasks.filter(t => t.owner === view.you).map(t => [t.id, t.text])), target = select("Handover to", view.players.filter(p => p.player_id !== view.you).map(p => [p.player_id, p.name]));
        details.append(task, target, button("Handover", "handover", () => dispatch("handover", {task_id:task.value, player_id:target.value}), can("handover"))); box.append(details);
      }
    } else if (view.phase === "playing") {
      box.append(el("p", "", can("play") ? `Choose a card from ${view.current_turn === helperId ? name(helperId) : "your hand"}.` : `Waiting for ${name(view.current_turn)}.`));
    }
    if (!box.children.length) box.append(el("p", "", "Waiting for the crew."));
    if (view.phase === "responses" && Object.keys(view.responses).length) box.append(el("p", "", Object.entries(view.responses).map(([pid, yes]) => `${name(pid)}: ${view.spec.special === "sick" ? yes ? "Good" : "Bad" : yes ? "Yes" : "No"}`).join(" · ")));
    if (view.distress_active) box.append(tip(el("span", "", "🆘 Active · +1 counted attempt"), explanations.distress[1], "distress"));
  }
  function render() {
    if (!view) return;
    panel.dataset.edition = view.config.edition;
    text("Edition", view.config.edition === 1 ? "01 / THE QUEST FOR PLANET NINE" : "02 / MISSION DEEP SEA");
    text("Mission", `${view.config.mode === "custom" ? "CUSTOM MISSION" : `MISSION ${String(view.mission).padStart(2, "0")}`} · Attempt ${view.attempt}`);
    text("Status", `${phases[view.phase]}${view.phase === "playing" ? ` · ${name(view.current_turn)}` : ""}`);
    text("TrickNumber", `Trick ${view.trick_number} / ${view.total_tricks}`);
    renderPlayers(); renderTrick(); renderTasks(); renderHands(); renderControls(); renderSignals();
  }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || explaining || dialog.open) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.tcTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(innerHeight - box.height - 12, r.bottom + box.height + 12 < innerHeight ? r.bottom + 6 : r.top - box.height - 6))}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) { explaining = value; panel.classList.toggle("the-crew-explaining", value); header.classList.toggle("the-crew-explaining", value); byId("ExplainBtn").setAttribute("aria-pressed", String(value)); hideTip(); }
  function showDialog(title, body, html = false) {
    hideTip(); focusBeforeDialog = document.activeElement; text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body;
    else byId("DialogBody").replaceChildren(el("p", "", body));
    if (!dialog.open) dialog.showModal(); byId("DialogClose").focus();
  }
  function explain(target) {
    if (!target) return;
    const key = target.dataset.tcExplain, entry = explanations[key];
    if (!entry) return;
    setExplain(false); showDialog(entry[0], target.dataset.tcDetail || (key === "mission" ? `${view?.spec.text || ""} ${entry[1]}` : entry[1]));
  }
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("The Crew · Game Rules", missionHelp + help, true); if (view) { byId("DialogBody").prepend(el("p", "", `Current mission: ${view.spec.text}`)); } });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  dialog.addEventListener("click", event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
  const exempt = target => target.closest("#theCrewHelpBtn, #theCrewExplainBtn, #theCrewDialog, #theCrewMissionDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = event.target.closest("[data-tc-explain]") || [...panel.querySelectorAll("[data-tc-explain]")].find(node => { const r = node.getBoundingClientRect(); return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom; });
    suppressClick = true; clearTimeout(suppressTimer); suppressTimer = setTimeout(() => { suppressClick = false; }, 700); explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-tc-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); selected = null; if (view) renderHands(); }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-tc-explain]"));
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-tc-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-tc-tip]"))); panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-tc-tip]"); if (target) showTip(target, true); else hideTip();
    if (!event.target.closest("button, select, #theCrewSelection, dialog") && selected) { selected = null; renderHands(); }
  });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);

  function updateSetup() {
    document.querySelectorAll("[data-the-crew-edition]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.theCrewEdition) === edition)));
    text("SetupNote", edition === 1 ? "目标牌与次序任务。双人自动加入助手 JARVIS。" : "96 种任务，按席位数计算难度。双人自动加入助手 Tonoja。限时关卡采用官方不限时条件。");
  }
  function updateMissionOptions() {
    const missionEdition = missionContext?.edition || edition;
    const custom = byId("SetupMode").value === "custom";
    ["Mission", "Count", "Difficulty", "Order", "Comm"].forEach(field => byId(`${field}Field`).classList.toggle("hidden", field === "Mission" ? custom : !custom || (field === "Difficulty" ? missionEdition === 1 : ["Count", "Order"].includes(field) ? missionEdition === 2 : false)));
    const mission = byId("SetupMission"), value = Number(mission.value) || 1; mission.replaceChildren();
    for (let i = 1; i <= (missionEdition === 1 ? 50 : 32); i++) { const option = el("option", "", `Mission ${i}`); option.value = i; mission.append(option); }
    mission.value = Math.min(value, missionEdition === 1 ? 50 : 32);
  }
  const isHost = () => currentRoomState?.game_type === "the_crew" && currentRoomState.host_player_id === playerId;
  function missionBlockReason() {
    if (!isHost()) return "Only the host can choose a mission.";
    if (!socket.connected || !roomSessionReady) return "Reconnect to the room before choosing a mission.";
    if (!missionContext || missionContext.roomId !== roomId) return "Room changed. Choose the mission again.";
    if (missionContext.kind === "start") return getRoomStartReason();
    if (!view || missionContext.gameToken !== view.game_token) return "Game changed. Choose the mission again.";
    return "";
  }
  function syncRoomControls() {
    const restart = byId("Restart");
    const active = ["in_game", "game_over"].includes(currentRoomState?.status);
    restart.classList.toggle("hidden", !isHost() || !active);
    restart.disabled = !socket.connected || !roomSessionReady || !!pendingRoomRequest || !view;
    if (!missionDialog.open) return;
    const reason = missionBlockReason(), busy = !!pendingRoomRequest;
    byId("MissionSubmit").disabled = busy || !!reason;
    byId("MissionSubmit").title = reason;
    text("MissionSubmit", busy ? "Starting..." : missionContext?.kind === "restart" ? "Restart Mission" : "Start Mission");
    missionDialog.querySelectorAll("select").forEach(node => { node.disabled = busy; });
    text("MissionAvailability", reason);
  }
  window.syncTheCrewRoomControls = syncRoomControls;
  window.openTheCrewMissionPicker = (kind = "start") => {
    if (!isHost() || !ensureRoomConnection()) return;
    if (kind === "start" && getRoomStartReason()) { setRoomFeedback(getRoomStartReason(), true); return; }
    if (kind === "restart" && (!view || !["in_game", "game_over"].includes(currentRoomState.status))) return;
    if (missionDialog.open) return;
    setExplain(false); hideTip(); if (dialog.open) dialog.close();
    const config = {edition:1, ...(kind === "restart" ? view.config : currentRoomState.game_config)};
    missionContext = {kind, roomId, edition:config.edition, gameToken:view?.game_token};
    focusBeforeMission = document.activeElement;
    byId("SetupMode").value = config.mode || "campaign";
    byId("SetupCount").value = config.task_count || 3;
    byId("SetupDifficulty").value = config.difficulty || 5;
    byId("SetupOrder").value = config.order || "none";
    byId("SetupComm").value = config.communication || "normal";
    updateMissionOptions();
    byId("SetupMission").value = kind === "restart" ? view.mission : config.mission || 1;
    text("MissionDialogTitle", kind === "restart" ? "Restart · Choose a mission" : "Choose a mission");
    text("MissionEdition", config.edition === 1 ? "🚀 1 · 第九行星任务 · 50 missions" : "🌊 2 · 深海任务 · 32 missions");
    text("MissionNotice", kind === "restart" ? "Restart resets the current game. Everyone stays in this room." : "Choose a mission for your crew, then start the game.");
    text("MissionError", "");
    missionDialog.showModal(); syncRoomControls(); byId(byId("SetupMode").value === "campaign" ? "SetupMission" : "SetupMode").focus();
  };
  byId("Restart").addEventListener("click", () => window.openTheCrewMissionPicker("restart"));
  byId("MissionClose").addEventListener("click", () => missionDialog.close());
  missionDialog.addEventListener("close", () => {
    missionContext = null;
    if (focusBeforeMission?.isConnected) focusBeforeMission.focus();
    focusBeforeMission = null;
  });
  missionDialog.addEventListener("click", event => {
    const r = missionDialog.getBoundingClientRect();
    if (event.target === missionDialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) missionDialog.close();
  });
  byId("MissionSubmit").addEventListener("click", () => {
    const reason = missionBlockReason();
    if (reason || pendingRoomRequest) { text("MissionError", reason); return; }
    const config = {mode:byId("SetupMode").value, mission:Number(byId("SetupMission").value), task_count:Number(byId("SetupCount").value), difficulty:Number(byId("SetupDifficulty").value), order:byId("SetupOrder").value, communication:byId("SetupComm").value};
    const payload = {room_id:missionContext.roomId, config};
    const restarting = missionContext.kind === "restart";
    if (restarting) payload.game_token = missionContext.gameToken;
    else if (typeof attachSkipValidation === "function") attachSkipValidation(payload);
    text("MissionError", "");
    sendRoomRequest(restarting ? "the_crew:restart" : "room:start", payload, restarting ? "Restarting mission..." : "Starting mission...");
    syncRoomControls();
  });
  document.querySelectorAll("[data-the-crew-edition]").forEach(button => button.addEventListener("click", () => { edition = Number(button.dataset.theCrewEdition); updateSetup(); }));
  for (let i = 1; i <= 20; i++) { const option = el("option", "", i); option.value = i; byId("SetupDifficulty").append(option); }
  byId("SetupDifficulty").value = 5; byId("SetupMode").addEventListener("change", updateMissionOptions);
  byId("SetupBack").addEventListener("click", showCreateRoomGameStep);
  byId("SetupCreate").addEventListener("click", () => createRoomForGame("the_crew", {edition}));
  window.showTheCrewSetup = () => {
    document.getElementById("createRoomModalTitle").textContent = "The Crew · 宇航员";
    ["createRoomGameStep", "forestShuffleLanguageStep", "catanStarfarersSetupStep"].forEach(id => { const node = document.getElementById(id); node.classList.add("hidden"); node.setAttribute("aria-hidden", "true"); });
    byId("SetupStep").classList.remove("hidden"); byId("SetupStep").setAttribute("aria-hidden", "false"); updateSetup(); document.querySelector(`[data-the-crew-edition="${edition}"]`).focus();
  };
  function clearState() {
    view = null; signature = null; selected = null; choices = {}; pending = false; suppressClick = false;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer); setExplain(false); hideTip(); if (dialog.open) dialog.close();
    ["Players", "Hand", "Helper", "Trick", "Tasks", "Controls", "Signals", "Log"].forEach(suffix => byId(suffix).replaceChildren());
    ["Review", "Selection", "HelperArea"].forEach(suffix => byId(suffix).classList.add("hidden")); text("Status", "Waiting to start");
  }
  window.renderTheCrewGameState = data => {
    if (data?.view?.game_id !== "the_crew" || currentGameType !== "the_crew" || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const incoming = JSON.stringify([data.room_id, data.view.game_token, data.view.attempt_id, data.view.step, data.view.you]);
    if (signature !== incoming) { selected = null; choices = {}; hideTip(); }
    if (signature !== incoming || view?.revision !== data.view.revision) { pending = false; clearTimeout(pendingTimer); }
    signature = incoming; view = data.view;
    if (missionDialog.open && missionContext?.kind === "restart" && missionContext.gameToken !== view.game_token) missionDialog.close();
    render(); syncRoomControls();
  };
  window.clearTheCrewState = clearState;
  window.showTheCrewHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) { clearState(); if (missionDialog.open) missionDialog.close(); } syncRoomControls(); };
  function syncRoom(state) {
    if (state?.game_type !== "the_crew" || state.status === "lobby") clearState();
    if (missionDialog.open && (!isHost() || state?.room_id !== missionContext?.roomId || (missionContext?.kind === "start" && state.status !== "lobby"))) missionDialog.close();
    syncRoomControls();
  }
  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", data => { pending = false; clearTimeout(pendingTimer); if (missionDialog.open) text("MissionError", data.message); render(); syncRoomControls(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); render(); hideTip(); syncRoomControls(); });
    socket.on("connect", () => { render(); syncRoomControls(); });
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "the_crew") window.renderTheCrewGameState(lastGameStatePayload);
  }
  updateSetup();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
})();
