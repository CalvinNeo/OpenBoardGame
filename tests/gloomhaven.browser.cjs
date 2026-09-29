// ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON may point to local installations.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const base=process.env.ROOM_TEST_URL||'http://127.0.0.1:8141';
const output='build/gloomhaven-ui';fs.mkdirSync(output,{recursive:true});
const views=JSON.parse(execFileSync(process.env.PYTHON||'python3',['-c',`
import copy,json
from tests.test_gloomhaven import make_state,force_turn,act,bot_step
from game.gloomhaven import GloomhavenGame as G,_hurt,_reveal,_condition
v={}
s=make_state(1,start=False);v['setup']=G.get_public_view(s,'p0')
s=make_state(1);s['player_meta']['p0']['name']='VeryLongUnbrokenMercenaryNameToCheckEveryContainer'
v['planning']=G.get_public_view(s,'p0');v['spectator']=G.get_public_view(s,'visitor')
h=force_turn(s,cards=['brute_1','brute_2']);h['pos']=[1,1]
v['acting']=G.get_public_view(s,'p0')
a=copy.deepcopy(s);act(a,'p0','half',hero_id='h1',card='brute_1',half='top',basic=False);v['attacking']=G.get_public_view(a,'p0')
act(s,'p0','half',hero_id='h1',card='brute_2',half='bottom',basic=False)
v['moving']=G.get_public_view(s,'p0')
a=copy.deepcopy(s);_reveal(a);v['revealed']=G.get_public_view(a,'p0')
a=copy.deepcopy(s);_hurt(a,a['heroes']['h1'],4,'强盗守卫');v['damage']=G.get_public_view(a,'p0')
s=make_state(1);h=force_turn(s);h['plan']={'rest':True};h['discard']=h['hand'][:4];del h['hand'][:4]
v['long_rest']=G.get_public_view(s,'p0')
s=make_state(2)
while s['phase']!='round_review':bot_step(s)
v['review']=G.get_public_view(s,'p0')
act(s,'p0','short_rest',hero_id='h1');v['short_rest']=G.get_public_view(s,'p0')
while s['phase']!='scenario_review':bot_step(s)
v['victory']=G.get_public_view(s,'p0')
s=make_state(4)
for h in s['heroes'].values():
 for condition in ('poison','wound','disarm','immobilize','stun','muddle','strengthen'):_condition(h,condition)
v['conditions']=G.get_public_view(s,'p0')
s=make_state(1,scenario=3)
while not s['game_over']:bot_step(s)
v['finished']=G.get_public_view(s,'p0')
print(json.dumps(v))
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
async function bounds(page,label){
 const result=await page.evaluate(()=>{
  const bad=[...document.querySelectorAll('#gloomhavenPanel *,#gloomhavenDialog *,#gloomhavenHeaderActions *,#mobileExplainSlot *')].filter(el=>{
   if(!el.checkVisibility())return false;
   const r=el.getBoundingClientRect(),s=getComputedStyle(el);
   return r.width>0&&r.height>0&&(r.left < -1||r.right>innerWidth+1||(el instanceof HTMLElement&&el.clientWidth&&el.scrollWidth>el.clientWidth+1&&!['hidden','auto','scroll'].includes(s.overflowX)));
  }).map(el=>`${el.id||el.className.baseVal||el.className}: ${el.textContent.slice(0,55)} ${el.clientWidth}/${el.scrollWidth} at ${el.getBoundingClientRect().left}`);
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad};
 });
 assert(result.scroll<=result.width,`${label}: page overflow ${JSON.stringify(result)}`);
 assert.deepEqual(result.bad,[],`${label}: container overflow`);
}
async function render(page,key){
 await page.evaluate(v=>{window.gloomhavenFixtureRevision=(window.gloomhavenFixtureRevision||10000)+1;lastGameStatePayload={room_id:roomId,game_type:'gloomhaven',view:{...v,revision:gloomhavenFixtureRevision}};renderGloomhavenGameState(lastGameStatePayload);},views[key]);
}
async function pointClick(page,locator,touch=false){await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();if(touch)await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[],contexts=[];
 async function newPage(){const ctx=await browser.newContext({viewport:{width:1440,height:1080},hasTouch:true});contexts.push(ctx);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.goto(base);await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);return page;}
 try{
  const host=await newPage(),guest=await newPage();
  assert.equal(await host.locator('#gloomhavenPanel').evaluate(e=>e.children.length),0);
  assert.equal(await host.locator('script[src*="games/gloomhaven.js"]').count(),0);
  await host.evaluate(()=>socket.emit('room:create',{name:'Gloomhaven QA',game_type:'gloomhaven',config:{seed:141,difficulty:0}}));
  await host.waitForFunction(()=>currentGameType==='gloomhaven'&&isGameAssetsLoaded('gloomhaven'));
  const rid=await host.evaluate(()=>roomId);
  await guest.evaluate(rid=>socket.emit('room:join',{room_id:rid,name:'Second mercenary'}),rid);
  await guest.waitForFunction(()=>currentGameType==='gloomhaven'&&isGameAssetsLoaded('gloomhaven'));
  await host.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
  await host.waitForFunction(()=>currentRoomState.players.length===3);
  for(const p of [host,guest])await p.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
  await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);await host.locator('#startBtn').click();
  await host.waitForFunction(()=>lastGameStatePayload?.view.phase==='setup');
  await host.locator('#gloomhavenReady').click();await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
  await guest.locator('#gloomhavenReady').click();await host.waitForFunction(()=>lastGameStatePayload?.view.phase==='planning');
  for(const p of [host,guest]){
   await p.locator('#gloomhavenHand > button').nth(0).click();await p.locator('#gloomhavenHand > button').nth(1).click();
   await p.locator('#gloomhavenActions button').filter({hasText:'Commit'}).click();
   await p.waitForFunction(()=>lastGameStatePayload.view.phase!=='planning'||lastGameStatePayload.view.heroes.some(h=>h.owner===playerId&&h.planned));
  }
  await host.waitForFunction(()=>lastGameStatePayload.view.phase==='acting');
  // Resolve a real round, including the server bot, monster attacks and damage choices.
  for(let i=0;i<45;i++){
   await host.waitForFunction(()=>lastGameStatePayload.view.phase!=='acting'||(lastGameStatePayload.view.current_turn&&lastGameStatePayload.view.players.some(p=>p.player_id===lastGameStatePayload.view.current_turn&&!p.is_bot)));
   const snap=await host.evaluate(()=>({phase:lastGameStatePayload.view.phase,owner:lastGameStatePayload.view.current_turn,rev:lastGameStatePayload.view.revision}));
   if(snap.phase!=='acting')break;
   const p=await host.evaluate(()=>playerId)===snap.owner?host:guest;
   await p.waitForFunction(()=>lastGameStatePayload.view.options.some(o=>o.type==='damage'||o.type==='end_turn'));
   const damage=await p.evaluate(()=>!!lastGameStatePayload.view.damage);
   await p.locator('#gloomhavenActions button').filter({hasText:damage?'Take ':'End Turn'}).first().click();
   await host.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,snap.rev);
  }
  await host.waitForFunction(()=>lastGameStatePayload.view.phase==='round_review');
  assert(await host.locator('.gh-report-group.is-yours').count()>0);
  await host.locator('#gloomhavenNext').click();await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
  assert.equal(await host.locator('#gloomhavenNext').isDisabled(),true);
  assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.round),1);
  await guest.locator('#gloomhavenNext').click();await host.waitForFunction(()=>lastGameStatePayload.view.round===2);
  const credentials=await host.evaluate(()=>({room:roomId,pid:playerId}));
  await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('gloomhaven')&&lastGameStatePayload?.view.round===2);
  assert.deepEqual(await host.evaluate(()=>({room:roomId,pid:playerId})),credentials);
  await guest.close();
  // The real room is waiting for the human plans. SendAction is captured for UI fixtures.
  await host.evaluate(()=>{socket.off("game:state");socket.off("room:state");window.gloomhavenTestActions=[];sendAction=a=>gloomhavenTestActions.push(a);setRoomControlsCollapsed(true);});
  await render(host,'planning');
  await host.locator('#gloomhavenHand > button').nth(0).click();await host.locator('.gh-heading h2').click();assert.equal(await host.locator('.gh-card.is-selected').count(),0);
  await host.locator('#gloomhavenHand > button').nth(0).click();await host.keyboard.press('Escape');assert.equal(await host.locator('.gh-card.is-selected').count(),0);
  await host.locator('#gloomhavenHand > button').nth(0).click();await host.locator('#gloomhavenHand > button').nth(1).click();await host.locator('#gloomhavenActions button').filter({hasText:'Commit'}).click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'plan');
  await render(host,'moving');
  await host.locator('.gh-hex.is-reachable').first().click();assert.equal(await host.locator('#gloomhavenSelectedAction').isVisible(),true);
  await host.locator('#gloomhavenSelectedAction button').filter({hasText:'Move'}).click();assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'move');
  await render(host,'acting');await host.locator('#gloomhavenHand [data-card-id="brute_1"] .gh-half-buttons button').first().click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'half');
  await render(host,'attacking');await host.locator('#gloomhavenActions button').filter({hasText:'强盗守卫'}).first().click();await host.locator('#gloomhavenSelectedAction button').filter({hasText:'Attack'}).click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'target');
  await render(host,'damage');await host.locator('#gloomhavenHand > button').first().click();await host.locator('#gloomhavenActions button').filter({hasText:'Lose & Prevent'}).click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).cards.length),1);
  await render(host,'short_rest');assert.equal(await host.locator('#gloomhavenNext').isDisabled(),true);await host.locator('#gloomhavenRestOptions button').filter({hasText:'Accept'}).click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'rest_accept');
  await render(host,'long_rest');await host.locator('#gloomhavenHand button').filter({hasText:'Lose & Rest'}).first().click();
  assert.equal(await host.evaluate(()=>gloomhavenTestActions.at(-1).type),'rest_lose');
  await render(host,'planning');await host.locator('#gloomhavenPanel').screenshot({path:`${output}/desktop-initial.png`});await host.locator('#gloomhavenHelpBtn').click();assert.equal(await host.locator('#gloomhavenDialog').evaluate(e=>e.open),true);await bounds(host,'help desktop');await host.keyboard.press('Escape');
  await host.locator('#gloomhavenExplainBtn').click();await pointClick(host,host.locator('#gloomhavenActions button').filter({hasText:'Long Rest'}));
  assert.equal(await host.locator('#gloomhavenDialog').evaluate(e=>e.open),true);assert.equal(await host.locator('#gloomhavenExplainBtn').getAttribute('aria-pressed'),'false');await host.keyboard.press('Escape');
  // Explain prevents unexplained controls from triggering their original action.
  const before=await host.evaluate(()=>gloomhavenTestActions.length);
  await host.locator('#gloomhavenExplainBtn').click();await host.evaluate(()=>document.getElementById('gloomhavenHeroTabs').querySelector('button').removeAttribute('data-gh-explain'));
  await pointClick(host,host.locator('#gloomhavenHeroTabs button').first());assert.equal(await host.evaluate(()=>gloomhavenTestActions.length),before);await host.keyboard.press('Escape');
  for(const width of [1440,768,390,320]){
   await host.setViewportSize({width,height:1000});
   for(const key of Object.keys(views)){
    await render(host,key);
    if(width<720&&key!=='setup')await host.locator('#gloomhavenRooms button').filter({hasText:'Room 1'}).click();
    await bounds(host,`${width}/${key}`);
    await host.mouse.move(0,0);await host.evaluate(()=>document.activeElement?.blur());
    if(['setup','planning','revealed','damage','review','finished'].includes(key))await host.locator('#gloomhavenPanel').screenshot({path:`${output}/${width}-${key}.png`});
   }
  }
  await render(host,'finished');assert(!/m[12]_\d/.test(await host.locator('#gloomhavenLastAttack').innerText()),'defeated monster lost its name');
  await render(host,'planning');await host.locator('#gloomhavenHelpBtn').click();await bounds(host,'320/help');await host.locator('#gloomhavenDialog').screenshot({path:`${output}/320-help.png`});await host.keyboard.press('Escape');
  await pointClick(host,host.locator('#gloomhavenHeroes .gh-stats [data-gh-tip]').first(),true);
  assert.equal(await host.locator('#gloomhavenTooltip').isVisible(),true);await host.waitForTimeout(3200);assert.equal(await host.locator('#gloomhavenTooltip').isVisible(),false);
  await render(host,'planning');await host.locator('#gloomhavenHand').evaluate(e=>e.scrollTop=180);const top=await host.locator('#gloomhavenHand').evaluate(e=>e.scrollTop);
  await host.locator('#gloomhavenHand > button').nth(4).click();assert(Math.abs(await host.locator('#gloomhavenHand').evaluate(e=>e.scrollTop)-top)<5,'card selection resets scroll');
  assert.equal(await host.locator('#roomControlsPanel').evaluate(e=>e.classList.contains('gh-your-turn')),true);
  assert.deepEqual(errors,[]);
  console.log(`Gloomhaven browser checks passed: real multiplayer + bot round, barrier, reconnect; ${Object.keys(views).length*4} layouts, Help/Explain, touch tooltips, selection and scroll.`);
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
