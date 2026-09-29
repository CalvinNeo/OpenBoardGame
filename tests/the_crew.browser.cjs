// Run against a local uvicorn server. PLAYWRIGHT_MODULE may point to a bundled runtime.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8139';
const output = 'build/the-crew-ui';
fs.mkdirSync(output, {recursive:true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json,copy
from tests.test_the_crew import make_state,to_phase,action,card
from game.the_crew import TheCrewGame as G,_start_trick,_preflight,_finish_attempt
from game.the_crew_data import SEA_TASKS
v={}
for edition in (1,2):
 s=make_state(5,edition=edition,mode='custom',task_count=10,difficulty=20)
 s['player_meta']['p1']['name']='VeryLongUnbrokenAstronautNameForWrapping'
 s['player_meta']['p2']['name']='名字很长的航天员验证小屏排版'
 to_phase(s,'preflight');_start_trick(s,'p0')
 v[f'playing{edition}']=G.get_public_view(s,'p0')
 v[f'spectator{edition}']=G.get_public_view(s,'visitor')
 v[f'waiting{edition}']=G.get_public_view(s,'p1')
 to_phase(s,'mission_review');v[f'review{edition}']=G.get_public_view(s,'p0')
s=make_state(2,edition=2,mission=5);to_phase(s,'preflight');v['helper']=G.get_public_view(s,s['captain'])
_start_trick(s,'__the_crew_helper__');v['helper_play']=G.get_public_view(s,s['captain'])
for name,edition,mission in [('tokens',1,23),('responses',1,20),('volunteer',2,14),('free',2,17),('draft',2,5),('assign',1,11)]:
 s=make_state(edition=edition,mission=mission);pid=s['current_turn'] or 'p0';v[name]=G.get_public_view(s,pid)
s=make_state(edition=2)
t=next(copy.deepcopy(t) for t in SEA_TASKS if t['kind']=='predictTricks' and t['reveal']=='hidden');t.update(owner='p0',status='pending');s['tasks']=[t];_preflight(s)
v['predict']=G.get_public_view(s,'p0')
G.apply_action(s,'p0',action(s,'predict',task_id=t['id'],value=2))
v['preflight']=G.get_public_view(s,'p0');G.apply_action(s,'p0',action(s,'distress',direction='left'));v['vote']=G.get_public_view(s,'p1')
G.apply_action(s,'p1',action(s,'distress_vote',yes=True));G.apply_action(s,'p2',action(s,'distress_vote',yes=True));v['exchange']=G.get_public_view(s,'p0')
_finish_attempt(s,False,'目标牌被其他成员收取。');v['failed']=G.get_public_view(s,'p0')
G.apply_action(s,'p0',action(s,'next_mission'));v['ready']=G.get_public_view(s,'p0')
s['game_over']=True;s['phase']='game_over';v['finished']=G.get_public_view(s,'p0')
print(json.dumps(v))
`], {encoding:'utf8'}));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType='the_crew';currentRoomState={...currentRoomState,room_id:roomId,game_type:'the_crew'};
    window.theCrewFixtureRevision=(window.theCrewFixtureRevision||1000)+1;
    lastGameStatePayload={room_id:roomId,game_type:'the_crew',view:{...view,revision:theCrewFixtureRevision}};
    document.getElementById('theCrewPanel').classList.remove('hidden');showTheCrewHeaderActions(true);
    renderTheCrewGameState(lastGameStatePayload);
  }, views[key]);
}
async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad=[...document.querySelectorAll('#theCrewPanel *, #theCrewDialog *, #theCrewMissionDialog *, #theCrewSetupStep *, #theCrewHeaderActions *')].filter(el=>{
      if(!el.checkVisibility()) return false;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0 && r.height>0 && (r.left< -1 || r.right>innerWidth+1 || (el.clientWidth && el.scrollWidth>el.clientWidth+1 && !['hidden','auto'].includes(s.overflowX)));
    }).map(el=>`${el.id||el.className}: ${el.textContent.slice(0,50)} ${el.clientWidth}/${el.scrollWidth}`);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad};
  });
  assert(result.scroll<=result.width,`${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad,[],`${label}: container overflow`);
}
async function pointClick(page, locator, touch=false) {
  await locator.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const r=await locator.boundingBox();
  if(touch) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const contexts=[],errors=[];
  async function newPage() {
    const ctx=await browser.newContext({viewport:{width:1440,height:1050},hasTouch:true});contexts.push(ctx);
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());
    await page.goto(base);await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
    return page;
  }
  try {
    const host=await newPage(),guest=await newPage();
    assert.equal(await host.locator('#theCrewPanel').evaluate(el=>el.children.length),0);
    assert.equal(await host.locator('script[src*="games/the_crew.js"]').count(),0);
    await host.evaluate(async()=>{saveStoredName('Crew QA');await openCreateRoomModal();await selectGameFromModal('the_crew');});
    await host.locator('[data-the-crew-edition="1"]').click();
    assert.equal(await host.locator('#theCrewSetupStep select').count(),0);
    await host.locator('[data-the-crew-edition="2"]').click();
    for(const width of [1440,390,320]) {await host.setViewportSize({width,height:900});await bounds(host,`${width}/setup`);}
    await host.locator('#theCrewSetupStep').screenshot({path:`${output}/setup.png`});
    await host.setViewportSize({width:1440,height:1050});
    await host.locator('#theCrewSetupCreate').click();
    await host.waitForFunction(()=>currentGameType==='the_crew'&&currentRoomState?.game_config.edition===2);
    const rid=await host.evaluate(()=>roomId);
    await guest.evaluate(rid=>socket.emit('room:join',{room_id:rid,name:'Second astronaut'}),rid);
    await guest.waitForFunction(()=>currentGameType==='the_crew'&&isGameAssetsLoaded('the_crew'));
    await host.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await host.waitForFunction(()=>currentRoomState.players.length===3);
    for(const page of [host,guest]) await page.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);await host.locator('#startBtn').click();
    await host.locator('#theCrewMissionDialog').waitFor({state:'visible'});
    assert.equal(await guest.locator('#startBtn').isDisabled(),true);
    assert.equal(await host.evaluate(()=>currentRoomState.status),'lobby');
    assert.equal(await host.locator('#theCrewSetupMission option').count(),32);
    await host.locator('#theCrewSetupMode').selectOption('custom');
    assert.equal(await host.locator('#theCrewCountField').isVisible(),false);
    assert.equal(await host.locator('#theCrewDifficultyField').isVisible(),true);
    await host.locator('#theCrewSetupMode').selectOption('campaign');
    for(const width of [1440,390,320]) {await host.setViewportSize({width,height:900});await bounds(host,`${width}/mission-picker`);}
    await host.locator('#theCrewMissionDialog').screenshot({path:`${output}/mission-picker.png`});
    await host.keyboard.press('Escape');
    assert.equal(await host.evaluate(()=>currentRoomState.status),'lobby');
    await host.setViewportSize({width:1440,height:1050});
    await host.locator('#startBtn').click();
    await host.locator('#theCrewMissionSubmit').click();
    await host.waitForFunction(()=>lastGameStatePayload?.view.game_id==='the_crew');
    await host.locator('#theCrewMissionDialog').waitFor({state:'hidden'});
    for(let step=0;step<130;step++) {
      const v=await host.evaluate(()=>lastGameStatePayload.view);
      if(v.phase==='mission_review') break;
      let acted=false;
      for(const page of [host,guest]) {
        const pv=await page.evaluate(()=>lastGameStatePayload?.view);if(!pv||pv.revision!==v.revision) continue;
        const legal=pv.legal_actions;
        if(legal.includes('take_task')) {await page.locator('#theCrewTasks button:enabled').first().click();acted=true;break;}
        if(legal.includes('ready')||legal.includes('next_round')) {await page.locator('#theCrewNext').click();acted=true;break;}
        if(legal.includes('play')) {
          await page.locator(`#theCrewHand button[data-card-id="${pv.legal_card_ids[0]}"]`).click();
          await page.locator('#theCrewSelectedActions button').filter({hasText:/^Play$/}).click();acted=true;break;
        }
      }
      await host.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,v.revision,{timeout:10000});
    }
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.phase),'mission_review');
    const before=await host.evaluate(()=>lastGameStatePayload.view.attempt_id);
    await host.locator('#theCrewNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
    assert.equal(await host.locator('#theCrewNext').isDisabled(),true);
    assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.attempt_id),before);
    await guest.locator('#theCrewNext').click();await host.waitForFunction(id=>lastGameStatePayload.view.attempt_id>id,before);
    const credentials=await host.evaluate(()=>({room:roomId,pid:playerId}));
    await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('the_crew')&&lastGameStatePayload?.view.attempt_id>=2);
    assert.deepEqual(await host.evaluate(()=>({room:roomId,pid:playerId})),credentials);
    const oldToken=await host.evaluate(()=>lastGameStatePayload.view.game_token);
    const seats=await host.evaluate(()=>currentRoomState.players.map(p=>[p.player_id,p.seat]));
    assert.equal(await guest.locator('#theCrewRestart').isVisible(),false);
    assert.equal(await guest.locator('#reopenBtn').isDisabled(),true);
    await host.locator('#theCrewRestart').click();
    await host.locator('#theCrewSetupMission').selectOption('4');
    await host.locator('#theCrewMissionClose').click();
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.game_token),oldToken);
    await host.locator('#theCrewRestart').click();
    await host.locator('#theCrewSetupMission').selectOption('4');
    await host.setViewportSize({width:320,height:844});await bounds(host,'320/restart');
    await host.locator('#theCrewMissionDialog').screenshot({path:`${output}/restart-picker.png`});
    await host.locator('#theCrewMissionSubmit').click();
    await host.waitForFunction(old=>lastGameStatePayload.view.game_token!==old,oldToken);
    await guest.waitForFunction(()=>lastGameStatePayload.view.mission===4);
    await host.locator('#theCrewMissionDialog').waitFor({state:'hidden'});
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.mission),4);
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.attempt),1);
    assert.deepEqual(await host.evaluate(()=>({room:roomId,pid:playerId})),credentials);
    assert.deepEqual(await host.evaluate(()=>currentRoomState.players.map(p=>[p.player_id,p.seat])),seats);
    await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('the_crew')&&lastGameStatePayload?.view.mission===4);
    assert.equal(await host.evaluate(()=>currentRoomState.host_player_id===playerId),true);
    await host.setViewportSize({width:1440,height:1050});
    await host.locator('#theCrewExplainBtn').click();await host.locator('#theCrewRestart').click();
    assert.equal(await host.locator('#theCrewMissionDialog').isVisible(),false);
    assert.match(await host.locator('#theCrewDialogBody').textContent(),/重新选关|重新发牌/);
    await host.keyboard.press('Escape');
    await guest.close();
    const planet=await newPage();
    await planet.evaluate(async()=>{saveStoredName('Planet QA');await openCreateRoomModal();await selectGameFromModal('the_crew');});
    await planet.locator('[data-the-crew-edition="1"]').click();await planet.locator('#theCrewSetupCreate').click();
    await planet.waitForFunction(()=>currentRoomState?.game_config.edition===1);
    await planet.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await planet.waitForFunction(()=>!document.getElementById('startBtn').disabled);await planet.locator('#startBtn').click();
    assert.equal(await planet.locator('#theCrewSetupMission option').count(),50);
    await planet.locator('#theCrewSetupMode').selectOption('custom');
    assert.equal(await planet.locator('#theCrewCountField').isVisible(),true);
    assert.equal(await planet.locator('#theCrewDifficultyField').isVisible(),false);
    await planet.setViewportSize({width:320,height:844});await bounds(planet,'320/planet-custom');
    await planet.locator('#theCrewMissionDialog').screenshot({path:`${output}/planet-custom-picker.png`});
    await planet.locator('#theCrewSetupMode').selectOption('campaign');await planet.locator('#theCrewSetupMission').selectOption('50');
    await planet.locator('#theCrewMissionSubmit').click();
    await planet.waitForFunction(()=>lastGameStatePayload?.view.mission===50);
    await planet.locator('#theCrewRestart').click();await planet.locator('#theCrewSetupMode').selectOption('custom');
    await planet.locator('#theCrewSetupCount').selectOption('2');await planet.locator('#theCrewSetupOrder').selectOption('relative');
    await planet.locator('#theCrewSetupComm').selectOption('hidden');await planet.locator('#theCrewMissionSubmit').click();
    await planet.waitForFunction(()=>lastGameStatePayload?.view.config.mode==='custom');
    assert.deepEqual(await planet.evaluate(()=>{const c=lastGameStatePayload.view.config;return [c.edition,c.task_count,c.order,c.communication];}),[1,2,'relative','hidden']);
    await planet.close();
    await host.evaluate(()=>{socket.emit('room:leave',{});window.theCrewTestActions=[];sendAction=a=>theCrewTestActions.push(a);setRoomControlsCollapsed(true);});
    await render(host,'playing1');
    const playable=host.locator('#theCrewHand button:enabled').first();await playable.click();
    assert.equal(await host.locator('#theCrewSelection').isVisible(),true);
    await host.locator('.the-crew-heading h2').click();assert.equal(await host.locator('#theCrewSelection').isVisible(),false);
    await playable.click();await host.keyboard.press('Escape');assert.equal(await host.locator('#theCrewSelection').isVisible(),false);
    await playable.click();await host.locator('#theCrewSelectedActions button').filter({hasText:/^Play$/}).click();
    assert.equal(await host.evaluate(()=>theCrewTestActions.at(-1).type),'play');
    await render(host,'waiting1');
    const disabled=host.locator('#theCrewHand button:disabled').first();
    const previous=await host.evaluate(()=>theCrewTestActions.length);
    await host.locator('#theCrewExplainBtn').click();await pointClick(host,disabled);
    assert.equal(await host.locator('#theCrewDialog').evaluate(e=>e.open),true);
    assert.equal(await host.evaluate(()=>theCrewTestActions.length),previous);await host.keyboard.press('Escape');
    await host.evaluate(()=>{window.theCrewProbeCount=0;const b=document.createElement('button');b.id='theCrewProbe';b.textContent='Probe';b.onclick=()=>theCrewProbeCount++;document.getElementById('theCrewPanel').append(b);});
    await host.locator('#theCrewExplainBtn').click();await host.locator('#theCrewProbe').click();
    assert.equal(await host.evaluate(()=>theCrewProbeCount),0);await host.keyboard.press('Escape');await host.locator('#theCrewProbe').evaluate(e=>e.remove());
    for(const width of [1440,768,390,320]) {
      await host.setViewportSize({width,height:width>500?1050:844});
      for(const key of Object.keys(views)) {await render(host,key);await bounds(host,`${width}/${key}`);}
      for(const key of ['playing1','playing2','helper_play']) {await render(host,key);await host.locator('#theCrewPanel').screenshot({path:`${output}/${width}-${key}.png`});}
      if(width<=390) {
        await render(host,'playing1');await host.locator('#theCrewHand button:enabled').first().click();await bounds(host,`${width}/selected`);
        await host.locator('#theCrewSelection').scrollIntoViewIfNeeded();await host.screenshot({path:`${output}/${width}-selection.png`});await host.keyboard.press('Escape');
      }
    }
    await render(host,'playing1');await pointClick(host,host.locator('#theCrewMission'),true);
    assert.equal(await host.locator('#theCrewTooltip').isVisible(),true);
    await pointClick(host,host.locator('#theCrewTrickNumber'),true);assert.match(await host.locator('#theCrewTooltip').textContent(),/Trick/);
    await host.waitForTimeout(3100);assert.equal(await host.locator('#theCrewTooltip').isVisible(),false);
    await host.locator('#theCrewHelpBtn').click();await bounds(host,'320/help');
    assert.match(await host.locator('#theCrewDialogBody').textContent(),/96/);
    await host.locator('#theCrewDialog').screenshot({path:`${output}/help.png`});await host.keyboard.press('Escape');
    for(const key of ['predict','tokens','free','responses','assign','volunteer','vote']) {
      await render(host,key);await host.locator('#theCrewControls button:enabled, #theCrewTasks button:enabled').first().click();
      assert(await host.evaluate(()=>theCrewTestActions.length)>previous);
    }
    await render(host,'helper_play');await host.locator('#theCrewHelper button:enabled').first().click();
    await host.locator('#theCrewSelectedActions button').filter({hasText:/^Play$/}).click();assert.equal(await host.evaluate(()=>theCrewTestActions.at(-1).type),'play');
    await render(host,'exchange');await host.locator('#theCrewHand button:enabled').first().click();
    await host.locator('#theCrewSelectedActions button').click();assert.equal(await host.evaluate(()=>theCrewTestActions.at(-1).type),'exchange');
    assert.deepEqual(errors,[]);
    console.log(`The Crew browser checks passed: edition-only creation, host mission picker, cancel, same-room Restart, multiplayer + bot mission, confirmation barrier, reconnect, ${Object.keys(views).length*4} responsive states, Help/Explain, mobile tips, and special controls.`);
  } finally {for(const ctx of contexts) await ctx.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
