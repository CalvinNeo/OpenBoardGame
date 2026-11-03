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
from game.dune_imperium import DuneImperiumGame as G,_resolve_combat,_queue
from game.dune_imperium_data import CARDS,effect
s=playing(4,leaders=['baron','paul','leto','helena'])
s['players']['0'].update(solari=10,spice=6,water=3)
s['players']['3']['name']='VeryLongPlayerNameForResponsiveLayoutTesting'
for k in ['kwisatz_haderach','guild_bankers','fremen_camp','sietch_mother','lady_jessica']: give(s,'0',k)
for k in ['ambush','water_of_life','rapid_mobilization']: intrigue(s,'0',k)
s['revision']=100
v={'turn':G.get_public_view(s,'0'),'spectator':G.get_public_view(s,'watcher')}
choice=copy.deepcopy(s)
_queue(choice,'0',[effect('trash')]);act(choice,'0',{'type':'resolve','index':0})
choice['revision']=101;v['choice']=G.get_public_view(choice,'0')
long_choice=copy.deepcopy(s)
for kind in CARDS: give(long_choice,'0',kind)
_queue(long_choice,'0',[effect('trash')]);act(long_choice,'0',{'type':'resolve','index':0})
long_choice['revision']=105;v['long_choice']=G.get_public_view(long_choice,'0')
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
      await p.locator(`[data-di-action="space"][data-space="${m.space}"]`).click();
    } else {
      const index=await p.evaluate(m=>lastGameStatePayload.view.moves.findIndex(x=>JSON.stringify(x)===JSON.stringify(m)),m);
      const rev=await p.evaluate(()=>lastGameStatePayload.view.revision);
      await p.locator(`#duneImperiumRoot [data-di-action="move"][data-index="${index}"]`).first().click();
      if(['next_round','pass','end_turn','endgame_done'].includes(m.type)) {
        await p.waitForFunction(r=>lastGameStatePayload.view.revision>r,rev);
        assert.equal(await p.locator('#duneImperiumRoot [data-di-action="confirm"]').count(),0,`${m.type} submits without an extra confirmation`);
        return;
      }
    }
    await confirm(p);
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
    await p.evaluate(v=>{window.showDuneImperiumHeaderActions(true);window.renderDuneImperiumGameState({view:v});},fixtures[key]);
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
    let agentPlayed=false;
    for(let i=0;i<100;i++) {
      const snapshot=await a.evaluate(()=>({phase:lastGameStatePayload.view.phase,pid:lastGameStatePayload.view.choice?.owner||lastGameStatePayload.view.current_turn,revision:lastGameStatePayload.view.revision}));
      if(snapshot.phase==='round_end')break;
      const p=seatPages[snapshot.pid];
      await p.waitForFunction(r=>lastGameStatePayload.view.revision>=r,snapshot.revision);
      const m=await p.evaluate(agentPlayed=>{
        const ms=lastGameStatePayload.view.moves;
        return ms.find(m=>m.type==='choose')||ms.find(m=>m.type==='resolve')||(!agentPlayed&&ms.find(m=>m.type==='agent'))||ms.find(m=>m.type==='reveal')||ms.find(m=>['end_turn','pass'].includes(m.type));
      },agentPlayed);
      assert(m,'there must be a next visible move');
      await move(p,m);if(m.type==='agent')agentPlayed=true;
      await a.waitForFunction(r=>lastGameStatePayload.view.revision>r,snapshot.revision);
    }
    assert(agentPlayed);
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.phase),'round_end');
    await move(a,{type:'next_round'});
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.round),1,'wait for all people');
    await move(b,{type:'next_round'});
    await a.waitForFunction(()=>lastGameStatePayload.view.round===2);
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
    await lastChoice.click();
    assert(Math.abs(await choiceList.evaluate(e=>e.scrollTop)-choiceScroll)<=2,'selecting an option preserves the choice list scroll position');
    assert.equal(await a.locator('[data-di-action="confirm"]').count(),1);
    await a.keyboard.press('Escape');
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
    assert(await mobile.locator('.di-space.di-available:visible').count(),'legal destinations stay visible');
    await bounds(mobile,'mobile selected card');
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
    await mobile.locator('#duneImperiumExplainBtn').tap();
    await touchChoices.evaluate(e=>{e.scrollTop=0;});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});
    for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-step*22,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForTimeout(200);
    assert.equal(await mobile.locator('#duneImperiumDialog').evaluate(e=>e.open),false,'Explain does not treat touch scrolling as a click');
    assert.equal(await mobile.locator('#duneImperiumExplainBtn').getAttribute('aria-pressed'),'true','touch scrolling keeps Explain mode active');
    assert.equal(await mobile.locator('[data-di-action="confirm"]').count(),0);
    await mobile.keyboard.press('Escape');
    await cdp.detach();
    assert.deepEqual(errors,[]);
    console.log('Dune: Imperium browser checks passed: real room, leader draft, agent placement, effects, reveal, combat, direct round confirmation, 320/390/1024/1440px, header row, Help, disabled Explain, Esc, inline market/reserve purchase confirmation, choice scroll retention, touch scrolling, review, results, spectator and touch tips.');
  } finally {
    for(const p of pages)await p.evaluate(()=>{if(typeof socket!=='undefined')socket.emit('room:leave',{});}).catch(()=>{});
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
