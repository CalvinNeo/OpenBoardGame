// Run with a local server on 8875. PLAYWRIGHT_MODULE, PYTHON, ROOM_TEST_URL may override installed runtimes.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8875';
const out = path.resolve('build/dune-imperium');
const viewports = [320, 390, 1024, 1440];
fs.mkdirSync(out, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy,json
from tests.test_dune_imperium import playing,give,intrigue,act,settle
from game.dune_imperium import DuneImperiumGame as G,_resolve_combat,_prompt
from game.dune_imperium_data import CARDS,effect
s=playing(4,leaders=['baron','paul','leto','helena'])
s['players']['0'].update(solari=10,spice=6,water=3)
s['players']['3']['name']='VeryLongPlayerNameForResponsiveLayoutTesting'
for k in ['kwisatz_haderach','guild_bankers','fremen_camp','sietch_mother','lady_jessica']: give(s,'0',k)
for k in ['ambush','water_of_life','rapid_mobilization']: intrigue(s,'0',k)
s['revision']=100
v={'turn':G.get_public_view(s,'0'),'spectator':G.get_public_view(s,'watcher')}
choice=copy.deepcopy(s)
source=next(uid for uid in choice['players']['0']['hand'] if choice['cards'][uid]=='sietch_mother')
_prompt(choice,dict(effect('trash'),owner='0',source=source),[None]+choice['players']['0']['hand'])
choice['revision']=101;v['choice']=G.get_public_view(choice,'0')
long_choice=copy.deepcopy(s)
for kind in CARDS: give(long_choice,'0',kind)
_prompt(long_choice,dict(effect('trash'),owner='0',source=source),[None]+long_choice['players']['0']['hand'])
long_choice['revision']=105;v['long_choice']=G.get_public_view(long_choice,'0')
starter=playing(4)
act(starter,'0',{'type':'reveal'})
starter['revision']=106;v['starter_reveal']=G.get_public_view(starter,'0')
deployment=playing(4)
uid=give(deployment,'0','reconnaissance')
act(deployment,'0',next(m for m in G.get_public_view(deployment,'0')['moves'] if m.get('card')==uid and m.get('space')=='arrakeen'))
deployment['revision']=107;v['deployment']=G.get_public_view(deployment,'0')
payment=playing(4)
payment['players']['0']['water']=3
uid=give(payment,'0','duncan_idaho')
act(payment,'0',next(m for m in G.get_public_view(payment,'0')['moves'] if m.get('card')==uid and m.get('space')=='research_station'))
payment['revision']=110;v['payment_order']=G.get_public_view(payment,'0')
act(payment,'0',{'type':'resolve','index':0})
payment['revision']=108;v['payment']=G.get_public_view(payment,'0')
branch=playing(4)
give(branch,'0','bene_sister')
act(branch,'0',{'type':'reveal'})
branch['revision']=109;v['branch']=G.get_public_view(branch,'0')
mobile_turn=copy.deepcopy(s)
mobile_turn['revision']=113;v['mobile_turn']=G.get_public_view(mobile_turn,'0')
mobile_move=next(m for m in v['mobile_turn']['moves'] if m['type']=='agent')
act(mobile_turn,'0',mobile_move);settle(mobile_turn);act(mobile_turn,'0',{'type':'end_turn'})
mobile_turn['revision']=114;v['mobile_waiting']=G.get_public_view(mobile_turn,'0')
for _ in range(3):
    pid=mobile_turn['current_turn']
    act(mobile_turn,pid,{'type':'reveal'});settle(mobile_turn);act(mobile_turn,pid,{'type':'end_turn'})
assert mobile_turn['current_turn']=='0'
mobile_turn['revision']=115;v['mobile_return']=G.get_public_view(mobile_turn,'0')
reveal=copy.deepcopy(s);act(reveal,'0',{'type':'reveal'});settle(reveal)
reveal['players']['0'].update(persuasion=20,recruitment=True)
reveal['revision']=102;v['reveal']=G.get_public_view(reveal,'0')
review=copy.deepcopy(s)
_resolve_combat(review)
review['revision']=103;v['review']=G.get_public_view(review,'0')
review.update(game_over=True,phase='game_over',winner=['0'],standings=['0','1','2','3'],revision=104)
v['over']=G.get_public_view(review,'0')
print(json.dumps(v))
`], {encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}}));

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const pages=[], errors=[];
  async function page(options={}) {
    const context=await browser.newContext({viewport:{width:1440,height:980},...options});
    const p=await context.newPage(); pages.push(p);
    p.on('pageerror',e=>errors.push(e.message));
    await p.route('https://fonts.googleapis.com/**',r=>r.abort());
    await p.goto(base);
    await p.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected);
    return p;
  }
  async function confirm(p) {
    const rev=await p.evaluate(()=>lastGameStatePayload.view.revision);
    await p.locator('#duneImperiumRoot [data-di-action="confirm"]').click();
    await p.waitForFunction(r=>lastGameStatePayload.view.revision>r,rev);
  }
  async function move(p,m) {
    if(m.type==='leader') {
      const rev=await p.evaluate(()=>lastGameStatePayload.view.revision);
      await p.locator(`[data-di-action="leader"][data-leader="${m.leader}"]`).click();
      await p.waitForFunction(r=>lastGameStatePayload.view.revision>r,rev);
      assert.equal(await p.locator('[data-di-action="confirm"]').count(),0,'leader selection submits directly');
      return;
    }
    if(m.type==='agent') {
      await p.locator(`[data-di-action="card"][data-card="${m.card}"]`).first().click();
      assert.equal(await p.locator(`[data-di-action="card"][data-card="${m.card}"].di-selected`).count(),1,'a playable hand card can be selected on each agent turn');
      assert(await p.locator('.di-space.di-available').count(),'selecting a playable hand card highlights legal spaces');
      await p.locator(`[data-di-action="space"][data-space="${m.space}"]`).click();
      assert.equal(await p.locator('[data-di-action="confirm"]').count(),1,'agent placement retains one confirmation at the chosen space');
      await confirm(p);
    } else {
      const index=await p.evaluate(m=>lastGameStatePayload.view.moves.findIndex(x=>JSON.stringify(x)===JSON.stringify(m)),m);
      const rev=await p.evaluate(()=>lastGameStatePayload.view.revision);
      await p.locator(`#duneImperiumRoot [data-di-action="move"][data-index="${index}"]`).first().click();
      await p.waitForFunction(r=>lastGameStatePayload.view.revision>r,rev);
      assert.equal(await p.locator('#duneImperiumRoot [data-di-action="confirm"]').count(),0,`${m.type} submits without an extra confirmation`);
    }
  }
  async function bounds(p,label) {
    const result=await p.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('#duneImperiumRoot *,#duneImperiumDialog *')].filter(e=>{
        const r=e.getBoundingClientRect();
        return r.width>0&&r.height>0&&getComputedStyle(e).display!=='inline'&&e.tagName!=='SELECT'&&e.scrollWidth>e.clientWidth+2;
      }).map(e=>({tag:e.tagName,cls:e.className,w:e.clientWidth,scroll:e.scrollWidth,text:e.textContent.slice(0,55)})).slice(0,15)}));
    assert(result.body<=result.width,`${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.overflow,[],`${label}: component overflow ${JSON.stringify(result)}`);
  }
  async function headerRow(p,width) {
    const layout=await p.evaluate(()=>{
      const rect=selector=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,center:r.top+r.height/2};
      };
      return {title:rect('.game-panel-title h2'),reconnect:rect('#gameReconnectBtn'),help:rect('#duneImperiumHelp')};
    });
    assert(Math.abs(layout.title.center-layout.reconnect.center)<=2,`${width}px title and Reconnect stay on one row`);
    assert(Math.abs(layout.title.center-layout.help.center)<=2,`${width}px title and Help stay on one row`);
  }
  async function fixture(p,key) {
    await p.evaluate(v=>{
      window.diCapturedActions=[];
      window.sendAction=action=>window.diCapturedActions.push(action);
      window.clearDuneImperiumState();
      window.showDuneImperiumHeaderActions(true);
      window.renderDuneImperiumGameState({view:v});
    },fixtures[key]);
  }
  async function directFixtureMove(p,key,move) {
    await fixture(p,key);
    const index=fixtures[key].moves.findIndex(m=>JSON.stringify(m)===JSON.stringify(move));
    assert(index>=0,`${key} has the expected move`);
    await p.locator(`#duneImperiumRoot [data-di-action="move"][data-index="${index}"]`).first().click();
    assert.deepEqual(await p.evaluate(()=>window.diCapturedActions),[move],`${key} submits exactly once on the first click`);
    assert.equal(await p.locator('#duneImperiumRoot [data-di-action="confirm"]').count(),0,`${key} has no extra confirmation`);
  }
  async function placementGuide(p,label) {
    await p.waitForFunction(()=>{
      const guide=document.querySelector('#duneImperiumBoard .di-placement-guide');
      if(!guide)return false;
      const r=guide.getBoundingClientRect();
      return r.top>=0&&r.bottom<=innerHeight&&[...document.querySelectorAll('.di-space.di-available')].some(space=>{
        const s=space.getBoundingClientRect();
        return s.width>0&&s.height>0&&s.top>=0&&s.bottom<=innerHeight;
      });
    },null,{timeout:2500});
    assert((await p.locator('.di-placement-guide').innerText()).includes('available spaces'),`${label} names the legal destination count`);
    if(label==='mobile hand selection')await p.screenshot({path:path.join(out,'mobile-selected-card.png'),fullPage:false});
    assert(await p.locator('.di-space.di-available').count(),`${label} marks legal spaces`);
    assert(await p.locator('.di-space.di-available').first().innerText().then(text=>text.includes('Place agent')),`${label} gives legal spaces a clear placement label`);
    const legalPositions=await p.locator('.di-space.di-available').evaluateAll(spaces=>spaces.map(space=>{
      const r=space.getBoundingClientRect();
      return {space:space.dataset.space,width:r.width,height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight};
    }));
    assert(legalPositions.some(r=>r.width>0&&r.height>0&&r.bottom>0&&r.top<r.viewport),`${label} brings a legal destination into the viewport: ${JSON.stringify(legalPositions)}`);
  }
  try {
    const a=await page(), b=await page();
    assert.equal(await a.locator('#duneImperiumRoot').count(),0,'game assets must be lazy');
    await a.evaluate(()=>socket.emit('room:create',{name:'Arrakis',game_type:'dune_imperium',config:{seed:4}}));
    await a.waitForFunction(()=>currentRoomState?.game_type==='dune_imperium'&&isGameAssetsLoaded('dune_imperium'));
    const rid=await a.evaluate(()=>roomId);
    await b.evaluate(rid=>socket.emit('room:join',{name:'Caladan',room_id:rid}),rid);
    await b.waitForFunction(()=>currentRoomState?.players.length===2&&isGameAssetsLoaded('dune_imperium'));
    for(const p of [a,b])await p.evaluate(()=>socket.emit('room:ready',{ready:true}));
    await a.waitForFunction(()=>currentRoomState.players.every(p=>p.ready));
    await a.evaluate(()=>socket.emit('room:start',{}));
    await a.waitForFunction(()=>lastGameStatePayload?.view.phase==='leader');
    const seatPages={};
    for(const p of [a,b]) {
      await p.waitForFunction(()=>lastGameStatePayload?.view.phase==='leader');
      seatPages[await p.evaluate(()=>lastGameStatePayload.view.you)]=p;
      assert.equal(await p.locator('.di-leader-selection').count(),1,'one leader panel');
      assert.equal(await p.locator('[data-di-action="leader"]').count(),8,'each leader appears once');
      assert.equal(await p.locator('.di-side,.di-hand-section,.di-tabs,#duneImperiumActions').count(),0,'setup has no duplicate actions or empty hand');
      const legal=await p.evaluate(()=>lastGameStatePayload.view.moves.filter(m=>m.type==='leader').length);
      assert.equal(await p.locator('[data-di-action="leader"]:not(:disabled)').count(),legal,'only the current player can pick');
      assert.equal(
        await p.evaluate(() => document.body.classList.contains('dune-needs-action')),
        legal > 0,
        'Room Control action attention follows the current player'
      );
    }
    for(const width of viewports) {
      await a.setViewportSize({width,height:980});
      await headerRow(a,width);
      await bounds(a,`${width}px leaders`);
      await a.screenshot({path:path.join(out,`leaders-${width}.png`),fullPage:true});
    }
    await a.setViewportSize({width:1440,height:980});
    for(let i=0;i<2;i++){
      const pid=await a.evaluate(()=>lastGameStatePayload.view.current_turn);
      const p=seatPages[pid];
      await p.waitForFunction(pid=>lastGameStatePayload?.view.current_turn===pid,pid);
      if(i===1) {
        const taken=p.locator('.di-leader-taken');
        assert.equal(await taken.count(),1);
        assert(await taken.isDisabled(),'claimed leaders cannot be chosen again');
        assert((await taken.innerText()).includes('Selected by'));
        const rev=await p.evaluate(()=>lastGameStatePayload.view.revision);
        await p.locator('#duneImperiumExplainBtn').click();
        await taken.scrollIntoViewIfNeeded();
        const r=await taken.boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
        assert(await p.locator('#duneImperiumDialog').evaluate(e=>e.open),'claimed leaders support Explain');
        assert.equal(await p.evaluate(()=>lastGameStatePayload.view.revision),rev,'Explain must not select a leader');
        await p.keyboard.press('Escape');
      }
      await move(p,await p.evaluate(()=>lastGameStatePayload.view.moves.find(m=>m.type==='leader')));
      await a.waitForFunction(n=>lastGameStatePayload.view.revision>=n,i+1);
    }
    const agentCardsBySeat={};
    for(let i=0;i<100;i++) {
      const snapshot=await a.evaluate(()=>({phase:lastGameStatePayload.view.phase,pid:lastGameStatePayload.view.choice?.owner||lastGameStatePayload.view.current_turn,revision:lastGameStatePayload.view.revision}));
      if(snapshot.phase==='round_end')break;
      const p=seatPages[snapshot.pid];
      await p.waitForFunction(r=>lastGameStatePayload.view.revision>=r,snapshot.revision);
      const m=await p.evaluate(agentCount=>{
        const ms=lastGameStatePayload.view.moves;
        return ms.find(m=>m.type==='choose')||ms.find(m=>m.type==='resolve')||(agentCount<2&&ms.find(m=>m.type==='agent'))||ms.find(m=>m.type==='reveal')||ms.find(m=>['end_turn','pass'].includes(m.type));
      },(agentCardsBySeat[snapshot.pid]||[]).length);
      assert(m,'there must be a next visible move');
      await move(p,m);
      if(m.type==='agent') {
        agentCardsBySeat[snapshot.pid]??=[];
        assert(!agentCardsBySeat[snapshot.pid].includes(m.card),'later agent turns use another hand card');
        agentCardsBySeat[snapshot.pid].push(m.card);
      }
      await a.waitForFunction(r=>lastGameStatePayload.view.revision>r,snapshot.revision);
    }
    assert(Object.values(agentCardsBySeat).some(cards=>cards.length===2),'a player can return to a later turn and dispatch a second hand card');
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.phase),'round_end');
    await move(a,{type:'next_round'});
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.round),1,'wait for all people');
    await move(b,{type:'next_round'});
    await a.waitForFunction(()=>lastGameStatePayload.view.round===2);
    assert.deepEqual(fixtures.starter_reveal.effects,[],'ordinary revealed gains settle on the server');
    assert(!fixtures.starter_reveal.moves.some(m=>m.type==='resolve'),'ordinary revealed gains are never effect-order actions');
    await fixture(a,'starter_reveal');
    const ordinaryActions=await a.locator('#duneImperiumActions [data-di-action="move"]').allTextContents();
    assert(!ordinaryActions.some(text=>/^🗣️\s*[:：]?\s*\d/.test(text)),'Your turn has no raw persuasion gain buttons');
    assert(!ordinaryActions.some(text=>/^⚔️\s*[:：]?\s*\d/.test(text)),'Your turn has no raw sword gain buttons');
    await directFixtureMove(a,'turn',fixtures.turn.moves.find(m=>m.type==='reveal'));
    const intrigueMove=fixtures.turn.moves.find(m=>m.type==='intrigue');
    assert(intrigueMove,'the turn fixture has a playable intrigue');
    await directFixtureMove(a,'turn',intrigueMove);
    await fixture(a,'payment_order');
    assert.equal(await a.locator('#duneImperiumActions .di-effect-order h3').innerText(),'Choose effect order','necessary sequencing has an explicit heading');
    const effectOrderLabels=await a.locator('#duneImperiumActions [data-di-action="move"]').allTextContents();
    assert(effectOrderLabels.some(text=>text.includes(fixtures.payment_order.catalog.spaces.research_station.name)&&text.includes('抽牌')),'effect ordering identifies the board space and draw effect');
    assert(effectOrderLabels.some(text=>text.includes('邓肯·艾达荷')&&text.includes('水')),'effect ordering identifies the card and payment');
    await directFixtureMove(a,'payment_order',fixtures.payment_order.moves.find(m=>m.type==='resolve'));
    for(const [key,mode,source,title] of [
      ['deployment','deployment','厄拉金','部署'],
      ['payment','pay','邓肯·艾达荷','支付'],
      ['branch','choice','姐妹会成员','选择']
    ]) {
      if(key==='branch') {
        assert.equal(fixtures[key].effects[0].kind,mode,'the card branch remains pending alongside purchases');
        assert.deepEqual(fixtures[key].moves.filter(m=>m.type==='resolve').map(m=>m.choice),[0,1],'the card branches are direct legal actions');
        assert(fixtures[key].moves.some(m=>m.type==='buy'),'a direct card branch preserves the purchase timing window');
      }else assert.equal(fixtures[key].choice?.mode,mode,`${key} opens the actual decision directly`);
      assert(!fixtures[key].moves.some(m=>m.type==='resolve'&&!Object.hasOwn(m,'choice')),`${key} does not require selecting its effect first`);
      for(const width of viewports) {
        await a.setViewportSize({width,height:980});
        await fixture(a,key);
        assert((await a.locator('#duneImperiumActions h3').first().innerText()).includes(title),`${key} has a semantic decision heading`);
        if(key!=='branch')assert((await a.locator('#duneImperiumActions .di-choice-source').innerText()).includes(source),`${key} identifies its board/card source`);
        const labels=await a.locator('#duneImperiumActions [data-di-action="move"]').allTextContents();
        assert(!labels.some(text=>text==='Yes'),`${key} does not use an unexplained Yes button`);
        if(key==='payment')assert(labels.some(text=>text.includes('支付')&&text.includes('💧')),`${key} names the resource payment`);
        if(key==='branch')assert(labels.every(text=>text.includes(source)&&/说服力|剑/.test(text)),`${key} names the card source and each reward type`);
        if(key==='deployment'&&width===390) {
          await a.locator('[data-di-action="card"][data-location="hand"]').first().click();
          assert((await a.locator('#duneImperiumDialogBody').innerText()).includes('先完成“部署部队”'),'a blocked hand card explains the pending deployment before its details');
          assert.deepEqual(await a.evaluate(()=>window.diCapturedActions),[],'viewing a blocked hand card does not submit an action');
          await a.keyboard.press('Escape');
        }
        await bounds(a,`${width}px ${key} decision`);
        await a.screenshot({path:path.join(out,`${key}-${width}.png`),fullPage:true});
      }
      await directFixtureMove(a,key,fixtures[key].moves.filter(m=>m.type==='choose'||(m.type==='resolve'&&Object.hasOwn(m,'choice'))).at(-1));
    }
    await fixture(a,'turn');
    for(const width of viewports) {
      await a.setViewportSize({width,height:980});
      await headerRow(a,width);
      await bounds(a,`${width}px board`);
      await a.screenshot({path:path.join(out,`${width}.png`),fullPage:true});
      await a.locator('[data-di-action="tab"][data-tab="market"]').click();
      await bounds(a,`${width}px market`);
      await a.screenshot({path:path.join(out,`market-${width}.png`),fullPage:true});
      await a.locator('[data-di-action="tab"][data-tab="board"]').click();
      if(width<=700)for(const region of ['factions','landsraad','city','spice']) {
        await a.locator(`[data-di-action="region"][data-region="${region}"]`).click();
        await bounds(a,`${width}px ${region}`);
      }
    }
    await a.setViewportSize({width:1440,height:980});
    await a.locator('#duneImperiumHelp').click();await bounds(a,'Help');
    assert(await a.locator('#duneImperiumDialog').evaluate(e=>e.open));
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#duneImperiumDialog').evaluate(e=>e.open),false);
    const card=fixtures.turn.moves.find(m=>m.type==='agent').card;
    await a.locator(`[data-di-action="card"][data-card="${card}"]`).first().click();
    const disabled=a.locator('[data-di-action="space"]:disabled').first();
    await disabled.scrollIntoViewIfNeeded();
    await a.locator('#duneImperiumExplainBtn').click();
    await disabled.scrollIntoViewIfNeeded();
    const r=await disabled.boundingBox();await a.mouse.click(r.x+r.width/2,r.y+r.height/2);
    assert(await a.locator('#duneImperiumDialog').evaluate(e=>e.open),'disabled Explain');
    assert.equal(await a.locator('#duneImperiumExplainBtn').getAttribute('aria-pressed'),'false');
    await a.keyboard.press('Escape');
    await a.locator('[data-di-action="space"]:not(:disabled)').first().click();
    assert(await a.locator('[data-di-action="confirm"]').count());
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('[data-di-action="confirm"]').count(),0);
    await fixture(a,'choice');await bounds(a,'private card choice');
    await a.locator('[data-di-action="player"][data-player="1"]').click();
    assert((await a.locator('#duneImperiumDialogBody').innerText()).includes('Discard'));
    assert.equal(await a.locator('#duneImperiumDialogBody [data-location="hand"]').count(),0);
    await a.keyboard.press('Escape');
    const buy=fixtures.reveal.moves.find(m=>m.type==='buy'&&m.top);
    const reserveBuy=fixtures.reveal.moves.find(m=>m.type==='buy'&&m.top&&fixtures.reveal.cards[m.card]==='spice_must_flow');
    assert(reserveBuy,'the reserve fixture can buy The Spice Must Flow on top of the deck');
    for(const width of viewports) {
      await a.setViewportSize({width,height:980});
      await fixture(a,'reveal');
      await a.locator('[data-di-action="tab"][data-tab="market"]').click();
      const buyCard=a.locator(`[data-di-action="card"][data-card="${buy.card}"]`).first();
      await buyCard.scrollIntoViewIfNeeded();
      const beforeBuyScroll=await a.evaluate(()=>scrollY);
      await buyCard.click();
      const buySlot=a.locator('.di-card-slot').filter({has:a.locator(`[data-di-action="card"][data-card="${buy.card}"]`)}).first();
      assert.equal(await buySlot.locator('[data-di-action="confirm"]').count(),1,`${width}px purchase confirmation stays on the selected card`);
      assert.equal(await buySlot.locator('[data-di-action="cancel"]').count(),1,`${width}px purchase cancellation stays on the selected card`);
      assert.equal(await buySlot.locator('[data-di-action="confirm"]').innerText(),'Buy');
      assert(Math.abs(await a.evaluate(()=>scrollY)-beforeBuyScroll)<=2,`${width}px selecting a purchase does not move the page`);
      await a.locator('#duneImperiumDestination').selectOption('top');
      assert((await buySlot.locator('.di-confirm').innerText()).includes('Top of deck'));
      await bounds(a,`${width}px inline purchase`);
      await a.screenshot({path:path.join(out,`purchase-${width}.png`),fullPage:true});
      await buySlot.locator('[data-di-action="cancel"]').click();
      assert.equal(await a.locator('[data-di-action="confirm"]').count(),0,'Cancel clears the purchase');
      const reserveCard=a.locator(`[data-di-action="card"][data-card="${reserveBuy.card}"]`).first();
      await reserveCard.click();
      const reserveSlot=a.locator('.di-card-slot').filter({has:a.locator(`[data-di-action="card"][data-card="${reserveBuy.card}"]`)}).first();
      await reserveSlot.locator('#duneImperiumDestination').selectOption('top');
      const reserveConfirmation=reserveSlot.locator('.di-confirm');
      assert((await reserveConfirmation.innerText()).includes('Top of deck'));
      const confirmationSize=await reserveConfirmation.evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
      assert(confirmationSize.scroll<=confirmationSize.height+2,`${width}px reserve purchase shows Buy and Cancel without internal scrolling: ${JSON.stringify(confirmationSize)}`);
      assert.equal(await reserveSlot.locator('[data-di-action="confirm"]').innerText(),'Buy');
      assert.equal(await reserveSlot.locator('[data-di-action="cancel"]').innerText(),'Cancel');
      await bounds(a,`${width}px reserve purchase`);
      await a.screenshot({path:path.join(out,`reserve-purchase-${width}.png`),fullPage:true});
      await reserveSlot.locator('[data-di-action="cancel"]').click();
    }
    await a.setViewportSize({width:1440,height:980});
    await fixture(a,'long_choice');
    const choiceList=a.locator('#duneImperiumActions .di-actions').first();
    const lastChoice=choiceList.locator('[data-di-action="move"]').last();
    await lastChoice.scrollIntoViewIfNeeded();
    const choiceScroll=await choiceList.evaluate(e=>e.scrollTop);
    assert(choiceScroll>0,'the long choice list is scrolled before selection');
    const lastChoiceIndex=Number(await lastChoice.getAttribute('data-index'));
    await lastChoice.click();
    const updatedChoiceList=a.locator('#duneImperiumActions .di-actions').first();
    assert(Math.abs(await updatedChoiceList.evaluate(e=>e.scrollTop)-choiceScroll)<=2,'submitting an option preserves the choice list scroll position');
    assert.deepEqual(await a.evaluate(()=>window.diCapturedActions),[fixtures.long_choice.moves[lastChoiceIndex]],'a choice submits exactly once on the first click');
    assert.equal(await a.locator('[data-di-action="confirm"]').count(),0,'a choice has no extra confirmation');
    await fixture(a,'review');await bounds(a,'round review');
    assert.equal(await a.locator('.di-result-row').count(),4);
    await fixture(a,'over');await bounds(a,'final result');
    await a.screenshot({path:path.join(out,'result.png'),fullPage:true});
    await fixture(a,'spectator');
    assert.equal(await a.locator('[data-di-action="move"]').count(),0);
    assert.equal(
      await a.evaluate(() => document.body.classList.contains('dune-needs-action')),
      false,
      'spectator views do not mark Room Control as actionable'
    );
    const mobile=await page({viewport:{width:390,height:852},isMobile:true,hasTouch:true});
    await mobile.evaluate(async()=>{await ensureGameAssets('dune_imperium');setGamePanelVisibility('dune_imperium');setRoomControlsCollapsed(true);});
    await fixture(mobile,'turn');
    assert.equal(await mobile.locator('#mobileExplainSlot #duneImperiumExplainBtn').count(),1,'Explain stays available in the hidden Room Control');
    await mobile.locator('.di-token[data-di-tip]').first().tap();
    assert(await mobile.locator('#duneImperiumTip').isVisible());
    await mobile.waitForTimeout(3200);
    assert.equal(await mobile.locator('#duneImperiumTip').isVisible(),false);
    await bounds(mobile,'touch');
    const mobileCard=fixtures.turn.moves.find(m=>m.type==='agent').card;
    await mobile.locator(`[data-di-action="card"][data-card="${mobileCard}"]`).first().tap();
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),false,'mobile selection compacts the hand');
    await placementGuide(mobile,'mobile hand selection');
    assert(await mobile.locator('.di-space.di-available:visible').count(),'legal destinations stay visible');
    assert(await mobile.locator('.di-intrigues [data-di-action="move"]').first().isVisible(),'compacting the hand keeps playable intrigue cards visible');
    await bounds(mobile,'mobile selected card');
    await mobile.screenshot({path:path.join(out,'mobile-selected-card.png'),fullPage:false});
    await mobile.locator('[data-di-action="change-card"]').tap();
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),true,'Change card reopens the mobile hand');
    assert.equal(await mobile.locator('.di-placement-guide').count(),0,'Change card clears the selected placement');
    await mobile.waitForFunction(()=>{
      const r=document.querySelector('.di-hand-section summary').getBoundingClientRect();
      return r.top>=0&&r.bottom<=innerHeight;
    },null,{timeout:2500});
    await mobile.locator(`[data-di-action="card"][data-card="${mobileCard}"]`).first().tap();
    await placementGuide(mobile,'changing the mobile card');
    await mobile.locator('[data-di-action="change-card"]').tap();
    const factionOnlyCard=fixtures.turn.moves.find(m=>m.type==='agent'&&fixtures.turn.cards[m.card]==='sietch_mother')?.card;
    assert(factionOnlyCard,'the mobile fixture has a hand card restricted to Bene Gesserit and Fremen spaces');
    await mobile.locator(`[data-di-action="card"][data-card="${factionOnlyCard}"]`).first().tap();
    await placementGuide(mobile,'faction-only mobile hand selection');
    await mobile.screenshot({path:path.join(out,'mobile-selected-faction-card.png'),fullPage:false});
    await fixture(mobile,'mobile_turn');
    const firstMobileCard=fixtures.mobile_turn.moves.find(m=>m.type==='agent').card;
    await mobile.locator(`[data-di-action="card"][data-card="${firstMobileCard}"]`).first().tap();
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),false,'the first agent selection compacts the mobile hand');
    await mobile.evaluate(v=>window.renderDuneImperiumGameState({view:v}),fixtures.mobile_waiting);
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),false,'the compact hand stays compact while another player acts');
    await mobile.evaluate(v=>window.renderDuneImperiumGameState({view:v}),fixtures.mobile_return);
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),true,'the hand reopens when the next own agent turn becomes available');
    const secondMobileCard=fixtures.mobile_return.moves.find(m=>m.type==='agent'&&m.card!==firstMobileCard)?.card;
    assert(secondMobileCard,'another hand card can be played after other players act');
    await mobile.locator(`[data-di-action="card"][data-card="${secondMobileCard}"]`).first().tap();
    assert.equal(await mobile.locator(`[data-di-action="card"][data-card="${secondMobileCard}"].di-selected`).count(),1,'the later mobile turn accepts another hand card');
    await placementGuide(mobile,'later mobile agent turn');
    assert(await mobile.locator('.di-space.di-available:visible').count(),'the later mobile turn exposes legal destinations');
    await mobile.keyboard.press('Escape');
    assert.equal(await mobile.locator('.di-hand-section').evaluate(e=>e.open),true,'canceling an agent selection reopens the mobile hand');
    await mobile.locator(`[data-di-action="card"][data-card="${secondMobileCard}"]`).first().tap();
    const secondDestination=mobile.locator('.di-space.di-available:visible').first();
    const secondSpace=await secondDestination.getAttribute('data-space');
    await secondDestination.tap();
    await mobile.locator('[data-di-action="confirm"]').tap();
    const secondMobileMove=fixtures.mobile_return.moves.find(m=>m.type==='agent'&&m.card===secondMobileCard&&m.space===secondSpace);
    assert.deepEqual(await mobile.evaluate(()=>window.diCapturedActions),[secondMobileMove],'the later mobile turn submits the second hand card and its destination');
    await fixture(mobile,'long_choice');
    const touchChoices=mobile.locator('#duneImperiumActions .di-actions').first();
    await touchChoices.scrollIntoViewIfNeeded();
    const touchBox=await touchChoices.boundingBox();
    const cdp=await mobile.context().newCDPSession(mobile);
    const point={x:touchBox.x+touchBox.width/2,y:touchBox.y+Math.min(touchBox.height-18,260)};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-step*22,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForTimeout(200);
    assert(await touchChoices.evaluate(e=>e.scrollTop)>0,'touch movement scrolls the choice list');
    assert.equal(await mobile.locator('[data-di-action="confirm"]').count(),0,'scrolling a choice list does not select an option');
    assert.deepEqual(await mobile.evaluate(()=>window.diCapturedActions),[],'touch scrolling does not submit a choice');
    await mobile.locator('#duneImperiumExplainBtn').tap();
    await touchChoices.evaluate(e=>{e.scrollTop=0;});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-step*22,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForTimeout(200);
    assert.equal(await mobile.locator('#duneImperiumDialog').evaluate(e=>e.open),false,'Explain does not treat touch scrolling as a click');
    assert.equal(await mobile.locator('#duneImperiumExplainBtn').getAttribute('aria-pressed'),'true','touch scrolling keeps Explain mode active');
    assert.equal(await mobile.locator('[data-di-action="confirm"]').count(),0);
    assert.deepEqual(await mobile.evaluate(()=>window.diCapturedActions),[],'Explain scrolling does not submit a choice');
    await mobile.keyboard.press('Escape');
    await cdp.detach();
    assert.deepEqual(errors,[]);
    console.log('Dune: Imperium browser checks passed: real room, leader draft, consecutive agent turns, automatic revealed gains, semantic decision sources, direct reveal/intrigue/choice/effect-order/turn/round actions, combat, 320/390/1024/1440px, header row, Help, disabled Explain, Esc, inline market/reserve purchase confirmation, choice scroll retention, mobile hand reopening and second-card dispatch, visible intrigue cards, touch scrolling without submission, review, results, spectator and touch tips.');
  } finally {
    for(const p of pages)await p.evaluate(()=>{if(typeof socket!=='undefined')socket.emit('room:leave',{});}).catch(()=>{});
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
