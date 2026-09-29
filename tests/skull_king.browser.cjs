// ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON can point to local installations.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8135';
const output = 'build/skull-king-ui';
fs.mkdirSync(output, {recursive: true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy,json
from tests.test_skull_king import make_state,card,bid_all,action
from game.skull_king import SkullKingGame as G,_start_round,_begin_trick
s=make_state(8)
s['round_number']=10
_start_round(s)
s['player_meta']['p1']['name']='VeryLongUnbrokenCaptainNameToCheckEveryContainer'
s['player_meta']['p2']['name']='名字很长的船长验证手机布局不会重叠'
v={'bidding':G.get_public_view(s,'p0')}
bid_all(s)
_begin_trick(s,'p0')
s['players']['p0']['hand']=[card(x) for x in ['green_2','yellow_14','purple_3','black_14','escape_1','mermaid_1','tigress_1','skull_king_1']]
v['playing']=G.get_public_view(s,'p0')
s['current_turn']='p1'
v['waiting']=G.get_public_view(s,'p0')
v['spectator']=G.get_public_view(s,'visitor')
s['current_turn']='p0'
s['trick']=[{'player_id':'p7','card':card('green_10')}]
v['follow']=G.get_public_view(s,'p0')
s=make_state(4,'quick')
bid_all(s)
while s['phase']=='playing':
 p=s['current_turn'];a=G.bot_move(s,p);a.pop('delay_ms');G.apply_action(s,p,a)
v['trick_review']=G.get_public_view(s,'p0')
while s['phase']!='round_review':
 p=next(p for p in s['turn_order'] if G.get_legal_actions(s,p));a=G.bot_move(s,p);a.pop('delay_ms');G.apply_action(s,p,a)
v['round_review']=G.get_public_view(s,'p0')
G.apply_action(s,'p0',action(s,'next_round'))
v['ready']=G.get_public_view(s,'p0')
while not s['game_over']:
 p=next(p for p in s['turn_order'] if G.get_legal_actions(s,p));a=G.bot_move(s,p);a.pop('delay_ms');G.apply_action(s,p,a)
v['finished']=G.get_public_view(s,'p0')
s=make_state(2,'quick');bid_all(s)
v['ghost']=G.get_public_view(s,'p0')
s=make_state(7);s['round_number']=10;_start_round(s);bid_all(s);_begin_trick(s,'p0')
v['max_hand']=G.get_public_view(s,'p0')
s=make_state(2)
v['one_card']=G.get_public_view(s,'p0')
print(json.dumps(v))
`], {encoding:'utf8'}));

async function render(page, key) {
  await page.evaluate(view => {
    window.skullKingFixtureRevision = (window.skullKingFixtureRevision || 0) + 1;
    lastGameStatePayload = {room_id: roomId, game_type:'skull_king', view:{...view, revision: skullKingFixtureRevision}};
    renderSkullKingGameState(lastGameStatePayload);
  }, views[key]);
}
async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#skullKingPanel *, #skullKingDialog *, #skullKingHeaderActions *, #mobileExplainSlot *')].filter(el => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth+1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth+1 && !['hidden','auto'].includes(s.overflowX)));
    }).map(el=>`${el.id||el.className}: ${el.textContent.slice(0,50)} ${el.clientWidth}/${el.scrollWidth}`);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad};
  });
  assert(result.scroll<=result.width, `${label} page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label} container overflow`);
}
async function pointClick(page, locator, touch=false) {
  await locator.scrollIntoViewIfNeeded(); const r=await locator.boundingBox();
  if(touch) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
}
async function playVisibleCard(page) {
  await page.locator('#skullKingHand button:enabled').first().click();
  if (await page.locator('#skullKingPirate').isVisible()) await page.locator('#skullKingPirate').click();
  else await page.locator('#skullKingPlay').click();
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const contexts=[], errors=[];
  async function newPage() {
    const context=await browser.newContext({viewport:{width:1440,height:1050},hasTouch:true});contexts.push(context);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());
    await page.goto(base);await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
    return page;
  }
  try {
    const host=await newPage(), guest=await newPage();
    assert.equal(await host.locator('#skullKingPanel').evaluate(e=>e.children.length),0);
    assert.equal(await host.locator('script[src*="games/skull_king.js"]').count(),0);
    await host.evaluate(()=>socket.emit('room:create',{name:'Skull King QA',game_type:'skull_king'}));
    await host.waitForFunction(()=>currentGameType==='skull_king'&&isGameAssetsLoaded('skull_king'));
    assert.equal(await host.locator('#skullKingConfigBox').isVisible(),true);
    await host.locator('#skullKingSchedule').selectOption('quick');
    const rid=await host.evaluate(()=>roomId);
    await guest.evaluate(rid=>socket.emit('room:join',{room_id:rid,name:'Second Captain'}),rid);
    await guest.waitForFunction(()=>currentGameType==='skull_king'&&isGameAssetsLoaded('skull_king'));
    await host.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await host.waitForFunction(()=>currentRoomState.players.length===3);
    assert.equal(await host.locator('#skullKingSchedule').inputValue(),'quick');
    for(const p of [host,guest]) await p.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);await host.locator('#startBtn').click();
    for(const p of [host,guest]) await p.waitForFunction(()=>lastGameStatePayload?.view.phase==='bidding');
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.cards_dealt),5);
    assert.equal(await host.locator('#skullKingConfigBox').isVisible(),false);
    await host.locator('[data-bid="1"]').click();await host.locator('#skullKingConfirmBid').click();
    const hostPid=await host.evaluate(()=>playerId);
    await guest.waitForFunction(pid=>lastGameStatePayload.view.players.find(p=>p.player_id===pid).bid_locked,hostPid);
    assert.equal(await guest.evaluate(pid=>lastGameStatePayload.view.players.find(p=>p.player_id===pid).bid,hostPid),null);
    await guest.locator('[data-bid="0"]').click();await guest.locator('#skullKingConfirmBid').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.phase==='playing');
    // Play a complete round through two real browser sessions plus the server bot.
    for(let step=0;step<40;step++) {
      await host.waitForFunction(()=>lastGameStatePayload.view.phase!=='playing'||lastGameStatePayload.view.players.some(p=>p.player_id===lastGameStatePayload.view.current_turn&&!p.is_bot));
      const snapshot=await host.evaluate(()=>({phase:lastGameStatePayload.view.phase,turn:lastGameStatePayload.view.current_turn,revision:lastGameStatePayload.view.revision}));
      if(snapshot.phase==='round_review') break;
      if(snapshot.phase==='trick_review') {
        for(const p of [host,guest]) {
          await p.waitForFunction(()=>lastGameStatePayload.view.legal_actions.includes('next_trick'));
          await p.locator('#skullKingNext').click();
        }
        await host.waitForFunction(()=>lastGameStatePayload.view.phase!=='trick_review');
      } else {
        const p=snapshot.turn===hostPid?host:guest;
        await p.waitForFunction(()=>lastGameStatePayload.view.legal_actions.includes('play'));
        await playVisibleCard(p);
      }
      await host.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,snapshot.revision);
    }
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.phase),'round_review');
    assert.equal(await host.locator('#skullKingRoundSummary').isVisible(),true);
    await host.locator('#skullKingNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
    assert.equal(await host.locator('#skullKingNext').isDisabled(),true);
    assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.round_number),1);
    await guest.locator('#skullKingNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.round_number===2&&lastGameStatePayload.view.phase==='bidding');
    const credentials=await host.evaluate(()=>({room:roomId,pid:playerId}));
    await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('skull_king')&&lastGameStatePayload?.view.round_number===2);
    assert.deepEqual(await host.evaluate(()=>({room:roomId,pid:playerId})),credentials);
    assert.equal(await host.locator('#skullKingHand button').count(),5);
    await guest.close();
    await host.waitForFunction(()=>currentRoomState.players.some(p=>p.name==='Second Captain'&&!p.connected));
    await host.waitForFunction(()=>lastGameStatePayload.view.players.filter(p=>p.is_bot).every(p=>p.bid_locked));
    await host.evaluate(()=>{window.skullKingTestActions=[];sendAction=a=>skullKingTestActions.push(a);setRoomControlsCollapsed(true);});
    await render(host,'playing');await bounds(host,'desktop');
    await host.locator('#skullKingPanel').screenshot({path:`${output}/desktop.png`});
    await host.locator('#skullKingHelpBtn').click();
    assert.match(await host.locator('#skullKingDialogBody').textContent(),/美人鱼|灰胡子|Rascal/);
    await host.keyboard.press('Escape');assert.equal(await host.locator('#skullKingDialog').evaluate(e=>e.open),false);
    await host.locator('#skullKingExplainBtn').click();await host.locator('[data-card-id="skull_king_1"]').click();
    assert.match(await host.locator('#skullKingDialogBody').textContent(),/美人鱼/);
    assert.equal(await host.evaluate(()=>skullKingTestActions.length),0);await host.keyboard.press('Escape');
    await render(host,'follow');
    assert.equal(await host.locator('[data-card-id="black_14"]').isDisabled(),true);
    await host.locator('#skullKingExplainBtn').click();await pointClick(host,host.locator('[data-card-id="black_14"]'));
    assert.match(await host.locator('#skullKingDialogBody').textContent(),/王牌/);await host.keyboard.press('Escape');
    await host.locator('#skullKingExplainBtn').click();
    await host.evaluate(()=>{window.skullKingProbeCount=0;const b=document.createElement('button');b.id='skullKingProbe';b.textContent='Probe';b.onclick=()=>skullKingProbeCount++;document.getElementById('skullKingPanel').append(b);});
    await host.locator('#skullKingProbe').click();assert.equal(await host.evaluate(()=>skullKingProbeCount),0);
    await host.keyboard.press('Escape');await host.locator('#skullKingProbe').evaluate(e=>e.remove());
    await render(host,'playing');
    await host.locator('[data-card-id="green_2"]').click();assert.equal(await host.locator('#skullKingSelection').isVisible(),true);
    await host.locator('.skull-king-heading h2').click();assert.equal(await host.locator('#skullKingSelection').isVisible(),false);
    await host.locator('[data-card-id="green_2"]').click();await host.keyboard.press('Escape');assert.equal(await host.locator('#skullKingSelection').isVisible(),false);
    await host.locator('[data-card-id="tigress_1"]').click();assert.equal(await host.locator('#skullKingPlay').isVisible(),false);
    await host.locator('#skullKingEscape').click();assert.equal(await host.evaluate(()=>skullKingTestActions.at(-1).mode),'escape');
    await render(host,'playing');await host.keyboard.press('Escape');await host.locator('[data-card-id="tigress_1"]').click();await host.locator('#skullKingPirate').click();
    assert.equal(await host.evaluate(()=>skullKingTestActions.at(-1).mode),'pirate');
    for(const key of ['trick_review','round_review']) {
      await render(host,key);
      if(key==='trick_review') await host.locator('#skullKingPanel').screenshot({path:`${output}/trick-review.png`});
      await host.locator('#skullKingNext').click();
      assert.equal(await host.evaluate(()=>skullKingTestActions.at(-1).type),key==='trick_review'?'next_trick':'next_round');
    }
    await render(host,'ready');assert.equal(await host.locator('#skullKingNext').isDisabled(),true);
    for(const width of [320,390,768,1440]) {
      await host.setViewportSize({width,height:950});
      await host.waitForFunction(mobile=>document.getElementById('skullKingExplainBtn').parentElement.id===(mobile?'mobileExplainSlot':'skullKingHeaderActions'),width<=900);
      for(const key of Object.keys(views)) {
        await render(host,key);await bounds(host,`${width} ${key}`);
        if(key==='one_card') assert((await host.locator('#skullKingHand button').first().boundingBox()).width<120);
      }
      await render(host,'playing');
      if(width<=390) {
        await host.locator('#skullKingPanel').screenshot({path:`${output}/mobile-${width}.png`,style:'#roomControlsPanel { visibility: hidden; }'});
        await host.evaluate(()=>window.scrollTo(0,0));
        await host.screenshot({path:`${output}/mobile-page-${width}.png`});
      }
      await host.locator('#skullKingHelpBtn').click();await bounds(host,`${width} help`);
      if(width===390) await host.locator('#skullKingDialog').screenshot({path:`${output}/help.png`});
      await host.keyboard.press('Escape');
    }
    await host.setViewportSize({width:390,height:950});await render(host,'playing');
    await pointClick(host,host.locator('#skullKingRound'),true);assert.equal(await host.locator('#skullKingTooltip').isVisible(),true);
    await pointClick(host,host.locator('#skullKingTrick'),true);assert.match(await host.locator('#skullKingTooltip').textContent(),/Trick/);
    await host.waitForTimeout(3200);assert.equal(await host.locator('#skullKingTooltip').isVisible(),false);
    await render(host,'waiting');await host.locator('#skullKingExplainBtn').tap();await pointClick(host,host.locator('#skullKingHand button').first(),true);
    assert.equal(await host.locator('#skullKingDialog').evaluate(e=>e.open),true);await host.keyboard.press('Escape');
    await render(host,'spectator');assert.equal(await host.locator('#skullKingHand button').count(),0);
    await render(host,'finished');assert.equal(await host.locator('#skullKingNext').isVisible(),false);
    await host.locator('#skullKingPanel').screenshot({path:`${output}/finished.png`});
    assert.deepEqual(errors,[]);console.log('Skull King: live multiplayer, bots, reconnect, controls, Help/Explain, touch tips and responsive bounds passed.');
  } finally {for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
