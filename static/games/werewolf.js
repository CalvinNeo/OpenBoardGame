(() => {
  "use strict";
  const panel = document.getElementById("werewolfPanel");
  const surface = document.getElementById("werewolfSurface");
  const header = document.getElementById("werewolfHeaderActions");
  const helpButton = document.getElementById("werewolfHelpBtn");
  const explainButton = document.getElementById("werewolfExplainBtn");
  const tooltip = document.getElementById("werewolfTooltip");
  if (!panel || !surface) return;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[character]);
  const phases = {setup: "牌局设置", identity: "确认身份", night: "天黑请闭眼", discussion: "依次发言", vote: "放逐投票", death_skill: "出局技能", last_words: "遗言", dawn_review: "天亮公告", dusk_review: "白天结算", game_over: "终局揭晓"};
  const roleText = {
    werewolf: "狼人 (🐺)：与狼队友共同选择夜间袭击目标，白天可自爆结束白天。",
    wolf_king: "狼王 (👑)：参与狼刀。被放逐、枪杀或决斗等非毒非刀伤害淘汰时，可以带走一名存活玩家。自爆不触发此技能。",
    white_wolf: "白狼王 (⚪)：参与狼刀。白天发言阶段可自爆并带走另一名玩家，随后结束白天。",
    villager: "平民 (🏠)：参与发言与放逐投票，没有夜间技能。",
    seer: "预言家 (🔮)：每夜必须查验另一名存活玩家，只向本人返回好人或狼人阵营。",
    witch: "女巫 (🧪)：整局各有一瓶解药与毒药，每晚最多用一种。持有解药时可看到当夜刀口，不可自毒。",
    hunter: "猎人 (🎯)：非毒杀出局时可以开枪带走另一名存活玩家，也可以放弃。",
    guard: "守卫 (🛡️)：每夜守护一人或空守，可以自守，但不能连续守护同一人。同守同救仍死亡。",
    idiot: "白痴 (🃏)：首次被放逐时亮明身份并存活，此后仍可发言，但永久失去投票权。",
    knight: "骑士 (⚔️)：白天发言阶段可发动一次决斗。目标是狼则狼死并结束白天，否则骑士死且继续发言。"
  };
  const helpConfig = {
    gameId: "werewolf",
    title: {zh: "狼人杀 · 真人法官", en: "Werewolf · Human table"},
    basic: {
      win: {zh: "好人淘汰所有狼人获胜，狼人按开局选择的屠边或屠城规则获胜。", en: "Good wins by eliminating every wolf. Wolves win by eliminating a good role category or all good players, as selected before dealing."},
      turn: {zh: "夜间私密发动技能，白天轮流发言，再秘密提交放逐票，全部提交后公开票型。", en: "Act privately at night, speak in seat order during the day and submit a secret exile ballot that is revealed after all votes arrive."},
      key: {zh: "系统只做发牌、交接、投票与规则校验，讨论和判断全部由真人完成，请使用线下或外部语音。狼人自刀默认禁止，可在发牌前开启，开启后狼刀可选自己或狼队友，发牌后规则锁定。", en: "The system only deals, hands over turns, collects ballots and enforces rules. Humans provide all discussion and deduction using in-person or external voice chat. Wolf self-attacks are disabled by default. Enable them before dealing to allow attacking yourself or a wolf teammate. Rules are locked after dealing."}
    },
    sections: [
      {id: "roles", label: {zh: "角色技能", en: "Roles"}, html: {
        zh: "<p>狼人(🐺)、狼王(👑)与白狼王(⚪)互认狼队友，每人秘密选一票。票数最多的唯一目标受到袭击，平票或全部空刀则无人被袭击，弃票不参与比较。</p><p>预言家(🔮)每夜查验一人的阵营。女巫(🧪)各有一瓶解药与毒药，同晚不能双药。持有解药时才能看到刀口，按开局约定决定是否首夜自救，不可自毒。守卫(🛡️)不能连续守同一人，同守同救会死亡。</p><p>猎人(🎯)非毒杀出局可以开枪。狼王(👑)被放逐、枪杀或决斗等非毒非刀伤害淘汰可以带人，自爆不触发。白狼王(⚪)白天自爆必须带一人，普通狼人自爆不带人，均结束白天。</p><p>白痴(🃏)首次被放逐免死并永久失去投票权。骑士(⚔️)仅可决斗一次，狼目标死亡则结束白天，好人目标则骑士死亡并继续发言。平民(🏠)参与发言和投票。</p>",
        en: "<p>Werewolves (🐺), Wolf King (👑) and White Wolf (⚪) know their teammates. Each casts one secret night ballot. A unique plurality is attacked. Ties or all passes cause no attack, and passes do not count toward a target.</p><p>The Seer (🔮) privately checks one other living player each night. The Witch (🧪) has one antidote and one poison, at most one per night. The victim is visible only while holding antidote. First-night self-save follows setup and self-poison is forbidden. The Guard (🛡️) cannot protect the same player consecutively. Guard and antidote together kill the victim.</p><p>The Hunter (🎯) can shoot when killed unless poisoned. The Wolf King (👑) can retaliate after exile, a shot or a duel, but not a night attack, poison or self-explosion. The White Wolf (⚪) must take another player when exploding in daytime discussion. Other wolves explode alone. Explosions end the day.</p><p>The Idiot (🃏) survives their first exile but permanently loses their vote. The Knight (⚔️) can duel once during discussion. A wolf target dies and ends the day, otherwise the Knight dies and discussion continues. Villagers (🏠) speak and vote.</p>"}},
      {id: "flow", label: {zh: "发言与投票", en: "Turns and votes"}, html: {
        zh: "<p>6–16 个席位入座后，1 号位选择角色数量与胜负规则再发牌。可在 Room Control 使用 Add Bot 添加调试机器人。每种特殊角色最多一张，至少有一名平民、一名神职与一名狼人，狼人数少于半数。所有人确认自己的身份后开始首夜。</p><p>夜晚按守卫、狼人、女巫、预言家顺序行动，不公开当前行动者。夜间淘汰统一在天亮公布，不公开死因。首夜死者与白天被放逐者有遗言，其他死者没有遗言，技能优先结算。</p><p>白天按座次交接，只有当前发言者能结束发言。投票不能投自己，可以弃票。首轮平票玩家依次 PK 发言，其他有票玩家只对他们复投，仍平票则不放逐。全员弃票也不放逐。</p><p>天亮和白天结算均暂停供复核，包括死者在内所有真人席位点击 Next Round 后继续，机器人自动确认。断线请 Reconnect，系统不会超时替真人发言、投票或推进。</p>",
        en: "<p>Seat 1 configures and deals for 6–16 seats. Use Add Bot in Room Control to add debugging bots. Each special role is unique. Include at least one villager, one god and one wolf, with fewer than half wolves. Everyone confirms their own role before the first night.</p><p>Night order is Guard, wolves, Witch and Seer. The active role is not publicly named. Deaths are announced together at dawn without causes. First-night casualties and exiled players receive last words. Death skills resolve first. Other casualties do not receive last words.</p><p>Speakers proceed by seat and only the current speaker can finish. Self-voting is forbidden and abstention is allowed. First-round ties give tied candidates PK speeches. Other eligible voters revote only for those candidates. A second tie or all abstentions means no exile.</p><p>Dawn and dusk pause for review. Every human seat including the dead must press Next Round to continue. Bots confirm automatically. Reconnect after disconnection. No timeout speaks, votes or advances on a human’s behalf.</p>"}},
      {id: "privacy", label: {zh: "隐私与约定", en: "Privacy and scope"}, html: {
        zh: "<p>身份默认遮盖，点击 Reveal 暂时显示，按 Hide、切换阶段或离开页面后遮盖。狼队友仅狼可见，查验仅预言家可见，药品与刀口仅女巫可见。死者和旁观者不会额外获得隐藏情报。终局公开全部身份。</p><p>屠边指平民或神职任一类全部出局时狼人获胜，屠城则要求所有好人出局，不按人数持平直接判狼胜。双方同时全部出局为平局，死亡连锁技能结束后才结算胜负。</p><p>机器人仅用于调试，不参与讨论或推理。机器人自动确认身份与结算、结束发言，狼刀、查验和放逐票按座次选首个合法目标，守卫、女巫与出局技能选择跳过，不主动自爆或决斗。本版不含警长竞选、警徽、丘比特、第三方阵营和内置语音，也不会识别或裁决玩家的真实语音内容。白天身份除技能翻牌外始终保密。狼队讨论请使用独立外部频道。</p>",
        en: "<p>Roles are covered by default. Reveal shows your information until Hide, a phase change or leaving the page. Only wolves see teammates, only the Seer sees checks and only the Witch sees potion inventory and the permitted victim. Dead players and spectators gain no additional secrets. All roles are revealed at game end.</p><p>Category victory eliminates every villager or every god. Total victory requires eliminating every good player. Numerical parity alone is not victory. Simultaneous total elimination is a draw. Death-skill chains resolve before victory.</p><p>Bots are for debugging only, without discussion or deduction. They confirm roles and reviews, finish speeches and choose the first legal seat for wolf attacks, checks and exile ballots. They skip guarding, potions and death skills, and never initiate explosions or duels. This edition has no sheriff, badge, Cupid, third-party factions or built-in voice. It does not interpret or judge speech. Daytime roles stay secret unless a skill reveals them. Use a separate external channel for wolf discussion.</p>"}}
    ]
  };
  const help = typeof window.obgCreateHelp === "function" ? window.obgCreateHelp(helpConfig) : null;
  const explain = typeof window.obgCreateExplain === "function" ? window.obgCreateExplain({
    gameId: "werewolf", attribute: "data-ww-explain", root: () => panel, button: explainButton,
    bypass: ["#werewolfHelpBtn", "#werewolfExplainBtn"],
    explanations: {
      table: {zh: "真人狼人杀牌桌。系统是法官，不替玩家说话或判断。点击座位选择技能或投票目标，再在座位附近确认。", en: "A human Werewolf table. The system is the judge, not a speaker or strategist. Select a seat for a skill or ballot and confirm beside the table."},
      phase: {zh: "这里显示昼夜与当前流程。夜晚不公开角色行动顺序的实际进度，只有本人获得合法操作。", en: "The current day and phase. Actual night-role progress is not publicly named. Only the actor gets legal controls."},
      seat: {zh: "座位显示存活状态、公开身份与当前发言者。选择后只高亮，不会直接投票或发动技能。死亡不会自动翻牌。", en: "Seats show survival, revealed roles and the current speaker. Selection alone never casts a vote or fires a skill. Death does not reveal a role."},
      identity: {zh: "只在你自己的屏幕显示身份、队友和私密记录。Reveal 后请注意旁人，切换阶段时自动遮盖。", en: "Your private role, teammates and records. Beware of onlookers after Reveal. A phase change covers them again."},
      action: {zh: "只提交当前阶段允许的行动。服务器校验身份、目标、药品、重复提交和旧阶段请求。选目标后必须按确认按钮，不会因选择座位而直接提交。", en: "Submit only an action allowed now. The server validates role, target, potions, duplicates and stale requests. Selecting a seat never submits until confirmation."},
      speech: {zh: "表示你已完成发言，把话筒交给下一位。系统不采集音频，不允许其他玩家强行跳过你。", en: "Finish your speech and hand over to the next seat. Audio is not recorded and other players cannot skip your turn."},
      review: {zh: "结果复核。包括死者在内所有席位都确认后才继续，不自动跳过离线玩家。", en: "Review the result. Every seat including the dead must confirm before continuing. Offline players are not skipped."},
      setup: {zh: "1 号位配置角色并私密发牌。特殊角色最多一张，角色总数必须等于人数。可以设置屠边或屠城、女巫首夜自救与狼人自刀规则。狼人自刀默认禁止，开启后狼刀可选自己或狼队友，发牌后不能更改。", en: "Seat 1 configures and privately deals. Each special role is unique and the total must match the player count. Select victory, Witch self-save and wolf self-attack rules. Wolf self-attacks are disabled by default. Enabling them permits targeting yourself or a wolf teammate at night. Rules are locked after dealing."},
      history: {zh: "仅记录公开事件与已结束的投票。夜间身份、查验、药品、刀口、存活但隐藏的角色均不进入此记录。", en: "Only public events and completed ballots are recorded. Hidden roles, checks, potions and night targets never enter this public history."}
    }
  }) : null;
  let view = null;
  let selected = null;
  let mode = null;
  let revealed = false;
  let pending = false;
  let pendingTimer = null;
  let tipTimer = null;
  let signature = null;
  let historyOpen = false;
  let setupDraft = null;
  const can = type => !!view?.legal_actions.includes(type);
  const name = playerId => view?.players.find(player => player.player_id === playerId)?.name || "—";
  const roleName = role => role ? (view.role_info[role]?.icon || "") + " " + (view.role_info[role]?.name || role) : "身份保密";
  const enabled = () => !pending && (typeof socket === "undefined" || socket.connected);
  const button = (text, action, primary = false, disabled = false, key = "action") => '<button type="button" class="ww-btn' + (primary ? ' ww-primary' : '') + '" data-ww-action="' + action + '" data-ww-explain="' + key + '"' + (disabled || !enabled() ? ' disabled' : '') + '>' + escape(text) + '</button>';

  function defaultMode() {
    return ["guard", "wolf_vote", "inspect", "vote", "shoot"].find(can) || null;
  }

  function canUseMode() {
    return mode && can(mode === "poison" ? "witch" : mode);
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tooltip.hidden = true;
  }

  function clearState() {
    view = null;
    signature = null;
    setupDraft = null;
    selected = null;
    mode = null;
    revealed = false;
    pending = false;
    clearTimeout(pendingTimer);
    hideTip();
    explain?.exit();
    document.body.classList.remove("ww-needs-action");
    surface.innerHTML = "<p>Waiting to start</p>";
  }

  function validTarget(player) {
    if (!player.alive || !canUseMode() || !enabled()) return false;
    const own = player.player_id === view.you;
    if (own && mode !== "guard" && !(mode === "wolf_vote" && view.allow_wolf_self_attack)) return false;
    if (mode === "guard" && player.player_id === view.own?.last_guard) return false;
    if (mode === "wolf_vote" && !view.allow_wolf_self_attack && view.wolf_team.some(wolf => wolf.player_id === player.player_id)) return false;
    if (mode === "vote" && view.pk_round && !view.vote_candidates.includes(player.player_id)) return false;
    return true;
  }

  function renderSetup() {
    if (!can("deal")) return '<div class="ww-banner"><strong>等待 1 号位配置并发牌</strong><p>本局需要真人讨论，请准备好线下或外部语音。</p></div>';
    if (!setupDraft) setupDraft = {roles: {...view.role_counts}, win_rule: view.win_rule, self_save: view.self_save,
      allow_wolf_self_attack: !!view.allow_wolf_self_attack};
    const total = Object.values(setupDraft.roles).reduce((sum, count) => sum + count, 0);
    return '<div class="ww-banner"><strong>组建你的牌局</strong><p>6–16 席 · 支持调试机器人 · 无内置语音</p></div><div class="ww-config" data-ww-explain="setup">'
      + Object.entries(view.role_info).map(([role, info]) => '<label class="ww-role-count"><span>' + escape(info.icon + ' ' + info.name) + '</span><input aria-label="' + escape(info.name) + '数量" data-ww-role="' + role + '" type="number" min="0" max="' + (["werewolf", "villager"].includes(role) ? 16 : 1) + '" value="' + setupDraft.roles[role] + '"></label>').join("")
      + '</div><div class="ww-options"><label>胜负规则<select data-ww-option="win_rule"><option value="side"' + (setupDraft.win_rule === "side" ? " selected" : "") + '>屠边</option><option value="all"' + (setupDraft.win_rule === "all" ? " selected" : "") + '>屠城</option></select></label>'
      + '<label>女巫自救<select data-ww-option="self_save"><option value="first_night"' + (setupDraft.self_save === "first_night" ? " selected" : "") + '>仅首夜</option><option value="never"' + (setupDraft.self_save === "never" ? " selected" : "") + '>不可自救</option></select></label>'
      + '<label data-ww-explain="setup">狼人自刀<select data-ww-option="allow_wolf_self_attack"><option value="false"' + (!setupDraft.allow_wolf_self_attack ? ' selected' : '') + '>禁止</option><option value="true"' + (setupDraft.allow_wolf_self_attack ? ' selected' : '') + '>允许</option></select></label></div>'
      + '<div class="ww-controls">' + button("Deal Roles · " + total + "/" + view.players.length, "deal", true, total !== view.players.length, "setup") + '</div><p class="ww-error" role="status" id="werewolfError"></p>';
  }

  function renderPrivate() {
    if (!view.own?.role) return '';
    const own = view.own;
    let content = '';
    if (revealed) {
      content = '<h4 class="ww-role" title="' + escape(roleText[own.role]) + '" data-ww-tip="' + escape(roleText[own.role]) + '">' + escape(roleName(own.role)) + '</h4><p>' + escape(roleText[own.role]) + '</p>';
      if (view.wolf_team.length) content += '<p>狼队友：' + view.wolf_team.map(wolf => escape(name(wolf.player_id)) + ' · ' + escape(roleName(wolf.role))).join('、') + '</p>';
      if (Object.keys(view.wolf_votes).length) content += '<p>本夜狼票：' + Object.entries(view.wolf_votes).map(([actor, target]) => escape(name(actor)) + ' → ' + escape(target ? name(target) : "空刀")).join('，') + '</p>';
      if (own.role === "witch") content += '<p>解药：' + (own.save ? '1' : '0') + ' · 毒药：' + (own.poison ? '1' : '0') + '</p>' + (can("witch") ? '<p>今晚刀口：' + escape(own.save ? (view.victim ? name(view.victim) : "无人") : "解药已用，不可见") + '</p>' : '');
      if (own.inspections.length) content += '<ul>' + own.inspections.map(check => '<li>第 ' + check.day + ' 夜 · ' + escape(name(check.target)) + '：' + (check.team === "wolves" ? '狼人' : '好人') + '</li>').join('') + '</ul>';
    } else content = '<p>身份与私密情报已遮盖。</p>';
    return '<aside class="ww-private"><div class="ww-caption">PRIVATE · ONLY YOU</div><div data-ww-explain="identity">' + content + '</div>'
      + button(revealed ? "Hide" : "Reveal", "reveal", false, false, "identity") + '<div class="ww-identity"><div class="ww-caption">TABLE RULES</div><p>' + (view.win_rule === "side" ? "屠边" : "屠城") + ' · ' + (view.self_save === "first_night" ? '女巫仅首夜自救' : '女巫不可自救') + ' · ' + (view.allow_wolf_self_attack ? '允许狼人自刀' : '禁止狼人自刀') + '</p></div></aside>';
  }

  function renderControls() {
    let controls = '';
    if (can("ready")) controls += button("身份已确认 · Ready", "ready", true);
    if (can("next_round")) controls += button("Next Round · " + view.ready.length + "/" + view.players.length, "next_round", true, false, "review");
    if (can("end_speech")) controls += button("结束发言 · Hand Over", "end_speech", true, false, "speech");
    if (can("witch")) {
      const selfSave = view.victim !== view.you || (view.day === 1 && view.self_save === "first_night");
      controls += button("使用解药", "save", false, !view.own.save || !view.victim || !selfSave);
      controls += button("使用毒药", "mode-poison", mode === "poison", !view.own.poison);
      controls += button("不用药 · Pass", "witch-pass");
    }
    if (can("duel")) controls += button(mode === "duel" ? "取消决斗" : "骑士决斗", "mode-duel", mode === "duel");
    if (can("explode")) controls += button(mode === "explode" ? "取消自爆" : "自爆", "mode-explode", mode === "explode");
    if (canUseMode() && mode === "explode" && view.own.role !== "white_wolf") {
      controls += button("确认自爆", "confirm", true);
      controls += button("Cancel", "cancel");
    }
    if (canUseMode() && ["guard", "wolf_vote", "vote", "shoot"].includes(mode)) {
      controls += button({guard: "空守", wolf_vote: "空刀", vote: "弃票", shoot: "放弃开枪"}[mode], "pass");
    }
    return '<div class="ww-controls">' + controls + '</div>';
  }

  function prompt() {
    if (view.game_over) return {good: "好人阵营获胜", wolves: "狼人阵营获胜", draw: "双方全部出局 · 平局"}[view.winning_team];
    if (view.phase === "identity") return "查看自己的身份后点击 Ready，全部确认后进入首夜。";
    if (["dawn_review", "dusk_review"].includes(view.phase)) return "出局：" + (view.last_deaths.map(name).join('、') || "无人") + '。请复核结果，全员确认后继续。';
    if (view.phase === "discussion" || view.phase === "last_words") return '当前发言：' + name(view.current_turn) + (view.pk_round && view.phase === "discussion" ? ' · PK' : '');
    if (view.phase === "death_skill") return '等待 ' + name(view.current_turn) + ' 选择是否发动出局技能。';
    if (view.phase === "vote") return view.submitted.includes(view.you) ? "投票已锁定，等待全员提交后公开票型。" : (can("vote") ? "请选择一位玩家投放逐票，或弃票。" : "等待其他玩家完成投票。");
    if (mode) return {guard: "请选择守护目标，或空守。", wolf_vote: "请选择袭击目标，或空刀。", inspect: "请选择另一名存活玩家查验。", poison: "请选择毒药目标，再确认。", duel: "请选择决斗目标，再确认。", explode: "自爆将结束白天，请确认。"}[mode] || "请选择目标。";
    if (can("witch")) return "女巫行动：查看私密刀口后，选择一种药或不用药。";
    return view.phase === "night" ? "请保持闭眼，等待天亮。私密操作由对应角色自行完成。" : "等待其他玩家确认。";
  }

  function renderHistory() {
    return '<details class="ww-history" data-ww-explain="history"' + (historyOpen ? ' open' : '') + '><summary>Public Log & Ballots · ' + view.log.length + '</summary><ol class="ww-records">'
      + view.log.map(text => '<li>' + escape(text) + '</li>').join('')
      + view.vote_history.map(ballot => '<li>第 ' + ballot.day + ' 天' + (ballot.pk ? ' PK' : '') + '票型：' + Object.entries(ballot.ballots).map(([actor, target]) => escape(name(actor)) + ' → ' + escape(target ? name(target) : '弃票')).join('，') + '</li>').join('') + '</ol></details>';
  }

  function render() {
    if (!view) return;
    const oldLog = surface.querySelector('.ww-records');
    const logScroll = oldLog?.scrollTop || 0;
    const roles = Object.entries(view.role_counts).filter(([, count]) => count).map(([role, count]) => view.role_info[role].name + ' ×' + count).join(' · ');
    let board = '<div class="ww-caption" title="' + escape(roles) + '" data-ww-tip="' + escape(roles) + '">座位 · ' + view.players.filter(player => player.alive).length + '/' + view.players.length + ' 存活</div><div class="ww-table">';
    board += view.players.map(player => {
      const speaker = view.current_turn === player.player_id;
      const text = view.game_over || player.role ? roleName(player.role) : (view.wolf_team.some(wolf => wolf.player_id === player.player_id) && revealed ? '狼队友' : '身份保密');
      const status = !player.alive ? '已出局' : speaker ? '正在发言 / 行动' : !player.can_vote ? '存活 · 无投票权' : view.ready.includes(player.player_id) || view.submitted.includes(player.player_id) ? '已确认' : '存活';
      const labels = {guard: "确认守护", wolf_vote: "确认袭击", inspect: "确认查验", vote: "确认投票", shoot: "确认开枪", poison: "确认毒杀", duel: "确认决斗", explode: "确认带走"};
      const confirmation = selected === player.player_id && canUseMode() ? '<div class="ww-seat-confirm">' + button(labels[mode], 'confirm', true) + button('Cancel', 'cancel') + '</div>' : '';
      return '<div class="ww-seat-slot"><button type="button" class="ww-seat' + (speaker ? ' ww-speaking' : '') + (selected === player.player_id ? ' ww-selected' : '') + (!player.alive ? ' ww-dead' : '') + '" data-ww-player="' + escape(player.player_id) + '" data-ww-explain="seat" aria-pressed="' + (selected === player.player_id) + '"' + (!validTarget(player) ? ' disabled' : '') + '><span class="ww-seat-number">' + String(player.seat).padStart(2, '0') + '</span><strong>' + escape(player.name) + (player.player_id === view.you ? ' · You' : '') + '</strong><small>' + escape(text) + '</small><span class="ww-seat-status">' + escape(status) + '</span></button>' + confirmation + '</div>';
    }).join('') + '</div>';
    surface.innerHTML = '<div class="ww-mast"><div><div class="ww-eyebrow">WEREWOLF · HUMAN TABLE</div><h3>' + escape(phases[view.phase]) + '</h3></div><div class="ww-moon" aria-hidden="true"></div></div>'
      + '<div class="ww-phase" data-ww-explain="phase" title="系统只负责流程和规则校验，玩家自行讨论。" data-ww-tip="系统只负责流程和规则校验，玩家自行讨论。"><span class="ww-active">第 ' + view.day + (view.phase === "night" ? ' 夜' : ' 天') + '</span><span>真人法官</span><span>无自动代打</span></div>'
      + (view.phase === "setup" ? renderSetup() : '<div class="ww-layout"><section>' + board + '<div class="ww-banner" aria-live="polite"><strong>' + escape(phases[view.phase]) + '</strong><p>' + escape(prompt()) + '</p></div>' + renderControls() + '<p class="ww-error" role="status" id="werewolfError"></p></section>' + renderPrivate() + '</div>')
      + renderHistory();
    const newLog = surface.querySelector('.ww-records');
    if (newLog) newLog.scrollTop = logScroll;
    surface.querySelector('.ww-history')?.addEventListener('toggle', event => { historyOpen = event.target.open; });
    document.body.classList.toggle('ww-needs-action', view.legal_actions.length > 0 && !pending);
    explain?.refresh();
  }

  function submit(fields) {
    if (!enabled() || !view) return;
    pending = true;
    clearTimeout(pendingTimer);
    sendAction({...fields, game_token: view.game_token, window_id: view.window_id});
    pendingTimer = setTimeout(() => { pending = false; render(); }, 6000);
    render();
  }

  surface.addEventListener('input', event => {
    if (!event.target.dataset.wwRole || !setupDraft) return;
    setupDraft.roles[event.target.dataset.wwRole] = Number(event.target.value);
    const total = Object.values(setupDraft.roles).reduce((sum, count) => sum + count, 0);
    const deal = surface.querySelector('[data-ww-action="deal"]');
    deal.textContent = 'Deal Roles · ' + total + '/' + view.players.length;
    deal.disabled = total !== view.players.length || !enabled();
  });
  surface.addEventListener('change', event => {
    const option = event.target.dataset.wwOption;
    if (option && setupDraft) setupDraft[option] = option === 'allow_wolf_self_attack' ? event.target.value === 'true' : event.target.value;
  });
  surface.addEventListener('click', event => {
    const target = event.target.closest('[data-ww-player]');
    if (target && !target.disabled) {
      selected = selected === target.dataset.wwPlayer ? null : target.dataset.wwPlayer;
      render();
      return;
    }
    const action = event.target.closest('[data-ww-action]')?.dataset.wwAction;
    if (!action) {
      if (!event.target.closest('button,input,select,details,[data-ww-tip]') && selected) { selected = null; render(); }
      return;
    }
    if (action === 'reveal') { revealed = !revealed; render(); return; }
    if (!enabled()) return;
    if (action.startsWith('mode-')) { mode = mode === action.slice(5) ? defaultMode() : action.slice(5); selected = null; render(); return; }
    if (action === 'cancel') { mode = defaultMode(); selected = null; render(); return; }
    if (action === 'deal') { submit({type: 'deal', ...setupDraft}); return; }
    if (action === 'save') { submit({type: 'witch', choice: 'save'}); return; }
    if (action === 'witch-pass') { submit({type: 'witch', choice: 'pass'}); return; }
    if (action === 'pass') { submit({type: mode, target: null}); return; }
    if (action === 'confirm') {
      submit(mode === 'poison' ? {type: 'witch', choice: 'poison', target: selected} : {type: mode, target: selected});
      return;
    }
    submit({type: action});
  });
  function showTip(event) {
    const target = event.target.closest('[data-ww-tip]');
    if (!target || event.target.closest('button')) return;
    clearTimeout(tipTimer);
    tooltip.textContent = target.dataset.wwTip;
    tooltip.hidden = false;
    tipTimer = setTimeout(hideTip, 3000);
  }
  surface.addEventListener('pointerover', event => { if (event.pointerType === 'mouse') showTip(event); });
  surface.addEventListener('click', showTip);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { revealed = false; render(); hideTip(); } });
  helpButton.addEventListener('click', () => { explain?.exit(); help?.open(); });
  explainButton.addEventListener('click', () => explain?.toggle());

  window.renderWerewolfGameState = data => {
    if (data?.view?.game_id !== 'werewolf' || currentGameType !== 'werewolf') return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = data.room_id + ':' + data.view.game_token + ':' + data.view.window_id + ':' + data.view.you;
    if (next !== signature) {
      selected = null;
      revealed = false;
      hideTip();
      explain?.exit();
    }
    if (next !== signature || data.view.revision !== view?.revision) {
      pending = false;
      clearTimeout(pendingTimer);
    }
    const changed = next !== signature;
    signature = next;
    view = data.view;
    if (changed || !canUseMode()) { mode = defaultMode(); selected = null; }
    render();
  };
  window.showWerewolfHeaderActions = visible => {
    header.style.display = visible ? 'flex' : 'none';
    if (!visible) clearState();
  };
  function syncRoom(state) {
    if (state?.game_type !== 'werewolf' || state.status === 'lobby') clearState();
  }
  function initialize() {
    socket.on('room:state', syncRoom);
    socket.on('system:error', data => {
      if (!view) return;
      pending = false;
      clearTimeout(pendingTimer);
      render();
      const error = document.getElementById('werewolfError');
      if (error) error.textContent = data?.message || data?.error || 'Action rejected. Please check your choice.';
    });
    socket.on('disconnect', () => { pending = false; revealed = false; render(); });
    socket.on('connect', () => { if (view) render(); });
    if (typeof currentRoomState !== 'undefined') syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== 'undefined' && lastGameStatePayload?.game_type === 'werewolf') window.renderWerewolfGameState(lastGameStatePayload);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
