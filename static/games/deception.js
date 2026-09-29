(() => {
  "use strict";
  const byId = suffix => document.getElementById(`deception${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  let view = null, pending = false, pendingTimer, explaining = false, suppressClick = false, suppressTimer, tipTimer;
  let selected = {}, draft = null, replaceId = null, expandedTile = null, caseKey = null, configKey = null, focusBeforeDialog;
  const roles = {forensic: "🔬 法医", murderer: "🗡️ 凶手", accomplice: "🎭 帮凶", witness: "👁️ 目击者", investigator: "🔎 侦探"};
  const roleBriefs = {
    forensic: "通过场景板给线索；不能说话或用其他方式提示。",
    murderer: "从自己的牌中秘密确定一对答案，讨论时隐藏身份。",
    accomplice: "你知道凶手和答案，与凶手共同获胜。",
    witness: "你知道两名罪犯，但不知道谁是凶手；不要让凶手认出你。",
    investigator: "结合场景线索找出同一人面前的手段和关键线索。",
  };
  const explanations = {
    round: ["调查（🔎）", "共三轮。第一轮放六个标记，第二、三轮各换一张普通场景板。前两轮结束所有人点击 Next Round 后继续。第三轮最后一位陈述结束即结案。"],
    role: ["秘密身份（🔒）", "点击 Reveal 查看自己的身份和合法获得的秘密信息。法医（🔬）公开，其他身份结案时公开。帮凶（🎭）知道凶手和答案；目击者（👁️）仅知道两名罪犯，不知道谁是凶手。"],
    badge: ["警徽（🛡️）", "除法医（🔬）外每人只有一次指认机会。点击同一位其他玩家的一张手段（🗡️）和一张线索（🧩），再 Confirm。错误只得到“不正确”，仍能讨论；不能再指认。"],
    card: ["手段（🗡️）与线索（🧩）", "所有牌公开。凶手从自己的牌中选一张手段（🗡️）和一张线索（🧩）作为答案。调查时选择另一玩家的一对牌再确认指认；两张必须都对。点击空白或 Esc 取消未提交选择。"],
    scene: ["场景板（📋）与标记（📍）", "点击场景板展开六个描述。法医（🔬）可按任意顺序选择最符合案件的一项，确认后标记不能移动。已标记板仍可展开查看所有选项。"],
    location: ["地点（📍）", "法医从四组地点板中选择一组，再与死亡原因和四张随机场景板组成六板。地点板一旦选定，本局不能更换。"],
    replacement: ["替换场景（🔄）", "第二、三轮法医各得到一张新场景板；选择一张普通板替换，并选择新板上的一项描述。死亡原因与地点不能替换。旧板及其标记可在 Case history 查看。"],
    present: ["开始陈述（💬）", "六个标记完成后先自由讨论。法医点击 Begin Presentations，从法医下一座位起轮流陈述，每位非法医玩家都参与。"],
    finish: ["完成陈述（💬）", "仅当前发言人可点击。原规则建议约 30 秒，线上由玩家自行结束。第三轮最后一位点击后未使用的警徽失效，未破案则凶手方获胜。正式指认可以打断任何人的陈述。"],
    next: ["Next Round", "第一、二轮结束后停留复盘。所有席位（包括法医）各自确认后才进入下一轮。机器人只确认自己的席位，断线玩家需要重连。"],
    chat: ["讨论（💬）", "第一枚标记后非法医玩家可发言；陈述期只有当前发言人能发送文字。法医始终不能用文字提示。反转时只允许凶手和帮凶讨论，讨论内容公开。"],
    confirm: ["Confirm", "提交当前选择。定案、标记、指认和目击者选择提交后无法撤回；选错可以先点 Cancel、空白区域或 Esc。"],
    cancel: ["Cancel", "取消尚未提交的选择；也可点击周围空白区域或按 Esc。"],
    witness: ["目击者反转（👁️）", "答案被正确指认后，凶手与帮凶可以讨论，再由凶手选择一人。选中目击者则罪犯反胜，否则侦探、法医和目击者获胜。"],
  };
  const help = `
    <p>4–12 人 · 三轮推理 · 基础规则。找出凶手面前的一张 <b>手段（🗡️）</b>和一张<b>关键线索（🧩）</b>，两张都对才算破案。</p>
    <h3>身份（🔒）</h3><ul><li><b>法医（🔬）</b>身份公开、知道答案，只能用场景板（📋）上的标记（📍）提供线索，不能文字、语音或手势提示。</li><li><b>凶手（🗡️）</b>从自己面前的手段和线索各选一张秘密定案，之后混入讨论。</li><li><b>侦探（🔎）</b>分析线索、讨论与指认。法医属于侦探方。</li><li>6 人以上可加<b>帮凶（🎭）</b>，知道凶手与答案；同时可加<b>目击者（👁️）</b>，仅知道两名罪犯，不知道谁是凶手或答案。</li></ul>
    <h3>调查（🔎）</h3><p>默认每人公开 4 张手段与 4 张线索，法医没有这两类牌。法医先选一组地点板，与死亡原因和随机四张普通场景板组成六板。按任意顺序在每板六个选项中标记一个，确认后不可移动。</p><p>第一枚标记后就能讨论（💬）。六枚放完后继续讨论，由法医点击 Begin Presentations。从法医下一座位开始顺序陈述，建议每人约 30 秒；线上不强制计时，自己点击 Finish Presentation。其他人不得插话，但可正式指认。</p><p>第一、二轮陈述结束后保留当前报告，所有玩家点击 <b>Next Round</b> 才继续。第二、三轮法医各抽一张新场景板（🔄），替换一个普通板并重新标记；死亡原因与地点永久保留。</p>
    <h3>警徽（🛡️）与胜负</h3><p>除法医外，每人（包括凶手、帮凶）有一次指认机会。案件定好后随时点选<b>同一位其他玩家</b>的一张手段（🗡️）与一张线索（🧩），再 Confirm。失败只显示“不正确”，不给部分命中提示；消耗警徽后仍能讨论和陈述。</p><p>两牌都对则侦探方获胜。有目击者时进入反转：凶手与帮凶讨论，由凶手选择目击者，猜中则罪犯反胜，猜错则侦探方胜。所有警徽用尽或第三轮最后一次陈述完成仍无人破案，则罪犯获胜。结案公开身份与答案。</p>
    <h3>线上操作</h3><p>选择后 Confirm 提交，Cancel、空白或 Esc 撤销未提交选择。Private briefing 查看自己的秘密；Case history 保留标记顺序、被替换的线索与指认。Help / Explain 对话框支持 Esc；Explain 后再点击目标可看说明，期间不触发游戏操作。静态图标可悬停，手机点击提示三秒。</p>
    <h3>本实现范围</h3><p>使用原创中英双语文字牌、场景描述和 Emoji，卡池与实体版不同，无商业卡图。包含基础三轮及帮凶／目击者选项，不包含事件牌或扩展角色。3／4／5 张每类牌分别为简单／标准／困难。机器人是基于词语关联的基础练习对手，只使用自身可见信息，不理解自由文字讨论；真人社交推理体验更完整。</p><p><a href="https://www.gen42.com/wp-content/uploads/Deception_Rules_online_EN_202402.pdf" target="_blank" rel="noopener noreferrer">Publisher rulebook</a></p>`;

  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(label, explanation, handler, disabled = false, className = "") {
    const n = node("button", className, label); n.type = "button"; n.disabled = disabled;
    if (explanation) n.dataset.deceptionExplain = explanation;
    n.addEventListener("click", handler); return n;
  }
  const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
  const legal = kind => !!view?.legal_actions.includes(kind);
  const available = kind => legal(kind) && !pending && socket.connected;
  const card = id => view?.players.flatMap(p => [...p.means, ...p.clues]).find(c => c.id === id);
  const label = id => { const c = card(id); return c ? `${c.emoji} ${c.zh}` : "—"; };
  const tileName = id => [...(view?.scenes || []), ...(view?.discarded_scenes || []), ...(view?.locations || []), view?.replacement].find(t => t?.id === id)?.zh || id;
  function text(suffix, value) { byId(suffix).textContent = value; }
  function hasSelection() { return !!(selected.target_id || draft || replaceId); }
  function clearSelection() { selected = {}; draft = null; replaceId = null; renderBoard(); renderPlayers(); }
  function dispatch(kind, fields = {}) {
    if (!available(kind)) return;
    pending = true;
    selected = {}; draft = null; replaceId = null;
    sendAction({type: kind, case_token: view.case_token, round: view.round, ...fields});
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 4000);
    render();
  }
  function confirms(parent, message, callback, enabled = true) {
    parent.append(node("p", "", message));
    const row = node("div", "deception-confirm-buttons");
    row.append(button("Confirm", "confirm", callback, !enabled || pending || !socket.connected, "deception-primary"),
      button("Cancel", "cancel", clearSelection));
    parent.append(row);
  }
  function renderPrivate() {
    const body = byId("PrivateBody"); body.replaceChildren();
    if (!view?.private) { body.append(node("p", "", "Spectating · no private information")); return; }
    body.append(node("p", "", `${roles[view.private.role]} · ${roleBriefs[view.private.role]}`));
    if (view.private.solution) {
      const s = view.private.solution;
      body.append(node("p", "", `答案：${name(s.player_id)} · ${label(s.means_id)} ＋ ${label(s.clue_id)}`));
    }
    if (view.private.allies?.length) body.append(node("p", "", `罪犯：${view.private.allies.map(name).join("、")}`));
    if (view.private.suspects) body.append(node("p", "", `目击到的两人：${view.private.suspects.map(name).join("、")}（不分凶手／帮凶）`));
  }
  function renderBoard() {
    if (!view) return;
    const board = byId("Scenes"); board.replaceChildren();
    if (!view.scenes.length) board.append(node("p", "deception-empty", view.phase === "crime" ? "🔒 等待凶手秘密定案" : "📍 等待法医选择地点"));
    for (const tile of view.scenes) {
      const open = expandedTile === tile.id;
      const section = node("article", `deception-scene${open ? " is-open" : ""}`);
      const toggle = button("", "scene", () => { expandedTile = open ? null : tile.id; renderBoard(); }, false, "deception-scene-toggle");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.append(node("strong", "", `${tile.fixed ? "📌 " : ""}${tile.zh}`), node("span", "", tile.marker == null ? "○ 等待标记 · Expand" : `📍 ${tile.options[tile.marker].zh} · ${open ? "−" : "+"}`));
      section.append(toggle);
      if (open) {
        const options = node("div", "deception-options");
        tile.options.forEach((option, index) => {
          let item;
          if (legal("place_marker") && tile.marker == null) {
            item = button(option.zh, "scene", () => { draft = {type: "place_marker", tile_id: tile.id, option: index}; renderBoard(); }, pending,
              `deception-option${draft?.tile_id === tile.id && draft?.option === index ? " is-selected" : ""}`);
          } else {
            item = node("span", `deception-marker${tile.marker === index ? " is-marked" : ""}`, `${tile.marker === index ? "📍 " : ""}${option.zh}`);
            item.tabIndex = 0; item.dataset.deceptionExplain = "scene";
          }
          item.dataset.deceptionTip = `${option.zh} · ${option.en}${tile.marker === index ? "（法医已选择）" : ""}`;
          options.append(item);
        });
        section.append(options);
      }
      board.append(section);
    }
    const locations = byId("LocationChoices"); locations.replaceChildren();
    if (view.locations.length) {
      const grid = node("div", "deception-location");
      view.locations.forEach(tile => {
        const item = button(tile.zh, "location", () => { draft = {type: "choose_location", tile_id: tile.id}; renderBoard(); }, pending, draft?.tile_id === tile.id ? "is-selected" : "");
        item.append(node("small", "", tile.options.map(o => o.zh).join(" · "))); grid.append(item);
      });
      locations.append(grid);
    }
    const replacement = byId("Replacement"); replacement.replaceChildren();
    if (view.replacement) {
      const tile = view.replacement, box = node("div", "deception-replacement");
      box.append(node("strong", "", `🔄 新报告：${tile.zh}`), node("p", "", "选择替换的旧板，再选一项描述。"));
      const targets = node("div", "deception-replace-targets");
      view.scenes.filter(t => !t.fixed).forEach(t => targets.append(button(t.zh, "replacement", () => {
        replaceId = t.id; if (draft?.type === "replace_scene") draft.replace_id = t.id; renderBoard();
      }, pending, replaceId === t.id ? "is-selected" : "")));
      box.append(targets);
      const options = node("div", "deception-options");
      tile.options.forEach((option, index) => options.append(button(option.zh, "replacement", () => {
        draft = {type: "replace_scene", tile_id: tile.id, replace_id: replaceId, option: index}; renderBoard();
      }, pending, `deception-option${draft?.option === index ? " is-selected" : ""}`)));
      box.append(options); replacement.append(box);
    }
    const area = byId("Draft"); area.replaceChildren(); area.classList.toggle("hidden", !draft);
    if (draft) {
      const tile = [...view.scenes, ...view.locations, view.replacement].find(t => t?.id === draft.tile_id);
      const message = draft.type === "choose_location" ? `采用 ${tile.zh}？` : `${draft.type === "replace_scene" ? `替换 ${tileName(draft.replace_id)} → ` : ""}${tile.zh}：${tile.options[draft.option].zh}`;
      const payload = {...draft}; delete payload.type;
      confirms(area, message, () => dispatch(draft.type, payload), draft.type !== "replace_scene" || !!draft.replace_id);
    }
  }
  function renderPlayers() {
    if (!view) return;
    const area = byId("Players"), oldScroll = area.scrollTop; area.replaceChildren();
    for (const p of view.players.filter(p => p.player_id !== view.forensic_id)) {
      const section = node("article", `deception-suspect${p.player_id === view.current_turn ? " is-speaking" : ""}`);
      section.dataset.player = p.player_id;
      const head = node("div", "deception-suspect-header"), who = node("div", "deception-suspect-name", `${p.name}${p.player_id === view.you ? " · You" : ""}`);
      who.append(node("span", "deception-player-role", [p.role ? roles[p.role] : "身份未知", p.is_bot ? "Bot" : "", p.player_id === view.current_turn && view.phase === "presentation" ? "💬 陈述中" : ""].filter(Boolean).join(" · ")));
      const badge = node("span", "deception-badge", p.badge ? "🛡️" : "○"); badge.tabIndex = 0; badge.dataset.deceptionExplain = "badge";
      badge.dataset.deceptionTip = p.badge ? "警徽（🛡️）：尚有一次指认机会。" : "警徽（○）：已使用指认机会，仍可讨论和陈述。";
      head.append(who, badge); section.append(head);
      const canSelect = (legal("choose_crime") && p.player_id === view.you) || (legal("accuse") && p.player_id !== view.you);
      for (const [key, title] of [["means", "🗡️ 手段 · MEANS"], ["clues", "🧩 线索 · CLUES"]]) {
        const hand = node("div", `deception-hand ${key}`); hand.append(node("div", "deception-hand-title", title));
        const cards = node("div", "deception-cards");
        for (const c of p[key]) {
          const field = key === "means" ? "means_id" : "clue_id";
          const chosen = selected.target_id === p.player_id && selected[field] === c.id;
          const answer = view.solution?.[field] === c.id;
          const item = button("", "card", () => {
            if (selected.target_id !== p.player_id) selected = {target_id: p.player_id};
            selected[field] = selected[field] === c.id ? null : c.id;
            renderPlayers();
          }, !canSelect || pending, `deception-card${chosen ? " is-selected" : ""}${answer ? " is-answer" : ""}`);
          item.dataset.card = c.id; item.setAttribute("aria-pressed", String(chosen));
          item.setAttribute("aria-label", `${c.zh} · ${c.en}`); item.dataset.deceptionTip = `${c.emoji} ${c.zh} · ${c.en}`;
          item.append(node("span", "deception-card-icon", c.emoji), node("span", "deception-card-label", c.zh)); cards.append(item);
        }
        hand.append(cards); section.append(hand);
      }
      if (selected.target_id === p.player_id && canSelect) {
        const confirm = node("div", "deception-pair-confirm");
        const choosing = legal("choose_crime"), payload = {means_id: selected.means_id, clue_id: selected.clue_id};
        if (!choosing) payload.target_id = p.player_id;
        confirms(confirm, `${choosing ? "秘密定案" : "消耗 🛡️ 指认"}：${label(selected.means_id)} ＋ ${label(selected.clue_id)}`,
          () => dispatch(choosing ? "choose_crime" : "accuse", payload), !!(selected.means_id && selected.clue_id));
        section.append(confirm);
      }
      if (legal("identify_witness") && p.player_id !== view.you) {
        section.append(button("👁️ Choose Witness", "witness", () => { selected = {target_id: p.player_id, witness: true}; renderPlayers(); }, pending, "deception-witness-button"));
        if (selected.target_id === p.player_id && selected.witness) {
          const confirm = node("div", "deception-pair-confirm"); confirms(confirm, `认定 ${p.name} 是目击者？`, () => dispatch("identify_witness", {target_id: p.player_id})); section.append(confirm);
        }
      }
      area.append(section);
    }
    area.scrollTop = oldScroll;
  }
  function historyText(entry) {
    if (entry.type === "marker") return `📍 ${tileName(entry.tile_id)}：${[...view.scenes, ...view.discarded_scenes].find(t => t.id === entry.tile_id)?.options[entry.option]?.zh || "—"}`;
    if (entry.type === "replacement") return `🔄 ${tileName(entry.replaced_id)} → ${tileName(entry.tile_id)}：${[...view.scenes, ...view.discarded_scenes].find(t => t.id === entry.tile_id)?.options[entry.option]?.zh || "—"}`;
    if (entry.type === "accusation") return `${entry.correct ? "✅" : "❌"} ${name(entry.player_id)} 指认 ${name(entry.target_id)}：${label(entry.means_id)} ＋ ${label(entry.clue_id)} · ${entry.correct ? "正确" : "不正确"}`;
    if (entry.type === "presented") return `💬 ${name(entry.player_id)} 完成陈述`;
    if (entry.type === "witness_guess") return `👁️ ${name(entry.player_id)} · ${entry.correct ? "找到目击者" : "不是目击者"}`;
    return {crime_selected: "🔒 秘密案件已确定", location: "📍 地点板已选定", presentations: "💬 开始轮流陈述", new_round: "🔎 新一轮调查"}[entry.type] || entry.type;
  }
  function renderHistory() {
    const messages = byId("Messages"), nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 40, oldTop = messages.scrollTop;
    messages.replaceChildren();
    const chat = view.history.filter(e => e.type === "message");
    if (!chat.length) messages.append(node("li", "deception-empty", "讨论将在第一枚标记后开放。"));
    for (const entry of chat) {
      const li = node("li"); li.append(node("strong", "", `${name(entry.player_id)}: `), document.createTextNode(entry.text)); messages.append(li);
    }
    messages.scrollTop = nearBottom ? messages.scrollHeight : oldTop;
    const history = byId("History"), scroll = history.scrollTop; history.replaceChildren();
    view.history.filter(e => e.type !== "message").forEach(entry => history.append(node("li", "", `R${entry.round} · ${historyText(entry)}`)));
    history.scrollTop = scroll;
  }
  function render() {
    if (!view) return;
    text("Round", `🔎 ${view.round} / 3`); text("BadgeCount", `🛡️ ${view.players.filter(p => p.badge).length}`);
    text("ForensicName", name(view.forensic_id));
    const states = {crime: legal("choose_crime") ? "从你自己的牌中秘密选择一对答案" : "等待凶手秘密定案", scene_setup: "法医选择地点板", evidence: view.round === 1 ? "法医依次放置六枚标记" : "法医替换一张场景板", discussion: "自由讨论 · 法医准备好后开始陈述", presentation: `💬 ${name(view.current_turn)} 正在陈述`, round_review: "本轮结束 · 查看报告后全员确认", reversal: "案件已破 · 凶手尝试找出目击者", game_over: "案件已结 · 身份与答案公开"};
    text("Status", states[view.phase] || view.phase);
    text("SelectionHint", legal("choose_crime") ? "选择自己的手段 + 线索" : legal("identify_witness") ? "选择目击者" : legal("accuse") ? "同一人的手段 + 线索" : "公开牌面");
    text("Speaker", view.phase === "presentation" ? name(view.current_turn) : view.private?.role === "forensic" ? "法医不可发言" : "");
    byId("Present").disabled = !available("start_presentations");
    byId("Finish").disabled = !available("end_presentation");
    byId("Next").classList.toggle("hidden", view.phase !== "round_review"); byId("Next").disabled = !available("next_round");
    text("Ready", view.phase === "round_review" ? `${view.next_round_ready.length} / ${view.players.length} ready · 等待所有席位` : "");
    byId("ChatInput").disabled = !available("discuss"); byId("Send").disabled = !available("discuss");
    const result = byId("Result"); result.replaceChildren(); result.classList.toggle("hidden", !view.solution);
    if (view.solution) {
      const s = view.solution;
      result.append(node("strong", "", view.game_over ? view.winner_team === "murderer" ? "🎭 凶手阵营获胜" : "🔎 侦探阵营获胜" : "👁️ 目击者反转"), node("div", "", `凶手：${name(s.player_id)} · ${label(s.means_id)} ＋ ${label(s.clue_id)}`));
      const reasons = {solved: "两项证据均被正确指认。", badges_exhausted: "全部警徽已用尽，案件未破。", three_rounds: "三轮陈述结束，案件未破。", witness_found: "凶手成功找出目击者，反转获胜。", witness_safe: "凶手未找到目击者。"};
      if (view.game_over) result.append(node("div", "", reasons[view.end_reason]), node("div", "", `🏆 ${view.winner_ids.map(name).join("、")}`));
    }
    renderPrivate(); renderBoard(); renderPlayers(); renderHistory();
  }

  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, temporary = false) {
    hideTip(); if (!target || explaining) return;
    tooltip.textContent = target.dataset.deceptionTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(r.bottom + 7, innerHeight - box.height - 12))}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(enabled) { explaining = enabled; panel.classList.toggle("deception-explaining", enabled); byId("ExplainBtn").setAttribute("aria-pressed", String(enabled)); hideTip(); }
  function showDialog(title, body, html = false) {
    focusBeforeDialog = document.activeElement; text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body; else byId("DialogBody").textContent = body;
    if (!dialog.open) dialog.showModal();
  }
  function explain(target) {
    const explanation = explanations[target?.dataset.deceptionExplain];
    if (explanation) { setExplain(false); showDialog(...explanation); }
  }
  function targetAt(event, attribute) {
    return event.target.closest(`[${attribute}]`) || [...panel.querySelectorAll(`[${attribute}]`)].find(n => {
      const r = n.getBoundingClientRect();
      return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
  }
  const exempt = target => target.closest("#deceptionHelpBtn, #deceptionExplainBtn, #deceptionDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); suppressClick = true;
    clearTimeout(suppressTimer); suppressTimer = setTimeout(() => { suppressClick = false; }, 750);
    explain(targetAt(event, "data-deception-explain"));
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-deception-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); if (hasSelection()) clearSelection(); }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-deception-explain]"));
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-deception-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("pointerdown", event => { if (event.pointerType === "touch") showTip(targetAt(event, "data-deception-tip"), true); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-deception-tip]"), true));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => {
    if (event.target.closest("[data-deception-tip]") && !event.target.closest("button")) showTip(event.target.closest("[data-deception-tip]"), true);
    if (!event.target.closest("button, input, a, summary, .deception-draft, .deception-pair-confirm") && hasSelection()) clearSelection();
  });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("犯罪现场 · Game Rules", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
  dialog.addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus(); });
  byId("Present").addEventListener("click", () => dispatch("start_presentations"));
  byId("Finish").addEventListener("click", () => dispatch("end_presentation"));
  byId("Next").addEventListener("click", () => dispatch("next_round"));
  byId("ChatForm").addEventListener("submit", event => {
    event.preventDefault(); const message = byId("ChatInput").value.trim();
    if (message && available("discuss")) { dispatch("discuss", {text: message}); byId("ChatInput").value = ""; }
  });
  byId("Witness").addEventListener("change", () => { if (byId("Witness").checked) byId("Accomplice").checked = true; });
  byId("Accomplice").addEventListener("change", () => { if (!byId("Accomplice").checked) byId("Witness").checked = false; });

  function clearState() {
    view = null; pending = false; selected = {}; draft = null; replaceId = null; expandedTile = null; caseKey = null;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer); suppressClick = false; setExplain(false);
    if (dialog.open) dialog.close(); byId("Private").open = false; byId("ChatInput").value = "";
    ["Scenes", "Players", "Messages", "History", "PrivateBody", "LocationChoices", "Replacement", "Draft", "Result"].forEach(id => byId(id).replaceChildren());
    ["Draft", "Result", "Next"].forEach(id => byId(id).classList.add("hidden"));
    ["Present", "Finish", "Next", "Send", "ChatInput"].forEach(id => { byId(id).disabled = true; });
    text("Status", "Waiting to start"); text("Ready", "");
  }
  function syncConfig(state) {
    const visible = state?.game_type === "deception" && state.status === "lobby";
    byId("ConfigBox").classList.toggle("hidden", !visible); byId("ConfigBox").setAttribute("aria-hidden", String(!visible));
    if (state?.game_type !== "deception") return;
    const signature = JSON.stringify([state.room_id, state.game_config]);
    if (signature !== configKey) {
      byId("CardCount").value = String(state.game_config?.cards_per_type || 4);
      byId("Accomplice").checked = !!state.game_config?.accomplice; byId("Witness").checked = !!state.game_config?.witness; configKey = signature;
    }
    const enoughPlayers = state.players?.length >= 6;
    byId("Accomplice").disabled = !enoughPlayers; byId("Witness").disabled = !enoughPlayers;
    if (!enoughPlayers) { byId("Accomplice").checked = false; byId("Witness").checked = false; }
    if (visible && view) clearState();
  }
  window.getDeceptionConfig = () => ({cards_per_type: Number(byId("CardCount").value), accomplice: byId("Accomplice").checked, witness: byId("Witness").checked});
  window.renderDeceptionGameState = data => {
    if (data?.view?.game_id !== "deception" || currentGameType !== "deception" || (data.room_id && data.room_id !== currentRoomState?.room_id)) return;
    const incoming = data.view, signature = `${incoming.case_token}:${incoming.round}`;
    if (signature !== caseKey) { selected = {}; draft = null; replaceId = null; expandedTile = null; if (!caseKey || incoming.case_token !== view?.case_token) byId("Private").open = false; caseKey = signature; }
    if (draft && !incoming.legal_actions.includes(draft.type)) draft = null;
    if (!incoming.legal_actions.some(k => ["choose_crime", "accuse", "identify_witness"].includes(k))) selected = {};
    if (view?.phase !== incoming.phase) { draft = null; replaceId = null; }
    if (!view || view.revision !== incoming.revision) { pending = false; clearTimeout(pendingTimer); }
    view = incoming; hideTip(); render();
  };
  window.showDeceptionHeaderActions = visible => {
    header.style.display = visible ? "flex" : "none";
    if (!visible) { clearState(); byId("ConfigBox").classList.add("hidden"); }
    else if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
  };
  function init() {
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); if (view) render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); if (view) render(); });
    socket.on("connect", () => { if (view) render(); });
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "deception") window.renderDeceptionGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true}); else init();
})();
