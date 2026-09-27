// Run with a local server on 8875. PLAYWRIGHT_MODULE, PYTHON, ROOM_TEST_URL may override installed runtimes.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8875';
const out = path.resolve('build/dune-imperium');
fs.mkdirSync(out, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy,json
from tests.test_dune_imperium import playing,give,intrigue,act,settle
from game.dune_imperium import DuneImperiumGame as G,_resolve_combat,_queue
from game.dune_imperium_data import effect
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
    const context=await browser.newContext({viewport:{width:1280,height:980},...options});
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
      await p.locator(`#duneImperiumRoot [data-di-action="move"][data-index="${index}"]`).first().click();
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
    }
    for(const width of [1280,768,393,320]) {
      await a.setViewportSize({width,height:980});
      await bounds(a,`${width}px leaders`);
      await a.screenshot({path:path.join(out,`leaders-${width}.png`),fullPage:true});
    }
    await a.setViewportSize({width:1280,height:980});
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
        await p.locator('#duneImperiumExplain').click();
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
    for(const width of [1280,768,393,320]) {
      await a.setViewportSize({width,height:980});
      await bounds(a,`${width}px board`);
      await a.screenshot({path:path.join(out,`${width}.png`),fullPage:true});
      await a.locator('[data-di-action="tab"][data-tab="market"]').click();
      await bounds(a,`${width}px market`);
      await a.locator('[data-di-action="tab"][data-tab="board"]').click();
      if(width<=700)for(const region of ['factions','landsraad','city','spice']) {
        await a.locator(`[data-di-action="region"][data-region="${region}"]`).click();
        await bounds(a,`${width}px ${region}`);
      }
    }
    await a.setViewportSize({width:1280,height:980});
    await a.locator('#duneImperiumHelp').click();await bounds(a,'Help');
    assert(await a.locator('#duneImperiumDialog').evaluate(e=>e.open));
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#duneImperiumDialog').evaluate(e=>e.open),false);
    const card=fixtures.turn.moves.find(m=>m.type==='agent').card;
    await a.locator(`[data-di-action="card"][data-card="${card}"]`).first().click();
    const disabled=a.locator('[data-di-action="space"]:disabled').first();
    await disabled.scrollIntoViewIfNeeded();
    await a.locator('#duneImperiumExplain').click();
    await disabled.scrollIntoViewIfNeeded();
    const r=await disabled.boundingBox();await a.mouse.click(r.x+r.width/2,r.y+r.height/2);
    assert(await a.locator('#duneImperiumDialog').evaluate(e=>e.open),'disabled Explain');
    assert.equal(await a.locator('#duneImperiumExplain').getAttribute('aria-pressed'),'false');
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
    await fixture(a,'reveal');
    await a.locator('[data-di-action="tab"][data-tab="market"]').click();
    const buy=fixtures.reveal.moves.find(m=>m.type==='buy'&&m.top);
    await a.locator(`[data-di-action="card"][data-card="${buy.card}"]`).first().click();
    await a.locator('#duneImperiumDestination').selectOption('top');
    assert((await a.locator('.di-confirm').innerText()).includes('Top of deck'));
    await fixture(a,'review');await bounds(a,'round review');
    assert.equal(await a.locator('.di-result-row').count(),4);
    await fixture(a,'over');await bounds(a,'final result');
    await a.screenshot({path:path.join(out,'result.png'),fullPage:true});
    await fixture(a,'spectator');
    assert.equal(await a.locator('[data-di-action="move"]').count(),0);
    const mobile=await page({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    await mobile.evaluate(async()=>{await ensureGameAssets('dune_imperium');document.body.append(document.getElementById('duneImperiumPanel'));document.body.append(document.getElementById('duneImperiumHeaderActions'));document.getElementById('duneImperiumPanel').classList.remove('hidden');});
    await fixture(mobile,'turn');
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
    assert.deepEqual(errors,[]);
    console.log('Dune: Imperium browser checks passed: real room, leader draft, agent placement, effects, reveal, combat, all-player round barrier, four viewports, Help, disabled Explain, Esc, card choice, topdeck, review, results, spectator and touch tips.');
  } finally {
    for(const p of pages)await p.evaluate(()=>{if(typeof socket!=='undefined')socket.emit('room:leave',{});}).catch(()=>{});
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
