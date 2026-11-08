(() => {
  "use strict";
  const byId = suffix => document.getElementById(`deception${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), tooltip = byId("Tooltip");
  let view = null, pending = false, pendingTimer, tipTimer;
  let selected = {}, draft = null, replaceId = null, expandedTile = null, caseKey = null, configKey = null;
  const roles = {forensic: "🔬 法医", murderer: "🗡️ 凶手", accomplice: "🎭 帮凶", witness: "👁️ 目击者", investigator: "🔎 侦探"};
  const roleBriefs = {
    forensic: "通过场景板给线索；不能说话或用其他方式提示。",
    murderer: "从自己的牌中秘密确定一对答案，讨论时隐藏身份。",
    accomplice: "你知道凶手和答案，与凶手共同获胜。",
    witness: "你知道两名罪犯，但不知道谁是凶手；不要让凶手认出你。",
    investigator: "结合场景线索找出同一人面前的手段和关键线索。",
  };
  const DECEPTION_HELP_CONFIG = {
    gameId: "deception",
    title: { zh: "犯罪现场 · Deception", en: "Deception: Murder in Hong Kong" },
    basic: {
      win: {
        zh: "侦探方要在三轮内指认出凶手，并说中他面前的一张手段(🗡️)和一张线索(🧩)，三项全对才算破案。",
        en: "The investigators win by naming the murderer together with one means (🗡️) and one clue (🧩) from that player's hand, all three correct, within three rounds."
      },
      turn: {
        zh: "法医(🔬)在六张场景板(📋)上逐个放下标记(📍)，其他玩家随时可以讨论(💬)和指认，陈述阶段只有当前发言人能开口。",
        en: "The forensic scientist (🔬) drops one marker (📍) on each of the six scene tiles (📋), while everyone else may discuss (💬) and accuse at any time, and during presentations only the current speaker may talk."
      },
      key: {
        zh: "法医知道答案却只能用标记说话，你要把这些标记读成三件事：谁是凶手、用了什么手段、留下了什么线索。",
        en: "The forensic scientist knows the answer but can only speak through markers, so you must read those markers as three facts: who did it, which means was used, and which clue was left behind."
      }
    },
    sections: [
      {
        id: "roles",
        label: { zh: "身份", en: "Roles" },
        html: {
          zh: "<p>身份随机发放。法医(🔬)的身份全程公开，其他身份要到结案才公开。</p>"
            + "<ul><li>法医(🔬)知道答案，只能用场景板(📋)上的标记(📍)给线索，不能写文字、说话或做手势。</li>"
            + "<li>凶手(🗡️)从自己面前的牌里秘密选出一张手段(🗡️)和一张线索(🧩)作为答案，之后混进讨论。</li>"
            + "<li>侦探(🔎)负责解读线索、参与讨论和正式指认，法医也站在侦探这一边。</li>"
            + "<li>帮凶(🎭)和目击者(👁️)是六人以上才能开启的可选角色。帮凶知道凶手和答案，与凶手同胜同负。目击者只知道两名罪犯是谁，不知道谁是凶手，也不知道答案。</li></ul>",
          en: "<p>Roles are dealt at random. The forensic scientist (🔬) is public for the whole game, while every other role stays hidden until the case closes.</p>"
            + "<ul><li>The forensic scientist (🔬) knows the answer and may only give clues through markers (📍) on the scene tiles (📋), never through words or gestures.</li>"
            + "<li>The murderer (🗡️) secretly picks one means (🗡️) and one clue (🧩) from their own cards as the answer, then blends into the discussion.</li>"
            + "<li>The investigators (🔎) read the clues, join the discussion and make formal accusations. The forensic scientist is on their side.</li>"
            + "<li>The accomplice (🎭) and the witness (👁️) are optional roles that need at least six players. The accomplice knows the murderer and the answer and shares that side's win. The witness only knows which two players are guilty, not which of them is the murderer and not the answer.</li></ul>"
        }
      },
      {
        id: "cards",
        label: { zh: "手牌", en: "Cards" },
        html: {
          zh: "<p>每位非法医玩家面前公开摆着同样数量的手段(🗡️)和线索(🧩)。数量由房间设置决定，三张是简单，四张是标准，五张是困难。法医(🔬)这两类牌都没有。</p>"
            + "<p>所有牌对所有人公开，所以你能看到每个人手里有什么，却看不出凶手选了哪两张。</p>"
            + "<p>指认时必须选同一位其他玩家的一张手段(🗡️)和一张线索(🧩)，两张都指对才算成功。</p>",
          en: "<p>Every player except the forensic scientist has the same number of means (🗡️) and clues (🧩) laid out face up. The room setting decides how many: three is easy, four is standard, five is hard. The forensic scientist (🔬) holds neither kind.</p>"
            + "<p>All cards are public, so you can see what everyone holds but never which two the murderer picked.</p>"
            + "<p>An accusation must name one means (🗡️) and one clue (🧩) belonging to the same other player, and both have to be right.</p>"
        }
      },
      {
        id: "forensics",
        label: { zh: "场景板与标记", en: "Tiles and markers" },
        html: {
          zh: "<p>案子定下之后，法医(🔬)先从四组地点板里选一组。它与死亡原因板和四张随机场景板(📋)一起组成六张板，地点板一旦选定本局都不能更换。</p>"
            + "<p>每张板都有六个描述。法医按任意顺序为每张板挑一个描述并放下标记(📍)，确认之后标记不能移动。六枚标记全部放完，讨论阶段才开始。</p>"
            + "<p>第二、三轮法医各抽到一张新场景板(🔄)，用它换掉一张普通板并重新标记。死亡原因板和地点板不能被替换，被换掉的旧板连同它的标记可以在 Case history 里回看。</p>",
          en: "<p>Once the crime is set, the forensic scientist (🔬) picks one of four location tiles. Together with the cause of death and four random scene tiles (📋) it forms the six tiles, and the location can never be swapped for the rest of the game.</p>"
            + "<p>Every tile carries six descriptions. The forensic scientist works through them in any order, picks one description per tile and drops a marker (📍) there. A confirmed marker can never move. The discussion phase opens only after all six markers are down.</p>"
            + "<p>In rounds two and three the forensic scientist draws one new scene tile (🔄), swaps it for an ordinary tile and marks it again. The cause of death and the location can never be replaced, and the retired tile stays visible with its marker in Case history.</p>"
        }
      },
      {
        id: "round",
        label: { zh: "讨论与陈述", en: "Discussion" },
        html: {
          zh: "<p>第一枚标记(📍)放下后，非法医玩家就可以开始讨论(💬)。六枚标记放完后继续讨论，由法医(🔬)点击 Begin Presentations 进入陈述。</p>"
            + "<p>陈述从法医的下一个座位开始，每位非法医玩家轮流发言。发言时只有他能发文字，其他人不得插话，但任何人都可以正式指认。</p>"
            + "<p>第一、二轮陈述结束后案子停在复盘阶段，所有席位都点击 Next Round 才进入下一轮。第三轮最后一位陈述结束时案子自动了结。</p>",
          en: "<p>As soon as the first marker (📍) is down, every player except the forensic scientist may discuss (💬). After the sixth marker the talk continues until the forensic scientist (🔬) presses Begin Presentations.</p>"
            + "<p>Presentations start from the seat after the forensic scientist, and every non-forensic player speaks in turn. Only the current speaker may type, nobody else may interrupt, yet anyone may still make a formal accusation.</p>"
            + "<p>After the presentations of rounds one and two the case pauses for review, and the next round starts only once every seat has pressed Next Round. The case closes by itself when the last speaker of round three finishes.</p>"
        }
      },
      {
        id: "accuse",
        label: { zh: "警徽与胜负", en: "Badges and winning" },
        html: {
          zh: "<p>除法医(🔬)外每位玩家只有一枚警徽(🛡️)，也就是一次正式指认机会。案子定好之后，你可以随时点选同一位其他玩家的一张手段(🗡️)和一张线索(🧩)再确认。</p>"
            + "<p>指认只有全对和全错两种结果，不会告诉你哪一张对了。警徽用掉之后你不能再指认，但仍然可以讨论和陈述。</p>"
            + "<p>指认正确时，若房间启用了目击者(👁️)，案子会先进入反转。凶手(🗡️)和帮凶(🎭)可以讨论，再由凶手指认一名玩家。指中目击者则罪犯方反败为胜，指错则侦探方获胜。</p>"
            + "<p>所有警徽都用光，或者第三轮最后一次陈述结束仍无人破案，罪犯方获胜。结案时公开全部身份和答案。</p>",
          en: "<p>Everyone except the forensic scientist (🔬) holds a single badge (🛡️), which is one formal accusation. Once the crime is set you may at any time pick one means (🗡️) and one clue (🧩) from the same other player and confirm.</p>"
            + "<p>An accusation is either completely right or completely wrong, and it never tells you which part you missed. Once the badge is spent you cannot accuse again, but you can still discuss and present.</p>"
            + "<p>When an accusation is correct and the room runs with a witness (👁️), the case first enters the reversal. The murderer (🗡️) and the accomplice (🎭) may talk it over, then the murderer names one player. Hitting the witness turns the loss into a win for the guilty side, missing hands the game to the investigators.</p>"
            + "<p>The guilty side also wins once every badge is spent, or when the last presentation of round three ends with the case unsolved. Closing the case reveals every role and the answer.</p>"
        }
      },
      {
        id: "online",
        label: { zh: "线上操作", en: "Playing online" },
        html: {
          zh: "<p>选好之后按 Confirm 提交。按 Cancel、点击空白区域或按 Esc 都能撤销尚未提交的选择。</p>"
            + "<p>Private briefing 里可以查看自己的身份和合法获得的秘密信息。Case history 保留了标记顺序、被替换的场景板和每一次指认。</p>"
            + "<p>本实现使用原创的中英双语文字牌与场景描述，卡池和实体版不同，也没有商业卡图。它包含基础三轮以及帮凶(🎭)、目击者(👁️)选项，不含事件牌和扩展角色。机器人只使用自己看得到的信息，读不懂自由文字讨论，真人局的推理体验更完整。</p>"
            + "<p><a href=\"https://www.gen42.com/wp-content/uploads/Deception_Rules_online_EN_202402.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Publisher rulebook</a></p>",
          en: "<p>Press Confirm to submit a selection. Press Cancel, click the empty area or hit Esc to drop a selection you have not submitted.</p>"
            + "<p>Private briefing shows your role and the secrets you are entitled to. Case history keeps the order of the markers, the replaced scene tiles and every accusation.</p>"
            + "<p>This implementation uses original bilingual text cards and scene descriptions, so the deck differs from the physical edition and carries no commercial art. It covers the basic three rounds plus the accomplice (🎭) and witness (👁️) options, and it has no event cards or extra roles. Bots only use what they can see and cannot follow free text discussion, so a table of humans plays much better.</p>"
            + "<p><a href=\"https://www.gen42.com/wp-content/uploads/Deception_Rules_online_EN_202402.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Publisher rulebook</a></p>"
        }
      }
    ]
  };

  const DECEPTION_EXPLAIN = {
    round: { zh: "调查(🔎)进度，最多三轮。第一轮放满六枚标记(📍)，第二、三轮各替换一张普通场景板(📋)。第三轮最后一位陈述结束时若仍无人破案，罪犯方获胜。", en: "Case progress, three rounds at most. Round one places all six markers (📍), and rounds two and three each replace one ordinary scene tile (📋). If nobody solves the case by the end of the last presentation in round three, the guilty side wins." },
    role: { zh: "你的秘密身份(🔒)。展开 Private briefing 查看自己的角色和合法获得的秘密。法医(🔬)的身份公开，其他身份要到结案才公开。", en: "Your secret role (🔒). Open Private briefing to see your role and the secrets you are entitled to. The forensic scientist (🔬) is public, every other role is revealed only when the case closes." },
    badge: { zh: "警徽(🛡️)，也就是一次正式指认机会。除法医(🔬)外每人只有一枚，用掉之后不能再指认，但仍然可以讨论和陈述。", en: "A badge (🛡️) is one formal accusation. Everyone except the forensic scientist (🔬) has exactly one, and once it is spent you cannot accuse again, though you may still discuss and present." },
    card: { zh: "手段(🗡️)与线索(🧩)。所有牌公开，凶手(🗡️)从自己面前的牌里各选一张作为答案。指认时必须选同一位其他玩家的一张手段(🗡️)和一张线索(🧩)。", en: "Means (🗡️) and clues (🧩). Every card is public, and the murderer (🗡️) picks one of each from their own cards as the answer. An accusation must name one means (🗡️) and one clue (🧩) belonging to the same other player." },
    scene: { zh: "场景板(📋)。点开一张板会展开六个描述，法医(🔬)为每张板挑一个并放下标记(📍)，确认之后标记不能移动。", en: "A scene tile (📋). Expanding a tile shows its six descriptions. The forensic scientist (🔬) picks one per tile and drops a marker (📍) there, and a confirmed marker can never move." },
    location: { zh: "地点(📍)。开局由法医(🔬)从四组地点板里选一组，它与死亡原因板和四张随机场景板组成六张板，本局都不能更换。", en: "The location (📍). At the start the forensic scientist (🔬) picks one of four location tiles. It joins the cause of death and four random scene tiles to form the six tiles, and it can never be swapped." },
    replacement: { zh: "替换场景(🔄)。第二、三轮法医(🔬)各抽到一张新场景板，用它换掉一张普通板并重新标记。死亡原因板与地点板不能替换，旧板可以在 Case history 里回看。", en: "Scene replacement (🔄). In rounds two and three the forensic scientist (🔬) draws one new scene tile, swaps it for an ordinary tile and marks it again. The cause of death and the location can never be replaced, and the old tile stays visible in Case history." },
    present: { zh: "Begin Presentations。六个标记放完后由法医(🔬)开启陈述，从法医的下一个座位开始，每位非法医玩家轮流发言。", en: "Begin Presentations. Once all six markers are placed the forensic scientist (🔬) opens the presentation round, starting from the seat after the forensic scientist, and every non-forensic player speaks in turn." },
    finish: { zh: "Finish Presentation。只有当前发言人能点击。第三轮最后一位点完时案子了结，若仍无人破案则罪犯方获胜。任何人都可以在别人陈述时正式指认。", en: "Finish Presentation. Only the current speaker can press it. When the last speaker of round three finishes, the case closes and the guilty side wins if it is still unsolved. Anyone may make a formal accusation while somebody else is presenting." },
    next: { zh: "Next Round。第一、二轮陈述结束后停在复盘阶段，所有席位（包括法医）都确认之后才进入下一轮。", en: "Next Round. After the presentations of rounds one and two the case pauses for review, and the next round starts only once every seat, including the forensic scientist, has confirmed." },
    chat: { zh: "讨论(💬)。第一枚标记放下后非法医玩家就能发言，陈述阶段只有当前发言人能发文字，法医(🔬)始终不能发言。反转阶段只有凶手(🗡️)和帮凶(🎭)能讨论，内容对所有人公开。", en: "Discussion (💬). Once the first marker is placed every non-forensic player may talk, during presentations only the current speaker may type, and the forensic scientist (🔬) can never speak. In the reversal only the murderer (🗡️) and the accomplice (🎭) may talk, and what they write is public." },
    confirm: { zh: "Confirm。提交当前选择。定案、标记、指认和目击者选择一旦提交就无法撤回。", en: "Confirm. Submits the current selection. A crime choice, a marker, an accusation or a witness pick can never be taken back once submitted." },
    cancel: { zh: "Cancel。取消尚未提交的选择，也可以点击周围空白区域或按 Esc。", en: "Cancel. Drops the selection you have not submitted yet. Clicking the empty area around the board or pressing Esc does the same." },
    witness: { zh: "目击者反转(👁️)。答案被正确指认后，凶手(🗡️)和帮凶(🎭)先讨论，再由凶手指一名玩家。指中目击者(👁️)则罪犯方反败为胜，指错则侦探方获胜。", en: "The witness reversal (👁️). After a correct accusation the murderer (🗡️) and the accomplice (🎭) talk it over, then the murderer names one player. Hitting the witness (👁️) turns the loss into a win for the guilty side, and missing gives the game to the investigators." }
  };

  let deceptionHelpWidget = null;
  let deceptionExplainWidget = null;

  function initDeceptionHelpExplain() {
    if (deceptionHelpWidget || typeof window.obgCreateHelp !== "function") return;
    deceptionHelpWidget = window.obgCreateHelp(DECEPTION_HELP_CONFIG);
    deceptionExplainWidget = window.obgCreateExplain({
      gameId: "deception",
      attribute: "data-deception-explain",
      explanations: DECEPTION_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => document.getElementById("deceptionPanel"),
      bypass: ["#deceptionHelpBtn", "#deceptionExplainBtn"]
    });
    byId("HelpBtn")?.addEventListener("click", () => {
      deceptionExplainWidget?.exit();
      deceptionHelpWidget.open();
    });
    byId("ExplainBtn")?.addEventListener("click", () => deceptionExplainWidget?.toggle());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDeceptionHelpExplain);
  } else {
    initDeceptionHelpExplain();
  }

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
    if (["place_marker", "replace_scene"].includes(kind)) expandedTile = null;
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
    if (!view.scenes.length) board.append(node("p", "deception-empty", view.game_over ? "📁 案件在报告发布前被破获。" : view.phase === "reversal" ? "👁️ 案件已破，等待目击者反转。" : view.phase === "crime" ? "🔒 等待凶手秘密定案" : "📍 等待法医选择地点"));
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
    if (!chat.length) messages.append(node("li", "deception-empty", view.game_over ? "案件已结。" : view.phase === "reversal" ? "凶手与帮凶可讨论目击者身份。" : view.scenes.some(t => t.marker != null) ? "暂无讨论消息。" : "讨论将在第一枚标记后开放。"));
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
    const latestAccusation = view.accusations[view.accusations.length - 1];
    byId("Verdict").classList.toggle("hidden", !latestAccusation || !!view.solution);
    text("Verdict", latestAccusation ? historyText(latestAccusation) : "");
    renderPrivate(); renderBoard(); renderPlayers(); renderHistory();
  }

  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, temporary = false) {
    hideTip(); if (!target) return;
    tooltip.textContent = target.dataset.deceptionTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(r.bottom + 7, innerHeight - box.height - 12))}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }
  function targetAt(event, attribute) {
    return event.target.closest(`[${attribute}]`) || [...panel.querySelectorAll(`[${attribute}]`)].find(n => {
      const r = n.getBoundingClientRect();
      return r.width && r.height && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    });
  }
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { hideTip(); if (hasSelection()) clearSelection(); }
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
    clearTimeout(pendingTimer); hideTip();
    byId("Private").open = false; byId("ChatInput").value = "";
    ["Scenes", "Players", "Messages", "History", "PrivateBody", "LocationChoices", "Replacement", "Draft", "Result", "Verdict"].forEach(id => byId(id).replaceChildren());
    ["Draft", "Result", "Verdict", "Next"].forEach(id => byId(id).classList.add("hidden"));
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
    const mobileLayout = window.matchMedia("(max-width: 600px)");
    byId("Discussion").open = !mobileLayout.matches;
    mobileLayout.addEventListener("change", event => { byId("Discussion").open = !event.matches; });
    socket.on("room:state", syncConfig);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); if (view) render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); if (view) render(); });
    socket.on("connect", () => { if (view) render(); });
    if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "deception") window.renderDeceptionGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true}); else init();
})();
