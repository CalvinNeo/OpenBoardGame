(() => {
  "use strict";
  const panel = document.getElementById("orlojPanel"), root = document.getElementById("orlojRoot");
  const header = document.getElementById("orlojHeaderActions"), help = document.getElementById("orlojHelpBtn");
  const explain = document.getElementById("orlojExplainBtn"), dialog = document.getElementById("orlojDialog");
  const tip = document.getElementById("orlojTip");
  const icons = {paint:"🎨", wood:"🌲", iron:"🔩", gold:"🟨", coin:"💰", blue:"🔵", pink:"🟣", yellow:"🟡"};
  const resourceNames = {paint:"颜料", wood:"木材", iron:"铁", gold:"黄金", coin:"金币"};
  const trackNames = {blue:"创新", pink:"精准", yellow:"观察"};
  const playerColors = ["#64cabc", "#de94e7", "#efa768", "#91bafb"];
  const apostleColors = {purple:"#c68ee1", orange:"#eda078", green:"#88ca9c"};
  const apostleIcons = {purple:"🟣", orange:"🟠", green:"🟢"};
  const outerIcons = ["🗿", "💰👤", "🌙🎨", "🔨", "🏛️", "💰⬆️", "🗿", "💰👤", "🌙🎨", "🔨", "🏛️", "💰⬆️"];
  const hammerRewards = {
    painter:["无额外奖励", "先增加 1 偏差(⚙️)，再移动画家(🎨)", "移动画家(🎨)"],
    coin:["无额外奖励", "获得 1 金币(💰)", "获得 1 金币(💰)与 2 分(⭐)"],
    rooster:["无额外奖励", "个人雄鸡(🐓) +1", "个人雄鸡(🐓) +1 与 2 分(⭐)"],
    moon:["无额外奖励", "修复 1 偏差(⚙️)", "激活月亮(🌙)，比通常少走 1 格"],
    mastery:["无额外奖励", "任意学识(📚) +1", "任意学识(📚) +1 与 1 金币(💰)"],
    apostle:["无额外奖励", "取使徒(👤)", "取使徒(👤)并修复 1 偏差(⚙️)"],
  };
  const descriptions = {
    clock:"钟盘(🕰️)：指针顺时针至少 1 格，创新(🔵)的 I–IV 级分别允许 1–4 格，超出每格加 1 偏差(⚙️)。内层钟面逆时针每格加 1 偏差。先放一个工人(👷)，弹回该格原工人；再按所选顺序执行两组行动。",
    moon:"月亮(🌙)：顺时针移动观察(🟡)等级 +2 格，领取途经的木材(🌲)、颜料(🎨)、铁(🔩)，每过修复格去掉一个偏差(⚙️)。月亮位置随全体玩家共享。普通月亮多余修复不会得分。",
    mastery:"学识(📚)：创新(🔵)控制钟盘移动；精准(🟣)控制 Pass 回收量和雕刻师(🗿)等级；观察(🟡)控制月亮(🌙)与画家(🎨)移动。4/9 格拿卷轴(📜)，6 格选助手(👥)或月亮，12 格竞争皇家卷轴。7 格起参与终局彩窗。",
    pass:"Pass：可以主动选择。依精准(🟣)等级回收 2/3/4/4 名工人(👷)，然后激活月亮(🌙)，再推进报晓(🐓)一格。可从钟盘或日历回收；取回日历工人会影响连片和终局分。目标工人不能回收。",
    build:"建造(🔨)：锤子按六个交点顺时针移动，可不移动；超过锤子能力每步加 1 偏差(⚙️)。选择该交点相邻的一格，支付显示费用，每份资源得 2 分(⭐)，再放一个工人(👷)。自己工人的整个相连群每格得 2 分，月份与对应星座也相邻。随后获得日历与锤子奖励。",
    workshop:"工坊(🏛️)：市场左至右需 3/2/1 份牌示资源，另加 1 颜料(🎨)。每个市场位置第一次购买解锁一个工人(👷)。拿顶部奖励，将新牌接在自己工坊左/右端；相同半边图标接合时获得使徒(👤)或建造(🔨)。中间奖励放助手时触发。",
    apostle:"使徒(👤)：支付该行的颜料(🎨)/木材(🌲)/铁(🔩)，把仓库使徒放入同色空格。立刻拿格子奖励：金币(💰)、升级(⬆️)、回收两工人(↩️👷)、解锁工人(🔓👷)。满行得 7 分(⭐)并生产，满列选助手(👥)或月亮(🌙)。",
    gears:"使徒齿轮(⚙️)：当前两个号码可领取。每付一个偏差可先转一格，领取后再自动转一格。每经过红齿推进报晓(🐓)。自己的每个使徒只能领取一次。仓库最多两件，其中最多一名助手(👥)。",
    painter:"画家(🎨)：沿日历顺时针移动至少 1 格、最多观察(🟡)等级 +2 格，选择落点左或右的奖励。画家位置由所有玩家共享。",
    sculptor:"雕刻师(🗿)：从四个位置选一个，不能重复自己当前的位置，弹回其他雕刻师。精准(🟣)到 5/10 格升 II/III 级。工坊、建造、黄金+金币、月亮/画家四类行动随等级增强，需先承担显示的偏差(⚙️)。",
    objective:"公共目标(🎯)：达到条件后放一名可用工人(👷)，不可取回。前三位终局得 8/6/4 分(⭐)，两人局第二位直接占 4 分位。只有第一位立即拿奖励，每人每目标只能一次。",
    rooster:"报晓(🐓)：Pass 和使徒齿轮红齿推进公共雄鸡。走到终点后，当前玩家先完成回合。全员按个人雄鸡值修复偏差(⚙️)，每个多余修复 +1 分(⭐)，每个残留偏差 −1 分。第四次报晓或日历造完后补齐末位回合，保证所有人回合数相同。",
    next:"Next Round：确认已看完本次报晓。所有玩家确认后继续，AI 自动确认，掉线玩家须重连确认。最后一次报晓后仍可能需补齐本轮剩余玩家的回合。",
    payment:"费用：金币(💰)和黄金(🟨)均能代替颜料(🎨)、木材(🌲)、铁(🔩)，但金币与黄金不能互相代替。可在 Payment 中选择保留哪种资源。三份相同基础资源可换一黄金，金币可作为百搭补足。",
    end:"End Turn：主行动完成且没有待处理奖励后结束自己的回合。结束前可以放使徒、用卷轴、放助手、认领目标和兑换资源。",
    skip:"Skip：放弃当前可选效果；放弃回收会一起放弃本次尚余的回收次数。后面的奖励继续执行。",
    confirm:"Confirm：提交当前预览中的行动与支付方案。选择不会提前扣除资源；空白、Cancel 或 Esc 可取消。",
    inspect:"Inspect：查看该玩家公开的资源、工坊、使徒和轨道；自己的行动仍以自己的资源和合法选择为准。",
    version:"数字适配：2–4 人多人规则，可添加 AI。使用标准起始套餐。工坊 21 张牌的组合、建造费用表与日历奖励采用公开的数字适配数据；不含 Josef Mánes 专用单人卡组或 promo。",
  };
  let view = null, room = null, tab = "clock", inspected = null, selected = null, family = [];
  let extraMode = null, buildZone = "months", clockSteps = 1, clockRotate = 0, clockFirst = "outer";
  let pendingSend = false, sendTimer, tipTimer, explaining = false, suppressedUntil = 0, restoreFocus;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
  const own = () => view?.players.find(p => p.player_id === view.you);
  const player = pid => view?.players.find(p => p.player_id === pid);
  const name = pid => player(pid)?.name || "Spectator";
  const color = pid => playerColors[Math.max(0, view.order.indexOf(pid)) % 4];
  const acting = () => view?.you === view?.current_turn && !view.game_over;
  const moves = kind => view.moves.filter(m => m.type === kind);
  const pending = () => view.pending[0] || null;
  const level = n => Math.max(1, Math.min(4, Math.ceil(n / 3)));
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const indexOf = m => view.moves.indexOf(m);
  const why = text => descriptions[text] || text;
  const button = (label, action, explanation, disabled=false, attrs="") => `<button type="button" data-or-action="${action}" data-or-explain="${esc(why(explanation))}" ${disabled || pendingSend ? "disabled" : ""} ${attrs}>${label}</button>`;
  const passive = (label, explanation, cls="or-token") => `<span class="${cls}" tabindex="0" title="${esc(why(explanation))}" data-or-tip="${esc(why(explanation))}" data-or-explain="${esc(why(explanation))}">${label}</span>`;
  const costs = obj => Object.entries(obj || {}).filter(([,n]) => n).map(([k,n]) => `${icons[k] || k} ${n}`).join(" · ");
  const resourceDescription = obj => Object.entries(obj || {}).filter(([,n]) => n).map(([k,n]) => `${resourceNames[k] || k}(${icons[k] || ""}) ${n}`).join("，");
  const apostleLabel = n => `${apostleIcons[view.catalog.apostles[n].color]} 使徒 ${n}`;

  function effectText(e) {
    const n=e.count || 1;
    const labels = {gain:costs(e.items), vp:`⭐ +${e.count ?? 1}`, repair:`⚙️ 修复 ${n}`, rooster:"🐓 雄鸡 +1", rooster_step:"🐓 报晓 +1",
      produce:`⚙️ ${e.resource ? icons[e.resource] : "🎨🌲🔩"} 生产`, upgrade:"⬆️ 升级", mastery:`${e.track ? icons[e.track] : "📚"} 学识 +${n}`,
      paid_mastery:"💰 −1 → 📚 +1", any_resource:`🎨🌲🔩 任意 ×${n}`, apostle:"👤 取使徒", moon:`🌙 月亮${e.modifier ? ` ${e.modifier>0?"+":""}${e.modifier}` : ""}`,
      painter:"🎨 移动画家", moon_painter:"🌙 月亮 / 🎨 画家", assistant_moon:"👥 助手 / 🌙 月亮", assistant:"👥 取助手", forced_painter:"⚙️ +1 → 🎨 画家",
      recover:`↩️👷 回收 ×${n}`, scroll:"📜 取卷轴", build:"🔨 建造", workshop:"🏛️ 扩建工坊", sculptor:"🗿 雕刻师", bundle:"选择行动顺序"};
    return labels[e.kind] || e.kind;
  }
  const effectExplanation = e => {
    if(e.kind === "gain")return `获得 ${resourceDescription(e.items)}。`;
    if(e.kind === "vp")return `立即获得 ${e.count ?? 1} 分(⭐)。`;
    if(e.kind === "repair")return `修复最多 ${e.count || 1} 个偏差(⚙️)。`;
    if(e.kind === "upgrade")return "升级(⬆️)：选择颜料(🎨)、木材(🌲)、铁(🔩)生产或锤子(🔨)。三种生产都越过同一高度时解锁工人(👷)。生产满级后升级获得黄金(🟨)与 1 分(⭐)。";
    return descriptions[e.kind] || (e.kind === "paid_mastery" ? descriptions.mastery+" 这一步须支付 1 金币(💰)。" : `${effectText(e)}。在当前行动区选择具体奖励。`);
  };
  const effects = list => `<div class="or-effect">${list.map(e=>passive(esc(effectText(e)),effectExplanation(e))).join("")}</div>`;

  function moveText(m) {
    if(m.type === "clock")return `🕰️ 指针 +${m.steps} · 内盘 ↶${m.rotate} · ${m.first === "outer" ? "外环" : "内环"}先`;
    if(m.type === "build")return m.zone === "final" ? "🔨 中心装饰 · 8⭐" : `🔨 ${m.zone === "months" ? `月份 ${m.slot+1}` : `${view.catalog.zodiac[m.slot]} 星座 ${m.slot+1}`}`;
    if(m.type === "workshop")return `🏛️ ${view.catalog.workshops[view.market[m.index]].name}`;
    if(m.type === "upgrade")return `⬆️ ${m.track === "hammer" ? "🔨 锤子" : `${icons[m.track]} ${resourceNames[m.track]}生产`}`;
    if(m.type === "mastery")return `${icons[m.track]} ${trackNames[m.track]} +1`;
    if(m.type === "any_resource" || m.type === "produce")return `${icons[m.resource]} ${resourceNames[m.resource]}${m.type === "produce" ? "生产" : " +1"}`;
    if(m.type === "take_apostle")return apostleLabel(m.apostle);
    if(m.type === "place_apostle")return `${apostleLabel(m.apostle)} → ${Math.floor(m.slot/4)+1} 行 ${m.slot%4+1} 列`;
    if(m.type === "take_assistant")return `👥 ${view.catalog.assistants[m.assistant].name} · ${view.catalog.assistants[m.assistant].text}`;
    if(m.type === "place_assistant")return `👥 → ${view.catalog.workshops[own().workshops[m.index].card].name}`;
    if(m.type === "painter")return `🎨 +${m.steps} 格 · ${m.side === "left" ? "左" : "右"}奖励`;
    if(m.type === "recover")return `↩️👷 ${m.zone === "clock" ? "钟盘" : m.zone === "months" ? "月份" : "星座"} ${m.slot+1}`;
    if(m.type === "take_scroll")return `📜 ${view.catalog.scrolls[view.scroll_market[m.index]].map(effectText).join(" · ")}`;
    if(m.type === "use_scroll")return `📜 ${view.catalog.scrolls[own().scrolls[m.index].kind].map(effectText).join(" · ")}`;
    if(m.type === "claim")return `🎯 ${view.catalog.objectives[m.objective].text}`;
    if(m.type === "exchange")return `${costs(m.payment)} → 🟨 1`;
    if(m.type === "resolve")return effectText(pending().effects[m.index]);
    if(m.type === "accept")return effectText(pending());
    if(m.type === "choose")return effectText({kind:m.option});
    if(m.type === "sculptor")return `🗿 ${["工坊", "建造", "黄金与金币", m.option === "moon" ? "月亮" : "画家"][m.index]}`;
    return {pass:"Pass",end_turn:"End Turn",next_round:"Next Round",skip:"Skip"}[m.type] || m.type;
  }
  function moveExplanation(m) {
    const map={take_apostle:"gears",place_apostle:"apostle",take_scroll:"mastery",exchange:"payment",next_round:"next",end_turn:"end"};
    let text=why(map[m.type] || m.type);
    if(m.type === "resolve")text=effectExplanation(pending().effects[m.index]);
    if(m.type === "accept")text=effectExplanation(pending());
    if(m.type === "painter") {
      const pos=(view.painter-m.steps+Number(m.side === "left")+12)%12;
      text=`${descriptions.painter} 本次奖励：${view.calendar[pos].map(effectText).join("，")}。`;
    }
    if(m.payment)text+=` 本次支付：${resourceDescription(m.payment)}。`;
    return `${moveText(m)}。${text}`;
  }

  function familyKey(m) {
    const ignored=["revision","payment"];
    if(["build","take_apostle"].includes(m.type))ignored.push("steps");
    if(m.type === "workshop")ignored.push("side");
    return JSON.stringify(Object.fromEntries(Object.entries(m).filter(([key])=>!ignored.includes(key))));
  }
  function selectMove(index) {
    selected=index;
    family=view.moves.map((m,i)=>({m,i})).filter(({m})=>familyKey(m)===familyKey(view.moves[index])).map(({i})=>i);
    render();
    if(matchMedia('(max-width:1000px)').matches)root.querySelector('[data-or-selection]')?.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  const isSelectedMove = m => m && family.includes(indexOf(m));
  const moveButton = (m,label=null) => button(esc(label || moveText(m)),`move:${indexOf(m)}`,moveExplanation(m),false,`class="${isSelectedMove(m)?"or-selected":""}"`);
  function options(list) {
    const unique=new Map();
    list.forEach(m=>{const key=familyKey(m);if(!unique.has(key))unique.set(key,m);});
    return `<div class="or-option-list">${[...unique.values()].map(m=>moveButton(m)).join("")}</div>`;
  }

  function clockBoard() {
    const can=moves("clock");
    const hours=Array.from({length:12},(_,i)=>{
      const angle=i*Math.PI/6-Math.PI/2;
      const possible=can.filter(m=>(view.hand+m.steps)%12===i);
      const owner=view.clock_workers[i];
      const text=`位置 ${i+1}。外环：${view.catalog.outer[i].map(effectText).join("，")}；当前内环：${view.catalog.inner[(i-view.face+12)%12].map(effectText).join("，")}。${owner?`${name(owner)} 的工人将返回。`:"无工人。"} ${descriptions.clock}`;
      return button(`<span class="or-hour-number">${i+1}</span><span class="or-hour-icon">${outerIcons[i]}</span>${owner?`<span class="or-owner" style="--player-color:${color(owner)}"></span>`:""}`,`hour:${i}`,text,!possible.length,
        `class="or-hour ${view.hand===i?"or-hand":""}" style="--x:${50+40*Math.cos(angle)}%;--y:${50+40*Math.sin(angle)}%"`);
    }).join("");
    return `<div class="or-clock-wrap"><div class="or-clock">${hours}<div class="or-clock-center"><span>ASTRONOMICAL</span><strong>${view.hand+1}</strong><span>ORLOJ · 1865</span></div></div></div>
      <div class="or-mini-row">${passive(`🌙 ${view.moon+1}/12`,"moon")}${passive(`👤 ${view.gear_apostles.join(" / ")}`,"gears")}${passive(`🐓 ${view.rooster}`,"rooster")}${passive(`🎨 ${view.painter+1}/12`,"painter")}</div>
      <div class="or-section-title" style="margin-top:12px"><h3>当前指针</h3>${passive("顺时针 ↻ / 内盘 ↶","clock")}</div>
      ${effects([...view.catalog.outer[view.hand],...view.catalog.inner[(view.hand-view.face+12)%12]])}`;
  }

  function calendarBoard() {
    const builds=moves("build");
    let construction="";
    if(pending()?.kind === "build") {
      const grid=view.board[buildZone].map((cell,i)=>{
        const available=builds.filter(m=>m.zone===buildZone&&m.slot===i);
        const m=available[0];
        return button(`<strong>${buildZone === "months"?`${i+1} 月`:view.catalog.zodiac[i]}</strong><small>${cell.built?"✓ 已建":costs(view.catalog.costs[buildZone][i])}</small>`,m?`move:${indexOf(m)}`:"none",m?moveExplanation(m):descriptions.build,!m,`class="or-build-cell ${isSelectedMove(m)?'or-selected':''}"`);
      }).join("");
      construction=`<div class="or-section-title"><h3>建造区</h3>${passive(`🔨 交点 ${view.hammers[buildZone]+1}`,"build")}</div><div class="or-action-row" style="margin-bottom:9px">${button("月份", "zone:months","build",false,`aria-pressed="${buildZone==='months'}"`)}${button("星座", "zone:zodiac","build",false,`aria-pressed="${buildZone==='zodiac'}"`)}</div><div class="or-construction">${grid}</div><div class="or-legend">${passive("🔨 六交点顺时针；可原位建造","build")}</div>`;
    }
    return `${construction}<div class="or-section-title"><h3>日历与星座</h3>${passive("同色相邻连片 ×2⭐","build")}</div><div class="or-calendar">${view.board.months.map((cell,i)=>{
      const z=view.board.zodiac[i];
      const dial=(c,zone,label)=>{
        const recovery=moves("recover").find(m=>m.zone===zone&&m.slot===i);
        const text=`${label}：${c.owner?name(c.owner)+" 的工人(👷)":c.built?"已建成，未放工人":"尚未建造"}。${descriptions.build}`;
        return recovery ? button(`↩️ ${label}`,`move:${indexOf(recovery)}`,text,false,"class=\"or-dial-button\"") : `<div class="or-dial ${c.built?"or-built":""}" style="--player-color:${c.owner?color(c.owner):"#b49b64"}">${passive(`${label} ${c.owner?"👷":c.built?"✓":"○"}`,text,"")}</div>`;
      };
      return `<div class="or-month"><span class="or-month-label">${i+1} 月</span>${dial(cell,"months","☀️")}${dial(z,"zodiac",view.catalog.zodiac[i])}${effects(view.calendar[i])}</div>`;
    }).join("")}</div>`;
  }

  function workshopBoard() {
    const p=player(inspected);
    const cardHtml=(key,i,owned=null)=>{
      if(!key)return `<div class="or-workshop">${passive('Empty',`工坊市场第 ${i+1} 格为空，剩余工坊继续向右补位。`)}</div>`;
      const card=view.catalog.workshops[key];
      const m=owned ? (p.player_id === view.you?moves("place_assistant").find(x=>x.index===i):null) : moves("workshop").find(x=>x.index===i);
      const cost={paint:1}; cost[card.resource]=(cost[card.resource]||0)+3-i;
      const inside=`<div class="or-seam"><span>${card.left === "build"?"🔨":"👤"}◁</span><span>▷${card.right === "build"?"🔨":"👤"}</span></div><strong>${esc(card.name)}</strong>${effects(card.reward)}<div class="or-workshop-cost">${owned?owned.assistant?`👥 ${esc(view.catalog.assistants[owned.assistant].name)}`:`👥 ${icons[card.resource]} → ${card.assistant.map(effectText).join(" ")}`:costs(cost)}</div>`;
      const explanation=`${descriptions.workshop} 顶部：${card.reward.map(effectText).join("，")}。放助手奖励：${card.assistant.map(effectText).join("，")}。`;
      return m?button(inside,`move:${indexOf(m)}`,explanation,false,`class="or-workshop ${isSelectedMove(m)?'or-selected':''}"`):`<div class="or-workshop" tabindex="0" data-or-tip="${esc(explanation)}" data-or-explain="${esc(explanation)}">${inside}</div>`;
    };
    return `<div class="or-section-title"><h3>工坊市场</h3>${passive(`📦 ${view.workshop_deck_count}`,"剩余工坊牌数量；后续牌序不公开。")}</div><div class="or-market">${view.market.map((key,i)=>cardHtml(key,i)).join("")}</div>
      <div class="or-section-title" style="margin-top:15px"><h3>${esc(name(inspected))} · 工坊</h3></div><div class="or-owned-workshops">${p.workshops.map((w,i)=>cardHtml(w.card,i,w)).join("")||'<p class="or-muted">尚无工坊</p>'}</div>`;
  }

  function masteryBoard() {
    const p=player(inspected);
    const tracks=["blue","pink","yellow"].map(t=>{
      const metric=view.windows[t];
      const royal=view.royals[t];
      const royalLabel=royal?`👑 ${view.catalog.metric_names[royal]} ×${view.catalog.primary[royal]}`:'👑 已领取';
      const royalText=royal?`皇家卷轴(👑)：首位到达 12 格，按${view.catalog.metric_names[royal]} ×${view.catalog.primary[royal]} 立即得分，上限 10 分(⭐)。`:'此轨的皇家卷轴(👑)已被领取，后到达者不再领取。';
      return `<div style="--track-color:${{blue:'#60c0dd',pink:'#c799dd',yellow:'#dec76f'}[t]}"><div class="or-track-head"><strong>${icons[t]} ${trackNames[t]} · ${p.mastery[t]}/12</strong><div class="or-track-goals">${passive(`${esc(view.catalog.metric_names[metric])} ×${view.catalog.primary[metric]}/1`,`${descriptions.mastery} 此彩窗按${view.catalog.metric_names[metric]}计分，领先者倍率 ${view.catalog.primary[metric]}，其他达 7 格者倍率 1，最高 15 分(⭐)。`)}${passive(royalLabel,royalText)}</div></div><div class="or-track-cells">${Array.from({length:13},(_,i)=>{
        const occupants=view.players.filter(other=>other.mastery[t]===i);
        const bonus=[4,9].includes(i)?'📜':i===6?'🌙':i===7?'│':i===12?'👑':'';
        return passive(`<span>${i}</span>${occupants.map(other=>`<span class="or-track-pawn" style="--player-color:${color(other.player_id)}"></span>`).join('')}<span>${bonus}</span>`,`${trackNames[t]}(${icons[t]}) ${i} 格。${occupants.map(other=>other.name).join('、') || '暂无玩家'}。${descriptions.mastery}`,`or-track-cell ${i<=p.mastery[t]?'or-filled':''}`);
      }).join("")}</div></div>`;
    }).join("");
    const upgrades=Object.entries(p.production).map(([r,n])=>passive(`${icons[r]} ${n}/3 → ${n===0?1:2}${n===2?" + 任意1":n===3?" +🟨1":""}`,`${resourceNames[r]}(${icons[r]})生产轨 ${n}。${effectExplanation({kind:"upgrade"})}`)).join("");
    const scrolls=p.scrolls.map(s=>passive(`📜 ${s.used?'✓':'●'} ${view.catalog.scrolls[s.kind].map(effectText).join(' · ')}`,`红卷轴(📜)：${s.used?'已使用，仍计入终局卷轴数量':'尚未使用，可在自己的回合额外使用'}。${view.catalog.scrolls[s.kind].map(effectExplanation).join(' ')}`)).join('');
    const royals=p.royals.map(r=>passive(`👑 ${view.catalog.metric_names[r]}`,`已领取的皇家卷轴(👑)：${view.catalog.metric_names[r]}。分数已结算，卷轴仍保留用于终局计数。`)).join('');
    return `<div class="or-tracks">${tracks}</div><div class="or-upgrades">${upgrades}${passive(`🔨 ${view.catalog.hammers[p.hammer].name} ${p.hammer_level+1}/3 · ↻${view.catalog.hammers[p.hammer].moves[p.hammer_level]}`,`${descriptions.build} 当前锤子奖励：${hammerRewards[p.hammer][p.hammer_level]}。`)}</div><div class="or-section-title" style="margin-top:12px"><h3>卷轴</h3></div><div class="or-scrolls">${scrolls+royals||'<span class="or-muted">尚无卷轴</span>'}</div>`;
  }

  function apostlesBoard() {
    const p=player(inspected), mine=p.player_id===view.you;
    const squares=p.panel.map((n,i)=>{
      const slot=view.catalog.slots[i];
      const m=mine?moves("place_apostle").find(m=>m.slot===i):null;
      const reward={coin:"💰",upgrade:"⬆️",recover:"↩️👷",worker:"🔓👷"}[slot.reward];
      const inside=`<strong>${n || apostleIcons[slot.color]}</strong><small>${icons[slot.cost]} −1 · ${reward}</small>`;
      return button(inside,m?`move:${indexOf(m)}`:"none","apostle",!m,`class="or-apostle ${isSelectedMove(m)?'or-selected':''}" style="--apostle-color:${apostleColors[slot.color]}"`);
    }).join("");
    return `<div class="or-section-title"><h3>${esc(name(inspected))} · 使徒面板</h3>${passive("满行 7⭐ + 生产","apostle")}</div><div class="or-apostle-grid">${squares}</div><div class="or-legend">${passive("满列 👥 / 🌙","apostle")}${passive("行费用：🎨 / 🌲 / 🔩","apostle")}</div><h3>仓库</h3><div class="or-mini-row">${p.warehouse.map(n=>passive(apostleLabel(n),"apostle")).join("")}${p.assistant?passive(`👥 ${view.catalog.assistants[p.assistant].name}`,view.catalog.assistants[p.assistant].text):""}${passive(`${p.warehouse.length+Number(!!p.assistant)}/2`,"gears")}</div>`;
  }

  function objectives() {
    return `<div class="or-objectives">${view.objectives.map(key=>{
      const m=moves("claim").find(m=>m.objective===key), definition=view.catalog.objectives[key];
      return `<div class="or-objective"><div data-or-explain="${esc(descriptions.objective)}">🎯 ${esc(definition.text)}</div>${button("Claim",m?`direct:${indexOf(m)}`:"none","objective",!m)}<div class="or-objective-rewards">${effects(definition.bonus)}<div class="or-effect">${view.claims[key].map(c=>passive(`${esc(name(c.player_id))} ${c.points}⭐`,"objective")).join("")||passive(view.players.length===2?'8 / 4⭐':'8 / 6 / 4⭐',"objective")}</div></div></div>`;
    }).join("")}</div>`;
  }

  function clockControl() {
    const legal=moves("clock");
    if(!legal.length)return "";
    if(!legal.some(m=>m.steps===clockSteps))clockSteps=legal[0].steps;
    const rotations=[...new Set(legal.filter(m=>m.steps===clockSteps).map(m=>m.rotate))];
    if(!rotations.includes(clockRotate))clockRotate=rotations[0];
    const m=legal.find(m=>m.steps===clockSteps&&m.rotate===clockRotate&&m.first===clockFirst);
    const pos=(view.hand+clockSteps)%12, inner=(pos-view.face+clockRotate+12)%12;
    const deviation=Math.max(0,clockSteps-level(own().mastery.blue))+clockRotate;
    const field=(label,key,values,current)=>`<label class="or-field" data-or-explain="${esc(descriptions.clock)}"><span>${label}</span><select data-or-clock="${key}" aria-label="${label}">${values.map(n=>`<option value="${n}" ${n===current?"selected":""}>${key==='steps'?`+${n} → ${(view.hand+n)%12+1}`:`↶ ${n}`}</option>`).join("")}</select></label>`;
    return `<div class="or-clock-fields">${field("指针","steps",[...new Set(legal.map(m=>m.steps))],clockSteps)}${field("内盘","rotate",rotations,clockRotate)}</div><div class="or-action-row">${button("外环先","first:outer","clock",false,`aria-pressed="${clockFirst==='outer'}"`)}${button("内环先","first:inner","clock",false,`aria-pressed="${clockFirst==='inner'}"`)}</div>
      <div class="or-summary"><div class="or-section-title"><strong>位置 ${pos+1}</strong>${passive(`⚙️ +${deviation}`,"clock")}</div><div class="or-effect-group"><span class="or-muted">外环</span>${effects(view.catalog.outer[pos])}</div><div class="or-effect-group"><span class="or-muted">内环</span>${effects(view.catalog.inner[inner])}</div>${button("Activate Clock",`direct:${indexOf(m)}`,"clock",false,"class=\"or-primary\"")}</div>`;
  }

  function selectionControl() {
    if(selected===null || !view.moves[selected])return "";
    const m=view.moves[selected];
    const fields=["steps","side","payment"].map(key=>{
      const values=[...new Set(family.map(i=>JSON.stringify(view.moves[i][key])))].filter(n=>n!==undefined);
      if(values.length<2)return "";
      const label={steps:"额外转动 / 移动",side:"放置方向",payment:"Payment"}[key];
      return `<label class="or-field" data-or-explain="${esc(key==='payment'?descriptions.payment:moveExplanation(m))}"><span>${label}</span><select data-or-variant="${key}" aria-label="${label}">${values.map((value,i)=>{
        const v=JSON.parse(value), text=key==='payment'?costs(v):key==='side'?(v==='left'?"左端":"右端"):`${v} 格`;
        return `<option value="${i}" ${same(m[key],v)?"selected":""}>${esc(text)}</option>`;
      }).join("")}</select></label>`;
    }).join("");
    let bonus="";
    if(m.type==='painter')bonus=effects(view.calendar[(view.painter-m.steps+Number(m.side==='left')+12)%12]);
    if(m.type==='build'&&m.zone!=='final')bonus=effects(view.calendar[m.slot]);
    return `<div class="or-summary" data-or-selection><strong>${esc(moveText(m))}</strong>${fields}${m.payment?passive(`Payment · ${costs(m.payment)}`,"payment"):""}${["build","take_apostle"].includes(m.type)?passive(`↻ ${m.steps} 格`,moveExplanation(m)):""}${bonus}<div class="or-action-row">${button("Confirm",`direct:${selected}`,"confirm",false,"class=\"or-primary\"")}${button("Cancel","cancel","Cancel 取消当前选择，也可点击周围空白或按 Esc。")}</div></div>`;
  }

  function consoleHtml() {
    const ownPlayer=own();
    const active=acting(), task=pending();
    const phase=view.game_over?"最终成绩":view.phase==='round_end'?"报晓回顾":view.phase==='setup'?"起始升级":active?"你的回合":`${name(view.current_turn)} 的回合`;
    let controls="";
    if(view.phase==='round_end') {
      const m=moves("next_round")[0];
      controls=`<p class="or-muted">${view.next_ready.length}/${view.players.length} Ready</p>${button(m?"Next Round":ownPlayer?"Waiting for players…":"Spectator",m?`direct:${indexOf(m)}`:"none","next",!m,"class=\"or-primary\"")}`;
    } else if(view.game_over)controls='<p class="or-muted">Game over</p>';
    else if(!active)controls=`<p class="or-muted">${ownPlayer?'Waiting for turn…':'Spectator'}</p>${task?effects([task]):""}`;
    else if(extraMode) {
      controls=`<div class="or-section-title"><h3>额外行动</h3>${button("Back","back","返回当前主行动。")}</div>${options(moves(extraMode))}`;
    } else if(task) {
      if(moves('accept').length)controls=button(esc(effectText(task)),`direct:${indexOf(moves('accept')[0])}`,effectExplanation(task),false,'class="or-primary"');
      else if(task.kind==='build' && moves('build').some(m=>m.zone!=='final'))controls=`<p class="or-muted">选择月份或星座建造格</p>${button("View Construction","tab:calendar","build")}`;
      else if(task.kind==='workshop')controls=`<p class="or-muted">选择工坊、拼接方向和支付资源</p>${button("View Market","tab:workshop","workshop")}`;
      else controls=options(view.moves.filter(m=>!['place_apostle','use_scroll','place_assistant','claim','exchange','skip'].includes(m.type)));
      const skip=moves('skip')[0];
      if(skip)controls+=`<div class="or-action-row" style="margin-top:8px">${button("Skip",`direct:${indexOf(skip)}`,"skip")}</div>`;
    } else if(!view.main_done) {
      controls=clockControl();
      const pass=moves('pass')[0];
      if(pass)controls+=`<div class="or-action-row">${button("Pass",`direct:${indexOf(pass)}`,"pass")}</div>`;
    } else {
      const end=moves('end_turn')[0];
      controls=button("End Turn",end?`direct:${indexOf(end)}`:"none","end",!end,"class=\"or-primary\"");
    }
    const extras=[['place_apostle','👤 放使徒'],['use_scroll','📜 用卷轴'],['place_assistant','👥 放助手'],['claim','🎯 认领目标'],['exchange','🟨 换黄金']].filter(([type])=>moves(type).length);
    return `<div class="or-console-head"><div><div class="or-phase">${view.phase==='setup'?"Preparation":`Turn ${ownPlayer?ownPlayer.turns+1:"—"}`}</div><h3 class="or-prompt">${esc(phase)}</h3></div>${pendingSend?'<span class="or-muted" role="status">Sending…</span>':""}</div>${task&&active&&!extraMode?effects([task]):""}${selectionControl()}${controls}${active&&extras.length?`<div><div class="or-section-title"><h3>额外行动</h3></div><div class="or-grid2">${extras.map(([type,label])=>button(label,`extra:${type}`,type==='place_apostle'?'apostle':type==='exchange'?'payment':type==='claim'?'objective':`${label}：可在自己的回合随时使用，处理完奖励后继续。`)).join("")}</div></div>`:""}`;
  }

  function reviewHtml() {
    if(view.phase!=='round_end')return "";
    return `<div class="or-review">${view.review.map(r=>`<div class="or-review-row"><strong>${esc(name(r.player_id))}</strong>${passive(`⚙️ ${r.before} → ${r.remaining} · 修复 ${r.repaired}`,"rooster")}${passive(`⭐ ${r.points>=0?'+':''}${r.points}`,"rooster")}<span>${view.next_ready.includes(r.player_id)?"✓ Ready":"Waiting"}</span></div>`).join("")}</div>`;
  }
  function resultsHtml() {
    if(!view.result)return "";
    return `<div class="or-results">${view.result.scores.map(r=>`<div class="or-result-card"><div class="or-result-total"><span>${view.result.winners.includes(r.player_id)?"🏆 ":""}${esc(name(r.player_id))}</span><strong>${r.total}⭐</strong></div><div class="or-effect">${passive(`即时 ${r.immediate}`,"对局中获得的分数(⭐)。")}${passive(`彩窗 ${Object.values(r.windows).reduce((a,b)=>a+b,0)}`,"mastery")}${passive(`黄金 ${r.gold}`,"剩余黄金(🟨)每个 1 分；基础资源和金币(💰)按三换一最优兑换。")}${passive(`偏差 ${r.deviation}`,"终局每个残留偏差(⚙️)扣 1 分，不再用个人雄鸡修复。")}${passive(`助手 ${Object.values(r.assistants).reduce((a,b)=>a+b,0)}`,"只计算已安置在工坊上的助手(👥)。")}${passive(`目标 ${r.objectives}`,"objective")}</div></div>`).join("")}</div>`;
  }

  function render() {
    if(!view)return;
    const current=player(inspected)||own()||view.players[0];
    inspected=current.player_id;
    const scrolls=[...root.querySelectorAll('.or-option-list,.or-owned-workshops,.or-scrolls,.or-log')].map(el=>[el.className,el.scrollTop]);
    const focus=document.activeElement?.dataset.orAction;
    root.innerHTML=`<div class="or-hero"><div><div class="or-wordmark">ORLOJ</div><div class="or-subtitle">布拉格天文钟 · PRAGUE 1865</div></div><div class="or-status">${passive(`🐓 ${view.calls}/4 次报晓 · 余 ${view.rooster}`,"rooster")}${view.finishing?`<span class="or-live">${view.finishing==='calendar'?"日历完成":"第四次报晓"} · 最后等量回合</span>`:'<span>THE ASTRONOMICAL CLOCK</span>'}</div></div>
      <div class="or-players" style="--players:${view.players.length}">${view.players.map(p=>button(`<span class="or-player-name">${p.player_id===view.current_turn?'▸ ':''}${p.is_bot?'🤖 ':''}${esc(p.name)}</span><span class="or-score">${p.score}⭐</span><small>👷 ${p.workers} · ⚙️ ${p.deviation}/5 · 🐓 ${p.rooster} · ${p.turns} 回合</small>`,`inspect:${p.player_id}`,"inspect",false,`class="or-player" style="--player-color:${color(p.player_id)}" aria-pressed="${inspected===p.player_id}"`)).join("")}</div>
      <div class="or-resources">${Object.entries(current.resources).map(([key,n])=>passive(`${icons[key]} ${n}`,`${esc(name(inspected))} · ${resourceNames[key]}(${icons[key]})。${descriptions.payment}`,"or-token or-resource")).join("")}${passive(`👷 ${current.workers}`,"可用工人(👷)：激活钟盘、建造或认领目标各需一名。工坊、生产与使徒可解锁新工人。","or-token or-resource")}</div>
      ${reviewHtml()}${resultsHtml()}<div class="or-layout"><div class="or-board"><nav class="or-tabs" aria-label="Game board">${[['clock','🕰️ 钟盘'],['calendar','🔨 日历'],['workshop','🏛️ 工坊'],['mastery','📚 学识'],['apostles','👤 使徒']].map(([key,label])=>button(label,`tab:${key}`,`查看${label}区域。`,false,`aria-pressed="${tab===key}"`)).join("")}</nav><div class="or-board-body">${{clock:clockBoard,calendar:calendarBoard,workshop:workshopBoard,mastery:masteryBoard,apostles:apostlesBoard}[tab]()}</div></div><aside class="or-console" aria-label="Actions">${consoleHtml()}</aside></div>${objectives()}
      <div class="or-footer"><details ${view.phase==='round_end'?'open':''}><summary>Game Log</summary><div class="or-log">${view.log.slice().reverse().map(e=>`<p>${esc(e.text)}</p>`).join("")}</div></details>${passive("数字适配 · 版本说明", "version")}</div>`;
    root.classList.toggle('or-explaining',explaining);
    scrolls.forEach(([cls,top])=>{const node=root.getElementsByClassName(cls)[0];if(node)node.scrollTop=top;});
    if(focus)[...root.querySelectorAll('[data-or-action]')].find(el=>el.dataset.orAction===focus)?.focus({preventScroll:true});
  }

  function resetSelection() { selected=null; family=[]; }
  function send(index) {
    if(pendingSend || !view.moves[index])return;
    const m=view.moves[index];
    pendingSend=true; resetSelection(); hideTip(); render();
    socket.emit('game:action',{action:m});
    clearTimeout(sendTimer);
    sendTimer=setTimeout(()=>{pendingSend=false;render();},5000);
  }
  root.addEventListener('click',e=>{
    const control=e.target.closest('[data-or-action]');
    if(!control) {
      if(e.target.closest('[data-or-tip]'))showTip(e.target.closest('[data-or-tip]'));
      else if(!e.target.closest('select,[data-or-selection]')&&selected!==null){resetSelection();render();}
      return;
    }
    if(control.disabled || explaining)return;
    const [action,...rest]=control.dataset.orAction.split(':'), value=rest.join(':');
    if(action==='direct'){send(Number(value));return;}
    if(action==='move'){selectMove(Number(value));return;}
    if(action==='tab')tab=value;
    else if(action==='inspect')inspected=value;
    else if(action==='zone')buildZone=value;
    else if(action==='first')clockFirst=value;
    else if(action==='hour') {
      const m=moves('clock').find(m=>(view.hand+m.steps)%12===Number(value));
      if(m){clockSteps=m.steps;clockRotate=m.rotate;clockFirst=m.first;}
    } else if(action==='cancel')resetSelection();
    else if(action==='back'){extraMode=null;resetSelection();}
    else if(action==='extra') {
      extraMode=value; resetSelection();
      if(value==='place_apostle') {tab='apostles';inspected=view.you;}
      if(value==='place_assistant') {tab='workshop';inspected=view.you;}
    }
    hideTip();render();
  });
  root.addEventListener('change',e=>{
    if(e.target.dataset.orClock) {
      if(e.target.dataset.orClock==='steps')clockSteps=Number(e.target.value);else clockRotate=Number(e.target.value);
      render();return;
    }
    const key=e.target.dataset.orVariant;
    if(!key||selected===null)return;
    const values=[...new Set(family.map(i=>JSON.stringify(view.moves[i][key])))].filter(n=>n!==undefined);
    const value=JSON.parse(values[Number(e.target.value)]), old=view.moves[selected];
    const matching=family.filter(i=>same(view.moves[i][key],value));
    selected=matching.find(i=>['steps','side','payment'].filter(k=>k!==key).every(k=>same(view.moves[i][k],old[k]))) ?? matching[0];
    render();
  });

  function hideTip(){clearTimeout(tipTimer);tip.hidden=true;}
  function showTip(target) {
    hideTip();tip.textContent=target.dataset.orTip;tip.hidden=false;
    const r=target.getBoundingClientRect();
    tip.style.left=`${Math.max(10,Math.min(r.left,innerWidth-tip.offsetWidth-10))}px`;
    tip.style.top=`${Math.max(10,Math.min(r.bottom+7,innerHeight-tip.offsetHeight-10))}px`;
    tipTimer=setTimeout(hideTip,3000);
  }
  root.addEventListener('pointerover',e=>{const target=e.target.closest('[data-or-tip]');if(target&&e.pointerType!=='touch'&&!explaining)showTip(target);});
  root.addEventListener('pointerout',e=>{if(e.target.closest('[data-or-tip]'))hideTip();});
  root.addEventListener('focusin',e=>{if(e.target.dataset.orTip&&!explaining)showTip(e.target);});
  root.addEventListener('focusout',hideTip);
  window.addEventListener('resize',hideTip);
  window.addEventListener('scroll',hideTip,true);
  function setExplain(value){explaining=value;root.classList.toggle('or-explaining',value);explain.setAttribute('aria-pressed',String(value));hideTip();}
  function openDialog(title,body,html=false) {
    restoreFocus=document.activeElement;hideTip();
    document.getElementById('orlojDialogTitle').textContent=title;
    const bodyNode=document.getElementById('orlojDialogBody');
    if(html)bodyNode.innerHTML=body;else bodyNode.textContent=body;
    if(!dialog.open)dialog.showModal();
  }
  help.addEventListener('click',()=>{
    setExplain(false);
    const sections=[
      ['目标与版本',descriptions.version+' 起始 10 分(⭐)，尽量通过建造、使徒、学识彩窗和助手得分。一个人可在房间添加 AI，按多人规则对局。'],
      ['资源与工人',descriptions.payment+' 两人起始 5 名可用工人(👷)，三/四人 4 名；另外 9 名分别锁在生产、使徒面板和工坊市场。'+descriptions.pass],
      ['你的回合',descriptions.clock+' 所有行动均可放弃。先处理完一组的全部基础行动，再处理另一组；额外行动可插入。'+descriptions.end],
      ['三种学识',descriptions.mastery+' 学识 I/II/III/IV 对应 0–3 / 4–6 / 7–9 / 10–12 格。每条轨到顶后多余推进每格 +1 分(⭐)。'],
      ['月亮与画家',descriptions.moon+' '+descriptions.painter],
      ['生产与升级',effectExplanation({kind:'upgrade'})+' 生产 I：1 个本类资源；II：2 个；III：2 个加 1 任意基础资源；IV：2 个加 1 黄金(🟨)。'],
      ['使徒与仓库',descriptions.gears+' '+descriptions.apostle],
      ['工坊与助手',descriptions.workshop+' 助手(👥)须从仓库安置到空工坊并支付该牌示基础资源 1 份，立即拿中间奖励。每种助手只能拥有一个。'+Object.values(view.catalog.assistants).map(a=>`${a.name}：${a.text}。`).join(' ')],
      ['建造与锤子',descriptions.build+' 锤子六交点依次邻接 4 个格子。具体移动和费用在确认区显示。最后一个日历完成后，建造改为金(🟨)、木(🌲)、颜料(🎨)、铁(🔩)各一，得 8 分(⭐)与锤子奖励，不放工人。'+Object.entries(view.catalog.hammers).map(([key,h])=>`${h.name}(🔨)：I/II/III 级免费移动 ${h.moves.join('/')} 格；奖励依次为${hammerRewards[key].join('、')}。`).join(' ')],
      ['雕刻师',descriptions.sculptor+' I/II 级多需承担 1 偏差(⚙️)，I 级建造需 2；III 级改为修复 1。月亮选项无需偏差。'],
      ['卷轴与目标','红卷轴(📜)可在自己回合翻面使用一次，保留用于计分；皇家卷轴(👑)只给第一个到达的玩家，立即按条件计分，最多 10 分。'+descriptions.objective],
      ['报晓与终局',descriptions.rooster+' '+descriptions.next+' 终局每条达到 7 格的彩窗计分：最高位置（并列均可）用主倍率，其余用 1 倍，每张上限 15。黄金(🟨)每个 1 分，资源/金币最优三换一；残留偏差每个 −1。安置助手和目标计分；同分比已放使徒数，再同分共同胜利。'],
      ['操作','Help 打开规则；Explain 后点击区域或按钮查看说明，禁用按钮也可解释。无交互图标悬停/点击显示提示，3 秒自动关闭。点击空白、Cancel 或 Esc 取消选择，Esc 也可关闭弹窗。Next Round、Pass、End Turn 直接执行。'],
    ];
    openDialog('Help · 布拉格天文钟',sections.map(([title,text])=>`<h3>${esc(title)}</h3><p>${esc(text)}</p>`).join('')+'<p><a href="https://perrolokogames.com/wp-content/uploads/2025/09/Rulebook_EN_Orloj.pdf" target="_blank" rel="noopener noreferrer">Publisher rulebook</a></p>',true);
  });
  explain.addEventListener('click',()=>setExplain(!explaining));
  document.getElementById('orlojClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{hideTip();suppressedUntil=0;if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  const activePanel=()=>view&&!panel.classList.contains('hidden');
  const exempt=target=>help.contains(target)||explain.contains(target)||dialog.contains(target);
  function explainTarget(target){if(target?.dataset.orExplain){setExplain(false);openDialog('Explain',target.dataset.orExplain);}}
  document.addEventListener('pointerdown',e=>{
    if(!explaining||!activePanel()||exempt(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();suppressedUntil=Date.now()+650;
    const target=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest('[data-or-explain]')).find(el=>el&&root.contains(el));
    explainTarget(target);
  },true);
  document.addEventListener('click',e=>{
    if(!activePanel()||exempt(e.target))return;
    if(Date.now()<suppressedUntil){e.preventDefault();e.stopImmediatePropagation();return;}
    if(explaining){e.preventDefault();e.stopImmediatePropagation();explainTarget(e.target.closest('[data-or-explain]'));}
  },true);
  document.addEventListener('keydown',e=>{
    if(!activePanel())return;
    if(e.key==='Escape'){hideTip();setExplain(false);if(!dialog.open){resetSelection();extraMode=null;render();}return;}
    if(explaining&&!exempt(e.target)&&[' ','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();if([' ','Enter'].includes(e.key))explainTarget(e.target.closest('[data-or-explain]'));
    }
  },true);
  function clearState(){view=null;room=null;tab='clock';inspected=null;resetSelection();extraMode=null;pendingSend=false;clearTimeout(sendTimer);setExplain(false);root.innerHTML='';if(dialog.open)dialog.close();}
  window.renderOrlojGameState=data=>{
    const next=data?.view;if(!next||next.game_id!=='orloj')return;
    if(room!==data.room_id || view?.revision!==next.revision) {
      resetSelection();extraMode=null;pendingSend=false;clearTimeout(sendTimer);
      if(next.current_turn===next.you&&next.pending[0]?.kind==='build')tab='calendar';
      if(next.current_turn===next.you&&next.pending[0]?.kind==='workshop')tab='workshop';
    }
    room=data.room_id;view=next;
    if(!next.players.some(p=>p.player_id===inspected))inspected=own()?.player_id||next.players[0].player_id;
    render();
  };
  window.showOrlojHeaderActions=visible=>{header.style.display=visible?'flex':'none';help.classList.toggle('hidden',!visible);explain.classList.toggle('hidden',!visible);if(!visible)clearState();if(typeof syncRoomControlsExplainButton==='function')syncRoomControlsExplainButton();};
  window.clearOrlojState=clearState;
  function connect(){
    if(typeof socket!=='undefined') {
      socket.on('system:error',()=>{if(pendingSend){pendingSend=false;clearTimeout(sendTimer);render();}});
      socket.on('room:state',state=>{if(state.game_type!=='orloj'||state.status==='lobby')clearState();});
    }
    if(typeof currentRoomState!=='undefined'&&currentRoomState?.game_type==='orloj'&&typeof lastGameStatePayload!=='undefined'&&lastGameStatePayload?.game_type==='orloj')window.renderOrlojGameState(lastGameStatePayload);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
})();
