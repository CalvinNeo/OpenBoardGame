(() => {
  "use strict";
  const panel = document.getElementById("duneImperiumPanel");
  const root = document.getElementById("duneImperiumRoot");
  const header = document.getElementById("duneImperiumHeaderActions");
  const dialog = document.getElementById("duneImperiumDialog");
  const tip = document.getElementById("duneImperiumTip");
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
    effect:"Resolve：选择一个尚未结算的效果。可以自行安排效果顺序。可选费用用 Yes／Skip 选择；派系、移除牌、部署等选择由服务器限定合法范围。",
    pass:"Pass：本次不再出战斗阴谋牌。若有人继续出牌，你仍可再次响应；全部参战玩家连续 Pass 才结算冲突。",
    finish:"End Turn：结束当前回合。所有待结算效果必须先完成；揭示回合中未花掉的说服力（🗣️）会失去。",
    maker:"产地 Maker（🟠）：大平原、哈加盆地、帝国盆地在轮末没有特工时累积一香料。下一次访问者获得基础产量和累积值。",
    control:"控制 Control（🚩）：冲突可给予厄拉金、迦太格或帝国盆地控制权。任何玩家访问时，控制者得一索拉里（💰），帝国盆地改为一香料（🟠）。下一次该城市冲突可从供应区投入一防御部队（🛡️）。",
    deck:"牌库 Deck（🃏）：抽牌堆耗尽时才重洗弃牌堆。购买的新牌先进入弃牌堆。移除 Trash（✖）可选手牌、弃牌或在场牌；储备牌被移除会回到储备堆。",
  };
  let view = null, selected = null, selectedCard = null, tab = "board", boardGroup = "factions", pending = false, explaining = false;
  let pendingTimer = null, tipTimer = null, suppressedUntil = 0, focusBack = null;
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
    if(kind==="gain")return values(e.values);
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
    return `${c.name_zh} · ${c.name}。访问：${c.icons.map(k=>`${names[k]}(${icons[k]})`).join("、")||"无"}。特工：${c.agent.map(e=>effectText(e,true)).join("；")||"无额外效果"}。揭示：${c.reveal.map(e=>effectText(e,true)).join("；")||"无"}。${c.acquire.length?`获得时：${c.acquire.map(e=>effectText(e,true)).join("；")}。`:""}${view.cards[uid]==="kwisatz_haderach"?"可派遣任何位置的己方特工，进入已占用格；仍需支付费用并满足条件。":""}${view.cards[uid]==="assassination_mission"?"被其他效果移除时获得四索拉里（💰）。":""}`;
  }
  function spaceText(id) {
    const s=view.catalog.spaces[id];
    return `${s.name}：${names[s.icon]}(${icons[s.icon]})。费用：${amountWords(s.cost)||"免费"}。${s.icon in view.catalog.factions?`${names[s.icon]}影响力 +1。`:""}${s.effects.map(e=>effectText(e,true)).join("；")}${s.combat?"。"+explanations.deploy:""}${s.maker?"。"+explanations.maker:""}${s.requirement?"。需要弗雷曼影响力至少 2。":""}${id==="sell_melange"?"一次支付 2／3／4／5 香料（🟠），获得 6／8／10／12 索拉里（💰）。":""}${id==="hall_of_oratory"?"揭示时若仍有特工在这里，得一说服力（🗣️）。":""}`;
  }
  function hideTip() { clearTimeout(tipTimer);tip.hidden=true; }
  function showTip(target) {
    hideTip();if(!target?.dataset.diTip||dialog.open)return;
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
    document.getElementById("duneImperiumExplain").setAttribute("aria-pressed",String(value));
  }
  function resetSelection() { selected=null;selectedCard=null;hideTip(); }
  function moveButton(m,label,explanation="effect",extra="") {
    const i=view.moves.indexOf(m);
    return `<button type="button" data-di-action="move" data-index="${i}" ${explainAttr(explanations[explanation]||explanation)} ${pending?"disabled":""} class="${extra}">${esc(label)}</button>`;
  }
  function choiceLabel(value) {
    const c=view.choice, mode=c.mode, e=c.effect;
    if(value===null)return "Skip";
    if(typeof value==="boolean")return value?(mode==="defense"?"Deploy 1 🛡️":"Yes"):"Skip";
    if(mode==="choice")return effectText(e.options[value]);
    if(["deploy","deployment"].includes(mode))return `Deploy ${value} 🛡️`;
    if(mode==="retreat")return `Retreat ${value} 🛡️`;
    if(mode==="influence")return `${icons[value]} ${names[value]} +${e.amount}`;
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
    if(m.type==="resolve")return effectText(view.effects[m.index]);
    if(m.type==="choose")return choiceLabel(m.choice);
    if(m.type==="intrigue")return view.catalog.intrigues[own().intrigues.find(i=>i.id===m.card).kind].name;
    return {reveal:"Reveal",end_turn:"End Turn",pass:"Pass",next_round:view.final_round?"Continue to Endgame":"Next Round",endgame_done:"Finish Endgame"}[m.type]||m.type;
  }
  function renderCard(uid,location="hand") {
    const c=card(uid), actionable=location==="hand"?moves("agent").some(m=>m.card===uid):moves("buy").some(m=>m.card===uid);
    return `<button type="button" class="di-card ${selectedCard===uid||selected?.card===uid?"di-selected":""}" style="--di-faction:${colors[c.factions[0]]||"#b59a6c"}" data-di-action="card" data-card="${esc(uid)}" data-location="${location}" ${explainAttr(cardText(uid))} ${pending?"disabled":""}>
      <div class="di-card-icons"><span>${c.icons.map(k=>icons[k]).join(" ")||"—"}</span><span>${c.cost?`🗣️ ${c.cost}`:""}</span></div>
      <strong>${esc(c.name_zh)}</strong><small>${esc(c.name)}</small>
      <div class="di-card-effect">${esc(c.agent.map(e=>effectText(e)).join("；")||"—")}</div>
      <div class="di-card-reveal">${esc(c.reveal.map(e=>effectText(e)).join("；")||"—")}</div>
      ${actionable?`<small>${location==="hand"?"Select → board":"Available to buy"}</small>`:""}</button>`;
  }
  function renderSpace(id) {
    const s=view.catalog.spaces[id], available=selectedCard&&moves("agent").some(m=>m.card===selectedCard&&m.space===id);
    const occupants=view.occupied[id];
    const disabled=pending||(selectedCard&&!available);
    return `<button type="button" class="di-space ${available?"di-available":""} ${occupants.length?"di-unavailable":""} ${selected?.space===id?"di-selected":""}" data-di-action="space" data-space="${id}" ${explainAttr(spaceText(id))} ${disabled?"disabled":""}>
      <strong>${esc(s.name)} ${s.combat?"⚔️":""}</strong>
      <span class="di-space-icons">${amounts(s.cost)||"Free"}${s.requirement?" · 🏜️ ≥2":""}${s.maker?` · 🟠 +${view.spice_bonus[id]}`:""}${view.control[id]?" · 🚩":""}</span>
      <span class="di-space-icons">${esc(s.effects.filter(e=>e.kind==="gain").map(e=>effectText(e)).join(" · "))}</span>
      <span class="di-occupants">${occupants.map(a=>`<span style="color:${color(a.owner)}">● ${esc(pname(a.owner))}</span>`).join("")}${view.blocked.some(b=>b.space===id)?"🔒":""}</span>
    </button>`;
  }
  function renderBoard() {
    const factions=Object.keys(view.catalog.factions).map(f=>`<section class="di-faction" style="--di-faction:${colors[f]}">
      <h3 ${tooltipAttr(`${names[f]}(${icons[f]})；${view.alliances[f]?`联盟：${pname(view.alliances[f])}`:"联盟未领取"}`)}>${icons[f]} ${names[f]} ${view.alliances[f]?"🤝":""}</h3>
      <div class="di-track" ${explainAttr(explanations.influence)}>${Array.from({length:7},(_,n)=>`<div class="di-step" ${tooltipAttr(`影响力 ${n}${n===2?" · ⭐ 1":n===4?" · 联盟门槛与派系奖励":""}`)}>${n}${n===2?"⭐":n===4?"🤝":""}<div class="di-step-markers">${view.players.filter(p=>p.influence[f]===n).map(p=>`<span class="di-dot" style="--di-player:${color(p.player_id)}"></span>`).join("")}</div></div>`).join("")}</div>
      <div class="di-space-list">${Object.keys(view.catalog.spaces).filter(s=>view.catalog.spaces[s].icon===f).map(renderSpace).join("")}</div></section>`).join("");
    const regions=["landsraad","city","spice"].map(icon=>`<section class="di-region ${boardGroup===icon?"di-mobile-active":""}"><h3 ${tooltipAttr(`${names[icon]}(${icons[icon]})`)}>${icons[icon]} ${names[icon]}</h3><div class="di-space-list">${Object.keys(view.catalog.spaces).filter(s=>view.catalog.spaces[s].icon===icon).map(renderSpace).join("")}</div></section>`).join("");
    const navigation=[["factions","Factions"],["landsraad","Landsraad"],["city","Cities"],["spice","Spice"]].map(([id,label])=>{
      const legal=moves("agent").some(m=>m.card===selectedCard&&(id==="factions"?view.catalog.spaces[m.space].icon in view.catalog.factions:view.catalog.spaces[m.space].icon===id));
      return `<button type="button" data-di-action="region" data-region="${id}" aria-pressed="${boardGroup===id}" ${explainAttr(`View ${label}`)}>${label}${legal?" •":""}</button>`;
    }).join("");
    return `<nav class="di-region-tabs" aria-label="Board region">${navigation}</nav><div class="di-factions ${boardGroup==="factions"?"di-mobile-active":""}">${factions}</div><div class="di-regions">${regions}</div>`;
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
    return `<div class="di-confirm"><p>${esc(actionLabel(selected))}${desc?`<br>${esc(desc)}`:""}</p>${options}<div class="di-confirm-buttons"><button type="button" class="di-primary" data-di-action="confirm" ${pending?"disabled":""} ${explainAttr("Confirm：提交当前选定的合法行动。")}>${pending?"Sending…":"Confirm"}</button><button type="button" data-di-action="cancel">Cancel</button></div></div>`;
  }
  function renderActions() {
    let status="", content="";
    if(view.game_over)status="Game Over";
    else if(view.choice)status=view.choice.owner===view.you?"Choose an option":`${pname(view.choice.owner)} · Choosing`;
    else if(view.phase==="round_end")status=view.ready.includes(view.you)?"Waiting for everyone":"Round complete";
    else status=view.current_turn===view.you?"Your turn":`${pname(view.current_turn)} · ${phases[view.phase]}`;
    if(view.choice?.owner===view.you){
      content=`<p class="di-small">${esc(effectText(view.choice.effect))}${view.choice.peek?` · ${esc(sourceName(view.choice.peek))}`:""}</p><div class="di-actions">${moves("choose").map(m=>moveButton(m,choiceLabel(m.choice),"effect")).join("")}</div>`;
    }else if(view.phase==="baron"){
      content=`<div class="di-actions">${moves("baron").map(m=>moveButton(m,actionLabel(m),"仅自己可见的两个妙计派系，发动后各增加一影响力。")).join("")}</div>`;
    }else{
      content=`<div class="di-actions">${moves("resolve").map(m=>moveButton(m,actionLabel(m),effectText(view.effects[m.index],true))).join("")}
      ${["reveal","end_turn","pass","next_round","endgame_done"].flatMap(type=>moves(type).map(m=>moveButton(m,actionLabel(m),{reveal:"reveal",end_turn:"finish",pass:"pass",next_round:"next",endgame_done:"完成终局阴谋牌结算，比较分数及资源。"}[type],type==="next_round"?"di-wide":""))).join("")}</div>`;
      if(!view.moves.length&&!view.game_over)content+=`<p class="di-small">${view.phase==="round_end"?`${view.ready.length} / ${view.order.length} ready`:"Waiting for another player…"}</p>`;
    }
    if(own()&&view.current_turn===view.you&&view.phase==="agent"&&!view.turn&&!view.choice)content=`<p class="di-small">Select a hand card, then a board space, or Reveal.</p>`+content;
    return `<section class="di-box" id="duneImperiumActions"><div class="di-status" aria-live="polite">${esc(status)}</div>${own()?`<div class="di-tokens">${token("persuasion",own().persuasion)}${token("swords",own().swords)}<span class="di-token" ${tooltipAttr("本轮可用特工 Agent（👤）")}>👤 ${own().agents.length}</span></div>`:""}${preview()}${content}</section>`;
  }
  function renderHand() {
    const p=own();if(!p)return `<div class="di-box"><p class="di-small">Spectator view</p></div>`;
    const intrigues=p.intrigues.map(i=>{
      const d=view.catalog.intrigues[i.kind], move=moves("intrigue").find(m=>m.card===i.id);
      const text=`${d.name} · ${d.timing}。${amountWords(d.cost)}${Object.keys(d.cost).length?" → ":""}${d.effects.map(e=>effectText(e,true)).join("；")}${i.kind==="tiebreaker"?"战斗 +2 剑（⚔️），或终局 +10 香料（🟠）。":""}${d.requirement?` 条件：${{alliance:"有任一联盟",council:"有议会席位",mentat:"门塔特仍在原格",enemy_troop:"对手有冲突部队",three_troops:"至少三冲突部队",agent:"至少一特工在棋盘上"}[d.requirement]}`:""}`;
      return move?moveButton(move,`🕵️ ${d.name}`,text):`<button type="button" data-di-action="info" ${explainAttr(text)}>${esc(d.name)} · ${esc(d.timing)}</button>`;
    }).join("");
    return `<section class="di-box"><details class="di-hand-section" ${!selectedCard||innerWidth>700?"open":""}><summary>Hand <span class="di-small" ${tooltipAttr(explanations.deck)}>🃏 ${p.deck_count} · Discard ${p.discard.length}</span></summary>
      ${p.peek?`<p class="di-small" ${tooltipAttr("保罗的预知：此信息仅你可见")}>👁️ ${esc(sourceName(p.peek))}</p>`:""}
      <div class="di-cards di-hand">${p.hand.map(uid=>renderCard(uid)).join("")||`<p class="di-small">${view.phase==="leader"?"Cards arrive after setup.":"No cards in hand."}</p>`}</div>
      ${p.intrigues.length?`<details class="di-intrigues" open><summary ${explainAttr(explanations.intrigue)}>Intrigue · 🕵️ ${p.intrigues.length}</summary><div class="di-actions">${intrigues}</div></details>`:""}
      ${p.baron_factions.length?`<p class="di-small" ${tooltipAttr("秘密妙计目标，仅你可见")}>${p.baron_used?"✓":"🔒"} ${p.baron_factions.map(f=>`${icons[f]} ${names[f]}`).join(" · ")}</p>`:""}
      ${p.played.length+p.revealed.length?`<details><summary>In play · ${p.played.length+p.revealed.length}</summary><div class="di-cards">${p.played.concat(p.revealed).map(uid=>renderCard(uid,"info")).join("")}</div></details>`:""}
      ${p.discard.length?`<details><summary>Discard · ${p.discard.length}</summary><div class="di-cards di-hand">${p.discard.map(uid=>renderCard(uid,"info")).join("")}</div></details>`:""}</details></section>`;
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
      <div class="di-result-grid">${view.players.map(p=>`<div class="di-result-row"><b style="color:${color(p.player_id)}">${esc(p.name)}</b><br>⚔️ ${r.strength[p.player_id]||0} · ⭐ ${p.vp}<br>${p.player_id==="hagal"?"No rewards":r.awards[p.player_id]!==undefined?esc(view.catalog.conflicts[r.conflict].rewards[r.awards[p.player_id]].map(e=>effectText(e)).join("；")):"—"}</div>`).join("")}</div>
      ${view.phase==="round_end"?`<p class="di-small">${view.ready.length} / ${view.order.length} ready${view.final_round?" · Final round":""}</p>`:""}</section>`;
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
  function render() {
    if(!view)return;
    const main=view.phase==="leader"?renderLeaders():tab==="market"?renderMarket():tab==="history"?`<section class="di-box"><h3>Activity</h3><ol class="di-log">${view.log.slice().reverse().map(l=>`<li><b>R${l.round}</b> ${esc(l.text)}</li>`).join("")}</ol></section>`:renderBoard();
    const table=view.phase==="leader"?main:`<div class="di-layout"><div class="di-main"><nav class="di-tabs" aria-label="Game view">${[["board","Board"],["market","Market"],["history","Activity"]].map(([id,label])=>`<button type="button" data-di-action="tab" data-tab="${id}" aria-pressed="${tab===id}" ${explainAttr(`View ${label}`)}>${label}</button>`).join("")}</nav>${renderConflict()}${main}</div><aside class="di-side">${renderActions()}${renderHand()}</aside></div>`;
    root.innerHTML=`<div class="di-hero"><div><h2 class="di-title">DUNE: IMPERIUM</h2><div class="di-subtitle">沙丘：帝国 · BASE GAME</div></div><div class="di-round"><strong>${view.round?`ROUND ${view.round} / 10`:"SETUP"}</strong>${esc(phases[view.phase])}</div></div>
      <div class="di-players">${renderPlayers()}</div>${renderReport()}${table}`;
    root.classList.toggle("di-explaining",explaining);
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
    if(action==="cancel"){resetSelection();render();return;}
    if(action==="tab"){tab=target.dataset.tab;hideTip();render();return;}
    if(action==="region"){boardGroup=target.dataset.region;hideTip();render();return;}
    if(action==="info"){openDialog("Details",target.dataset.diExplain);return;}
    if(action==="player"){
      const p=player(target.dataset.player), leader=view.catalog.leaders[p.leader];
      const sections=[["In play",p.played.concat(p.revealed)],["Discard",p.discard],["Reserved",p.reserved]];
      const contents=sections.map(([label,cards])=>`<h3>${label} · ${cards.length}</h3>${cards.map(uid=>`<details><summary>${esc(sourceName(uid))}</summary><p>${esc(cardText(uid))}</p></details>`).join("")}`).join("");
      openDialog(p.name,`${leader?`<p>${esc(leader.name_zh)} · ${esc(leader.passive)} 💍 ${esc(leader.ring)}</p>`:""}${contents}`,true);return;
    }
    if(action==="move"){selected=view.moves[Number(target.dataset.index)];if(selected?.type==="agent")selectedCard=selected.card;render();return;}
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
      }else{openDialog(card(uid).name_zh,cardText(uid));return;}
      render();
      if(selected?.type==="buy"&&innerWidth<=700)document.getElementById("duneImperiumActions").scrollIntoView({block:"nearest",behavior:"smooth"});
      return;
    }
    if(action==="space"){
      const id=target.dataset.space;
      selected=moves("agent").find(m=>m.card===selectedCard&&m.space===id)||null;
      if(!selected){openDialog(view.catalog.spaces[id].name,spaceText(id));return;}
      render();
      if(innerWidth<=700)document.getElementById("duneImperiumActions").scrollIntoView({block:"nearest",behavior:"smooth"});
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
  root.addEventListener("pointerdown",event=>{
    if(explaining||event.target.closest("button,select,input,summary,a,[data-di-tip]"))return;
    resetSelection();render();
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
      ["揭示与购牌",explanations.reveal+" "+explanations.buy+" 抽牌堆用完才洗弃牌；揭示期间抽到的牌立即揭示并结算。"],
      ["四派系与联盟",explanations.influence+" 皇帝（👑）、宇航公会（🚀）、贝尼·杰瑟里特（🔮）、弗雷曼（🏜️）。塔布穴地需要弗雷曼影响力至少 2。"],
      ["部署与战斗",explanations.deploy+" "+explanations.conflict+" "+explanations.pass+" 独赢者结算后还可使用胜后阴谋牌。"],
      ["香料与控制",explanations.maker+" "+explanations.control],
      ["阴谋牌与卡牌联动",explanations.intrigue+" 弗雷曼羁绊要求另一张弗雷曼牌在场；贝尼·杰瑟里特联动同理。特工牌与揭示牌在揭示结束前均算在场。移除储备牌回到储备，其他牌退出本局。移除暗杀任务得四索拉里（💰）；帝国间谍只有用自己的能力移除才抽阴谋牌。"],
      ["轮末与终局",explanations.next+" 达到 10 分（⭐）或第十轮结束时，在本轮冲突完整结算后触发终局。先打终局阴谋牌，再比胜利点、香料、索拉里、水、驻军，仍相同则最后揭示者胜。"],
      ["双人局 House Hagal","自动加入第三方干扰者，无分数、手牌及资源。每轮先手玩家每次特工回合后，Hagal 根据卡牌派特工，至多三次；卡牌格被占或封锁则重抽。它可占格、招兵、争联盟并参与冲突，但不领取奖励；若赢得城市冲突，移除原控制权。"],
      ["图标与操作",Object.entries(names).map(([k,n])=>`${n}(${icons[k]})`).join("、")+"；特工 Agent（👤）、戒指 Signet（💍）、联盟 Alliance（🤝）、控制 Control（🚩）、移除 Trash（✖）。点击手牌→棋盘→Confirm。可在选项框挑特工或出售数量；购牌在 Market。空白或 Esc 取消选择，Esc 关闭对话框。Explain 点选后自动退出，禁用按钮也可解释；悬停或手机点击图标显示三秒提示。"],
      ["版本","原版基础盒；不含伊克斯、不朽、起义、促销牌或纸面单人挑战。AI 使用公开信息及自己的手牌在本地计算，不需要额外模型。"]
    ];
    openDialog("Help · 沙丘：帝国",sections.map(([title,text])=>`<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join("")+`<p><a href="https://www.direwolfdigital.com/dune-imperium/resources/" target="_blank" rel="noopener noreferrer">Official rules and FAQ</a></p>`,true);
  }
  document.getElementById("duneImperiumHelp").addEventListener("click",help);
  document.getElementById("duneImperiumExplain").addEventListener("click",()=>setExplain(!explaining));
  document.getElementById("duneImperiumClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  dialog.addEventListener("close",()=>{suppressedUntil=0;if(focusBack?.isConnected)focusBack.focus();});
  const active=()=>!!view&&!panel.classList.contains("hidden");
  function explainTarget(target) { if(target?.dataset.diExplain){setExplain(false);openDialog("Explain",target.dataset.diExplain);} }
  document.addEventListener("pointerdown",event=>{
    if(!explaining||!active()||header.contains(event.target)||dialog.contains(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();
    const direct=event.target.closest("[data-di-explain]");
    const target=(direct&&root.contains(direct)?direct:null)||[...root.querySelectorAll("[data-di-explain]")].reverse().find(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});
    suppressedUntil=Date.now()+650;explainTarget(target);
  },true);
  document.addEventListener("click",event=>{
    if(!active()||header.contains(event.target)||dialog.contains(event.target))return;
    if(Date.now()<suppressedUntil){event.preventDefault();event.stopImmediatePropagation();return;}
    if(explaining){event.preventDefault();event.stopImmediatePropagation();explainTarget(event.target.closest("[data-di-explain]"));}
  },true);
  document.addEventListener("keydown",event=>{
    if(!active())return;
    if(event.key==="Escape"){hideTip();setExplain(false);if(!dialog.open){resetSelection();render();}return;}
    if(explaining&&!header.contains(event.target)&&!dialog.contains(event.target)&&[" ","Enter","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();if(event.key==="Enter"||event.key===" ")explainTarget(event.target.closest("[data-di-explain]"));
    }
  },true);
  function clear() { view=null;pending=false;clearTimeout(pendingTimer);resetSelection();setExplain(false);root.replaceChildren();if(dialog.open)dialog.close(); }
  window.renderDuneImperiumGameState=data=>{
    if(!data?.view||data.view.game_id!=="dune_imperium")return;
    if(typeof currentRoomState!=="undefined"&&data.room_id&&currentRoomState?.room_id!==data.room_id)return;
    if(!view||view.revision!==data.view.revision){resetSelection();pending=false;clearTimeout(pendingTimer);}
    view=data.view;render();
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
