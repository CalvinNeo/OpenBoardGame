(() => {
  "use strict";
  const panel = document.getElementById("duneImperiumPanel");
  const root = document.getElementById("duneImperiumRoot");
  const header = document.getElementById("duneImperiumHeaderActions");
  const dialog = document.getElementById("duneImperiumDialog");
  const tip = document.getElementById("duneImperiumTip");
  const explainButton = document.getElementById("duneImperiumExplainBtn");
  const icons = {emperor:"👑",guild:"🚀",bene:"🔮",fremen:"🏜️",landsraad:"🏛️",city:"🏙️",spice:"🟠",water:"💧",solari:"💰",troops:"🛡️",garrison:"🛡️",swords:"⚔️",persuasion:"🗣️",vp:"⭐",draw:"🃏",intrigue:"🕵️"};
  const names = {emperor:"皇帝",guild:"宇航公会",bene:"贝尼·杰瑟里特",fremen:"弗雷曼",landsraad:"议会",city:"城市",spice:"香料",water:"水",solari:"索拉里",troops:"部队",garrison:"驻军",swords:"剑",persuasion:"说服力",vp:"胜利点",draw:"抽牌",intrigue:"阴谋牌"};
  const colors = {emperor:"#b65b3c",guild:"#bf8221",bene:"#5d71a9",fremen:"#3e8786"};
  const playerColors = ["#448673","#c66a53","#587cb6","#996eb0"];
  const phases = {leader:"Choose a leader",baron:"Choose two factions",agent:"Player Turns",combat:"Combat",rewards:"Rewards",round_end:"Round Review",endgame:"Endgame",game_over:"Game Over"};
  const explanations = {
    agent:"特工 Agent（👤）：每次特工回合使用一张手牌，进入对应图标的合法行动格。先付入场费，再按任意顺序结算格子与卡牌效果。每格通常只能容纳一名特工。",
    reveal:"Reveal：公开剩余手牌，结算揭示区。说服力 Persuasion（🗣️）可购买多张牌；新牌默认进弃牌堆。结束后本轮不能再派特工。剑 Sword（⚔️）只有自己在冲突中有部队（🛡️）时才贡献战力。",
    influence:"影响力 Influence：四条轨道各为 0–6。达到 2 得一胜利点（⭐），跌回 2 以下失去。跨入 4 获得资源奖励；首次到 4 取得联盟（🤝）及一分。只有严格超过持有者才能抢走联盟；持有者掉到 4 以下或落后也会失去。",
    conflict:"冲突 Conflict（⚔️）：每个冲突部队（🛡️）提供 2 战力，加上剑。无部队则为 0。第一、二名得对应奖励，仅四人局给第三名奖励。并列第一各得第二档，并列第二各得第三档（仅四人局）；并列第三无奖励。零战力无奖励。",
    deploy:"部署 Deploy（🛡️）：派遣特工到战斗格后，可投入该回合新招募部队和至多两名原驻军。部署数量可以为零；冲突结束的部队回供应区，撤退则回驻军。每人总量 12。",
    buy:"Buy：在自己的 Reveal 回合花说服力（🗣️）购牌；帝国行立即补新牌，可继续购买。新牌默认进弃牌堆。香料必须流动 The Spice Must Flow 费用 9，获得时加一分（⭐）。",
    intrigue:"阴谋牌 Intrigue（🕵️）与主牌库分开。Plot 仅在自己的特工或揭示回合；Combat 仅在战斗阶段且有部队；胜后牌必须独赢冲突；Endgame 仅在终局。出牌前须满足条件并支付费用。",
    next:"Next Round：确认看完本轮结算。所有玩家确认后才收回部队和特工，开始下一轮。AI 自动确认；最后一轮后进入终局阴谋牌结算。",
    effect:"普通收益自动结算。只有能力的先后次序会影响结果时才选择先结算哪项能力。部署、支付、移除卡牌等选择点一次即生效。",
    pass:"Pass：本次不再出战斗阴谋牌。若有人继续出牌，你仍可再次响应；全部参战玩家连续 Pass 才结算冲突。",
    finish:"End Turn：结束当前回合。所有待结算效果必须先完成；揭示回合中未花掉的说服力（🗣️）会失去。",
    maker:"产地 Maker（🟠）：大平原、哈加盆地、帝国盆地在轮末没有特工时累积一香料。下一次访问者获得基础产量和累积值。",
    control:"控制 Control（🚩）：冲突可给予厄拉金、迦太格或帝国盆地控制权。任何玩家访问时，控制者得一索拉里（💰），帝国盆地改为一香料（🟠）。下一次该城市冲突可从供应区投入一防御部队（🛡️）。",
    deck:"牌库 Deck（🃏）：抽牌堆耗尽时才重洗弃牌堆。购买的新牌先进入弃牌堆。移除 Trash（✖）可选手牌、弃牌或在场牌；储备牌被移除会回到储备堆。",
  };
  let view = null, selected = null, selectedCard = null, tab = "board", boardGroup = "factions", pending = false, explaining = false;
  let pendingTimer = null, tipTimer = null, suppressedUntil = 0, focusBack = null;
  let gesture = null;
  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const own = () => view?.players.find(p=>p.player_id===view.you);
  const player = id => view?.players.find(p=>p.player_id===id);
  const pname = id => player(id)?.name || "Player";
  const color = id => id === "hagal" ? "#7e7769" : playerColors[(player(id)?.seat || 0)%4];
  const card = uid => view.catalog.cards[view.cards[uid]];
  const moves = type => (view?.moves || []).filter(m=>m.type===type);
  const has = type => moves(type).length>0 && !pending;
  const sourceName = uid => view.cards[uid] ? card(uid).name_zh : "";
  const amounts = values => Object.entries(values).map(([k,n])=>`${icons[k]||""} ${n}`).join(" · ");
  const amountWords = values => Object.entries(values).map(([k,n])=>`${names[k]||k}(${icons[k]||""}) ${n}`).join("、");
  const explainAttr = text => `data-di-explain="${esc(text)}"`;
  const tooltipAttr = text => `data-di-tip="${esc(text)}" tabindex="0"`;
  function token(key,n,label) { return `<span class="di-token" ${tooltipAttr(label||`${names[key]}(${icons[key]})`)}>${icons[key]} ${esc(n)}</span>`; }
  function effectText(e, words=false) {
    const kind=e.kind, values=words?amountWords:amounts;
    if(kind==="gain")return `${words?"获得 ":""}${values(e.values)}`;
    if(kind==="influence")return `${e.faction==="any"?"任一派系":names[e.faction]} +${e.amount}${e.exclude?`（除${names[e.exclude]}）`:""}${e.behind?"（须落后于对手）":""}`;
    if(kind==="pay")return `${values(e.cost)} → ${e.effects.map(x=>effectText(x,words)).join("；")}`;
    if(kind==="choice")return e.options.map(x=>effectText(x,words)).join(" / ");
    if(kind==="conditional"){
      const prefix=e.condition==="bond"?"弗雷曼羁绊":e.condition==="sister"?"另一张姐妹会牌在场":e.condition==="alliance"?`${names[e.faction]}联盟`:`${names[e.faction]} ≥ ${e.amount}`;
      return `${prefix}：${e.effects.map(x=>effectText(x,words)).join("；")}`;
    }
    const text={trash:"可移除一张牌 ✖",trash_self:"移除此牌 ✖",harvest:`收获 🟠 ${e.amount} + 累积`,carryall:"额外获得基础香料产量",foldspace:"获得折叠空间",swordmaster:"获得第三名特工 👤",mentat:"若可用，获得本轮门塔特 👤",council:"取得议会席位 · 每轮 🗣️ +2",ring:"发动领袖戒指 💍",steal:"从持有至少四阴谋牌的对手各随机取一张",enemy_garrison:"每名对手失去一驻军",enemy_discard:`每名对手弃 ${e.amount} 张手牌`,test_humanity:"每名对手弃一牌或失去一冲突部队",deploy:`可部署至多 ${e.amount} 驻军`,deployment:`部署新兵及至多两名原驻军`,retreat:`可撤退至多 ${e.amount} 部队`,recruit_deploy:`招募 ${e.amount} 部队，可投入冲突`,reinforcements:`招募 ${e.amount} 部队；揭示回合可投入冲突`,memory:"抽一牌 / 从弃牌堆拿回一姐妹会牌",shift:"🟠 2 + 某派系 −1 → 任一派系 +2",voice:"封锁一个行动格，持续本轮",discount:"每张香料必须流动少付 🗣️ 3",liet:"每张在场弗雷曼牌提供 🗣️ 2",reserve_card:"保留一张帝国行牌，购买少付 🗣️ 1",two_factions:"选择两个不同派系，各 +1",alliance_choice:"选择联盟的新持有者",baron_power:"可发动一次妙计",envoy:"本回合手牌可访问四派系",infiltrate:"下次特工无视敌方特工占格",recruitment:"本次揭示购牌可置顶",bindu:"可以跳过本次回合",bypass:"免费获得费用 ≤3 的牌；或 🟠 2 获得 ≤5 的牌并置顶",double_cross:"对手失去一冲突部队，自己从供应区部署一兵",snooper:"查看顶牌，抽取或移除",refocus:"弃牌洗回牌库，抽一牌",recall:"召回一名己方特工",staged:"失去三名冲突部队 → ⭐ 1",next_mentat:"下轮获得门塔特 👤",corner_market:"至少两张香料必须流动得一分；数量独多再得一分",plans:"三个派系影响力 ≥3 得一分；四个则得两分",breeding:"可移除一牌 → 抽两牌",spy:"可移除此牌 → 抽一阴谋牌",defense:"从供应区部署一名防御部队"};
    return text[kind] || kind;
  }
  function cardText(uid) {
    const c=card(uid);
    return `${c.name_zh} · ${c.name}。购买费用：说服力（🗣️）${c.cost}。访问：${c.icons.map(k=>`${names[k]}(${icons[k]})`).join("、")||"无"}。特工：${c.agent.map(e=>effectText(e,true)).join("；")||"无额外效果"}。揭示：${c.reveal.map(e=>effectText(e,true)).join("；")||"无"}。${c.acquire.length?`获得时：${c.acquire.map(e=>effectText(e,true)).join("；")}。`:""}${view.cards[uid]==="kwisatz_haderach"?"可派遣任何位置的己方特工，进入已占用格；仍需支付费用并满足条件。":""}${view.cards[uid]==="assassination_mission"?"被其他效果移除时获得四索拉里（💰）。":""}`;
  }
  function spaceText(id) {
    const s=view.catalog.spaces[id];
    return `${s.name}：${names[s.icon]}(${icons[s.icon]})。费用：${amountWords(s.cost)||"免费"}。${s.icon in view.catalog.factions?`${names[s.icon]}影响力 +1。`:""}${s.effects.map(e=>effectText(e,true)).join("；")}${s.combat?"。"+explanations.deploy:""}${s.maker?"。"+explanations.maker:""}${s.requirement?"。需要弗雷曼影响力至少 2。":""}${id==="sell_melange"?"一次支付 2／3／4／5 香料（🟠），获得 6／8／10／12 索拉里（💰）。":""}${id==="hall_of_oratory"?"揭示时若仍有特工在这里，得一说服力（🗣️）。":""}`;
  }
  function hideTip() { clearTimeout(tipTimer);tip.hidden=true; }
  function showTip(target) {
    hideTip();if(!target?.dataset.diTip||target.closest("button,select,input,summary,a")||dialog.open)return;
    tip.textContent=target.dataset.diTip;tip.hidden=false;
    const r=target.getBoundingClientRect(), b=tip.getBoundingClientRect();
    tip.style.left=`${Math.max(12,Math.min(innerWidth-b.width-12,r.left))}px`;
    tip.style.top=`${Math.max(12,Math.min(innerHeight-b.height-12,r.bottom+7))}px`;
    tipTimer=setTimeout(hideTip,3000);
  }
  function openDialog(title,body,html=false) {
    hideTip();focusBack=document.activeElement;
    document.getElementById("duneImperiumDialogTitle").textContent=title;
    const content=document.getElementById("duneImperiumDialogBody");
    if(html)content.innerHTML=body;else content.textContent=body;
    if(!dialog.open)dialog.showModal();
    document.getElementById("duneImperiumClose").focus();
  }
  function setExplain(value) {
    explaining=value;hideTip();root.classList.toggle("di-explaining",value);
    explainButton.setAttribute("aria-pressed",String(value));
  }
  function resetSelection() { selected=null;selectedCard=null;hideTip(); }
  function moveButton(m,label,explanation="effect",extra="") {
    const i=view.moves.indexOf(m);
    return `<button type="button" data-di-action="move" data-index="${i}" ${explainAttr(explanations[explanation]||explanation)} ${pending?"disabled":""} class="${extra}">${esc(label)}</button>`;
  }
  function effectSource(e) {
    if(e.origin){
      const {kind,id}=e.origin;
      if(kind==="space")return view.catalog.spaces[id]?.name||"";
      if(kind==="card")return view.catalog.cards[id]?.name_zh||sourceName(id);
      if(kind==="intrigue")return view.catalog.intrigues[id]?.name||"";
      if(kind==="leader")return view.catalog.leaders[id]?.name_zh||"";
      if(kind==="conflict")return view.catalog.conflicts[id]?.name||"";
    }
    if(e.source)return sourceName(e.source);
    if(["deployment","defense"].includes(e.kind)&&view.turn?.space)return view.catalog.spaces[view.turn.space].name;
    if(view.phase==="rewards")return view.catalog.conflicts[view.conflict]?.name||"";
    return "";
  }
  function choiceTitle() {
    const mode=view.choice.mode;
    return {pay:"支付费用",choice:"选择卡牌效果",trash:"选择移除的卡牌",breeding:"选择移除的卡牌",spy:"帝国间谍",discard:"选择弃掉的手牌",deploy:"部署部队",deployment:"部署部队",retreat:"撤回部队",influence:"选择提升影响力的派系",memory:"先祖记忆",shift:"改换门庭",voice:"选择封锁的行动格",reserve_card:"选择保留的帝国行卡牌",two_factions:"选择两个派系",alliance_choice:"选择联盟持有者",baron_power:"是否发动妙计",bindu:"是否跳过回合",bypass:"选择获得的卡牌",double_cross:"选择失去部队的对手",snooper:"抽取或移除牌顶",recall:"选择召回的特工",defense:"部署防御部队"}[mode]||"Choose an option";
  }
  function choiceLabel(value) {
    const c=view.choice, mode=c.mode, e=c.effect;
    if(value===null)return "Skip";
    if(typeof value==="boolean"){
      if(!value)return "Skip";
      if(mode==="pay")return `支付 ${amountWords(e.cost)} → ${e.effects.map(x=>effectText(x,true)).join("；")}`;
      return {defense:"Deploy 1 🛡️",spy:"移除此牌 → 抽 1 阴谋牌 🕵️",baron_power:"发动妙计",bindu:"跳过本次回合"}[mode]||"Use ability";
    }
    if(mode==="choice")return effectText(e.options[value],true);
    if(["deploy","deployment"].includes(mode))return `Deploy ${value} 🛡️`;
    if(mode==="retreat")return `Retreat ${value} 🛡️`;
    if(mode==="influence")return `${icons[value]} ${names[value]}影响力 +${e.amount}`;
    if(mode==="voice")return `${icons[view.catalog.spaces[value].icon]} ${view.catalog.spaces[value].name}`;
    if(mode==="alliance_choice"||mode==="double_cross")return pname(value);
    if(mode==="shift"||mode==="two_factions")return value.map((f,i)=>`${icons[f]} ${names[f]} ${mode==="shift"?(i?"+2":"−1"):"+1"}`).join(" · ");
    if(mode==="bypass")return `${sourceName(value.card)}${value.spice?` · 🟠 ${value.spice}`:" · Free"}${value.top?" · Top of deck":""}`;
    if(mode==="recall")return `${view.catalog.spaces[value.space].name} · ${value.agent==="mentat"?"Mentat":"Agent"}`;
    if(value==="lose_troop")return "Lose 1 🛡️";
    if(value==="draw")return "Draw 🃏";
    if(value==="trash")return "Trash ✖";
    return view.cards[value]?sourceName(value):String(value);
  }
  function actionLabel(m) {
    if(m.type==="agent")return `${sourceName(m.card)} → ${view.catalog.spaces[m.space].name}`;
    if(m.type==="buy")return `Buy ${sourceName(m.card)}${m.top?" · Top of deck":""}`;
    if(m.type==="leader")return view.catalog.leaders[m.leader].name_zh;
    if(m.type==="baron")return m.factions.map(f=>`${icons[f]} ${names[f]}`).join(" + ");
    if(m.type==="resolve"){
      const e=view.effects[m.index], source=effectSource(e);
      if("choice" in m)return `${source?source+"：":""}${effectText(e.options[m.choice],true)}`;
      return `先结算 · ${source?source+"：":""}${effectText(e,true)}`;
    }
    if(m.type==="choose")return choiceLabel(m.choice);
    if(m.type==="intrigue")return view.catalog.intrigues[own().intrigues.find(i=>i.id===m.card).kind].name;
    return {reveal:"Reveal",end_turn:"End Turn",pass:"Pass",next_round:view.final_round?"Continue to Endgame":"Next Round",endgame_done:"Finish Endgame"}[m.type]||m.type;
  }
  function handUnavailableReason(uid) {
    if(view.choice)return view.choice.owner===view.you?`先完成“${choiceTitle()}”，再继续行动。`:`等待 ${pname(view.choice.owner)} 完成选择。`;
    if(view.current_turn!==view.you)return `现在轮到 ${pname(view.current_turn)}，轮到你时可以继续打手牌。`;
    if(view.phase!=="agent")return "当前不是派遣特工阶段。";
    if(view.turn?.mode==="reveal")return "本轮已经揭示，接下来使用说服力购牌；下一轮重新派遣特工。";
    if(moves("resolve").length)return "先选择需要先结算的能力，完成当前行动。";
    if(view.turn?.mode==="agent")return "本次特工已派出，点击 End Turn 结束行动；再次轮到你时可以打下一张手牌。";
    if(!own().agents.length)return "本轮没有可用特工了，点击 Reveal 揭示剩余手牌。";
    if(uid&&!card(uid).icons.length)return "此牌没有访问图标，留在手中于 Reveal 时获得揭示收益。";
    return "此牌目前没有可进入的行动格；请检查访问图标、费用、占用和影响力要求，或选择其他手牌。";
  }
  function renderCard(uid,location="hand") {
    const c=card(uid), actionable=location==="hand"?moves("agent").some(m=>m.card===uid):moves("buy").some(m=>m.card===uid);
    const buying=location==="market"&&selected?.type==="buy"&&selected.card===uid;
    return `<div class="di-card-slot ${location==="market"?"di-purchasable":""}"><button type="button" class="di-card ${selectedCard===uid||selected?.card===uid?"di-selected":""}" style="--di-faction:${colors[c.factions[0]]||"#b59a6c"}" data-di-action="card" data-card="${esc(uid)}" data-location="${location}" ${explainAttr(cardText(uid))} ${pending?"disabled":""}>
      <div class="di-card-icons"><span>${c.icons.map(k=>icons[k]).join(" ")||"—"}</span><span class="di-card-cost">${c.cost?`🗣️ ${c.cost}`:""}</span></div>
      <strong>${esc(c.name_zh)}</strong><small>${esc(c.name)}</small>
      <div class="di-card-effect"><span class="di-card-label">👤</span> ${esc(c.agent.map(e=>effectText(e)).join("；")||"—")}</div>
      <div class="di-card-reveal"><span class="di-card-label">Reveal</span> ${esc(c.reveal.map(e=>effectText(e)).join("；")||"—")}</div>
      ${actionable?`<small>${location==="hand"?"Play → board":"Available to buy"}</small>`:location==="hand"?`<small>${c.icons.length?"View details":"Reveal only"}</small>`:""}</button>${buying?preview():""}</div>`;
  }
  function renderSpace(id) {
    const s=view.catalog.spaces[id], available=selectedCard&&moves("agent").some(m=>m.card===selectedCard&&m.space===id);
    const occupants=view.occupied[id];
    const disabled=pending||(selectedCard&&!available);
    const choosing=selected?.type==="agent"&&selected.space===id;
    return `<div class="di-space-slot ${choosing?"di-space-choosing":""}"><button type="button" class="di-space ${available?"di-available":""} ${occupants.length?"di-unavailable":""} ${selected?.space===id?"di-selected":""}" data-di-action="space" data-space="${id}" ${explainAttr(spaceText(id))} ${disabled?"disabled":""}>
      <strong>${esc(s.name)} ${s.combat?"⚔️":""}</strong>
      <span class="di-space-icons">${amounts(s.cost)||"Free"}${s.requirement?" · 🏜️ ≥2":""}${s.maker?` · 🟠 +${view.spice_bonus[id]}`:""}${view.control[id]?" · 🚩":""}</span>
      <span class="di-space-icons">${esc(s.effects.filter(e=>e.kind==="gain").map(e=>effectText(e)).join(" · "))}</span>
      ${available?`<span class="di-destination">Place agent →</span>`:""}
      <span class="di-occupants">${occupants.map(a=>`<span style="color:${color(a.owner)}">● ${esc(pname(a.owner))}</span>`).join("")}${view.blocked.some(b=>b.space===id)?"🔒":""}</span>
    </button>${choosing?preview():""}</div>`;
  }
  function renderBoard() {
    const destinations=new Set(moves("agent").filter(m=>m.card===selectedCard).map(m=>m.space)).size;
    const placement=selectedCard?`<div class="di-placement-guide" role="status"><div><strong>${esc(sourceName(selectedCard))}</strong><span>${destinations} available spaces · Select a highlighted space</span></div><button type="button" data-di-action="change-card">Change card</button></div>`:"";
    const factionOrder=Object.keys(view.catalog.factions);
    if(selectedCard&&innerWidth<=700){
      const reachable=new Set(moves("agent").filter(m=>m.card===selectedCard).map(m=>view.catalog.spaces[m.space].icon));
      factionOrder.sort((a,b)=>Number(reachable.has(b))-Number(reachable.has(a)));
    }
    const factions=factionOrder.map(f=>`<section class="di-faction" style="--di-faction:${colors[f]}">
      <h3 ${tooltipAttr(`${names[f]}(${icons[f]})；${view.alliances[f]?`联盟：${pname(view.alliances[f])}`:"联盟未领取"}`)}>${icons[f]} ${names[f]} ${view.alliances[f]?"🤝":""}</h3>
      <div class="di-track" ${explainAttr(explanations.influence)}>${Array.from({length:7},(_,n)=>`<div class="di-step" ${tooltipAttr(`影响力 ${n}${n===2?" · ⭐ 1":n===4?" · 联盟门槛与派系奖励":""}`)}>${n}${n===2?"⭐":n===4?"🤝":""}<div class="di-step-markers">${view.players.filter(p=>p.influence[f]===n).map(p=>`<span class="di-dot" style="--di-player:${color(p.player_id)}"></span>`).join("")}</div></div>`).join("")}</div>
      <div class="di-space-list">${Object.keys(view.catalog.spaces).filter(s=>view.catalog.spaces[s].icon===f).map(renderSpace).join("")}</div></section>`).join("");
    const regions=["landsraad","city","spice"].map(icon=>`<section class="di-region ${boardGroup===icon?"di-mobile-active":""}"><h3 ${tooltipAttr(`${names[icon]}(${icons[icon]})`)}>${icons[icon]} ${names[icon]}</h3><div class="di-space-list">${Object.keys(view.catalog.spaces).filter(s=>view.catalog.spaces[s].icon===icon).map(renderSpace).join("")}</div></section>`).join("");
    const navigation=[["factions","Factions"],["landsraad","Landsraad"],["city","Cities"],["spice","Spice"]].map(([id,label])=>{
      const legal=moves("agent").some(m=>m.card===selectedCard&&(id==="factions"?view.catalog.spaces[m.space].icon in view.catalog.factions:view.catalog.spaces[m.space].icon===id));
      return `<button type="button" data-di-action="region" data-region="${id}" aria-pressed="${boardGroup===id}" ${explainAttr(`View ${label}`)}>${label}${legal?" •":""}</button>`;
    }).join("");
    return `<div id="duneImperiumBoard">${placement}<nav class="di-region-tabs" aria-label="Board region">${navigation}</nav><div class="di-factions ${boardGroup==="factions"?"di-mobile-active":""}">${factions}</div><div class="di-regions">${regions}</div></div>`;
  }
  function renderPlayers() {
    return view.players.map(p=>`<section class="di-player ${view.current_turn===p.player_id||view.choice?.owner===p.player_id?"di-current":""}" style="--di-player:${color(p.player_id)}">
      <div class="di-player-name"><button type="button" class="di-player-open" data-di-action="player" data-player="${esc(p.player_id)}" ${explainAttr("查看此玩家的领袖、在场牌、弃牌及保留牌。对手的手牌和阴谋牌保密。")}>${esc(p.name)}${p.player_id===view.you?" · You":""}</button>${token("vp",p.vp)}</div>
      <small ${tooltipAttr(p.leader&&p.leader!=="hagal"?`${view.catalog.leaders[p.leader].passive} 💍 ${view.catalog.leaders[p.leader].ring}`:"双人局自动对手，不计分")}>${esc(view.catalog.leaders[p.leader]?.name_zh||p.leader||"Choosing leader")}${p.player_id===view.order[view.first]?" · First":""}</small>
      <div class="di-tokens">${["spice","water","solari"].map(k=>token(k,p[k])).join("")}${token("garrison",p.garrison)}<span class="di-token" ${tooltipAttr("可用特工 Agent（👤）")}>👤 ${p.agents.length}</span><span class="di-token" ${tooltipAttr("手牌 / 阴谋牌数量")}>🃏 ${p.hand_count} / 🕵️ ${p.intrigue_count}</span>${p.council?`<span ${tooltipAttr("议会席位：每轮揭示 +2 说服力（🗣️）")}>🏛️</span>`:""}</div></section>`).join("");
  }
  function renderConflict() {
    if(!view.conflict)return "";
    const c=view.catalog.conflicts[view.conflict];
    return `<section class="di-box di-conflict" ${explainAttr(explanations.conflict)}><h3>⚔️ ${esc(c.name)} <span>${"I".repeat(c.tier)}</span></h3>
      <div class="di-rewards">${c.rewards.map((r,i)=>`<div class="di-reward"><b>${["🥇","🥈","🥉"][i]}</b> ${i===2&&view.order.length!==4?"—":esc(r.map(e=>effectText(e)).join("；"))}${i===0&&c.control?`<br>🚩 ${view.catalog.spaces[c.control].name}`:""}</div>`).join("")}</div>
      <div class="di-combat">${view.players.map(p=>`<span ${tooltipAttr(`${p.name}：${p.troops} 部队（🛡️） ×2 + ${p.swords} 剑（⚔️）；无部队时战力为零`)}>${esc(p.name)} <b>${p.strength}</b></span>`).join("")}</div></section>`;
  }
  function preview() {
    if(selected&&!["agent","buy"].includes(selected.type))return "";
    if(!selected)return selectedCard?`<p class="di-small">${esc(sourceName(selectedCard))} · Select a highlighted board space.</p>`:"";
    let options="", desc="";
    if(selected.type==="agent"){
      const alternatives=moves("agent").filter(m=>m.card===selected.card&&m.space===selected.space);
      const counts=[...new Set(alternatives.map(m=>m.amount))];
      if(counts.length>1)options+=`<label class="di-field">Spice to sell<select id="duneImperiumAmount">${counts.map(n=>`<option value="${n}" ${selected.amount===n?"selected":""}>🟠 ${n} → 💰 ${{2:6,3:8,4:10,5:12}[n]}</option>`).join("")}</select></label>`;
      const agents=[...new Set(alternatives.map(m=>m.agent))];
      if(agents.length>1)options+=`<label class="di-field">Agent<select id="duneImperiumAgent">${agents.map(a=>`<option value="${a}" ${selected.agent===a?"selected":""}>${{agent1:"Agent 1",agent2:"Agent 2",swordmaster:"Swordmaster",mentat:"Mentat"}[a]}</option>`).join("")}</select></label>`;
      desc=amounts(view.catalog.spaces[selected.space].cost);
    }
    if(selected.type==="buy"&&moves("buy").some(m=>m.card===selected.card&&m.top))options+=`<label class="di-field">Destination<select id="duneImperiumDestination"><option value="discard" ${!selected.top?"selected":""}>Discard</option><option value="top" ${selected.top?"selected":""}>Top of deck</option></select></label>`;
    return `<div class="di-confirm" data-di-scroll="confirm-${esc(selected.card||selected.type)}" aria-label="Selected action"><p>${esc(actionLabel(selected))}${desc?`<br>${esc(desc)}`:""}</p>${options}<div class="di-confirm-buttons"><button type="button" class="di-primary" data-di-action="confirm" ${pending?"disabled":""} ${explainAttr("Confirm：提交当前选定的合法行动。")}>${pending?"Sending…":selected.type==="buy"?"Buy":"Confirm"}</button><button type="button" data-di-action="cancel">Cancel</button></div></div>`;
  }
  function renderActions() {
    let status="", content="";
    if(view.game_over)status="Game Over";
    else if(view.choice)status=view.choice.owner===view.you?"Choose an option":`${pname(view.choice.owner)} · Choosing`;
    else if(view.phase==="round_end")status=view.ready.includes(view.you)?"Waiting for everyone":"Round complete";
    else if(pending)status="Sending…";
    else if(selectedCard)status="Choose a board space";
    else if(view.current_turn===view.you&&view.turn?.mode==="agent"&&!view.effects.length)status="Agent action complete";
    else if(view.current_turn===view.you&&view.turn?.mode==="reveal"&&!view.effects.length)status="Reveal · Buy cards";
    else status=view.current_turn===view.you?"Your turn":`${pname(view.current_turn)} · ${phases[view.phase]}`;
    if(view.choice?.owner===view.you){
      const e=view.choice.effect, source=effectSource(e);
      content=`<div class="di-decision"><h3>${esc(choiceTitle())}</h3>${source?`<p class="di-choice-source">${esc(source)}</p>`:""}<p class="di-small">${esc(effectText(e,true))}${view.choice.peek?` · ${esc(sourceName(view.choice.peek))}`:""}</p><div class="di-actions" data-di-scroll="choices">${moves("choose").map(m=>moveButton(m,choiceLabel(m.choice),"effect")).join("")}</div></div>`;
    }else if(view.phase==="baron"){
      content=`<div class="di-actions" data-di-scroll="baron">${moves("baron").map(m=>moveButton(m,actionLabel(m),"仅自己可见的两个妙计派系，发动后各增加一影响力。")).join("")}</div>`;
    }else{
      const branches=moves("resolve").filter(m=>"choice" in m), ordered=moves("resolve").filter(m=>!("choice" in m));
      content=`${branches.length?`<div class="di-decision"><h3>选择卡牌效果</h3><div class="di-actions" data-di-scroll="branches">${branches.map(m=>moveButton(m,actionLabel(m),effectText(view.effects[m.index].options[m.choice],true))).join("")}</div></div>`:""}${ordered.length?`<div class="di-effect-order"><h3>Choose effect order</h3>${moves("buy").length||moves("intrigue").length?`<p class="di-small">可先${[moves("intrigue").length?"使用阴谋牌":"",moves("buy").length?"在 Market 购牌":""].filter(Boolean).join("或")}，再结算以下能力。</p>`:""}<div class="di-actions" data-di-scroll="effect-order">${ordered.map(m=>moveButton(m,actionLabel(m),effectText(view.effects[m.index],true))).join("")}</div></div>`:""}<div class="di-actions" data-di-scroll="actions">
      ${["reveal","end_turn","pass","endgame_done"].flatMap(type=>moves(type).map(m=>moveButton(m,actionLabel(m),{reveal:"reveal",end_turn:"finish",pass:"pass",endgame_done:"完成终局阴谋牌结算，比较分数及资源。"}[type]))).join("")}</div>`;
      if(!view.moves.length&&!view.game_over)content+=`<p class="di-small">${view.phase==="round_end"?`${view.ready.length} / ${view.order.length} ready`:"Waiting for another player…"}</p>`;
    }
    if(own()&&view.current_turn===view.you&&view.phase==="agent"&&!view.choice){
      let hint="";
      if(!view.turn)hint=moves("agent").length?"Select a hand card, then a board space, or Reveal.":handUnavailableReason();
      else if(view.turn.mode==="reveal")hint=view.effects.length
        ?"普通收益已计入资源栏，请选择下面的卡牌能力；也可先在 Market 购牌。"
        :"揭示收益已计入资源栏。前往 Market 购牌，或 End Turn 结束。";
      else if(!view.effects.length)hint="本次特工行动已完成。End Turn 后轮到下一名玩家。";
      if(hint)content=`<p class="di-small di-turn-hint">${esc(hint)}</p>`+content;
    }
    return `<section class="di-box" id="duneImperiumActions"><div class="di-status" aria-live="polite">${esc(status)}</div>${own()?`<div class="di-tokens"><span class="di-token" ${tooltipAttr("说服力（🗣️）：揭示回合用于购买卡牌")}>说服力 ${icons.persuasion} ${own().persuasion}</span><span class="di-token" ${tooltipAttr("剑（⚔️）：有冲突部队时计入战力")}>剑 ${icons.swords} ${own().swords}</span><span class="di-token" ${tooltipAttr("本轮可用特工 Agent（👤）")}>👤 ${own().agents.length}</span></div>`:""}${!selected?preview():""}${content}</section>`;
  }
  function renderHand() {
    const p=own();if(!p)return `<div class="di-box"><p class="di-small">Spectator view</p></div>`;
    const intrigues=p.intrigues.map(i=>{
      const d=view.catalog.intrigues[i.kind], move=moves("intrigue").find(m=>m.card===i.id);
      const text=`${d.name} · ${d.timing}。${amountWords(d.cost)}${Object.keys(d.cost).length?" → ":""}${d.effects.map(e=>effectText(e,true)).join("；")}${i.kind==="tiebreaker"?"战斗 +2 剑（⚔️），或终局 +10 香料（🟠）。":""}${d.requirement?` 条件：${{alliance:"有任一联盟",council:"有议会席位",mentat:"门塔特仍在原格",enemy_troop:"对手有冲突部队",three_troops:"至少三冲突部队",agent:"至少一特工在棋盘上"}[d.requirement]}`:""}`;
      return move?moveButton(move,`🕵️ ${d.name}`,text):`<button type="button" data-di-action="info" ${explainAttr(text)}>${esc(d.name)} · ${esc(d.timing)}</button>`;
    }).join("");
    return `<section class="di-box"><details class="di-hand-section" data-di-detail="hand" open><summary ${explainAttr(explanations.deck)}>Hand <span class="di-small">🃏 ${p.deck_count} · Discard ${p.discard.length}</span></summary>
      ${p.peek?`<p class="di-small" ${tooltipAttr("保罗的预知：此信息仅你可见")}>👁️ ${esc(sourceName(p.peek))}</p>`:""}
      <div class="di-cards di-hand" data-di-scroll="hand">${p.hand.map(uid=>renderCard(uid)).join("")||`<p class="di-small">${view.phase==="leader"?"Cards arrive after setup.":"No cards in hand."}</p>`}</div>
      </details>
      ${p.intrigues.length?`<details class="di-intrigues" data-di-detail="intrigues" open><summary ${explainAttr(explanations.intrigue)}>Intrigue · 🕵️ ${p.intrigues.length}</summary><div class="di-actions" data-di-scroll="intrigues">${intrigues}</div></details>`:""}
      ${p.baron_factions.length?`<p class="di-small" ${tooltipAttr("秘密妙计目标，仅你可见")}>${p.baron_used?"✓":"🔒"} ${p.baron_factions.map(f=>`${icons[f]} ${names[f]}`).join(" · ")}</p>`:""}
      ${p.played.length+p.revealed.length?`<details data-di-detail="played"><summary>In play · ${p.played.length+p.revealed.length}</summary><div class="di-cards">${p.played.concat(p.revealed).map(uid=>renderCard(uid,"info")).join("")}</div></details>`:""}
      ${p.discard.length?`<details data-di-detail="discard"><summary>Discard · ${p.discard.length}</summary><div class="di-cards di-hand" data-di-scroll="discard">${p.discard.map(uid=>renderCard(uid,"info")).join("")}</div></details>`:""}</section>`;
  }
  function renderMarket() {
    return `<section class="di-box"><h3>Imperium Row</h3><div class="di-cards di-market">${view.market.map(c=>renderCard(c,"market")).join("")}</div></section>
      <section class="di-box"><h3>Reserve</h3><div class="di-cards">${Object.entries(view.reserve).filter(([,s])=>s.card).map(([k,s])=>`<div><p class="di-small">× ${s.count}</p>${renderCard(s.card,k==="foldspace"?"info":"market")}</div>`).join("")}</div></section>
      ${own()?.reserved.length?`<section class="di-box"><h3>Reserved for you</h3><div class="di-cards">${own().reserved.map(c=>renderCard(c,"market")).join("")}</div></section>`:""}`;
  }
  function renderReport() {
    if(!view.round_report||!["round_end","endgame","game_over"].includes(view.phase))return "";
    const r=view.round_report;
    return `<section class="di-result"><h3>${view.game_over?`🏆 ${view.winner.map(pname).map(esc).join(" · ")}`:`Round ${r.round} · ${esc(view.catalog.conflicts[r.conflict].name)}`}</h3>
      <div class="di-result-grid">${view.players.map(p=>`<div class="di-result-row ${p.player_id===view.you?"di-result-you":""}"><b style="color:${color(p.player_id)}">${esc(p.name)}${p.player_id===view.you?" · You":""}</b><br>⚔️ ${r.strength[p.player_id]||0} · ⭐ ${p.vp}<br>${p.player_id==="hagal"?"No rewards":r.awards[p.player_id]!==undefined?esc(view.catalog.conflicts[r.conflict].rewards[r.awards[p.player_id]].map(e=>effectText(e)).join("；")):"—"}</div>`).join("")}</div>
      ${view.phase==="round_end"?`<div class="di-review-next"><span class="di-small">${view.ready.length} / ${view.order.length} ready${view.final_round?" · Final round":""}</span>${moves("next_round").map(m=>moveButton(m,actionLabel(m),"next","di-primary")).join("")}</div>`:""}</section>`;
  }
  function renderLeaders() {
    const status=pending?"Selecting…":view.current_turn===view.you?"Your turn · Click a leader to select":`${pname(view.current_turn)} · Choosing a leader`;
    return `<section class="di-box di-leader-selection" aria-label="Leader selection"><div class="di-status" aria-live="polite">${esc(status)}</div><div class="di-leaders">${Object.entries(view.catalog.leaders).map(([id,l])=>{
      const move=moves("leader").find(m=>m.leader===id);
      const owner=view.players.find(p=>p.leader===id);
      return `<button type="button" class="di-leader ${owner?"di-leader-taken":""}" data-di-action="leader" data-leader="${esc(id)}" ${explainAttr(l.passive+" 💍 "+l.ring)} ${!move||pending?"disabled":""}>
        <strong>${esc(l.name_zh)}</strong><small>${esc(l.name)}</small><span class="di-leader-ability">${esc(l.passive)}</span><span class="di-leader-ability">💍 ${esc(l.ring)}</span>
        <span class="di-leader-status">${owner?`Selected by ${esc(owner.name)}`:pending&&selected?.leader===id?"Selecting…":move?"Select →":"Available"}</span></button>`;
    }).join("")}</div></section>`;
  }
  function render({compactHand=false,reopenHand=false}={}) {
    if(!view)return;
    const scrolls=new Map([...root.querySelectorAll("[data-di-scroll]")].map(el=>[el.dataset.diScroll,el.scrollTop]));
    const details=new Map([...root.querySelectorAll("[data-di-detail]")].map(el=>[el.dataset.diDetail,el.open]));
    const pageY=scrollY;
    const focused=document.activeElement;
    const focusId=root.contains(focused)?focused.id:null;
    const focusIndex=root.contains(focused)?focused.dataset.index:null;
    const main=view.phase==="leader"?renderLeaders():tab==="market"?renderMarket():tab==="history"?`<details class="di-activity" data-di-detail="activity" open><summary>Activity</summary><ol class="di-log" data-di-scroll="log">${view.log.slice().reverse().map(l=>`<li><b>R${l.round}</b> ${esc(l.text)}</li>`).join("")}</ol></details>`:renderBoard();
    const table=view.phase==="leader"?main:`<div class="di-layout"><div class="di-main"><nav class="di-tabs" aria-label="Game view">${[["board","Board"],["market","Market"],["history","Activity"]].map(([id,label])=>`<button type="button" data-di-action="tab" data-tab="${id}" aria-pressed="${tab===id}" ${explainAttr(`View ${label}`)}>${label}</button>`).join("")}</nav>${renderConflict()}${main}</div><aside class="di-side">${renderActions()}${renderHand()}</aside></div>`;
    root.innerHTML=`<div class="di-round"><strong>${view.round?`ROUND ${view.round} / 10`:"SETUP"}</strong><span>${esc(phases[view.phase])}</span></div>
      <div class="di-players">${renderPlayers()}</div>${renderReport()}${table}`;
    for(const el of root.querySelectorAll("[data-di-detail]")){
      if(details.has(el.dataset.diDetail))el.open=details.get(el.dataset.diDetail);
      if(compactHand&&innerWidth<=700&&el.dataset.diDetail==="hand")el.open=!selectedCard;
      if(reopenHand&&el.dataset.diDetail==="hand")el.open=true;
    }
    for(const el of root.querySelectorAll("[data-di-scroll]"))if(scrolls.has(el.dataset.diScroll))el.scrollTop=scrolls.get(el.dataset.diScroll);
    const nextFocus=focusId?document.getElementById(focusId):focusIndex!=null?root.querySelector(`[data-index="${focusIndex}"]`):null;
    if(nextFocus&&!nextFocus.disabled)nextFocus.focus({preventScroll:true});
    if(scrollY!==pageY)window.scrollTo({top:pageY,behavior:"instant"});
    root.classList.toggle("di-explaining",explaining);
    updateActionAttention();
  }

  function updateActionAttention() {
    // Room Control is docked automatically during a game. Keep its collapsed
    // affordance visibly actionable when this player's view has a legal move.
    const needsAction = Boolean(view && !view.game_over && view.moves?.length && !panel.classList.contains("hidden"));
    document.body.classList.toggle("dune-needs-action", needsAction);
    panel.classList.toggle("di-needs-action", needsAction);
  }
  function submit() {
    if(!selected||pending||!view.moves.some(m=>JSON.stringify(m)===JSON.stringify(selected)))return;
    const action=selected;pending=true;hideTip();render();sendAction(action);
    clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{pending=false;if(view)render();},6500);
  }
  root.addEventListener("click",event=>{
    const target=event.target.closest("[data-di-action]");
    if(!target){const t=event.target.closest("[data-di-tip]");if(t)showTip(t);return;}
    if(target.disabled||explaining)return;
    const action=target.dataset.diAction;
    if(action==="confirm"){submit();return;}
    if(action==="leader"){selected=moves("leader").find(m=>m.leader===target.dataset.leader);submit();return;}
    if(action==="cancel"){const reopenHand=!!selectedCard;resetSelection();render({reopenHand});return;}
    if(action==="change-card"){resetSelection();render({reopenHand:true});root.querySelector(".di-hand-section").scrollIntoView({block:"nearest",behavior:"smooth"});return;}
    if(action==="tab"){tab=target.dataset.tab;hideTip();render();return;}
    if(action==="region"){boardGroup=target.dataset.region;hideTip();render();return;}
    if(action==="info"){openDialog("Details",target.dataset.diExplain);return;}
    if(action==="player"){
      const p=player(target.dataset.player), leader=view.catalog.leaders[p.leader];
      const sections=[["In play",p.played.concat(p.revealed)],["Discard",p.discard],["Reserved",p.reserved]];
      const contents=sections.map(([label,cards])=>`<h3>${label} · ${cards.length}</h3>${cards.map(uid=>`<details><summary>${esc(sourceName(uid))}</summary><p>${esc(cardText(uid))}</p></details>`).join("")}`).join("");
      openDialog(p.name,`${leader?`<p>${esc(leader.name_zh)} · ${esc(leader.passive)} 💍 ${esc(leader.ring)}</p>`:""}${contents}`,true);return;
    }
    if(action==="move"){
      selected=view.moves[Number(target.dataset.index)];
      if(selected&&!["agent","buy"].includes(selected.type)){submit();return;}
      if(selected?.type==="agent")selectedCard=selected.card;
      render();return;
    }
    if(action==="card"){
      const uid=target.dataset.card, location=target.dataset.location;
      if(location==="hand"&&moves("agent").some(m=>m.card===uid)){
        selectedCard=selectedCard===uid?null:uid;selected=null;tab="board";
        if(selectedCard){
          const access=moves("agent").filter(m=>m.card===selectedCard).map(m=>view.catalog.spaces[m.space].icon);
          if(!access.some(icon=>boardGroup==="factions"?icon in view.catalog.factions:icon===boardGroup))boardGroup=access[0] in view.catalog.factions?"factions":access[0];
        }
      }else if(location==="market"&&moves("buy").some(m=>m.card===uid)){
        selected=moves("buy").find(m=>m.card===uid);selectedCard=null;
      }else{openDialog(card(uid).name_zh,`${location==="hand"?handUnavailableReason(uid)+"\n\n":""}${cardText(uid)}`);return;}
      render({compactHand:location==="hand"});
      if(location==="hand"&&selectedCard){
        const board=document.getElementById("duneImperiumBoard"), rect=board.getBoundingClientRect();
        if(innerWidth<=700||rect.top<0||rect.top>innerHeight-100)board.scrollIntoView({block:"start",behavior:"smooth"});
      }
      return;
    }
    if(action==="space"){
      const id=target.dataset.space;
      selected=moves("agent").find(m=>m.card===selectedCard&&m.space===id)||null;
      if(!selected){openDialog(view.catalog.spaces[id].name,spaceText(id));return;}
      render();
    }
  });
  root.addEventListener("change",event=>{
    if(selected?.type==="buy"&&event.target.id==="duneImperiumDestination"){
      selected=moves("buy").find(m=>m.card===selected.card&&m.top===(event.target.value==="top"));render();return;
    }
    if(!selected||selected.type!=="agent")return;
    const key=event.target.id==="duneImperiumAmount"?"amount":event.target.id==="duneImperiumAgent"?"agent":null;
    if(key){const value=key==="amount"?Number(event.target.value):event.target.value;selected=moves("agent").find(m=>m.card===selected.card&&m.space===selected.space&&m[key]===value&&(key==="agent"?m.amount===selected.amount:m.agent===selected.agent));render();}
  });
  root.addEventListener("pointerover",event=>{if(event.pointerType!=="touch"&&!explaining)showTip(event.target.closest("[data-di-tip]"));});
  root.addEventListener("pointerout",hideTip);
  root.addEventListener("focusin",event=>{if(!explaining)showTip(event.target.closest("[data-di-tip]"));});
  window.addEventListener("resize",hideTip);document.addEventListener("scroll",hideTip,true);
  function help() {
    setExplain(false);
    const sections=[
      ["目标与开局","2–4 个玩家席位，八位原版领袖，67 张帝国牌、40 张阴谋牌。每人相同 10 张起始牌、两特工（👤）、一水（💧）、三驻军（🛡️），总兵力 12。四人局 1 分开局，双人及三人局 0 分开局。一个人可在房间里 Add Bot。冲突牌顺序是 1 张 I、5 张 II、4 张 III，最多十轮。"],
      ["特工回合",explanations.agent+" 剑师永久增加一名特工，包括本轮；门塔特是临时特工。高议会永久在揭示时加二说服力（🗣️）。"],
      ["揭示与购牌",explanations.reveal+" "+explanations.buy+" 普通卡牌收益自动汇总到说服力、剑和资源。部署数量、支付费用、选择派系或移除卡牌时，点选项一次就生效。只有效果顺序会影响结果时才选择先结算哪项，并显示对应卡牌或行动格。抽牌堆用完才洗弃牌；揭示期间抽到的牌立即揭示并结算。"],
      ["四派系与联盟",explanations.influence+" 皇帝（👑）、宇航公会（🚀）、贝尼·杰瑟里特（🔮）、弗雷曼（🏜️）。塔布穴地需要弗雷曼影响力至少 2。"],
      ["部署与战斗",explanations.deploy+" "+explanations.conflict+" "+explanations.pass+" 独赢者结算后还可使用胜后阴谋牌。"],
      ["香料与控制",explanations.maker+" "+explanations.control],
      ["阴谋牌与卡牌联动",explanations.intrigue+" 弗雷曼羁绊要求另一张弗雷曼牌在场；贝尼·杰瑟里特联动同理。特工牌与揭示牌在揭示结束前均算在场。移除储备牌回到储备，其他牌退出本局。移除暗杀任务得四索拉里（💰）；帝国间谍只有用自己的能力移除才抽阴谋牌。"],
      ["轮末与终局",explanations.next+" 达到 10 分（⭐）或第十轮结束时，在本轮冲突完整结算后触发终局。先打终局阴谋牌，再比胜利点、香料、索拉里、水、驻军，仍相同则最后揭示者胜。"],
      ["双人局 House Hagal","自动加入第三方干扰者，无分数、手牌及资源。每轮先手玩家每次特工回合后，Hagal 根据卡牌派特工，至多三次；卡牌格被占或封锁则重抽。它可占格、招兵、争联盟并参与冲突，但不领取奖励；若赢得城市冲突，移除原控制权。"],
      ["图标与操作",Object.entries(names).map(([k,n])=>`${n}(${icons[k]})`).join("、")+"；特工 Agent（👤）、戒指 Signet（💍）、联盟 Alliance（🤝）、控制 Control（🚩）、移除 Trash（✖）。卡牌右上角为购买价格，中间为特工效果，底部为 Reveal 揭示效果。仅派遣特工与购牌保留原地确认：点击手牌→棋盘→Confirm，Market 点卡牌→Buy / Cancel。Reveal、阴谋牌、部署数量、支付选项、效果顺序、Next Round、Pass、End Turn 均点一次提交。空白轻点或 Esc 取消选择，Esc 关闭对话框；滑动只滚动页面或列表。Explain 点选后自动退出，禁用按钮也可解释；悬停或手机点击非交互图标显示三秒提示。"],
      ["版本","原版基础盒；不含伊克斯、不朽、起义、促销牌或纸面单人挑战。AI 使用公开信息及自己的手牌在本地计算，不需要额外模型。"]
    ];
    openDialog("Help · 沙丘：帝国",sections.map(([title,text])=>`<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join("")+`<p><a href="https://www.direwolfdigital.com/dune-imperium/resources/" target="_blank" rel="noopener noreferrer">Official rules and FAQ</a></p>`,true);
  }
  document.getElementById("duneImperiumHelp").addEventListener("click",help);
  explainButton.addEventListener("click",()=>setExplain(!explaining));
  document.getElementById("duneImperiumClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  dialog.addEventListener("close",()=>{suppressedUntil=0;if(focusBack?.isConnected)focusBack.focus();});
  const active=()=>!!view&&!panel.classList.contains("hidden");
  function explainTarget(target) { if(target?.dataset.diExplain){setExplain(false);openDialog("Explain",target.dataset.diExplain);} }
  const controlTarget=target=>header.contains(target)||explainButton.contains(target)||dialog.contains(target)||target.closest("#roomControlsPanel");
  function explainAtPoint(event) {
    const direct=event.target.closest("[data-di-explain]");
    return (direct&&root.contains(direct)?direct:null)||[...root.querySelectorAll("[data-di-explain]")].reverse().find(el=>{
      const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;
    });
  }
  document.addEventListener("pointerdown",event=>{
    if(!active()||controlTarget(event.target)||!root.contains(event.target))return;
    suppressedUntil=0;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,explaining};
    // Keep native touch scrolling available, including over disabled controls.
    if(explaining)event.stopImmediatePropagation();
  },true);
  document.addEventListener("pointermove",event=>{
    if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.moved=true;
  },true);
  document.addEventListener("pointercancel",event=>{
    if(gesture?.id!==event.pointerId)return;
    gesture=null;suppressedUntil=Date.now()+650;hideTip();
  },true);
  document.addEventListener("pointerup",event=>{
    if(gesture?.id!==event.pointerId)return;
    const tap=gesture;gesture=null;
    if(tap.moved||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>8){suppressedUntil=Date.now()+650;return;}
    if(tap.explaining){
      event.preventDefault();event.stopImmediatePropagation();suppressedUntil=Date.now()+650;explainTarget(explainAtPoint(event));return;
    }
    if(root.contains(event.target)&&!event.target.closest("button,select,input,summary,a,[data-di-tip],.di-confirm")&&(selected||selectedCard)){
      const reopenHand=!!selectedCard;resetSelection();render({reopenHand});
    }
  },true);
  document.addEventListener("click",event=>{
    if(!active()||controlTarget(event.target))return;
    if(Date.now()<suppressedUntil){event.preventDefault();event.stopImmediatePropagation();return;}
    if(explaining){event.preventDefault();event.stopImmediatePropagation();explainTarget(event.target.closest("[data-di-explain]"));}
  },true);
  document.addEventListener("keydown",event=>{
    if(!active())return;
    if(event.key==="Escape"){hideTip();setExplain(false);if(!dialog.open){const reopenHand=!!selectedCard;resetSelection();render({reopenHand});}return;}
    if(explaining&&!controlTarget(event.target)&&[" ","Enter","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();if(event.key==="Enter"||event.key===" ")explainTarget(event.target.closest("[data-di-explain]"));
    }
  },true);
  function clear() { view=null;pending=false;gesture=null;tab="board";boardGroup="factions";clearTimeout(pendingTimer);resetSelection();setExplain(false);document.body.classList.remove("dune-needs-action");panel.classList.remove("di-needs-action");root.replaceChildren();if(dialog.open)dialog.close(); }
  window.renderDuneImperiumGameState=data=>{
    if(!data?.view||data.view.game_id!=="dune_imperium")return;
    if(typeof currentRoomState!=="undefined"&&data.room_id&&currentRoomState?.room_id!==data.room_id)return;
    if(!view||view.revision!==data.view.revision){resetSelection();pending=false;clearTimeout(pendingTimer);}
    const reopenHand=data.view.moves.some(m=>m.type==="agent")&&!view?.moves.some(m=>m.type==="agent");
    view=data.view;render({reopenHand});
  };
  window.showDuneImperiumHeaderActions=visible=>{header.style.display=visible?"flex":"none";if(!visible)clear();};
  window.clearDuneImperiumState=clear;
  function connect() {
    if(typeof socket!=="undefined"){
      socket.on("system:error",()=>{if(pending){pending=false;clearTimeout(pendingTimer);if(view)render();}});
      socket.on("disconnect",()=>{pending=false;resetSelection();if(view)render();});
      socket.on("room:state",state=>{if(state.game_type!=="dune_imperium"||state.status==="lobby")clear();});
    }
    if(typeof currentRoomState!=="undefined"&&currentRoomState?.game_type==="dune_imperium"&&typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="dune_imperium")window.renderDuneImperiumGameState(lastGameStatePayload);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",connect,{once:true});else connect();
})();
