(() => {
  "use strict";
  const $ = suffix => document.getElementById(`gloomhaven${suffix}`);
  const panel = $("Panel"), header = $("HeaderActions"), dialog = $("Dialog"), tooltip = $("Tooltip");
  const elementInfo = {fire:["🔥","火"],ice:["❄️","冰"],air:["🌬️","风"],earth:["🌿","土"],light:["☀️","光"],dark:["🌑","暗"]};
  const conditionInfo = {poison:["☠️","中毒"],wound:["🩸","创伤"],disarm:["⛔","缴械"],immobilize:["⛓️","定身"],stun:["💫","晕眩"],muddle:["🌀","困惑"],strengthen:["✨","强化"]};
  const monsters = {guard:["🪓","强盗守卫"],archer:["🏹","强盗弓手"],bones:["💀","活骸"]};
  const explanations = {
    scenario:["战术遭遇版", "使用初版战斗框架、六职业精简能力牌和三个原创遭遇。非原版完整剧情战役。难度 0–2 影响敌人生命、攻击、陷阱和奖励；同一公司打到第三关获胜。单人控制两名佣兵，多人每人一名。"],
    ready:["Ready · 准备", "为每名佣兵选择不同职业。房主可在无人 Ready 时选择遭遇和难度。全部玩家准备后进入秘密选牌；单人需控制两名佣兵。"],
    round:["Round · 轮次", "选双卡或长休 → 公开先攻 → 逐个行动 → 回顾。每轮全员 Next Round 才继续；耗尽佣兵的玩家仍需确认。可在回顾中短休；短休未完成不能确认。胜利全员 Continue 后进入下一关，失败 Retry 重试，第三关胜利后结束。"],
    cards:["Ability cards（🂠）· 能力牌", "每轮选两张牌，第一张决定先攻（⌛），数字越小越早。行动时一张用上半，另一张用下半，先后自由。可改为基础 Attack（⚔️）2 / Move（👣）2。烧牌（🔥 Lost）仅在实际执行牌面能力时生效；基础动作始终弃置。点选已选牌、空白或 Esc 可取消本地选择。"],
    half:["上半 / 下半行动", "一回合至多一个上半和另一个卡牌的下半。Use 执行牌面；Basic 使用基础攻击 2 或移动 2。选择后在地图或目标按钮上操作，Skip 跳过剩余能力。End Turn 直接结束，未用牌进入弃牌堆。"],
    map:["Hex map · 六角地图", "👣 Move 按格消耗移动力；可穿越友军但不能停在其格，敌军／障碍（🪨）阻挡。≋ 困难地形耗 2 点；🪽 Jump 可越过单位和障碍，中途不触发陷阱，落地仍触发。🚪 Door 踏入开启，新怪物本轮就行动。⚠️ Trap 造成 2 + 难度 点伤害。墙与关闭的门挡视线；本版采用格心射线，两种贴边路径有一条通即可。小屏可切换房间看清棋格。"],
    attack:["Attack（⚔️）· 攻击", "基础攻击 + 中毒修正，再抽攻击修正牌，最后扣除护盾（🛡️），穿刺（↗）忽略对应护盾。每人独立标准 20 张牌堆：六张 0、五张 +1、五张 −1、+2／−2／×0／×2 各一。远程贴身或困惑（🌀）劣势；强化（✨）优势。优势／劣势抽二选好／差，互相抵消。×0／×2 在轮末洗回。状态即使攻击造成 0 伤害也施加。"],
    damage:["Damage · 伤害与抵消", "每次受伤都暂停。Take Damage 承受伤害；也可失去一张手牌或两张弃牌来抵消整次伤害。已选但未执行的本轮牌不属于手牌／弃牌，不能抵伤；攻击附加状态不被抵消。生命（❤️）归零耗尽，移出地图。"],
    rest:["Rest · 休息", "至少两张弃牌才能休息。短休在回顾阶段随机失去一张弃牌，Accept 后回收其余；可承受 1 点伤害重抽一次且不会抽回原卡，伤害仍能烧牌抵消。长休占整轮、先攻 99，行动时选失去一张弃牌，回收其余，治疗 2 并刷新疾行靴。如果抵伤使弃牌少于两张，本次长休失效。"],
    elements:["Elements · 元素", "火（🔥）、冰（❄️）、风（🌬️）、土（🌿）、光（☀️）、暗（🌑）：生成元素在行动者回合结束时变 Strong；轮末 Strong → Waning → Inert。不能在自己生成它的同一回合消费。带消费文字的能力可在第一次选目标前 Use Element，使该能力攻击 +1。"],
    conditions:["Conditions · 状态", "中毒（☠️）：被攻击 +1，治疗先清除且不回血。创伤（🩸）：回合开始伤害 1，治疗清除。两者同时存在时都清除但不回血。缴械（⛔）不能攻击；定身（⛓️）不能移动；晕眩（💫）跳过正常行动；困惑（🌀）攻击劣势；强化（✨）攻击优势。后五种到目标下一回合结束移除，自己回合施加则持续到再下一回合结束。"],
    monster:["Monsters · 怪物行动", "守卫（🪓）、弓手（🏹）、活骸（💀）每类共抽一张能力牌，以 ⌛ 先攻行动；同类精英（★）先、普通后，各按编号。聚焦依次比较到可攻击位置的移动消耗、距离、目标先攻；优先不踩陷阱，远程尽量避免贴身劣势。没有 Move 的能力不移动。开门后，新怪物先攻已过则在开门者之后尽快行动。"],
    initiative:["Initiative（⌛）· 先攻", "先攻从小到大。佣兵与怪物相同先攻，佣兵先；两佣兵相同则比较第二张牌，再按固定佣兵编号决定。怪物同先攻按种类稳定排序，组内精英先。所有人提交前不公开选牌。"],
    items:["Items · 道具", "每名佣兵有治疗药水（🧪）：自己回合治疗 3，每关一次；疾行靴（🥾）：移动能力执行期间增加 2 移动力，长休恢复。晕眩时不能使用道具。每关结束后生命、卡牌与道具恢复；经验（⭐）、金币（💰）与击杀继续累计。"],
    loot:["Loot（💰）· 战利品", "每个怪物掉落一枚金币，脚下金币在回合结束自动拾取，Loot 能拾取范围内且有视线的金币。每枚价值 2 + 难度。经验（⭐）来自执行标有奖励的牌与过关奖励。此遭遇版记录成绩，不提供商店、升级或退休。"],
  };
  const help = `<h3>这是哪个版本？</h3><p>这是《幽港迷城》初版战斗框架的<strong>战术遭遇版</strong>：六种初始职业、重新编写的精简能力牌、三个原创双房间关卡。支持 1–4 人，单人控制两名佣兵，所有人合作击败两房间全部怪物。它不包含商业版 95 个剧情关卡、召唤物、升级、退休、事件、商店或遗产解锁。职业初始生命／手牌容量保留：蛮族 10／10，工匠 8／12，织法者 6／8，恶棍 8／9，裂岩者 10／11，心灵窃贼 6／10。AI 只用自己可见的信息，适合作为练习队友。</p>
    ${["ready","round","cards","half","initiative","map","attack","damage","conditions","elements","rest","monster","items","loot"].map(k=>`<h3>${explanations[k][0]}</h3><p>${explanations[k][1]}</p>`).join("")}
    <h3>失败、胜利与操作</h3><p>轮初不能出两张手牌且无法长休，或生命归零，佣兵耗尽。所有佣兵耗尽则失败；每轮结束时全部怪物已击败则胜利。轮末保留地图和日志，全员确认后推进。失败可重试当前关；第三关胜利结束。每关恢复资源、累计经验和金币作为成绩。难度为本版独立参数，不额外叠加原版单人难度修正。</p><p>选择两张手牌，第一张旁标 1／⌛，然后 Commit。行动时先点卡牌半区 Use／Basic，再点地图高亮格或目标按钮并确认 Move／Attack。小屏切换 Room 1／Room 2，All 显示全部已探索区域。手牌和日志内部可滚动。空白或 Esc 取消本地选择，Esc 关闭对话框。Help 显示规则；Explain 后点有虚线对象，禁用按钮也可解释，查看一次自动退出。静态图标可悬停／聚焦，手机点按显示 3 秒提示。</p><p>线上约定：严格同时提交；完全相同的先攻固定按佣兵编号；格心射线判定视线。地图、职业牌及怪物能力为精简原创内容，以卡面数值为准。短休重抽的伤害抵消若烧掉候选弃牌，则从剩余弃牌重新随机；没有剩余则结束休息。</p><p><a href="https://online.flippingbook.com/view/642368833/" target="_blank" rel="noopener noreferrer">初版规则书 · Round / Combat / Rest</a></p>`;
  let view = null, heroId = null, selected = [], selectedAction = null, damagePile = "hand", pending = false, explaining = false;
  let pendingTimer, tipTimer, suppressTimer, suppressClick = false, focusBeforeDialog = null;
  const narrowLayout = window.matchMedia("(max-width: 720px)");
  let roomMode = narrowLayout.matches ? 1 : 0, previousPositionRoom = null;
  narrowLayout.addEventListener("change", () => { roomMode = narrowLayout.matches ? previousPositionRoom || 1 : 0; if (view) renderMap(); });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const setText = (id, text) => { $(id).textContent = text; };
  const hero = () => view?.heroes.find(h => h.id === heroId);
  const ownHeroes = () => view?.heroes.filter(h => h.owner === view.you) || [];
  const playerName = pid => view?.players.find(p => p.player_id === pid)?.name || "Spectator";
  const className = h => h ? `${view.classes[h.class_id].icon} ${view.classes[h.class_id].name}` : "—";
  const unitName = id => { const h = view.heroes.find(h => h.id === id); const m = view.monsters.find(m => m.id === id); return h ? className(h) : m ? `${monsters[m.kind][0]} ${monsters[m.kind][1]} ${m.number}${m.elite ? " ★" : ""}` : view.last_attack?.target===id ? view.last_attack.target_name || id : view.last_attack?.attacker===id ? view.last_attack.attacker_name || id : id; };
  const opts = (type, hid = null) => view?.options.filter(o => o.type === type && (!hid || o.hero_id === hid)) || [];
  const matching = (type, fields = {}) => opts(type).find(o => Object.entries(fields).every(([k,v]) => JSON.stringify(o[k]) === JSON.stringify(v)));
  const enabled = option => !!option && !pending && socket.connected;
  function tip(node, message, key) { node.dataset.ghTip = message; node.tabIndex = 0; if (key) node.dataset.ghExplain = key; return node; }
  function button(text, action, key, cls = "") {
    const b = el("button",cls,text); b.type = "button"; b.disabled = !enabled(action); if (key) b.dataset.ghExplain = key;
    b.addEventListener("click", () => dispatch(action)); return b;
  }
  function localButton(text, fn, key) { const b = el("button","",text); b.type="button"; if (key) b.dataset.ghExplain=key; b.addEventListener("click",fn); return b; }
  function dispatch(action) {
    if (!enabled(action) || explaining || !view.options.some(o => JSON.stringify(o) === JSON.stringify(action))) return;
    pending = true; selectedAction = null; hideTip(); clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending=false; render(); }, 3000);
    sendAction({...action, ...Object.fromEntries(["game_token","scenario_attempt","round","revision"].map(k=>[k,view[k]]))}); render();
  }
  function clearSelection() { selected=[]; selectedAction=null; renderHand(); renderActions(); renderMap(); }
  function effectText(e) {
    let text = {attack:`⚔️ 攻击 ${e.value}${e.range>1 ? ` · 🎯 射程 ${e.range}` : ""}`,move:`👣 移动 ${e.value}${e.jump ? " · 🪽 跳跃" : ""}`,heal:`❤️ 治疗 ${e.value}${e.range ? ` · 🎯 ${e.range}` : " · 自己"}`,shield:`🛡️ 护盾 ${e.value}`,loot:`💰 拾取 ${e.value}`,recover:"♻️ 回收所有失去的牌",strengthen:"✨ 强化自己"}[e.kind] || e.kind;
    if (e.targets>1) text += ` · ${e.targets} 个目标`;
    if (e.pierce) text += ` · ↗ 穿刺 ${e.pierce}`;
    if (e.condition) text += ` · ${conditionInfo[e.condition].join(" ")}`;
    if (e.infuse) text += ` · 生成 ${elementInfo[e.infuse].join("")}`;
    if (e.consume) text += ` · 可消费 ${elementInfo[e.consume].join("")}`;
    return text;
  }
  function cardDescription(card) { return `${card.name}，先攻（⌛）${card.initiative}。上半：${card.top.map(effectText).join("；")}${card.top_loss ? "，执行后失去（🔥 Lost）" : ""}。下半：${card.bottom.map(effectText).join("；")}${card.bottom_loss ? "，执行后失去（🔥 Lost）" : ""}。${card.xp ? `实际执行牌面能力获得 ${card.xp} 经验（⭐）。` : ""}`; }
  function renderSetup() {
    $("Setup").classList.toggle("hidden",view.phase!=="setup");
    if (view.phase!=="setup") return;
    $("ScenarioSelect").replaceChildren();
    view.scenarios.forEach(s=>{const n=el("option","",`${s.id} · ${s.name}`);n.value=s.id;$("ScenarioSelect").append(n);});
    $("ScenarioSelect").value=view.scenario; $("Difficulty").value=view.difficulty;
    $("ScenarioSelect").disabled=$("Difficulty").disabled=!opts("configure").length || pending;
    setText("SetupReady",`${view.ready.length} / ${view.players.length} ready`);
    const tabs=$("SetupHeroes");tabs.replaceChildren();
    ownHeroes().forEach(h=>{const b=localButton(`${h.id.toUpperCase()} · ${className(h)}`,()=>{heroId=h.id;renderSetup();},"ready");b.setAttribute("aria-pressed",String(h.id===heroId));tabs.append(b);});
    const box=$("Classes");box.replaceChildren();
    Object.entries(view.classes).forEach(([id,c])=>{const action=matching("choose_class",{hero_id:heroId,class_id:id});const b=button("",action,"ready","gh-class");b.style.setProperty("--class-color",c.color);b.append(el("strong","",`${c.icon} ${c.name}`),el("span","",c.role),el("span","",`❤️ ${c.hp} · 🂠 ${c.hand}`));b.setAttribute("aria-pressed",String(hero()?.class_id===id));box.append(b);});
    const ready=opts("ready")[0]||opts("unready")[0];$("Ready").disabled=!enabled(ready);$("Ready").textContent=ready?.type==="unready" ? "Unready" : "Ready";$("Ready").onclick=()=>dispatch(ready);
  }
  function renderHeroes() {
    const box=$("Heroes");box.replaceChildren();
    view.heroes.forEach(h=>{
      const n=el("article",`gh-hero${view.current===h.id ? " is-current" : ""}${h.exhausted ? " is-exhausted" : ""}`);n.style.setProperty("--class-color",view.classes[h.class_id].color);
      n.append(el("strong","",`${h.id.toUpperCase()} · ${className(h)}`),el("div","gh-owner",`${playerName(h.owner)}${h.owner===view.you ? " · You" : ""}${h.exhausted ? " · Exhausted" : h.planned && view.phase==="planning" ? " · Ready ✓" : ""}`));
      if (h.hp!=null) {
        const health=el("div","gh-health"),fill=el("i");fill.style.width=`${h.hp/h.max_hp*100}%`;health.append(fill);n.append(health);
        const stats=el("div","gh-stats");
        [[`❤️ ${h.hp}/${h.max_hp}`,"生命（❤️）：归零则耗尽。","damage"],[`🂠 ${h.hand_count}`,"手牌（🂠）：只有本人能看到牌面。","cards"],[`🗂️ ${h.discard_count}`,"弃牌（🗂️）：休息后可以回收。","rest"],[`🔥 ${h.lost_count}`,"Lost（🔥）：本关失去的牌。","rest"],[`⭐ ${h.xp}`,"经验（⭐）：累计成绩。","loot"],[`💰 ${h.gold}`,"金币（💰）：累计成绩。","loot"]].forEach(([t,d,k])=>stats.append(tip(el("span","",t),d,k)));
        n.append(stats);
        const conditions=Object.keys(h.conditions).map(c=>conditionInfo[c].join(" ")).join(" · ");
        if (conditions) n.append(tip(el("div","gh-owner",conditions),explanations.conditions[1],"conditions"));
      }
      box.append(n);
    });
  }
  const svgEl = (tag, attrs = {}, text) => {const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!=null)n.textContent=text;return n;};
  function renderMap() {
    if (!view || view.phase==="setup") return;
    const rooms=$("Rooms");rooms.replaceChildren();
    [0,1,2].filter(r=>r!==2||view.cells.some(c=>c.room===2)).forEach(r=>{const b=localButton(r ? `Room ${r}` : "All",()=>{roomMode=r;renderMap();},"map");b.setAttribute("aria-pressed",String(roomMode===r));rooms.append(b);});
    const cells=view.cells.filter(c=>!roomMode||c.room===roomMode||c.terrain==="door");
    const centers=cells.map(c=>({c,x:Math.sqrt(3)*29*(c.q+c.r/2),y:43.5*c.r}));
    const minX=Math.min(...centers.map(p=>p.x))-32,maxX=Math.max(...centers.map(p=>p.x))+32,minY=-34,maxY=Math.max(...centers.map(p=>p.y))+34;
    const svg=svgEl("svg",{viewBox:`${minX} ${minY} ${maxX-minX} ${maxY-minY}`,role:"group","aria-label":"Explored hex map"});
    centers.forEach(({c,x,y})=>{
      const h=view.heroes.find(h=>!h.exhausted&&h.pos[0]===c.q&&h.pos[1]===c.r),m=view.monsters.find(m=>m.pos[0]===c.q&&m.pos[1]===c.r),unit=h||m;
      const move=matching("move",{hero_id:heroId,q:c.q,r:c.r}),target=unit&&matching("target",{hero_id:heroId,target:unit.id}),action=target||move;
      const selectedHere=selectedAction&&JSON.stringify(selectedAction)===JSON.stringify(action);
      const n=svgEl("g",{class:`gh-hex${action ? " is-reachable" : ""}${selectedHere ? " is-selected" : ""}`,tabindex:0,role:"button","aria-disabled":String(!action),"data-gh-explain":"map","data-q":c.q,"data-r":c.r});
      const terrain={floor:"地面",obstacle:"障碍（🪨）",trap:"陷阱（⚠️）",difficult:"困难地形（≋）",door:c.open ? "已开启的门" : "关闭的门（🚪）"}[c.terrain];
      n.dataset.ghTip=`${unit ? `${unitName(unit.id)}，❤️ ${unit.hp}/${unit.max_hp}。` : ""}${terrain} · [${c.q}, ${c.r}]${c.coins ? ` · 💰 ${c.coins}` : ""}${action ? "。可点选并确认操作。" : ""}`;n.setAttribute("aria-label",n.dataset.ghTip);
      n.append(svgEl("polygon",{points:Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return `${x+28*Math.cos(a)},${y+28*Math.sin(a)}`;}).join(" ")}));
      if(unit){n.append(svgEl("circle",{cx:x,cy:y-2,r:18,class:`gh-token${m ? " monster" : ""}${view.current===unit.id ? " active" : ""}`}));n.append(svgEl("text",{x,y:y-4,class:"gh-token-icon"},h ? view.classes[h.class_id].icon : monsters[m.kind][0]));n.append(svgEl("text",{x,y:y+20,class:"gh-hex-detail"},`${h ? h.id.toUpperCase() : `${m.elite ? "★" : "#"}${m.number}`} · ${unit.hp}♥`));}
      else {const icon=c.coins ? "💰" : {obstacle:"🪨",trap:"⚠️",difficult:"≋",door:c.open ? "◇" : "🚪"}[c.terrain]||"";n.append(svgEl("text",{x,y,class:"gh-terrain"},icon));}
      const choose=()=>{if(action&&!pending&&!explaining){selectedAction=action;renderMap();renderActions();}else showTip(n,true);};
      n.addEventListener("click",choose);n.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});svg.append(n);
    });$("Map").replaceChildren(svg);
  }
  function renderBattleInfo() {
    $("Elements").replaceChildren();
    Object.entries(elementInfo).forEach(([key,[icon,name]])=>{const strength=view.elements[key];$("Elements").append(tip(el("span",`gh-element${!strength ? " is-empty" : strength===2 ? " is-strong" : ""}`,`${icon} ${name} · ${["○","◐","●"][strength]}`),`${name}（${icon}）：${["Inert · 消失","Waning · 弱","Strong · 强"][strength]}。`,"elements"));});
    $("Queue").replaceChildren();
    view.queue.forEach((id,index)=>{const h=view.heroes.find(h=>h.id===id),m=view.monsters.find(m=>m.id===id);if(!h&&!m)return;const initiative=h ? h.initiative : view.monster_cards[m.kind]?.initiative;$("Queue").append(tip(el("span",`gh-initiative${view.current===id ? " is-current" : index<view.queue_index ? " is-done" : ""}`,`⌛ ${initiative ?? "?"} · ${h ? view.classes[h.class_id].icon : monsters[m.kind][0]} ${h ? id.toUpperCase() : m.number}`),`${unitName(id)} · 先攻 ${initiative ?? "尚未公开"}`,"initiative"));});
    $("MonsterCards").replaceChildren();Object.entries(view.monster_cards).forEach(([kind,card])=>{const b=tip(el("div","gh-monster-card"),explanations.monster[1],"monster");b.append(el("strong","",`${monsters[kind].join(" ")} · ⌛ ${card.initiative}`),el("div","",`${card.name} · ${card.move===null ? "不移动" : `👣 ${card.move>=0 ? "+" : ""}${card.move}`} · ⚔️ ${card.attack>=0 ? "+" : ""}${card.attack}${card.shield ? ` · 🛡️ ${card.shield}` : ""}`));$("MonsterCards").append(b);});
    $("LastAttack").classList.toggle("hidden",!view.last_attack);
    if(view.last_attack){const a=view.last_attack;const mod=m=>m==="miss" ? "×0" : m==="double" ? "×2" : m>0 ? `+${m}` : m;setText("LastAttack",`${unitName(a.attacker)} → ${unitName(a.target)} · [${a.drawn.map(mod).join(" / ")}] → ⚔️ ${a.damage}`);$("LastAttack").dataset.ghTip=explanations.attack[1];}
    const log=$("Log"),scroll=log.scrollTop;log.replaceChildren();[...view.log].reverse().forEach(row=>log.append(el("li","",`R${row.round} · ${row.text}`)));log.scrollTop=scroll;
  }
  function renderReview() {
    const reviewing=["round_review","scenario_review","game_over"].includes(view.phase);
    $("Review").classList.toggle("hidden",!reviewing);if(!reviewing)return;
    setText("ResultTitle",view.result ? `${view.result.won ? "🏆" : "🕯️"} ${view.result.won ? "遭遇胜利" : "公司耗尽"}${view.game_over ? " · 远征完成" : ""}` : `Round ${view.round} complete`);
    $("ResultTitle").dataset.ghTip=view.result ? `${view.result.won ? "胜利（🏆）：两房间的怪物均已击败。" : "失败（🕯️）：所有佣兵耗尽。"}确认后推进或重试。` : explanations.round[1];$("ResultTitle").dataset.ghExplain="round";$("ResultTitle").tabIndex=0;
    setText("ReadyCount",view.game_over ? "Final results" : `${view.ready.length} / ${view.players.length} ready`);
    $("Results").replaceChildren();if(!view.result){const report=el("div","gh-round-report");view.heroes.forEach(h=>{const rows=(view.round_report||[]).filter(row=>row.hero_id===h.id);const group=el("div",`gh-report-group${h.owner===view.you ? " is-yours" : ""}`);group.append(el("strong","",`${className(h)}${h.owner===view.you ? " · You" : ""}`));rows.forEach(row=>group.append(el("div","",row.text)));if(!rows.length)group.append(el("div","","No actions this round."));report.append(group);});$("Results").append(report);}if(view.result)view.result.heroes.forEach(h=>$("Results").append(tip(el("div","gh-score",`${className(h)} · ⭐ ${h.xp} · 💰 ${h.gold} · ⚔️ ${h.kills} 击杀`),"经验（⭐）、金币（💰）与击杀为累计成绩。","loot")));
    const box=$("RestOptions");box.replaceChildren();
    ownHeroes().forEach(h=>{
      if(h.rest_pending){const n=el("div","gh-rest");n.append(el("span","",`${className(h)} · 🔥 ${view.cards[h.rest_pending.card].name}`),button("Accept",matching("rest_accept",{hero_id:h.id}),"rest"),button("Redraw · 1 ❤️",matching("rest_redraw",{hero_id:h.id}),"rest"));box.append(n);}
      else if(opts("short_rest",h.id).length)box.append(button(`${className(h)} · Short Rest`,opts("short_rest",h.id)[0],"rest"));
    });
    const next=opts("next_round")[0]||opts("continue")[0];$("Next").classList.toggle("hidden",view.game_over);$("Next").disabled=!enabled(next);$("Next").textContent=view.ready.includes(view.you) ? "Ready ✓" : view.phase==="round_review" ? "Next Round" : view.result?.won ? "Continue" : "Retry";$("Next").onclick=()=>dispatch(next);
  }
  function renderActions() {
    if(!view || view.phase==="setup")return;
    const h=hero(),box=$("Actions");box.replaceChildren();$("SelectedAction").replaceChildren();$("SelectedAction").classList.toggle("hidden",!selectedAction);
    if(selectedAction){const action=selectedAction;const label=action.type==="move" ? `Move → [${action.q}, ${action.r}]` : `${view.active?.effects[view.active.index]?.kind==="heal" ? "Heal" : "Attack"} → ${unitName(action.target)}`;$("SelectedAction").append(el("span","",label),button(action.type==="move" ? "Move" : view.active?.effects[view.active.index]?.kind==="heal" ? "Heal" : "Attack",action,action.type==="move" ? "map" : "attack","gh-primary"),localButton("Cancel",()=>{selectedAction=null;renderMap();renderActions();}));}
    let message="Spectating · hands are private.";
    if(h){
      if(view.damage){
        const d=view.damage,ours=heroesOwn(d.hero_id);message=`${unitName(d.hero_id)} · ${d.source} → ${d.amount} damage`;
        if(ours){box.append(button(`Take ${d.amount} Damage`,matching("damage",{hero_id:d.hero_id,cards:[]}),"damage","gh-danger"));
          const use=opts("damage",d.hero_id).find(o=>o.cards.length===selected.length&&o.cards.length&&o.cards.every(c=>selected.includes(c)));
          box.append(button("Lose & Prevent",use,"damage","gh-primary"));
          ["hand","discard"].forEach(p=>{const b=localButton(p==="hand" ? "1 hand card" : "2 discards",()=>{damagePile=p;selected=[];renderHand();renderActions();},"damage");b.setAttribute("aria-pressed",String(damagePile===p));box.append(b);});
          message += ` · Select ${damagePile==="hand" ? "1 hand card" : "2 discarded cards"}, or take the damage.`;
        }
      }else if(h.exhausted)message="Exhausted · watch the company and confirm round results.";
      else if(view.phase==="planning"){
        if(h.planned){message=`${className(h)} · Plan locked. Waiting for the company.`;box.append(button("Undo Plan",matching("undo_plan",{hero_id:h.id}),"cards"));}
        else {message=`${className(h)} · Choose 2 cards. First card sets initiative.`;const plan=matching("plan",{hero_id:h.id,cards:selected});box.append(button(selected.length===2 ? `Commit · ⌛ ${view.cards[selected[0]].initiative}` : `Commit · ${selected.length}/2`,plan,"cards","gh-primary"),button("Long Rest · ⌛ 99",matching("long_rest",{hero_id:h.id}),"rest"));}
      }else if(view.phase==="acting"){
        if(view.current!==h.id)message=view.active ? `${unitName(view.current)} · ${view.cards[view.active.card].name} · ${effectText(view.active.effects[view.active.index])}` : `Waiting for ${unitName(view.current)}.`;
        else if(h.resting){message="Long rest · choose one discarded card to lose.";if(opts("end_turn",h.id).length)box.append(button("End Turn",opts("end_turn",h.id)[0],"rest"));}
        else if(view.active){const e=view.active.effects[view.active.index];message=`${view.cards[view.active.card].name} · ${effectText(e)}${e.kind==="move" ? ` · ${view.active.remaining} remaining` : ""}`;
          if(opts("consume",h.id).length)box.append(button(`Use ${elementInfo[e.consume].join(" ")} · +1`,opts("consume",h.id)[0],"elements"));
          opts("target",h.id).forEach(o=>box.append(localButton(`${e.kind==="heal" ? "❤️" : "⚔️"} ${unitName(o.target)}`,()=>{selectedAction=o;renderMap();renderActions();},e.kind==="heal" ? "conditions" : "attack")));
          box.append(button(e.kind==="move" ? "Finish Move" : "Skip",opts("skip",h.id)[0],"half"));
        }else{message=`${className(h)} · Choose a card half, or End Turn.`;box.append(button("End Turn",matching("end_turn",{hero_id:h.id}),"half"));}
        opts("item",h.id).forEach(o=>box.append(button(o.item==="potion" ? "🧪 Heal 3" : "🥾 Move +2",o,"items")));
      }else message="Review the map and results before continuing.";
    }
    setText("Command",message);
  }
  function heroesOwn(id){return view.heroes.some(h=>h.id===id&&h.owner===view.you);}
  function renderHand() {
    if(!view||view.phase==="setup")return;
    const h=hero(),tabs=$("HeroTabs");tabs.replaceChildren();
    ownHeroes().forEach(unit=>{const b=localButton(`${unit.id.toUpperCase()} ${view.classes[unit.class_id].icon}`,()=>{heroId=unit.id;selected=[];selectedAction=null;renderHand();renderActions();renderMap();},"cards");b.setAttribute("aria-pressed",String(h?.id===unit.id));tabs.append(b);});
    setText("HandTitle",h ? className(h) : "Spectating");
    const box=$("Hand"),scroll=box.scrollTop;box.replaceChildren();
    if(!h){$("Piles").classList.add("hidden");return;}
    const takingDamage=view.damage?.hero_id===h.id&&heroesOwn(h.id),resting=view.current===h.id&&h.resting&&view.phase==="acting"&&!view.damage;
    const acting=view.phase==="acting"&&view.current===h.id&&!takingDamage&&!resting;
    const ids=takingDamage ? h[damagePile] : resting ? h.discard : acting||h.planned ? h.played : h.hand;
    ids.forEach(cid=>{
      const card=view.cards[cid],pickable=takingDamage||(!h.planned&&view.phase==="planning"),n=el(pickable ? "button" : "article",`gh-card${selected.includes(cid) ? " is-selected" : ""}`);
      n.style.setProperty("--class-color",view.classes[h.class_id].color);n.dataset.ghExplain="card";n.dataset.cardId=cid;n.setAttribute("aria-label",cardDescription(card));
      if(pickable){n.type="button";n.disabled=pending||!socket.connected;n.setAttribute("aria-pressed",String(selected.includes(cid)));n.addEventListener("click",()=>{if(explaining)return;const max=takingDamage&&damagePile==="hand" ? 1 : 2;if(selected.includes(cid))selected=selected.filter(c=>c!==cid);else if(selected.length<max)selected.push(cid);else selected=[cid];renderHand();renderActions();});}
      const title=el("div","gh-card-title");title.append(el("span","",card.name),tip(el("strong","",String(card.initiative).padStart(2,"0")),`先攻（⌛）${card.initiative}，越小越早。`,"initiative"));n.append(title);
      ["top","bottom"].forEach(half=>{const part=tip(el("div","gh-card-half"),`${card[half].map(effectText).join("；")}${card[half+"_loss"] ? "。执行牌面能力后失去此牌（🔥 Lost）。" : "。执行后弃置。"}`,"half");part.append(el("b","",`${half==="top" ? "▲ 上半" : "▼ 下半"}${card[half+"_loss"] ? " · 🔥 Lost" : ""}${card.xp ? ` · ⭐ ${card.xp}` : ""}`),el("span","",card[half].map(effectText).join(" → ")));
        if(acting){const actions=el("div","gh-half-buttons");actions.append(button("Use",matching("half",{hero_id:h.id,card:cid,half,basic:false}),"half"),button(half==="top" ? "Basic ⚔️ 2" : "Basic 👣 2",matching("half",{hero_id:h.id,card:cid,half,basic:true}),"half"));part.append(actions);}
        n.append(part);
      });
      if(selected.includes(cid))n.append(el("div","gh-card-selection",takingDamage ? "Selected to lose" : `${selected.indexOf(cid)+1} · ${selected.indexOf(cid)===0 ? "⌛ Initiative" : "Second card"}`));
      if(resting)n.append(button("Lose & Rest",matching("rest_lose",{hero_id:h.id,card:cid}),"rest"));
      box.append(n);
    });
    box.scrollTop=scroll;
    $("Piles").classList.remove("hidden");setText("PileTitle",`Discard ${h.discard_count} · Lost ${h.lost_count}`);$("PileCards").replaceChildren();
    [[h.discard,"🗂️"],[h.lost,"🔥"]].forEach(([list,icon])=>list.forEach(cid=>$("PileCards").append(tip(el("span","",`${icon} ${view.cards[cid].name}`),cardDescription(view.cards[cid]),"cards"))));
  }
  function render() {
    if(!view)return;
    document.getElementById("roomControlsPanel")?.classList.toggle("gh-your-turn",socket.connected&&view.options.some(o=>!["undo_plan","unready","configure","choose_class"].includes(o.type)));
    $("Battle").classList.toggle("hidden",view.phase==="setup");
    setText("Round",view.phase==="setup" ? "Company setup" : `Round ${view.round}`);setText("ScenarioName",`${String(view.scenario).padStart(2,"0")} · ${view.scenarios[view.scenario-1].name}`);
    const status={setup:"Prepare the company",planning:"Choose your two cards",acting:view.damage ? "Damage · choose a response" : `Turn · ${unitName(view.current)}`,round_review:"Round complete · all players confirm",scenario_review:view.result?.won ? "Victory · ready for the next encounter" : "Defeat · ready to retry",game_over:"Expedition complete"}[view.phase];
    setText("Status",!socket.connected ? "Disconnected · reconnecting…" : status);
    renderSetup();renderHeroes();renderReview();if(view.phase!=="setup"){renderMap();renderBattleInfo();renderHand();renderActions();}
  }
  function hideTip(){clearTimeout(tipTimer);tooltip.classList.add("hidden");}
  function showTip(target,auto=false){if(!target?.dataset.ghTip||explaining||dialog.open)return;clearTimeout(tipTimer);tooltip.textContent=target.dataset.ghTip;tooltip.classList.remove("hidden");const r=target.getBoundingClientRect(),b=tooltip.getBoundingClientRect();tooltip.style.left=`${Math.max(12,Math.min(r.left,innerWidth-b.width-12))}px`;tooltip.style.top=`${r.bottom+b.height+12<innerHeight ? r.bottom+6 : Math.max(12,r.top-b.height-6)}px`;if(auto)tipTimer=setTimeout(hideTip,3000);}
  function setExplain(value){explaining=value;panel.classList.toggle("gh-explaining",value);$("ExplainBtn").setAttribute("aria-pressed",String(value));hideTip();}
  function showDialog(title,body,html=false){hideTip();focusBeforeDialog=document.activeElement;setText("DialogTitle",title);if(html)$("DialogBody").innerHTML=body;else $("DialogBody").replaceChildren(el("p","",body));if(!dialog.open)dialog.showModal();$("DialogClose").focus();}
  function explain(target){if(!target)return;const key=target.dataset.ghExplain;let entry=explanations[key];if(key==="card"&&view?.cards[target.dataset.cardId]){const c=view.cards[target.dataset.cardId];entry=[c.name,cardDescription(c)+" "+explanations.cards[1]];}else if(target.dataset.ghTip&&entry)entry=[entry[0],target.dataset.ghTip+" "+entry[1]];if(entry){setExplain(false);showDialog(...entry);}}
  const exempt=target=>target.closest("#gloomhavenHelpBtn,#gloomhavenExplainBtn,#gloomhavenDialog");
  $("HelpBtn").addEventListener("click",()=>{setExplain(false);showDialog("Gloomhaven · Help",help,true);});
  $("ExplainBtn").addEventListener("click",()=>setExplain(!explaining));$("DialogClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{if(focusBeforeDialog?.isConnected)focusBeforeDialog.focus();});
  $("ScenarioSelect").addEventListener("change",()=>dispatch(matching("configure",{scenario:Number($("ScenarioSelect").value),difficulty:view.difficulty})));
  $("Difficulty").addEventListener("change",()=>dispatch(matching("configure",{scenario:view.scenario,difficulty:Number($("Difficulty").value)})));
  document.addEventListener("pointerdown",event=>{if(!explaining||panel.classList.contains("hidden")||exempt(event.target))return;event.preventDefault();event.stopImmediatePropagation();const target=[...panel.querySelectorAll("[data-gh-explain]")].reverse().find(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});suppressClick=true;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppressClick=false;},700);explain(target);},true);
  document.addEventListener("click",event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}if(!explaining||panel.classList.contains("hidden")||exempt(event.target))return;event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-gh-explain]"));},true);
  document.addEventListener("keydown",event=>{if(panel.classList.contains("hidden"))return;if(event.key==="Escape"){setExplain(false);hideTip();clearSelection();}if(explaining&&!exempt(event.target)&&["Enter"," "].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-gh-explain]"));}},true);
  panel.addEventListener("pointerover",event=>{if(event.pointerType==="mouse")showTip(event.target.closest("[data-gh-tip]"));});panel.addEventListener("pointerout",event=>{if(event.pointerType==="mouse")hideTip();});panel.addEventListener("focusin",event=>showTip(event.target.closest("[data-gh-tip]")));panel.addEventListener("focusout",hideTip);
  panel.addEventListener("click",event=>{const target=event.target.closest("[data-gh-tip]");if(target&&!event.target.closest("button"))showTip(target,true);if(!event.target.closest("button,svg,select,details,dialog,.gh-card")&&(selected.length||selectedAction))clearSelection();});
  document.addEventListener("scroll",hideTip,true);window.addEventListener("resize",()=>{hideTip();if(view)renderMap();});window.addEventListener("blur",hideTip);
  function clearState(){document.getElementById("roomControlsPanel")?.classList.remove("gh-your-turn");view=null;heroId=null;selected=[];selectedAction=null;pending=false;suppressClick=false;clearTimeout(pendingTimer);clearTimeout(suppressTimer);setExplain(false);hideTip();if(dialog.open)dialog.close();["Heroes","Hand","Map","Actions","Log"].forEach(id=>$(id).replaceChildren());["Battle","Setup","Review"].forEach(id=>$(id).classList.add("hidden"));setText("Status","Waiting to start");previousPositionRoom=null;}
  window.renderGloomhavenGameState=data=>{
    if(data?.view?.game_id!=="gloomhaven"||currentGameType!=="gloomhaven"||(data.room_id&&currentRoomState?.room_id!==data.room_id))return;
    const incoming=data.view,phaseChanged=view?.phase!==incoming.phase,newGame=view?.game_token!==incoming.game_token;
    if(newGame){heroId=null;selected=[];previousPositionRoom=null;}
    if(phaseChanged||view?.damage?.hero_id!==incoming.damage?.hero_id)selected=[];
    if(view?.revision!==incoming.revision){pending=false;clearTimeout(pendingTimer);selectedAction=null;}
    view=incoming;
    const forced=view.damage?.hero_id||view.current;
    if(forced&&heroesOwn(forced))heroId=forced;
    if(!ownHeroes().some(h=>h.id===heroId))heroId=ownHeroes()[0]?.id||null;
    const h=hero();if(h?.hand&&view.phase==="planning"&&!h.planned)selected=selected.filter(c=>h.hand.includes(c));
    if(h?.pos){const r=view.cells.find(c=>c.q===h.pos[0]&&c.r===h.pos[1])?.room;if(roomMode&&r&&r!==previousPositionRoom)roomMode=r;previousPositionRoom=r;}
    render();
  };
  window.clearGloomhavenState=clearState;
  window.showGloomhavenHeaderActions=visible=>{header.style.display=visible ? "flex" : "none";if(!visible)clearState();};
  function syncRoom(state){if(state?.game_type!=="gloomhaven"||state.status==="lobby")clearState();}
  function sync(){socket.on("room:state",syncRoom);socket.on("system:error",()=>{pending=false;clearTimeout(pendingTimer);render();});socket.on("disconnect",()=>{pending=false;clearTimeout(pendingTimer);hideTip();render();});socket.on("connect",render);if(typeof currentRoomState!=="undefined")syncRoom(currentRoomState);if(typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="gloomhaven")window.renderGloomhavenGameState(lastGameStatePayload);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();
