(() => {
  "use strict";
  const byId = suffix => document.getElementById(`powerGrid${suffix}`);
  const panel = byId("Panel"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  const fuels = ["coal", "oil", "garbage", "uranium"];
  const icons = {coal:"🟤", oil:"⚫", garbage:"🟡", uranium:"🔴", hybrid:"🟤⚫", green:"🌿"};
  const names = {coal:"Coal", oil:"Oil", garbage:"Garbage", uranium:"Uranium", hybrid:"Hybrid", green:"Clean energy"};
  const shades = {coal:"#dfcdb8", oil:"#d6d7cd", garbage:"#f0dda2", uranium:"#efcbc0", hybrid:"#ddcfb8", green:"#d5e6bd"};
  const colors = ["#c76049", "#4c85b0", "#8c6bb2", "#bd9937", "#398574", "#b66c92"];
  const regionNames = {north:"North", west:"West", southwest:"Southwest", central:"Central", south:"South", east:"East"};
  let view = null, pending = false, pendingTimer, signature = "", phaseSignature = "", configSignature = "";
  let selectedPlant = null, selectedCity = null, chosenPlants = [], hybridCoal = 0, bidValue = 0;
  let cart = emptyFuel(), keep = emptyFuel(), explaining = false, suppressClick = false, suppressTimer;
  let tipTimer, previousFocus, mapBounds, mapBox, mapKey = "", drag = null;

  const explanations = {
    steps:["Round / Step", "每轮进行竞拍、买资源、建网、供电。Step 1／2／3 每城分别允许 1／2／3 家公司。达到门槛的整段建设结束后才进入 Step 2；抽到 Step 3 卡后在下一阶段生效。"],
    order:["Player order · 行动顺序", "每轮按 Cities（🏠，已连接城市数）排序，平手看最高电厂编号。顺序领先者先发起竞拍、后买资源和建城。拍卖内叫价按座位顺时针进行。首轮拍卖后重新排序。"],
    market:["Power plants（🏭）· 电厂市场", "Step 1／2 只有上排最低的 4 张可竞拍，下排为未来市场；Step 3 全部 6 张可买。电厂编号也是最低出价。每轮最多买 1 厂，首轮必须购买。售出立即补牌；过时电厂会淘汰。Deck（🂠）不含 Step 3 卡。"],
    auction:["Auction / Bid（🔨）", "点现货电厂，输入起拍价，点击 Start Auction。已开始竞拍时可加价，必须高于当前价且付得起。只有最后赢家付款。竞拍中 Pass 只退出当前电厂；无人竞拍时 Pass 表示本轮不再购买。首轮不能跳过购买。"],
    resources:["Fuel market · 资源市场", "Coal（🟤，煤）、Oil（⚫，油）、Garbage（🟡，垃圾）、Uranium（🔴，铀）从便宜到贵买入。价格随库存变化。用 +／− 选数量，Buy Fuel 一次购买；可以买多次，再点 Done。Step 和人数决定补货量，总组件有限。"],
    storage:["Fuel storage · 燃料储存", "每座电厂可储存一次燃料需求的两倍，只能存兼容类型。Hybrid（🟤⚫，混合厂）的煤和油共享容量。公司资源池自动安排储位，等价于规则允许的自由调配。Clean energy（🌿，清洁电厂）不需要也不能储存燃料。"],
    network:["Cities（🏠）· 城市网络", "点城市或展开 City list 选择目标，再点 Build。首城只付占位费，后续付从已有任一城市出发的最短线路费用，再加占位 10／15／20 💰。可以途经已满或尚未购买的城市，但不能途经未启用区域；一个城市不能重复建。"],
    zoom:["Map controls", "拖动地图平移，+／− 缩放，Fit 显示全部可用区域。手机触摸由地图接管，松手或取消后停止；拖动不会误选城市。也可使用 City list 查看名称和精确建造费用。"],
    power:["Power（⚡）· 供电", "点选自己的电厂，选择混合厂消耗的煤数（其余消耗油），再确认 Run Plants。每厂只能运行一次，必须消耗完整燃料；可以少发或完全不发。收入按实际供电城市数计算，超过已连接城市的电力浪费。0 城也可领取 10 💰。"],
    replace:["Replace plant · 更换电厂", "2 人最多 4 厂，其余人数最多 3 厂。购入超额电厂后，点选一座旧厂退役（不能退役刚购买的电厂），用资源控件决定保留量。保留量必须符合剩余电厂容量，多余资源回到供应堆。"],
    money:["Elektro（💰）· 资金", "竞拍、电厂燃料和网络建设共用这笔资金。只显示你自己的余额；其他公司的资金隐藏（🔒），终局统一公开。终局供电数相同，资金较多者优先。"],
    capacity:["Capacity（⚡）· 额定供电能力", "所有电厂印刷供电量的总和。实际可供电量还取决于燃料是否足够，以及 Cities（🏠，已连接城市数），并不等于最终得分。"],
    winning:["Finish line（🏁） / Winner（🏆）", "达到门槛后完成整段建设，比较现有燃料实际最多能供电的城市数，再比较现金、网络城市数，仍相同则共享胜利。触发结束的人不一定获胜。最终轮不再发收入，也不能再买燃料。"],
    next:["Next Round", "确认已看完本轮供电、收入和补货。所有玩家确认后才进入下一轮。机器人只确认自己的席位，断线真人需要重连后确认。"],
    done:["Done", "结束你的资源采购或网络建设，继续下一位玩家。同阶段可以先做多次购买／建设，也可以直接跳过。已支付的操作不能撤销。"],
  };
  const help = `
    <h3>目标 · Power Grid / 电力公司</h3><p>经典版德国地图，2–6 人。经营 Power plants（🏭，电厂），购买 Fuel（燃料），连接 Cities（🏠，城市），以 Power（⚡，电力）获取 Elektro（💰，资金）。最后能为最多城市供电者获胜（🏆）。</p>
    <h3>准备与规模</h3><p>每人 50 💰。地图选相连区域，每区 7 城。8 座起始电厂为 3–10 号，13 号在牌库顶，Step 3 卡在底部；其余洗牌并按人数暗移除。只显示本人现金（其他人为 🔒）；电厂、城市与燃料公开。</p>
    <table><thead><tr><th>Players</th><th>Regions</th><th>Removed</th><th>Plant limit</th><th>Step 2</th><th>Finish 🏁</th></tr></thead><tbody><tr><td>2</td><td>3</td><td>8</td><td>4</td><td>10</td><td>21</td></tr><tr><td>3</td><td>3</td><td>8</td><td>3</td><td>7</td><td>17</td></tr><tr><td>4</td><td>4</td><td>4</td><td>3</td><td>7</td><td>17</td></tr><tr><td>5</td><td>5</td><td>0</td><td>3</td><td>7</td><td>15</td></tr><tr><td>6</td><td>5</td><td>0</td><td>3</td><td>6</td><td>14</td></tr></tbody></table>
    <h3>1 · 顺序</h3><p>城市多的公司靠前，平手看最高电厂编号。首轮随机，首轮竞拍结束后重排。竞拍发起与供电使用正序；资源采购和建设使用逆序。</p>
    <h3>2 · 竞拍 🔨</h3><p>选现货电厂起拍，价格不能低于编号。按座位顺时针加价或 Pass，最后一位支付叫价。每人每轮最多买 1 座；首轮必须买。当前拍卖 Pass 只退出这张牌；轮到发起拍卖时 Pass 会退出本轮所有后续拍卖。若别人赢了你发起的拍卖，你可再发起。超过电厂上限时必须退役一座旧厂，选择可保留的资源，多余燃料返回供应堆。</p>
    <h3>3 · 资源采购</h3><p>Coal（🟤，煤）、Oil（⚫，油）、Garbage（🟡，垃圾）、Uranium（🔴，铀）从便宜到贵购买。初始价格分别为 1／3／7／14 💰。每厂只存兼容燃料，最多为一次需求的两倍。Hybrid（🟤⚫，混合厂）混合储存煤油，共享容量。Clean energy（🌿，清洁电厂）无需燃料。公司燃料可在兼容电厂之间自由分配。</p>
    <h3>4 · 建设网络</h3><p>首城只付占位费。后续城市需支付最短线路费用加占位费：同城第一／二／三家公司分别 10／15／20 💰。可以经过未建或已满城市，线路可跨越多城；不能经过未启用区域，也不能重复占同一城。每次延伸重新计算连接费，不永久占有已用线路。可建任意多城，也可跳过。选城后可见线路与费用，Build 确认。</p>
    <h3>5 · 供电与收入</h3><p>选择要运行的电厂，每厂本轮最多一次，必须支付其完整燃料。混合厂的煤油合计达到需求即可。可少发或不发；按供电量和已有城市数中较小者领钱。0 城收入 10 💰。结算补货受供应堆实物数量限制。轮末所有人点击 Next Round 才继续。</p>
    <p>供电城市 → 收入 💰：${[10,22,33,44,54,64,73,82,90,98,105,112,118,124,129,134,138,142,145,148,150].map((n,i)=>`${i===20?"20+":i}→${n}`).join(" · ")}</p>
    <h3>Step 与电厂市场</h3><p>Step 1 每城最多一家。有人达到 Step 2 门槛时，完成整段建设后移除最低电厂并补一张，开放第二个位置。Step 1／2 的 8 张电厂分现货 4 张、未来 4 张；每轮无人买厂则淘汰最低，轮末最高厂沉底。编号不超过任何玩家网络城市数的市场电厂立即淘汰并补牌。</p>
    <p>抽到 Step 3 卡后洗混剩余牌库，下一阶段起进入 Step 3，移除最低厂和 Step 3 卡，不补这两张。若在拍卖中抽到，则先完成拍卖；若在建设中抽到，则先完成整段建设。Step 3 每城最多三家，6 张市场牌都能购买，轮末淘汰最低厂。</p>
    <h3>终局 🏁</h3><p>达到终局城市门槛时，所有人完成建设后直接比较现有电厂与燃料最多能供电的城市数。同分比较现金，再比已连接城市数，仍平则共享胜利。终局不额外领取收入。</p>
    <h3>操作</h3><p>地图可拖动或用 +／− 缩放，City list 可精确选城。点击空白或 Esc 取消未提交选择。Help 集中规则；Explain 后再点目标可解释，灰色按钮同样有效。静态图标电脑悬停、手机点击可查看 3 秒提示。本次包含经典德国地图，不采用 Recharged 折扣或扩展规则。</p>
    <p><a href="https://cs.uwaterloo.ca/~dtompkin/archive/dtlib/base/Power%20Grid.pdf" target="_blank" rel="noopener noreferrer">Classic rules · Rio Grande / 2F</a></p>`;

  function emptyFuel() { return Object.fromEntries(fuels.map(r => [r, 0])); }
  function node(tag, className, text) { const n=document.createElement(tag); if(className) n.className=className; if(text!=null)n.textContent=text; return n; }
  function text(id, value) { byId(id).textContent=value; }
  function explainable(n, key, message) { n.dataset.pgExplain=key; if(message){n.dataset.pgTip=message; n.tabIndex=0;} return n; }
  function button(label, fn, key, disabled=false, primary=false) {
    const n=node("button",primary?"pg-primary":"",label); n.type="button"; n.disabled=disabled;
    if(key)n.dataset.pgExplain=key; n.addEventListener("click",fn); return n;
  }
  function own() { return view?.players.find(p=>p.player_id===view.you); }
  function playerName(pid) { return view?.players.find(p=>p.player_id===pid)?.name || pid || "—"; }
  function playerColor(pid) { return colors[Math.max(0,view.players.findIndex(p=>p.player_id===pid))%colors.length]; }
  function can(kind) { return !!view?.legal_actions.includes(kind) && !pending && socket.connected; }
  function fuelText(values) { return fuels.filter(r=>values[r]).map(r=>`${icons[r]} ${values[r]}`).join("  ") || "🌿 No fuel"; }
  function storeable(plants, values) {
    const caps={...emptyFuel(),hybrid:0}; plants.forEach(p=>{if(p.intake)caps[p.resource]+=2*p.intake;});
    return values.garbage<=caps.garbage && values.uranium<=caps.uranium && Math.max(0,values.coal-caps.coal)+Math.max(0,values.oil-caps.oil)<=caps.hybrid;
  }
  function send(kind, fields={}) {
    if(explaining || !can(kind))return;
    const action={type:kind,round:view.round,...fields}; if(kind!=="next_round")action.revision=view.revision;
    pending=true; clearTimeout(pendingTimer); pendingTimer=setTimeout(releasePending,3500);
    renderAction(); renderReview(); sendAction(action);
  }
  function releasePending(){
    pending=false;clearTimeout(pendingTimer);
    if(view){renderMarket();renderFleet();renderAction();renderReview();}
  }
  function hideTip(){clearTimeout(tipTimer);tooltip.classList.add("hidden");}
  function showTip(target, auto=false){
    if(!target?.dataset.pgTip || explaining || dialog.open)return;
    clearTimeout(tipTimer);tooltip.textContent=target.dataset.pgTip;tooltip.classList.remove("hidden");
    const r=target.getBoundingClientRect(), t=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(12,Math.min(r.left,innerWidth-t.width-12))}px`;
    tooltip.style.top=`${r.bottom+t.height+18<innerHeight?r.bottom+7:Math.max(12,r.top-t.height-7)}px`;
    if(auto)tipTimer=setTimeout(hideTip,3000);
  }
  function setExplain(value){explaining=value;panel.classList.toggle("pg-explaining",value);byId("ExplainBtn").setAttribute("aria-pressed",String(value));hideTip();}
  function showDialog(title, content, html=false){
    previousFocus=document.activeElement;hideTip();text("DialogTitle",title);
    if(html)byId("DialogBody").innerHTML=content;else byId("DialogBody").replaceChildren(node("p","",content));
    if(!dialog.open)dialog.showModal();byId("DialogClose").focus();
  }
  function explain(target){const item=explanations[target?.dataset.pgExplain];if(!item)return;setExplain(false);showDialog(...item);}
  function setTab(tab){panel.dataset.tab=tab;byId("MapTab").setAttribute("aria-pressed",String(tab==="network"));byId("MarketTab").setAttribute("aria-pressed",String(tab==="market"));applyMapBox();}

  function plantCard(plant, source){
    const available=source==="market" ? plant.available && can("auction") : source==="fleet" && (can("power") || (can("replace") && plant.id!==view.new_plant));
    const selected=source==="market" ? selectedPlant===plant.id : view.phase==="replace" ? selectedPlant===plant.id : chosenPlants.includes(plant.id);
    const card=button("",()=>{
      if(source==="market"){selectedPlant=selectedPlant===plant.id?null:plant.id;bidValue=plant.id;}
      else if(view.phase==="replace"){
        selectedPlant=selectedPlant===plant.id?null:plant.id;keep=emptyFuel();
        if(selectedPlant){
          const remaining=own().plants.filter(p=>p.id!==selectedPlant);
          const priority=[...fuels].sort((a,b)=>(view.resources[b].prices[0]||9)-(view.resources[a].prices[0]||9));
          for(const r of priority){for(let i=0;i<own().resources[r];i++){keep[r]++;if(!storeable(remaining,keep)){keep[r]--;break;}}}
        }
      } else {chosenPlants=chosenPlants.includes(plant.id)?chosenPlants.filter(n=>n!==plant.id):[...chosenPlants,plant.id].sort((a,b)=>a-b);normalizeHybrid();}
      renderMarket();renderFleet();renderAction();
    },source==="market"?"market":view.phase==="replace"?"replace":"power");
    card.className=`pg-plant${selected?" is-selected":""}${source==="market"&&!plant.available?" is-future":""}${view.auction?.plant===plant.id?" is-auction":""}${!available?" is-unavailable":""}`;
    // Keep descriptive cards focusable. Their action still checks availability.
    card.setAttribute("aria-disabled",String(!available));card.setAttribute("aria-pressed",String(selected));
    card.dataset.plant=plant.id;card.dataset.source=source;
    card.dataset.pgTip=`🏭 #${plant.id} · ${names[plant.resource]}（${icons[plant.resource]}）×${plant.intake} → Power（⚡）${plant.output} cities${plant.available===false?" · Future market":""}`;
    card.setAttribute("aria-label",`Plant ${plant.id}, ${names[plant.resource]}, ${plant.intake} fuel, ${plant.output} cities${plant.available===false?", future market":""}`);
    card.addEventListener("click",e=>{if(!available){e.stopImmediatePropagation();showTip(card,true);}},true);
    card.style.setProperty("--fuel-color",shades[plant.resource]);
    const top=node("div","pg-plant-top");top.append(node("strong","pg-plant-number",String(plant.id).padStart(2,"0")),node("span","pg-plant-icon",plant.resource==="green"?"🌿":"🏭"));
    const bottom=node("div","pg-plant-bottom");bottom.append(node("span","",plant.intake?`${icons[plant.resource]} ${plant.intake}`:"🌿 0"),node("strong","",`⚡ ${plant.output}`));
    card.append(top,node("div","pg-plant-type",names[plant.resource]),bottom);return card;
  }
  function renderMarket(){
    const box=byId("Market");box.replaceChildren();
    view.market.forEach((p,i)=>{
      if(i===0 || (i===4 && view.step<3))box.append(node("div","pg-market-label",i===0?"CURRENT MARKET · AVAILABLE":"FUTURE MARKET"));
      box.append(plantCard(p,"market"));
    });
    text("Deck",`🂠 ${view.deck_count}`);
    byId("ResourceMarket").replaceChildren(...fuels.map(r=>{
      const resource=view.resources[r],tiers={};resource.prices.forEach(p=>{tiers[p]=(tiers[p]||0)+1;});
      const description=`${names[r]}（${icons[r]}）：${Object.entries(tiers).map(([price,count])=>`${price} 💰 × ${count}`).join(" · ")||"Sold out"}。每轮补充 ${resource.refill}，受供应堆余量限制。`;
      const tile=explainable(node("div","pg-resource-tile"),"resources",description);
      tile.append(node("span","",`${icons[r]} ${names[r]}`),node("strong","",`${resource.prices[0]??"—"} 💰`),node("small","",`${resource.count} left · +${resource.refill}`));return tile;
    }));
  }
  function renderFleet(){
    const player=own();byId("Fleet").replaceChildren(...(player?.plants || []).map(p=>plantCard(p,"fleet")));
    text("Fuel",player?fuelText(player.resources):"Spectator");
    byId("Fuel").dataset.pgTip="Fuel：公司拥有的资源可在兼容电厂间自动调配；每座最多储存两倍需求。";
  }
  function normalizeHybrid(){
    const options=view.dispatch_options.filter(o=>JSON.stringify(o.plants)===JSON.stringify(chosenPlants));
    if(options.length && !options.some(o=>o.hybrid_coal===hybridCoal))hybridCoal=options[0].hybrid_coal;
  }
  function stepper(container, value, max, update, key, label){
    const step=node("div","pg-stepper");
    const minus=button("−",()=>update(value-1),key,value<=0 || pending);minus.setAttribute("aria-label",`Decrease ${label}`);
    const plus=button("+",()=>update(value+1),key,value>=max || pending);plus.setAttribute("aria-label",`Increase ${label}`);
    const output=node("output","",value);output.setAttribute("aria-label",`${label} quantity`);
    step.append(minus,output,plus);container.append(step);
  }
  function renderResources(box, replacing=false){
    const values=replacing?keep:cart, player=own();
    fuels.forEach(r=>{
      const row=node("div","pg-resource-row"), label=node("label","",`${icons[r]} ${names[r]}`);
      const resource=view.resources[r];
      label.append(node("small","",replacing?`Owned ${player.resources[r]}`:`${resource.count} left · ${resource.prices[0]??"—"} 💰 each · +${resource.refill} / round`));
      row.append(explainable(label,replacing?"storage":"resources"));
      stepper(row,values[r],replacing?player.resources[r]:view.buy_limits[r],value=>{values[r]=value;renderAction();},replacing?"storage":"resources",names[r]);box.append(row);
    });
    if(replacing)return;
    const cost=fuels.reduce((s,r)=>s+view.resources[r].prices.slice(0,cart[r]).reduce((a,b)=>a+b,0),0);
    const stored=Object.fromEntries(fuels.map(r=>[r,player.resources[r]+cart[r]]));
    const fits=storeable(player.plants,stored), nonempty=Object.values(cart).some(Boolean), affordable=cost<=player.money;
    box.append(node("div",`pg-cost-preview${!fits||!affordable?" pg-warning":""}`,`${cost} 💰${!fits?" · Storage exceeded":!affordable?" · Not enough money":` · ${player.money-cost} remaining`}`));
    const actions=node("div","pg-inline-actions");actions.append(button("Buy Fuel",()=>send("buy_resources",{resources:{...cart}}),"resources",!can("buy_resources")||!fits||!nonempty||!affordable,true),button("Done",()=>send("done"),"done",!can("done")));box.append(actions);
  }
  function renderAction(){
    const box=byId("Action");box.replaceChildren();if(!view)return;
    const player=own(), active=view.current_turn===view.you;
    const labels={auction:"AUCTION DESK",resources:"BUY FUEL",building:"EXTEND YOUR NETWORK",bureaucracy:"POWER YOUR CITIES",replace:"RETIRE A PLANT",round_end:"ROUND COMPLETE",game_over:"FINAL NETWORKS"};
    text("ActionTitle",labels[view.phase]||"YOUR MOVE");text("ActionBadge",pending?"Sending…":active?"YOUR TURN":"");
    if(!player){box.append(node("p","pg-action-message","Watching this table."));return;}
    if(view.phase==="round_end" || view.game_over){box.append(node("p","pg-action-message",view.game_over?`🏆 ${view.winner_ids.map(playerName).join(" · ")}`:"Review this round below, then choose Next Round."));return;}
    if(view.auction)box.append(node("p","pg-action-message",`🔨 #${view.auction.plant} · ${view.auction.bid} 💰 · ${playerName(view.auction.leader)} leads`));
    if(!active){box.append(node("p","pg-action-message",`Waiting for ${playerName(view.current_turn)}.`));return;}
    if(view.phase==="auction"){
      const auction=view.auction, minimum=auction?auction.bid+1:selectedPlant;
      if(!auction)box.append(node("p","pg-action-message",selectedPlant?`Plant #${selectedPlant} · minimum ${selectedPlant} 💰`:"Choose a plant from the current market."));
      const row=node("div","pg-inline-actions");
      if(minimum!=null){
        const input=node("input");input.type="number";input.id="powerGridBid";input.min=minimum;input.max=player.money;input.step="1";input.value=Math.max(minimum,bidValue||0);input.disabled=pending;
        const label=node("label","","Bid 💰");label.htmlFor=input.id;label.append(input);row.append(label);
        const submit=button(auction?"Raise Bid":"Start Auction",()=>send(auction?"bid":"auction",auction?{amount:Number(input.value)}:{plant:selectedPlant,amount:Number(input.value)}),"auction",false,true);
        const update=()=>{bidValue=Number(input.value);submit.disabled=!can(auction?"bid":"auction") || !Number.isInteger(bidValue) || bidValue<minimum || bidValue>player.money;};
        input.addEventListener("input",update);update();row.append(submit);
      }
      row.append(button("Pass",()=>send("pass"),"auction",!can("pass")));box.append(row);
    }else if(view.phase==="resources")renderResources(box);
    else if(view.phase==="building"){
      const quote=view.build_quotes.find(q=>q.city===selectedCity), city=view.cities.find(c=>c.id===selectedCity);
      box.append(node("p","pg-action-message",city?`${city.name} · ${quote?`${quote.house} 🏠 + ${quote.connection} 🔗 = ${quote.cost} 💰`:"Unavailable"}`:"Choose a city on the map or in City list."));
      if(quote)box.append(node("div","pg-resource-summary",quote.path.map(c=>view.cities.find(x=>x.id===c)?.name).join(" → ")));
      const row=node("div","pg-inline-actions");row.append(button("Build",()=>send("build",{city:selectedCity}),"network",!can("build")||!quote?.affordable,true),button("Done",()=>send("done"),"done",!can("done")));box.append(row);
    }else if(view.phase==="replace"){
      box.append(node("p","pg-action-message",`Choose an old plant below to retire. New plant #${view.new_plant} stays.`));
      if(selectedPlant){
        box.append(node("p","pg-action-message",`Retire #${selectedPlant} · keep these resources:`));renderResources(box,true);
        const fits=storeable(player.plants.filter(p=>p.id!==selectedPlant),keep);
        box.append(button(`Retire #${selectedPlant}`,()=>send("replace",{plant:selectedPlant,resources:{...keep}}),"replace",!can("replace")||!fits,true));
        if(!fits)box.append(node("p","pg-warning pg-action-message","Reduce fuel to fit your remaining plants."));
      }
    }else if(view.phase==="bureaucracy"){
      box.append(node("p","pg-action-message","Select the plants to run in Your Company below."));
      const hybrid=player.plants.filter(p=>chosenPlants.includes(p.id)&&p.resource==="hybrid").reduce((s,p)=>s+p.intake,0);
      if(hybrid){const row=node("div","pg-resource-row");row.append(node("label","",`Hybrid · 🟤 ${hybridCoal} + ⚫ ${hybrid-hybridCoal}`));stepper(row,hybridCoal,hybrid,value=>{hybridCoal=value;renderAction();},"power","hybrid coal");box.append(row);}
      const option=view.dispatch_options.find(o=>JSON.stringify(o.plants)===JSON.stringify(chosenPlants)&&o.hybrid_coal===hybridCoal);
      box.append(node("div",`pg-cost-preview${option?"":" pg-warning"}`,option?`${fuelText(option.fuel)} → ⚡ ${option.powered} cities · +${option.income} 💰`:"Not enough fuel for this selection."));
      const row=node("div","pg-inline-actions");
      row.append(button(chosenPlants.length?"Run Plants":"Take 10 💰",()=>send("power",{plants:chosenPlants,hybrid_coal:hybridCoal}),"power",!can("power")||!option,true));
      row.append(button("Best Output",()=>{const best=[...view.dispatch_options].sort((a,b)=>b.powered-a.powered || Object.values(a.fuel).reduce((s,n)=>s+n,0)-Object.values(b.fuel).reduce((s,n)=>s+n,0))[0];chosenPlants=[...best.plants];hybridCoal=best.hybrid_coal;renderFleet();renderAction();},"power",!can("power")));box.append(row);
    }
  }

  function svg(tag, attrs={}, value){const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(value!=null)n.textContent=value;return n;}
  function applyMapBox(){
    if(!mapBox)return;
    const map=byId("Map");map.setAttribute("viewBox",`${mapBox.x} ${mapBox.y} ${mapBox.w} ${mapBox.h}`);
    const rect=map.getBoundingClientRect(),scale=Math.min(rect.width/mapBox.w,rect.height/mapBox.h);
    if(!scale)return;
    map.querySelectorAll(".pg-city-ring").forEach(n=>n.setAttribute("r",Math.max(21,9/scale)));
    map.querySelectorAll(".pg-city-number").forEach(n=>{n.style.fontSize=`${Math.max(21,10/scale)}px`;n.setAttribute("y",3.5/scale);});
    const detailed=(rect.width>=450 && scale>=.32)||scale>=.65;
    map.querySelectorAll(".pg-city-name").forEach(n=>{n.style.display=detailed?"":"none";n.style.fontSize=`${Math.max(24,10/scale)}px`;});
    map.querySelectorAll(".pg-edge-label").forEach(n=>{n.style.display=detailed?"":"none";});
  }
  function fitMap(){mapBox={...mapBounds};applyMapBox();}
  function zoom(factor){if(!mapBox)return;const w=Math.max(mapBounds.w/4,Math.min(mapBounds.w,mapBox.w*factor)), h=mapBounds.h*w/mapBounds.w;mapBox={x:mapBox.x+(mapBox.w-w)/2,y:mapBox.y+(mapBox.h-h)/2,w,h};clampMap();applyMapBox();}
  function clampMap(){mapBox.x=Math.max(mapBounds.x,Math.min(mapBounds.x+mapBounds.w-mapBox.w,mapBox.x));mapBox.y=Math.max(mapBounds.y,Math.min(mapBounds.y+mapBounds.h-mapBox.h,mapBox.y));}
  function selectCity(id){selectedCity=selectedCity===id?null:id;renderMap();renderAction();}
  function renderMap(){
    const map=byId("Map"), previousScroll=byId("Cities").scrollTop;map.replaceChildren();
    const key=view.cities.map(c=>c.id).join("|");
    if(key!==mapKey){
      const xs=view.cities.map(c=>c.x*1.6),ys=view.cities.map(c=>c.y);
      mapBounds={x:Math.min(...xs)-65,y:Math.min(...ys)-45,w:Math.max(...xs)-Math.min(...xs)+150,h:Math.max(...ys)-Math.min(...ys)+110};
      mapKey=key;fitMap();
    }
    const cityById=Object.fromEntries(view.cities.map(c=>[c.id,{...c,x:c.x*1.6}]));
    const path=view.build_quotes.find(q=>q.city===selectedCity)?.path||[];
    for(const edge of view.edges){
      const a=cityById[edge.a],b=cityById[edge.b];
      const highlighted=path.some((c,i)=>i && ((path[i-1]===a.id && c===b.id)||(path[i-1]===b.id && c===a.id)));
      map.append(svg("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:`pg-edge${highlighted?" is-path":""}`}));
      map.append(svg("text",{x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,class:"pg-edge-label"},edge.cost));
    }
    view.cities.forEach((original,index)=>{
      const c=cityById[original.id];
      const group=svg("g",{class:`pg-city${c.owners.includes(view.you)?" is-owned":""}${c.id===selectedCity?" is-selected":""}`,transform:`translate(${c.x} ${c.y})`,role:"button",tabindex:"0","aria-label":`${index+1}. ${c.name}, ${c.owners.length}/${view.step} companies`});
      group.dataset.city=c.id;group.dataset.pgExplain="network";
      const quote=view.build_quotes.find(q=>q.city===c.id);
      group.dataset.pgTip=`${index+1}. ${c.name} · ${c.owners.length}/${view.step} companies${quote?` · Build ${quote.cost} 💰`:""}`;
      group.append(svg("circle",{r:33,fill:view.region_colors[c.region],opacity:.22}),svg("circle",{r:21,class:"pg-city-ring"}),svg("text",{y:5,class:"pg-city-number"},index+1));
      group.append(svg("text",{y:42,class:"pg-city-name"},c.name));
      c.owners.forEach((pid,i)=>group.append(svg("circle",{cx:(i-(c.owners.length-1)/2)*15,cy:-26,r:7,fill:playerColor(pid),stroke:"#fffdf0","stroke-width":2})));
      group.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectCity(c.id);}});map.append(group);
    });
    applyMapBox();
    const legend=byId("MapLegend");legend.replaceChildren();
    view.config.regions.forEach(r=>{const n=node("span","",regionNames[r]),dot=node("i","pg-dot");dot.style.background=view.region_colors[r];n.prepend(dot);legend.append(n);});
    legend.append(explainable(node("span","","🔗 Costs · tap city numbers"),"network","🔗：每段线路费用；系统自动选最便宜路径。缩略图点数字查看城市名称，放大后显示名称与线路价格。"));
    const list=byId("Cities");list.replaceChildren();
    view.cities.forEach((c,i)=>{
      const q=view.build_quotes.find(x=>x.city===c.id), b=button("",()=>selectCity(c.id),"network");
      b.append(node("span","",`${i+1}. ${c.name}`),node("strong","",q?`${q.cost} 💰`:c.owners.includes(view.you)?"✓ Owned":"Full"));
      if(c.id===selectedCity)b.classList.add("pg-primary");list.append(b);
    });list.scrollTop=previousScroll;
  }
  function renderPlayers(){
    byId("Players").replaceChildren(...view.order.map((pid,i)=>{
      const p=view.players.find(x=>x.player_id===pid),card=node("article",`pg-player${pid===view.current_turn?" is-current":""}`);
      card.style.setProperty("--player-color",playerColor(pid));card.append(node("strong","",`${i+1}. ${p.name}${pid===view.you?" · You":""}${p.is_bot?" · Bot":""}`));
      card.append(explainable(node("span","",`🏠 ${p.cities.length} · ⚡ ${p.capacity} · 💰 ${p.money??"🔒"}`),"capacity","🏠 城市数；⚡ 电厂额定容量；💰 本人资金，🔒 隐藏。"));
      card.append(explainable(node("span","",`🏭 ${p.plants.map(n=>`#${n.id}`).join(" · ")||"—"}`),"market",p.plants.map(n=>`#${n.id} ${names[n.resource]}（${icons[n.resource]}）×${n.intake} → ⚡ ${n.output}`).join("；")||"No power plants yet."));
      card.append(explainable(node("span","",fuelText(p.resources)),"storage","Coal（🟤）、Oil（⚫）、Garbage（🟡）、Uranium（🔴）为储存燃料。"));return card;
    }));
  }
  function renderReview(){
    const visible=view.phase==="round_end"||view.game_over;byId("Review").classList.toggle("hidden",!visible);if(!visible)return;
    text("ReviewTitle",view.game_over?"FINAL NETWORKS":"ROUND COMPLETE");text("Ready",view.game_over?"":`${view.next_ready.length} / ${view.players.length} ready`);
    const results=view.game_over?view.final_results:view.round_summary.players;
    byId("Results").replaceChildren(...results.map(r=>{const card=node("div","pg-result");card.append(node("strong","",`${view.winner_ids.includes(r.player_id)?"🏆 ":""}${playerName(r.player_id)}`));card.append(node("div","",view.game_over?`⚡ ${r.powered} · 🏠 ${r.cities} · 💰 ${r.money}`:`⚡ ${r.powered} · +${r.income} 💰`));return card;}));
    text("Refill",view.game_over?"Scored before final income.":`Restocked: ${fuelText(view.round_summary.refill)}`);
    byId("Next").classList.toggle("hidden",view.game_over);byId("Next").disabled=!can("next_round");text("Next",view.next_ready.includes(view.you)?"Ready ✓":"Next Round");
  }
  function render(){
    if(!view)return;const p=own();
    text("Round",`Round ${view.round} · Step ${view.step}${view.step3_pending?" → 3":""}`);text("Threshold",`🏁 ${view.end_threshold} cities · Step 2 at ${view.step2_threshold}`);
    text("Status",view.game_over?`🏆 ${view.winner_ids.map(playerName).join(" · ")}`:view.phase==="round_end"?"Round complete · waiting for everyone":view.current_turn===view.you?"Your turn":`${playerName(view.current_turn)} is playing`);
    byId("Phases").replaceChildren(...[["order","① Order"],["auction","② Auction"],["resources","③ Fuel"],["building","④ Build"],["bureaucracy","⑤ Power"]].map(([key,label])=>explainable(node("div",`pg-phase${view.phase===key||(view.phase==="replace"&&key==="auction")?" is-active":""}`,label),key==="order"?"order":"steps",key==="order"?explanations.order[1]:explanations.steps[1])));
    byId("Stats").replaceChildren(...[["💰 Elektro",p?.money??"—","money"],["🏠 Cities",p?.cities.length??"—","network"],["⚡ Capacity",p?.capacity??"—","capacity"],["🏭 Plants",p?`${p.plants.length}/${view.plant_limit}`:"—","storage"]].map(([label,value,key])=>{const n=explainable(node("div","pg-stat"),key,explanations[key][1]);n.append(node("span","",label),node("strong","",value));return n;}));
    renderMarket();renderFleet();renderMap();renderAction();renderPlayers();renderReview();
    const log=byId("Log"),scroll=log.scrollTop;log.replaceChildren(...[...view.log].reverse().map(row=>node("li","",`R${row.round} · ${row.text}`)));log.scrollTop=scroll;
  }

  byId("HelpBtn").addEventListener("click",()=>{setExplain(false);showDialog("Power Grid · Game Rules",help,true);});
  byId("ExplainBtn").addEventListener("click",()=>setExplain(!explaining));
  byId("DialogClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{if(previousFocus?.isConnected)previousFocus.focus();});
  dialog.addEventListener("click",e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  byId("Next").addEventListener("click",()=>send("next_round"));
  byId("MapTab").addEventListener("click",()=>setTab("network"));byId("MarketTab").addEventListener("click",()=>setTab("market"));
  byId("ZoomIn").addEventListener("click",()=>zoom(.7));byId("ZoomOut").addEventListener("click",()=>zoom(1.4));byId("Fit").addEventListener("click",fitMap);
  const map=byId("Map");
  map.addEventListener("pointerdown",e=>{
    if(explaining||!mapBox||drag)return;e.preventDefault();hideTip();
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,box:{...mapBox},city:e.target.closest("[data-city]")?.dataset.city,moved:false};
    map.setPointerCapture(e.pointerId);
  });
  map.addEventListener("pointermove",e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>6;if(!drag.moved)return;
    const rect=map.getBoundingClientRect(),scale=Math.max(drag.box.w/rect.width,drag.box.h/rect.height);
    mapBox={...drag.box,x:drag.box.x-dx*scale,y:drag.box.y-dy*scale};clampMap();applyMapBox();map.classList.add("is-dragging");
  });
  function finishDrag(e){
    if(!drag||drag.id!==e.pointerId)return;const ended=drag;drag=null;map.classList.remove("is-dragging");
    if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);
    if(e.type==="pointerup"&&!ended.moved){if(ended.city){selectCity(ended.city);showTip(map.querySelector(`[data-city="${ended.city}"]`),true);}else{selectedCity=null;renderMap();renderAction();}}
  }
  ["pointerup","pointercancel","lostpointercapture"].forEach(type=>map.addEventListener(type,finishDrag));
  map.addEventListener("wheel",e=>{if(!view)return;e.preventDefault();zoom(e.deltaY>0?1.15:.87);},{passive:false});
  const exempt=target=>target.closest("#powerGridHelpBtn,#powerGridExplainBtn,#powerGridDialog");
  document.addEventListener("pointerdown",e=>{
    suppressClick=false;if(!explaining||panel.classList.contains("hidden")||exempt(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();
    const target=e.target.closest("[data-pg-explain]")||[...panel.querySelectorAll("[data-pg-explain]")].reverse().find(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;});
    suppressClick=true;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppressClick=false;},750);explain(target);
  },true);
  document.addEventListener("click",e=>{
    if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();return;}
    if(!explaining||panel.classList.contains("hidden")||exempt(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();explain(e.target.closest("[data-pg-explain]"));
  },true);
  function clearSelection(){selectedPlant=null;selectedCity=null;chosenPlants=[];hybridCoal=0;cart=emptyFuel();if(view){renderMarket();renderFleet();renderMap();renderAction();}}
  panel.addEventListener("click",e=>{
    const target=e.target.closest("[data-pg-tip]");if(target)showTip(target,true);else hideTip();
    if(!e.target.closest("button,input,label,summary,svg,[data-pg-tip],.pg-plant,.pg-resource-row"))clearSelection();
  });
  panel.addEventListener("pointerover",e=>{if(e.pointerType==="mouse")showTip(e.target.closest("[data-pg-tip]"));});
  panel.addEventListener("pointerout",e=>{if(e.pointerType==="mouse")hideTip();});
  panel.addEventListener("focusin",e=>showTip(e.target.closest("[data-pg-tip]")));panel.addEventListener("focusout",hideTip);
  document.addEventListener("keydown",e=>{
    if(panel.classList.contains("hidden"))return;
    if(e.key==="Escape"){setExplain(false);hideTip();if(!dialog.open)clearSelection();}
    if(!explaining||exempt(e.target)||!["Enter"," "].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();explain(e.target.closest("[data-pg-explain]"));
  },true);
  document.addEventListener("scroll",hideTip,true);window.addEventListener("resize",()=>{hideTip();applyMapBox();});window.addEventListener("blur",hideTip);

  const regionBox=byId("RegionChoices");
  Object.entries(regionNames).forEach(([key,label])=>{const row=node("label","",label),input=node("input");input.type="checkbox";input.value=key;input.checked=["north","west","southwest"].includes(key);row.prepend(input);regionBox.append(row);});
  byId("AutoRegions").addEventListener("change",()=>regionBox.classList.toggle("hidden",byId("AutoRegions").checked));
  function syncConfig(state){
    const visible=state?.game_type==="power_grid"&&state.status==="lobby";byId("ConfigBox").classList.toggle("hidden",!visible);byId("ConfigBox").setAttribute("aria-hidden",String(!visible));
    if(state?.game_type!=="power_grid")return;
    if(visible){
      const count=state.players?.length||2;const required=count<=3?3:count===4?4:5;text("ConfigHint",`Classic Germany · ${required} connected regions for ${count} players`);
      const sig=JSON.stringify([state.room_id,state.game_config]);
      if(sig!==configSignature){const selected=state.game_config?.regions||[];byId("AutoRegions").checked=!selected.length;regionBox.classList.toggle("hidden",!selected.length);if(selected.length)regionBox.querySelectorAll("input").forEach(n=>{n.checked=selected.includes(n.value);});configSignature=sig;}
      if(view)clearState();
    }
  }
  function clearState(){
    view=null;signature="";phaseSignature="";pending=false;selectedPlant=null;selectedCity=null;chosenPlants=[];cart=emptyFuel();mapKey="";drag=null;
    clearTimeout(pendingTimer);clearTimeout(suppressTimer);suppressClick=false;setExplain(false);if(dialog.open)dialog.close();
    ["Action","Market","ResourceMarket","Fleet","Players","Stats","Map","Cities","Log","Results","Phases"].forEach(id=>byId(id).replaceChildren());byId("Review").classList.add("hidden");text("Status","Waiting to start");
  }
  window.getPowerGridConfig=()=>view&&currentRoomState?.status!=="lobby"?{...view.config}:{regions:byId("AutoRegions").checked?[]:[...regionBox.querySelectorAll("input:checked")].map(n=>n.value)};
  window.renderPowerGridGameState=data=>{
    if(data?.view?.game_id!=="power_grid"||currentGameType!=="power_grid"||(data.room_id&&currentRoomState?.room_id!==data.room_id))return;
    const next=data.view,nextSignature=JSON.stringify([data.room_id,next.round,next.revision,next.phase,next.current_turn,next.you]);
    if(nextSignature!==signature){pending=false;clearTimeout(pendingTimer);hideTip();cart=emptyFuel();}
    const phase=JSON.stringify([data.room_id,next.round,next.phase,next.current_turn,next.you]);
    if(phase!==phaseSignature){selectedPlant=null;selectedCity=null;chosenPlants=[];hybridCoal=0;bidValue=0;setTab(next.phase==="building"?"network":"market");}
    if(next.players.find(p=>p.player_id===next.you)?.cities.includes(selectedCity))selectedCity=null;
    signature=nextSignature;phaseSignature=phase;view=next;render();
  };
  window.showPowerGridHeaderActions=visible=>{byId("HeaderActions").style.display=visible?"flex":"none";if(!visible){clearState();byId("ConfigBox").classList.add("hidden");}else if(typeof currentRoomState!=="undefined")syncConfig(currentRoomState);};
  function sync(){
    socket.on("room:state",syncConfig);
    socket.on("system:error",releasePending);
    socket.on("disconnect",()=>{releasePending();hideTip();});
    socket.on("connect",releasePending);
    if(typeof currentRoomState!=="undefined")syncConfig(currentRoomState);
    if(typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="power_grid")window.renderPowerGridGameState(lastGameStatePayload);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();
