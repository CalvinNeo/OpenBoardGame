(() => {
  "use strict";
  const panel = document.getElementById("dndStarterSetPanel"), surface = document.getElementById("dndSurface");
  const header = document.getElementById("dndStarterSetHeaderActions"), helpButton = document.getElementById("dndStarterSetHelpBtn");
  const explainButton = document.getElementById("dndStarterSetExplainBtn"), dialog = document.getElementById("dndStarterSetDialog"), tooltip = document.getElementById("dndTooltip");
  let view = null, signature = null, selection = null, selectedClass = null, busy = false, busyTimer = null;
  let explaining = false, tipTimer = null, suppress = 0, drafts = {}, returnFocus = null;
  const phaseNames = {setup:"组建冒险队伍",exploration:"自由探索",combat:"战斗",round_review:"战斗轮回顾",encounter_review:"遭遇回顾",final_review:"冒险结算",game_over:"冒险结束"};
  const details = {
    edition:"边陲英雄（2025）中文线上适配。3–5 人：一名地下城主（DM）与 2–4 位冒险者，1–3 级。使用自编场景摘要与自制地图，完整盒内特殊能力请由 DM 配合所用角色板裁定。",
    dm:"地下城主（📖 DM）描述场景、控制怪物、发起检定并裁定自由行动。第一席固定担任 DM。私有提示和笔记不会发送给冒险者。",
    hp:"生命（❤️ HP）：降至 0 会失去意识。回合开始进行死亡豁免；3 次成功稳定，3 次失败死亡。自然 20 恢复 1 HP，自然 1 计两次失败。普通治疗不能复活。",
    ac:"护甲等级（🛡️ AC）：攻击掷骰总和达到 AC 命中。攻击自然 1 必定失手，自然 20 必定命中且伤害骰翻倍；属性调整值不翻倍。",
    gold:"金币（💰）：队伍共同资源。首次解决任务获得一次性奖励；在集市可用 50 金币购买一瓶治疗药水。",
    movement:"移动（👣）：每格 5 尺，斜向移动也计一格，困难地形（🟫）额外消耗一格；不能穿墙（⬛）或穿过其他站立生物。离开敌人邻格可能触发一次自动借机攻击。撤离避免借机攻击。",
    initiative:"先攻（🎲）：d20+敏捷，数值高者先行动，同值按入场顺序。你的角色或 DM 的怪物回合开始后会高亮；每个完整战斗轮结束后全员 Next Round。",
    action:"每回合有一个动作（⚡）、一个附赠动作（✦）和移动（👣），并在回合开始恢复一次反应。动作如潮可增加一个动作。分次移动后仍可攻击。",
    attack:"武器攻击（⚔️／🏹）：选武器和目标，在原地 Confirm。远程攻击身边有敌人时具有劣势，超常规射程具有劣势；墙体阻挡视线。游荡者每回合一次符合条件的偷袭自动结算。",
    spell:"施法（✨）：戏法不消耗法术位。每回合只能消耗一个法术位施法（2024）。标注 DM 裁定的法术只扣资源、记录专注，效果由 DM 执行；受到伤害时自动进行专注豁免。",
    slots:"法术位（🔹）：牧师、法师 1 级为 2 个一环位，2 级为 3 个，3 级为 4 个一环与 2 个二环位。长休恢复；戏法（0 环）无限使用。",
    potion:"治疗药水（🧪）：花费一瓶，恢复 2d4+2 HP；战斗中使用附赠动作，可给自己或接触范围内的友方服用（2024）。",
    stabilize:"援助倒地者（🩹）：动作，接触目标做 DC10 医药检定；成功使 0 HP 的角色稳定，不再进行死亡豁免。治疗恢复生命后解除昏迷，但仍需起身。",
    dodge:"闪避（🛡️）：花费动作；直到下次回合开始，对你的攻击具有劣势、你的敏捷豁免具有优势。被束缚或失去行动能力时失效。",
    dash:"疾走（👣）：花费动作，增加相当于速度的移动力。2 级游荡者也可花费附赠动作疾走。",
    disengage:"撤离（↗️）：花费动作，本回合移动不触发借机攻击。2 级游荡者可花费附赠动作撤离。",
    stand:"起身（🧍）：消耗一半速度的移动力，移除倒地。被束缚时不能起身。",
    second_wind:"回气（💨）：战士花费附赠动作，恢复 1d10+等级 HP；初始两次，短休恢复一次、长休恢复全部。",
    action_surge:"动作如潮（⚡⚡）：2 级战士每次短休或长休间可使用一次，立即增加一个动作。",
    check:"d20 测试（🎲）：由 DM 指定属性／技能、DC、优势或劣势。玩家按按钮掷骰。技能熟练加 2；游荡者隐匿和巧手专精加 4。属性检定与普通豁免的自然 1／20不自动失败／成功。DC 在结果揭示前只对 DM 可见。",
    rest:"短休（⛺）：探索中花费一枚生命骰恢复生命，战士恢复部分职业资源。长休（🌙）：DM 在安全据点发起，恢复存活队员的生命和资源；每次离开安全区域后可再次长休。时长是线上适配。",
    ready:"Ready：确定当前角色板；准备后不能再次换角。所有席位准备完毕才开始冒险。",
    review:"结果回顾：保留地图、逐条行动和骰子结果，与你有关的条目突出显示。所有人点击 Next Round 后才继续；机器人自动确认，没有倒计时。",
    travel:"探索路线（🧭）：全队讨论目的地，DM 点击相邻地点并确认。允许在要塞、荒野、洞窟之间自由往返；任务首次解决才奖励金币。",
    encounter:"遭遇（⚔️）：DM 启动当前场景的战斗，自动生成紧凑地图与先攻。怪物的普通攻击自动结算，特殊能力由 DM 裁定。冒险者人数较少时建议用裁定调整难度。",
    ruling:"DM 裁定：可和平解决、撤退或判定胜利，也可依据未自动实现的规则调整生命和状态。每次生命调整／解决遭遇必须填写理由并进入公共日志。不会重复发放奖励。",
    condition:"状态：中毒使攻击具有劣势；束缚禁止移动并影响攻击；倒地影响攻击、移动和起身；震慑跳过行动且使力量／敏捷豁免失败。其他复杂效果由 DM 裁定。",
    level:"等级（⭐）：DM 在探索中授予里程碑，最高 3 级。增加生命、生命骰、法术位和对应基础能力。3 级子职业、完整族裔能力与背景专长由 DM 配合所用角色板裁定。",
    character:"职业板：四种职业不重复。族裔和背景提供角色故事与部分已自动化能力；本版不是盒内角色卡逐项复刻。剩余能力请查 Help 并由 DM 裁定。",
    note:"DM 私有笔记（🔒）：只有当前 DM 收到此内容，随房间存档保存。叙述（📖）会公开给全队。",
    end_turn:"结束回合：交给下一位先攻角色。本轮所有生物行动后进入回顾，不立即进入下一轮。",
    finish:"冒险结算：完成至少一个任务并返回安全据点后，DM 写下结语，所有人确认后结束。队伍全部失去战斗能力则进入失败回顾。",
    map:"紧凑战术地图：蓝底是冒险者，红底是敌人，金边表示当前行动者。点击可达格再 Confirm 移动。这里使用原创地图，不使用官方商业素材。",
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const explainAliases = {cast:"spell",move:"movement",resolve:"ruling",level_up:"level",cunning_dash:"dash",cunning_disengage:"disengage"};
  const explainText = key => details[explainAliases[key] || key] || view?.spells?.[key]?.text || view?.species?.[key]?.text || view?.classes?.[key]?.description || "";
  const info = (label, key) => `<span tabindex="0" data-dnd-tip="${esc(explainText(key))}" data-dnd-explain="${key}">${esc(label)}</span>`;
  const connected = () => typeof socket !== "undefined" && socket.connected;
  const allowed = kind => view?.legal_actions.includes(kind) && !busy && connected();
  const hero = () => view?.heroes.find(h => h.id === view.you);
  const units = () => [...(view?.heroes || []), ...(view?.monsters || [])];
  const unit = id => units().find(u => u.id === id);
  const name = id => unit(id)?.name || view?.players.find(p => p.player_id === id)?.name || id;
  const button = (label, command, key, enabled = true, cls = "") => `<button type="button" class="${cls}" data-dnd-command="${esc(JSON.stringify(command))}" data-dnd-explain="${key}" ${!enabled || busy || !connected() ? "disabled" : ""}>${esc(label)}</button>`;
  const pickButton = (label, pick, key, enabled = true) => `<button type="button" data-dnd-pick="${esc(JSON.stringify(pick))}" data-dnd-explain="${key}" ${!enabled || busy || !connected() ? "disabled" : ""}>${esc(label)}</button>`;
  const option = (id, label, selected) => `<option value="${esc(id)}" ${String(id) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
  function field(id, label, options, value, key = "ruling") {
    const chosen = drafts[id] ?? value;
    return `<div class="dnd-field"><label for="${id}">${label}</label><select id="${id}" data-dnd-draft data-dnd-explain="${key}">${options.map(([k, v]) => option(k, v, chosen)).join("")}</select></div>`;
  }
  function input(id, label, value, min, max) {
    return `<div class="dnd-field"><label for="${id}">${label}</label><input id="${id}" type="number" min="${min}" max="${max}" data-dnd-draft value="${esc(drafts[id] ?? value)}" data-dnd-explain="ruling"></div>`;
  }
  function textArea(id, placeholder, value = "", max = 1200) {
    return `<textarea id="${id}" rows="2" maxlength="${max}" data-dnd-draft aria-label="${esc(placeholder)}" placeholder="${esc(placeholder)}">${esc(drafts[id] ?? value)}</textarea>`;
  }
  function openDialog(title, html) {
    hideTip(); returnFocus = document.activeElement;
    document.getElementById("dndDialogTitle").textContent = title;
    document.getElementById("dndDialogBody").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  function help() {
    setExplain(false);
    openDialog("Help · 边陲英雄", `<p>${esc(details.edition)}</p>
      <h3>从哪里开始</h3><ol><li>第一席是 DM（📖）；冒险者选择职业板、族裔和背景，点击选择角色，再 Ready。</li><li>通过房间聊天描述想做的事。DM 描述环境，发起检定（🎲），决定何时进入战斗。</li><li>战斗中选择行动与目标，或点击地图移动。用完行动后结束回合。每轮所有人 Next Round 才继续。</li><li>从要塞（🏰）前往荒野（🌲）和洞窟（⛰️），可以交涉、战斗或撤退。DM 授予最高 3 级里程碑，回到据点后可结算冒险。</li></ol>
      ${["dm","check","action","attack","hp","movement","spell","slots","potion","rest","review"].map(k => `<p>${esc(details[k])}</p>`).join("")}
      <h3>自动化边界</h3><p>已自动处理普通攻击、视线墙体、攻击优势／劣势、偷袭、基本状态、移动、一次反应借机攻击、死亡豁免、治疗、法术位和专注伤害豁免。借机攻击自动使用反应；穿越友方空间和精细掩体没有自动化。对话、躲藏、隐形、光照、购物道具、怪物特殊能力、完整族裔特性、背景专长和子职业能力由 DM 裁定。法术的 DM 裁定标识意味着只记录资源与专注，未自动应用法术效果。</p>
      <p>本版职业与遭遇为可玩线上适配。魔法飞弹／灼热射线在界面中集中同一目标；复杂的分配目标请由 DM 裁定。地图、中文描述与角色板均为重建内容，不代表官方授权译文或盒内全部卡牌。</p>
      <h3>职业与族裔</h3>${Object.values(view?.classes || {}).map(c => `<p><strong>${esc(c.emoji + " " + c.name)}</strong>：${esc(c.description)}</p>`).join("")}
      ${Object.values(view?.species || {}).map(s => `<p><strong>${esc(s.emoji + " " + s.name)}</strong>：${esc(s.text)}</p>`).join("")}
      <h3>法术卡</h3>${Object.values(view?.spells || {}).map(s => `<p><strong>${esc(s.emoji + " " + s.name)} · ${s.level} 环</strong>：${esc(s.text)}</p>`).join("")}
      <p>Help 查看规则，Explain 后点选元素查看解释，Esc 关闭；空白处或 Esc 取消选择。图标可悬停，手机点击后显示 3 秒提示。存档和刷新重连保留角色资源与进度。</p>`);
  }
  function setExplain(value) { explaining = value; panel.classList.toggle("dnd-explaining", value); explainButton.setAttribute("aria-pressed", String(value)); hideTip(); }
  function hideTip() { tooltip.hidden = true; clearTimeout(tipTimer); }
  function showTip(el) {
    if (!el?.dataset.dndTip || explaining || dialog.open) return;
    tooltip.textContent = el.dataset.dndTip; tooltip.hidden = false;
    const r = el.getBoundingClientRect(), t = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(innerWidth - t.width - 12, r.left))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(innerHeight - t.height - 12, r.bottom + 7))}px`;
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 3000);
  }
  function logRows(rows) { return rows.map(row => `<div class="dnd-log-row ${row.actors.includes(view.you) ? "is-you" : ""} ${row.kind === "roll" ? "is-roll" : ""}">${esc(row.text)}</div>`).join(""); }
  function setup() {
    const mine = hero(), selected = selectedClass || mine?.class_id;
    const taken = view.heroes.filter(h => h.id !== view.you).map(h => h.class_id);
    let html = `<div class="dnd-box"><h3>${view.is_dm ? "📖 地下城主" : "选择你的冒险者"}</h3>`;
    if (view.is_dm) html += `<p class="dnd-scene-copy">你将主持这场边陲冒险。准备好描述场景、扮演住民，让同伴决定故事如何展开。</p>${button("Ready",{type:"ready"},"ready",allowed("ready"),"dnd-primary")}`;
    else if (!view.players.some(p => p.player_id === view.you)) html += `<p class="dnd-muted">Spectator · 等待冒险者准备。</p>`;
    else {
      html += `<div class="dnd-cards">${Object.entries(view.classes).map(([id,c]) => `<button type="button" class="dnd-class" data-dnd-class="${id}" aria-pressed="${selected === id}" data-dnd-explain="${id}" ${taken.includes(id) || !allowed("choose") ? "disabled" : ""}><span class="dnd-icon">${c.emoji}</span><strong>${c.name}</strong><small>${c.role}</small><span>❤️ ${c.hp} · 🛡️ ${c.ac}</span><small>${taken.includes(id) ? "已被选择" : c.description}</small></button>`).join("")}</div>`;
      html += `<div class="dnd-fields">${field("dndSpecies","族裔",Object.entries(view.species).map(([k,s]) => [k,`${s.emoji} ${s.name}`]),mine?.species || "human","character")}${field("dndBackground","背景",Object.entries(view.backgrounds).map(([k,s]) => [k,`${s.emoji} ${s.name}`]),mine?.background || "soldier","character")}</div>`;
      html += `<div class="dnd-actions">${button("选择角色",{type:"choose_form"},"character",!!selected && allowed("choose"),"dnd-primary")}${button(view.ready.includes(view.you) ? "Ready ✓" : "Ready",{type:"ready"},"ready",!!mine && allowed("ready"))}</div>`;
    }
    html += `<div class="dnd-people">${view.players.map(p => `<span>${view.ready.includes(p.player_id) ? "✓" : "○"} ${esc(p.name)} · ${p.player_id === view.dm ? "DM" : view.classes[view.heroes.find(h=>h.id===p.player_id)?.class_id]?.name || "未选职业"}</span>`).join("")}</div></div>`;
    return html;
  }
  function heroCards() {
    return `<div class="dnd-heroes">${view.heroes.map(h => `<article class="dnd-hero ${h.id === view.you ? "is-you" : ""} ${h.id === view.actor && view.phase === "combat" ? "is-active" : ""} ${!h.hp ? "is-fallen" : ""}" data-dnd-explain="character"><strong>${esc(h.emoji + " " + h.name)}${h.id===view.you ? " · You" : ""}</strong><div class="dnd-muted">${esc(view.species[h.species].name)} · ${esc(view.classes[h.class_id].name)} · ${info(`⭐ ${h.level}`,"level")}</div><div class="dnd-health"><span style="width:${Math.max(0,Math.min(100,h.hp/h.max_hp*100))}%"></span></div><div class="dnd-stats">${info(`❤️ ${h.hp}/${h.max_hp}`,"hp")}${info(`🛡️ ${h.ac}`,"ac")}${info(`🧪 ${h.potions}`,"potion")}${info(`🎲 ${h.hit_dice}d${view.classes[h.class_id].hit_die}`,"rest")}${view.classes[h.class_id].spells.length ? info(`🔹 ${h.slots[0]} / ${h.slots[1]}`,"slots") : ""}</div>${!h.hp ? `<div class="dnd-muted">${h.dead ? "💀 死亡" : h.stable ? "🩹 稳定" : `死亡豁免 ✓${h.death_success} / ✕${h.death_fail}`}</div>` : ""}${h.conditions.length ? `<div class="dnd-muted">${info(h.conditions.map(c=>view.conditions[c]).join(" · "),"condition")}</div>` : ""}${h.concentration ? `<div class="dnd-muted">✨ 专注：${esc(view.spells[h.concentration].name)}</div>` : ""}</article>`).join("")}</div>`;
  }
  function exploration() {
    return `<div class="dnd-box"><div class="dnd-regions">${Object.entries(view.regions).map(([id,r])=>`<div class="dnd-region ${view.scene_info.region===id ? "is-here" : ""}" data-dnd-explain="travel" data-dnd-tip="${esc(details.travel)}" tabindex="0">${r.emoji} ${r.name}</div>`).join("")}</div><h3>${view.scene_info.emoji} ${esc(view.scene_info.name)}</h3><p class="dnd-scene-copy">${esc(view.scene_info.text)}</p><div class="dnd-routes">${view.routes.map(r=>pickButton(`${r.emoji} ${r.name}${r.complete?" ✓":""}`,{type:"travel",scene:r.id,label:r.name},"travel",view.is_dm&&allowed("travel"))).join("")}</div>${selection?.type==="travel"?selectionBox():""}${view.is_dm ? `<div class="dnd-actions">${button("⚔️ 开始遭遇",{type:"encounter"},"encounter",allowed("encounter")&&view.can_encounter,"dnd-danger")}${button("🌙 全队长休",{type:"rest",kind:"long"},"rest",allowed("rest")&&view.scene_info.safe&&!view.rested)}</div>` : `<p class="dnd-muted" style="margin-top:10px">与同伴讨论路线，由 DM 带领队伍出发。</p>`}</div>`;
  }
  function map() {
    const cells=[];
    for(let y=0;y<8;y++) for(let x=0;x<10;x++) {
      const u=units().find(u=>u.pos[0]===x&&u.pos[1]===y);
      const wall=view.map.walls.some(p=>p[0]===x&&p[1]===y), rough=view.map.rough.some(p=>p[0]===x&&p[1]===y);
      const reachable=view.moves.some(m=>m.x===x&&m.y===y), selected=selection?.type==="move"&&selection.x===x&&selection.y===y;
      const dead=u&&(u.hp===0||u.health==="击败"), label=`${String.fromCharCode(65+x)}${y+1}${u?` · ${u.name}`:wall?" · 墙体":rough?" · 困难地形":""}`;
      cells.push(`<button type="button" class="dnd-cell ${wall?"is-wall":""} ${rough?"is-rough":""} ${reachable?"is-reachable":""} ${selected?"is-selected":""} ${u?u.side==="heroes"?"is-hero":"is-monster":""} ${u?.id===view.actor?"is-current":""} ${dead?"is-defeated":""}" aria-label="${esc(label)}" data-dnd-cell="${x},${y}" data-dnd-explain="${u?"character":"movement"}" data-dnd-tip="${esc(label)}">${u?esc(u.emoji):wall?"⬛":rough?"·":""}${u?.side==="monsters"?`<small>${esc(u.id.slice(1))}</small>`:""}</button>`);
    }
    return `<section class="dnd-map-box"><div class="dnd-row dnd-map-title"><strong>${view.scene_info.emoji} ${esc(view.scene_info.name)}</strong>${info(`第 ${view.round} 轮`,"review")}</div><div class="dnd-grid" aria-label="战术地图">${cells.join("")}</div>${selection?.type==="move"?selectionBox():""}<div class="dnd-legend">${info("👣 1 格 = 5 尺","movement")}${info("🟫 困难地形","movement")}${info("⬛ 墙体","map")}${info("🔵 队伍 / 🔴 敌人","map")}</div><div class="dnd-initiative">${view.initiative.map(i=>`<span class="${i.id===view.actor?"is-current":""}" data-dnd-explain="initiative" data-dnd-tip="${esc(name(i.id)+" · "+details.initiative)}" tabindex="0">${esc(unit(i.id)?.emoji || "🎲")} ${esc(view.classes[unit(i.id)?.class_id]?.name || name(i.id))} · ${i.total}</span>`).join("")}</div></section>`;
  }
  function selectionBox() {
    if(!selection) return "";
    const needsTarget=["attack","cast","potion","stabilize"].includes(selection.type);
    let targets=[];
    if(needsTarget) {
      const active=view.phase==="combat"?unit(view.actor):hero();
      const friendly=selection.type!=="attack" && (selection.type!=="cast" || ["heal","armor","manual"].includes(view.spells[selection.spell].kind));
      targets=units().filter(t=>friendly?t.side==="heroes"&&!t.dead:t.side!==active?.side&&t.hp!==0&&t.health!=="击败");
      if(selection.type==="cast"&&view.spells[selection.spell].kind==="manual") targets=units().filter(t=>!t.dead&&t.hp!==0&&t.health!=="击败");
      if(selection.type==="cast"&&view.spells[selection.spell].kind==="armor") targets=targets.filter(t=>t.id===active?.id);
      if(selection.type==="stabilize") targets=targets.filter(t=>t.hp===0&&!t.stable);
    }
    return `<div class="dnd-selection"><strong>${esc(selection.label||"")}</strong>${selection.type==="cast"?`<p class="dnd-muted">${esc(view.spells[selection.spell].text)}</p>`:""}${needsTarget?`<div class="dnd-targets">${targets.map(t=>`<button type="button" data-dnd-target="${esc(t.id)}" aria-pressed="${selection.target===t.id}" data-dnd-explain="${selection.type==="cast"?selection.spell:selection.type}">${esc(t.emoji+" "+t.name)}${t.health?` · ${t.health}`:""}</button>`).join("")}</div>`:""}<div class="dnd-actions">${button("Confirm",{type:"confirm"},selection.type,(!needsTarget||!!selection.target)&&allowed(selection.type),"dnd-primary")}${button("Cancel",{type:"cancel"},selection.type)}</div></div>`;
  }
  function spells(h, combat) {
    const list=view.classes[h.class_id].spells;
    if(!list.length) return "";
    return `<details data-dnd-detail="spells" open><summary>✨ 法术卡 · ${info(`🔹 ${h.slots[0]} / ${h.slots[1]}`,"slots")}</summary><div class="dnd-spell-list" data-dnd-scroll="spells">${list.map(id=>{
      const s=view.spells[id];
      const can=allowed("cast")&&(!combat||(s.bonus?h.bonus_left:h.action_left)>0)&&(!combat||!s.level||!h.slot_used);
      const slots=s.level===0?[0]:[1,2].filter(n=>n>=s.level&&h.slots[n-1]>0);
      if(!slots.length) slots.push(s.level);
      return slots.map(slot=>pickButton(`${s.emoji} ${s.name} · ${slot?`${slot}环`:"戏法"}${s.kind==="manual"?" · DM 裁定":""}`,{type:"cast",spell:id,slot,label:`${s.emoji} ${s.name}`},id,can&&(!slot||h.slots[slot-1]>0)&&(combat||["heal","armor","manual"].includes(s.kind)))).join("");
    }).join("")}</div></details>`;
  }
  function commands() {
    const combat=view.phase==="combat", h=combat?unit(view.actor):hero();
    let html=`<section class="dnd-box"><h3>${combat?`🎲 ${esc(name(view.actor))} 的回合`:view.is_dm?"📖 地下城主桌面":"冒险者行动"}</h3>`;
    if(view.pending_check) {
      const check=view.pending_check, label=view.abilities[check.ability]||view.skills[check.ability].name;
      html+=`<div class="dnd-selection"><strong>${esc(name(check.target))} · ${label}${check.kind==="save"?"豁免":"检定"}</strong><p class="dnd-muted">${check.mode===1?"优势：掷两次取高":check.mode===-1?"劣势：掷两次取低":"普通 d20"}${view.is_dm?` · DC ${check.dc}`:""}</p><div class="dnd-actions">${button("🎲 掷骰",{type:"roll_check"},"check",allowed("roll_check"),"dnd-primary")}${view.is_dm?button("Cancel",{type:"cancel_check"},"check",allowed("cancel_check")):""}</div></div>`;
    }
    if(combat&&h) html+=`<div class="dnd-stats">${info(`⚡ ${h.action_left??"—"}`,"action")}${info(`✦ ${h.bonus_left??"—"}`,"action")}${info(`👣 ${h.move_left==null?"—":h.move_left*5} 尺`,"movement")}${view.is_dm&&h.side==="monsters"?info(`❤️ ${h.hp}/${h.max_hp} · 🛡️ ${h.ac}`,"hp"):""}</div>`;
    if(!["travel","move","resolve","finish","level_up"].includes(selection?.type)) html+=selectionBox();
    if(combat&&view.current_turn!==view.you) html+=`<p class="dnd-muted" style="margin-top:10px">等待 ${esc(name(view.current_turn))} 操作；行动与骰子结果会实时显示。</p>`;
    if(h&&((combat&&view.current_turn===view.you)||(!combat&&!view.is_dm))) {
      if(combat) {
        const weapons=h.side==="monsters"?["monster"]:view.classes[h.class_id].weapons;
        html+=`<div class="dnd-actions">${weapons.map(id=>pickButton(id==="monster"?"⚔️ 普通攻击":`${view.weapons[id].emoji} ${view.weapons[id].name}`,{type:"attack",weapon:id,label:id==="monster"?"普通攻击":view.weapons[id].name},"attack",allowed("attack"))).join("")}${["dodge","dash","disengage"].map((type,i)=>button(["🛡️ 闪避","👣 疾走","↗️ 撤离"][i],{type},type,allowed(type))).join("")}${h.conditions.includes("prone")?button("🧍 起身",{type:"stand"},"stand",allowed("stand")&&h.move_left>=3):""}</div>`;
      }
      if(h.side==="heroes") {
        html+=`<div class="dnd-actions">${pickButton("🧪 治疗药水",{type:"potion",label:"治疗药水 · 2d4+2"},"potion",allowed("potion")&&h.potions>0&&(!combat||h.bonus_left>0))}${pickButton("🩹 稳定倒地者",{type:"stabilize",label:"医药检定 · DC10"},"stabilize",allowed("stabilize")&&(!combat||h.action_left>0))}`;
        if(h.class_id==="fighter") html+=button(`💨 回气 ${h.second_wind}`,{type:"second_wind"},"second_wind",allowed("second_wind")&&h.second_wind>0&&(!combat||h.bonus_left>0))+(combat&&h.level>=2?button("⚡ 动作如潮",{type:"action_surge"},"action_surge",allowed("action_surge")&&h.surge>0):"");
        if(combat&&h.class_id==="rogue"&&h.level>=2) html+=button("✦ 狡猾疾走",{type:"cunning_dash"},"dash",h.bonus_left>0)+button("✦ 狡猾撤离",{type:"cunning_disengage"},"disengage",h.bonus_left>0);
        if(!combat) html+=button("⛺ 短休",{type:"rest",kind:"short"},"rest",allowed("rest")&&h.hp>0&&h.hit_dice>0)+(view.scene==="market"?button("🧪 购买 · 💰 50",{type:"buy_potion"},"gold",allowed("buy_potion")&&view.gold>=50):"");
        html+=`</div><div style="margin-top:12px">${spells(h,combat)}</div>`;
      }
      if(combat) html+=`<div class="dnd-actions">${button("结束回合 →",{type:"end_turn"},"end_turn",allowed("end_turn"),"dnd-primary")}</div>`;
    }
    if(!combat&&!view.is_dm&&hero()) {
      const mine=hero();
      html+=`<details data-dnd-detail="sheet" style="margin-top:12px"><summary>角色详情</summary><div class="dnd-abilities">${Object.entries(mine.mods).map(([k,n])=>`<div class="dnd-ability" data-dnd-explain="check">${view.abilities[k]}<b>${n>=0?"+":""}${n}</b></div>`).join("")}</div><p class="dnd-muted">技能：${mine.skills.map(s=>view.skills[s].name).join("、")}</p><p class="dnd-muted">${esc(view.species[mine.species].text)}</p></details>`;
    }
    html+=`</section>`;
    if(view.is_dm) html+=dmTools();
    return html;
  }
  function dmTools() {
    const targets=units().map(u=>[u.id,u.name]), heroOptions=view.heroes.map(h=>[h.id,h.name]), combat=view.phase==="combat";
    let html=`<section class="dnd-box dnd-dm"><details data-dnd-detail="dmguide" open><summary>🔒 场景提示 · DM</summary><p class="dnd-muted">${esc(view.dm_scene)}</p></details>`;
    html+=`<details data-dnd-detail="check"><summary>🎲 发起检定</summary>${field("dndCheckTarget","角色",heroOptions,heroOptions[0]?.[0],"check")}${field("dndCheckAbility","检定",[...Object.entries(view.abilities),...Object.entries(view.skills).map(([k,s])=>[k,s.name])],"perception","check")}<div class="dnd-fields">${input("dndDC","DC",12,5,30)}${field("dndCheckMode","掷骰",[[0,"普通"],[1,"优势"],[-1,"劣势"]],0,"check")}</div>${field("dndCheckKind","类别",[["check","属性／技能"],["save","属性豁免"]],"check","check")}${button("发起检定",{type:"check_form"},"check",allowed("request_check"))}</details>`;
    html+=`<details data-dnd-detail="narrate"><summary>📖 叙述与私有笔记</summary>${textArea("dndNarration","向全队描述当前情景")}${button("发布叙述",{type:"narrate_form"},"dm",allowed("narrate"))}<div style="margin-top:10px">${textArea("dndNote","DM 私有笔记",view.dm_note,4000)}${button("Save",{type:"note_form"},"note",allowed("note"))}</div></details>`;
    html+=`<details data-dnd-detail="ruling"><summary>⚖️ 裁定与资源</summary>${field("dndRulingTarget","目标",targets,targets[0]?.[0])}${input("dndDelta","HP ±",-1,-100,100)}${textArea("dndReason","裁定理由（公开）")}${button("调整生命",{type:"hp_form"},"ruling",allowed("adjust_hp"))}${field("dndCondition","状态",Object.entries(view.conditions),"poisoned","condition")}<div class="dnd-actions">${button("添加状态",{type:"condition_form",enabled:true},"condition",allowed("condition"))}${button("移除状态",{type:"condition_form",enabled:false},"condition",allowed("condition"))}</div><div class="dnd-actions">${pickButton("和平解决",{type:"resolve",outcome:"peace",label:"和平解决当前任务"},"ruling",allowed("resolve"))}${pickButton("判定胜利",{type:"resolve",outcome:"victory",label:"裁定当前遭遇胜利"},"ruling",allowed("resolve"))}${pickButton("撤回要塞",{type:"resolve",outcome:"retreat",label:"从当前遭遇撤退"},"ruling",allowed("resolve"))}</div>${!combat?`<div class="dnd-actions">${pickButton("⭐ 里程碑升级",{type:"level_up",label:"队伍提升一级（最高 3 级）"},"level",allowed("level_up")&&view.heroes.every(h=>h.level<3))}${pickButton("完成冒险",{type:"finish",label:"使用裁定理由作为结语，结束冒险"},"finish",allowed("finish")&&view.completed.length>0&&view.scene_info.safe)}</div>`:""}${["resolve","finish","level_up"].includes(selection?.type)?selectionBox():""}</details></section>`;
    return html;
  }
  function reviewPanel() {
    const title=view.phase==="round_review"?`第 ${view.round} 轮结束`:view.outcome==="defeat"?"冒险暂告一段落":view.phase==="final_review"||view.phase==="game_over"?"边陲冒险纪事":"遭遇已结算";
    return `<div class="dnd-box dnd-review"><h3>${esc(title)}</h3><div class="dnd-scroll" data-dnd-scroll="report">${logRows(view.report)}</div><div class="dnd-people">${view.players.map(p=>`<span>${view.ready.includes(p.player_id)?"✓":"○"} ${esc(p.name)}</span>`).join("")}</div>${view.game_over?`<p class="dnd-muted" style="margin-top:10px">已解决 ${view.completed.length} 个场景 · 💰 ${view.gold} 金币 · ${view.outcome==="defeat"?"队伍失败":"冒险完成"}</p>`:`<div class="dnd-actions">${button(view.ready.includes(view.you)?"Ready ✓":"Next Round",{type:"next_round"},"review",allowed("next_round"),"dnd-primary")}</div>`}</div>`;
  }
  function render() {
    if(!view) return;
    const scrolls={}, opened={};
    surface.querySelectorAll("[data-dnd-scroll]").forEach(el=>{scrolls[el.dataset.dndScroll]=el.scrollTop;});
    surface.querySelectorAll("details[data-dnd-detail]").forEach(el=>{opened[el.dataset.dndDetail]=el.open;});
    const focused=document.activeElement?.id, focusStart=document.activeElement?.selectionStart, focusEnd=document.activeElement?.selectionEnd;
    const reviewing=["round_review","encounter_review","final_review","game_over"].includes(view.phase);
    const yours=allowed("ready")||allowed("next_round")||allowed("roll_check")||(view.phase==="combat"&&view.current_turn===view.you);
    document.body.classList.toggle("dnd-needs-action",!!yours);
    const subtitle=view.phase==="combat"?`${name(view.actor)} 行动 · ${name(view.current_turn)} 控制`:view.pending_check?`等待 ${name(view.pending_check.target)} 掷骰`:view.is_dm?"你是地下城主 · 描述世界，回应选择":"由你决定下一段故事";
    const content=view.phase==="setup"?setup():`<div class="dnd-columns"><main>${view.phase==="exploration"?exploration():view.initiative.length?map():exploration()}${reviewing?"":`<details class="dnd-box" data-dnd-detail="recent"><summary>最近行动 · ${esc(view.history.at(-1)?.text || "")}</summary><div class="dnd-scroll" data-dnd-scroll="recent">${logRows(view.history.slice(-6))}</div></details>`}</main><aside>${reviewing?reviewPanel():commands()}</aside></div>${heroCards()}<details class="dnd-box" style="margin-top:12px;margin-bottom:0" data-dnd-detail="history"><summary>📜 冒险日志</summary><div class="dnd-scroll" data-dnd-scroll="history">${logRows(view.history)}</div></details>`;
    surface.innerHTML=`<header class="dnd-banner"><div><div class="dnd-eyebrow">DUNGEONS & DRAGONS · STARTER SET</div><h2>边陲英雄</h2><p>${info("HEROES OF THE BORDERLANDS · 中文线上适配","edition")}</p></div><div class="dnd-emblem" aria-hidden="true">🐉</div></header><div class="dnd-status dnd-row ${yours?"is-yours":""}"><strong>${esc(phaseNames[view.phase])}</strong><span class="dnd-badge">${info(`💰 ${view.gold}`,"gold")}</span><span class="dnd-muted">${!connected()?"Disconnected":busy?"Sending…":esc(subtitle)}</span></div><div class="dnd-content">${content}</div>`;
    surface.querySelectorAll("[data-dnd-scroll]").forEach(el=>{if(scrolls[el.dataset.dndScroll]!=null)el.scrollTop=scrolls[el.dataset.dndScroll];});
    surface.querySelectorAll("details[data-dnd-detail]").forEach(el=>{if(opened[el.dataset.dndDetail]!=null)el.open=opened[el.dataset.dndDetail];});
    const next=focused&&document.getElementById(focused);
    if(next&&surface.contains(next)){next.focus({preventScroll:true});if(typeof focusStart==="number"&&next.type!=="number")next.setSelectionRange?.(focusStart,focusEnd);}
  }
  function send(command) {
    if(!view||busy||!connected()) return;
    busy=true; hideTip(); render();
    sendAction({...command,game_instance_id:view.game_instance_id,window_id:view.window_id});
    clearTimeout(busyTimer); busyTimer=setTimeout(()=>{busy=false;render();},5000);
  }
  const value = id => document.getElementById(id)?.value ?? drafts[id];
  function handleCommand(command) {
    const type=command.type;
    if(type==="cancel"){selection=null;render();return;}
    if(type==="choose_form") {send({type:"choose",class_id:selectedClass||hero()?.class_id,species:value("dndSpecies"),background:value("dndBackground")});return;}
    if(type==="check_form") {send({type:"request_check",target:value("dndCheckTarget"),ability:value("dndCheckAbility"),kind:value("dndCheckKind"),mode:Number(value("dndCheckMode")),dc:Number(value("dndDC"))});return;}
    if(type==="narrate_form"||type==="note_form") {const id=type==="narrate_form"?"dndNarration":"dndNote";send({type:type==="narrate_form"?"narrate":"note",text:value(id)||""});return;}
    if(type==="hp_form") {send({type:"adjust_hp",target:value("dndRulingTarget"),delta:Number(value("dndDelta")),reason:value("dndReason")||""});return;}
    if(type==="condition_form") {send({type:"condition",target:value("dndRulingTarget"),condition:value("dndCondition"),enabled:command.enabled});return;}
    if(type==="confirm") {
      if(!selection) return;
      const {label,...action}=selection;
      if(["finish","resolve"].includes(action.type)) action.reason=value("dndReason")||"";
      selection=null;send(action);return;
    }
    send(command);
  }
  surface.addEventListener("input",e=>{if(e.target.matches("[data-dnd-draft]"))drafts[e.target.id]=e.target.value;});
  surface.addEventListener("change",e=>{if(e.target.matches("[data-dnd-draft]"))drafts[e.target.id]=e.target.value;});
  surface.addEventListener("click",event=>{
    if(explaining||busy) return;
    const command=event.target.closest("[data-dnd-command]"), pick=event.target.closest("[data-dnd-pick]"), cls=event.target.closest("[data-dnd-class]"), target=event.target.closest("[data-dnd-target]"), cell=event.target.closest("[data-dnd-cell]");
    if(command){handleCommand(JSON.parse(command.dataset.dndCommand));return;}
    if(pick){selection=JSON.parse(pick.dataset.dndPick);render();return;}
    if(cls){selectedClass=cls.dataset.dndClass;render();return;}
    if(target&&selection){selection.target=target.dataset.dndTarget;render();return;}
    if(cell){const [x,y]=cell.dataset.dndCell.split(",").map(Number);if(view.moves.some(m=>m.x===x&&m.y===y)&&allowed("move")){selection={type:"move",x,y,label:`移动到 ${String.fromCharCode(65+x)}${y+1}`};render();}else showTip(cell);return;}
    const tip=event.target.closest("[data-dnd-tip]");if(tip){showTip(tip);return;}
    if(!event.target.closest("button,input,textarea,select,label,summary,details")){selection=null;hideTip();render();}
  });
  const exempt = el => el.closest("#dndStarterSetHelpBtn,#dndStarterSetExplainBtn,#dndStarterSetDialog");
  function explain(el){if(!el)return;const text=explainText(el.dataset.dndExplain);if(!text)return;setExplain(false);openDialog("Explain",`<p>${esc(text)}</p>`);}
  document.addEventListener("pointerdown",event=>{
    if(!explaining||exempt(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
    let el=event.target.closest("[data-dnd-explain]");
    if(!el)el=[...surface.querySelectorAll("button:disabled[data-dnd-explain]")].find(b=>{const r=b.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});
    if(el){suppress=performance.now()+700;explain(el);}
  },true);
  document.addEventListener("click",event=>{
    if(performance.now()<suppress&&!exempt(event.target)){suppress=0;event.preventDefault();event.stopImmediatePropagation();return;}
    if(!explaining||exempt(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-dnd-explain]"));
  },true);
  document.addEventListener("keydown",event=>{
    if(panel.classList.contains("hidden"))return;
    if(event.key==="Escape"){setExplain(false);hideTip();if(!dialog.open){selection=null;render();}return;}
    if(explaining&&!exempt(event.target)&&["Enter"," "].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-dnd-explain]"));}
  },true);
  surface.addEventListener("pointerover",e=>{if(e.pointerType==="mouse")showTip(e.target.closest("[data-dnd-tip]"));});
  surface.addEventListener("pointerout",e=>{if(e.pointerType==="mouse")hideTip();});
  surface.addEventListener("focusin",e=>showTip(e.target.closest("[data-dnd-tip]")));
  surface.addEventListener("focusout",hideTip);
  helpButton.addEventListener("click",help); explainButton.addEventListener("click",()=>setExplain(!explaining));
  document.getElementById("dndDialogClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{if(returnFocus?.isConnected)returnFocus.focus();});
  dialog.addEventListener("click",event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  window.addEventListener("resize",hideTip);window.addEventListener("blur",hideTip);document.addEventListener("scroll",hideTip,true);
  function clear(){view=null;signature=null;selection=null;selectedClass=null;drafts={};busy=false;clearTimeout(busyTimer);setExplain(false);hideTip();document.body.classList.remove("dnd-needs-action");if(dialog.open)dialog.close();surface.innerHTML='<div class="dnd-wait">Waiting to start · 第一席担任地下城主</div>';}
  window.renderDndStarterSetGameState = data => {
    if(data?.view?.game_id!=="dnd_starter_set"||currentGameType!=="dnd_starter_set")return;
    if(data.room_id&&currentRoomState?.room_id!==data.room_id)return;
    const next=`${data.room_id}:${data.view.game_instance_id}:${data.view.window_id}:${data.view.you}`;
    if(view?.game_instance_id&&view.game_instance_id!==data.view.game_instance_id){drafts={};selectedClass=null;}
    if(next!==signature){selection=null;hideTip();}
    if(next!==signature||view?.revision!==data.view.revision){busy=false;clearTimeout(busyTimer);}
    signature=next;view=data.view;render();
  };
  window.showDndStarterSetHeaderActions = visible => {header.style.display=visible?"flex":"none";if(!visible)clear();};
  function roomSync(state){if(state?.game_type!=="dnd_starter_set"||state.status==="lobby")clear();}
  function sync(){socket.on("room:state",roomSync);socket.on("system:error",()=>{busy=false;clearTimeout(busyTimer);render();});socket.on("disconnect",()=>{busy=false;clearTimeout(busyTimer);render();});socket.on("connect",render);if(typeof currentRoomState!=="undefined")roomSync(currentRoomState);if(typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="dnd_starter_set")window.renderDndStarterSetGameState(lastGameStatePayload);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();
