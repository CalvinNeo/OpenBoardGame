// Run against a local server. PLAYWRIGHT_MODULE can point to the bundled runtime.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8140';
const output = 'build/mall-of-horror-ui';
fs.mkdirSync(output, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from tests.test_mall_of_horror import make_state,arrange,grant,pass_window
from game import mall_of_horror as r
from game.mall_of_horror import MallOfHorrorGame as G
from game.mall_of_horror_ai import choose_action
views={}
s=make_state(6)
s['player_meta']['p1']['name']='VeryLongUnbrokenSurvivorNameForWrapping'
s['player_meta']['p2']['name']='名字很长的幸存者检查小屏幕换行'
for i in range(1800):
 p=next((p for p in s['turn_order'] if G.get_legal_actions(s,p)),'p0')
 if s['phase'] not in views: views[s['phase']]=G.get_public_view(s,p)
 if s['game_over']:break
 a=choose_action(G.get_public_view(s,p))
 assert a,(s['phase'],p)
 assert G.apply_action(s,p,a)[1] is None
views['spectator']=G.get_public_view(s,'visitor')
s=make_state(4)
arrange(s,{'s0_pinup':1,'s0_tough':1,'s1_gunman':1,'s2_pinup':3,'s3_pinup':6})
s['locations'][0]['zombies']=5;s['attack_location']=1
r._start_vote(s,'victim',1)
for kind in r.CARDS: grant(s,'p0',kind)
views['cards']=G.get_public_view(s,'p0')
views['waiting']=G.get_public_view(s,'p1')
s=make_state(4)
arrange(s,{'s0_pinup':1,'s0_tough':3,'s1_pinup':5,'s2_pinup':6,'s3_pinup':6})
s.update(destinations={'p0':5,'p1':3,'p2':1,'p3':4},queue=['p0','p1','p2','p3'])
grant(s,'p0','sprint');views['sprint']=G.get_public_view(s,'p0')
print(json.dumps(views))
`], {encoding:'utf8'}));

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#mallOfHorrorPanel *, #mallOfHorrorDialog *, #mallOfHorrorHeaderActions *')].filter(el => {
      if (!el.checkVisibility()) return false;
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth+1 || (el.clientWidth && el.scrollWidth > el.clientWidth+1 && !['auto','hidden'].includes(s.overflowX)));
    }).map(el => `${el.id || el.className}: ${el.textContent.slice(0,70)} ${el.clientWidth}/${el.scrollWidth}`);
    return {width:innerWidth, scroll:document.documentElement.scrollWidth, bad};
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
}

async function render(page, key) {
  await page.evaluate(v => {
    currentGameType='mall_of_horror';
    currentRoomState={...currentRoomState,room_id:roomId,game_type:'mall_of_horror'};
    window.mallOfHorrorFixtureRevision=(window.mallOfHorrorFixtureRevision||5000)+1;
    lastGameStatePayload={room_id:roomId,game_type:'mall_of_horror',view:{...v,revision:mallOfHorrorFixtureRevision}};
    document.getElementById('mallOfHorrorPanel').classList.remove('hidden');
    showMallOfHorrorHeaderActions(true);renderMallOfHorrorGameState(lastGameStatePayload);
  }, fixtures[key]);
}

async function humanMove(page, v) {
  const controls=page.locator('#mallOfHorrorControls');
  const press=label=>controls.getByRole('button',{name:label,exact:true}).click();
  const pickChar=id=>controls.locator(`[data-character-id="${id}"]`).click();
  const pickLoc=n=>page.locator(`.moh-location[data-location="${n}"] > .moh-location-name`).click();
  const a=v.legal_actions;
  if(a.includes('pass')) await press('Pass');
  else if(a.includes('place')) {
    const c=v.characters.find(c=>c.owner===v.you&&c.location===null);await pickChar(c.id);await pickLoc(v.setup_locations[0]);await press('Place survivor');
  } else if(a.includes('vote')) {
    const target=v.vote.candidates.find(p=>v.vote.kind==='victim'?p!==v.you:p===v.you)||v.vote.candidates[0];
    await press(v.players.find(p=>p.player_id===target).name);await press('Lock vote');
  } else if(a.includes('choose_destination')) {
    await pickLoc(v.destination_options.find(n=>n!==4)||v.destination_options[0]);
    await press(v.phase==='chief_destination'?'Announce destination':'Lock destination');
  } else if(a.includes('move')) {
    const o=v.move_options.find(o=>!o.sprint_card_id)||v.move_options[0];
    if(o.sprint_card_id) await page.locator(`#mallOfHorrorHand [data-card-id="${o.sprint_card_id}"]`).click();
    await pickChar(o.character_id);if(o.sprint_card_id)await pickLoc(o.destination);await press('Move survivor');
  } else if(a.includes('sacrifice')) {await pickChar(v.victim_options[0]);await press('Sacrifice survivor');}
  else if(a.includes('distribute')) {
    const rows=controls.locator('.moh-choices');await rows.nth(0).locator('button').first().click();
    if(v.loot.length>1){await rows.nth(1).locator('button').nth(1).click();await rows.nth(2).locator('button').first().click();}
    await press('Distribute cards');
  } else if(a.includes('place_zombie')) {await pickLoc(v.locations.find(l=>!l.closed).id);await press('Place zombie');}
  else return false;
  return true;
}

async function pointClick(page, locator, touch=false) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const r=await locator.boundingBox();
  if(touch) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const contexts=[], errors=[];
  async function newPage() {
    const ctx=await browser.newContext({viewport:{width:1440,height:1050},hasTouch:true});contexts.push(ctx);
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());
    await page.goto(base);await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
    return page;
  }
  try {
    const host=await newPage(),guest=await newPage();
    assert.equal(await host.locator('#mallOfHorrorPanel').evaluate(e=>e.children.length),0);
    assert.equal(await host.locator('script[src*="games/mall_of_horror.js"]').count(),0);
    await host.evaluate(async()=>{saveStoredName('Mall QA');await openCreateRoomModal();await selectGameFromModal('mall_of_horror');});
    await host.waitForFunction(()=>currentGameType==='mall_of_horror'&&isGameAssetsLoaded('mall_of_horror'));
    const rid=await host.evaluate(()=>roomId);
    await guest.evaluate(rid=>socket.emit('room:join',{room_id:rid,name:'Second survivor'}),rid);
    await guest.waitForFunction(()=>currentGameType==='mall_of_horror'&&isGameAssetsLoaded('mall_of_horror'));
    await host.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await host.waitForFunction(()=>currentRoomState.players.length===3);
    for(const page of [host,guest])await page.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);await host.locator('#startBtn').click();
    await host.waitForFunction(()=>lastGameStatePayload?.view.game_id==='mall_of_horror');
    let reviewed=false;
    for(let i=0;i<220;i++) {
      const v=await host.evaluate(()=>lastGameStatePayload.view);
      if(v.phase==='round_review'){reviewed=true;break;}
      assert.notEqual(v.phase,'game_over','expected at least one round review');
      for(const page of [host,guest]) {
        const current=await page.evaluate(()=>lastGameStatePayload.view);
        if(current.revision!==v.revision)break;
        if(await humanMove(page,current))break;
      }
      await host.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,v.revision,{timeout:12000});
    }
    assert(reviewed,'round review reached');
    const round=await host.evaluate(()=>lastGameStatePayload.view.round);
    await host.locator('#mallOfHorrorNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
    assert.equal(await host.locator('#mallOfHorrorNext').isDisabled(),true);
    assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.round),round);
    await guest.locator('#mallOfHorrorNext').click();
    await host.waitForFunction(r=>lastGameStatePayload.view.round>r,round);
    const identity=await host.evaluate(()=>({rid:roomId,pid:playerId}));
    await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('mall_of_horror')&&lastGameStatePayload?.view.round>=2);
    assert.deepEqual(await host.evaluate(()=>({rid:roomId,pid:playerId})),identity);
    console.log('Live room: setup, voting, movement, attack, all-player review and reconnect passed');
    await guest.close();
    await host.evaluate(()=>{socket.emit('room:leave',{});window.mallOfHorrorTestActions=[];sendAction=a=>mallOfHorrorTestActions.push(a);setRoomControlsCollapsed(true);});
    await render(host,'cards');
    const card=host.locator('#mallOfHorrorHand [data-card-id^="weapon1_"]');await card.click();
    await host.locator('#mallOfHorrorControls').getByRole('button',{name:'Use card',exact:true}).click();
    assert.equal(await host.evaluate(()=>mallOfHorrorTestActions.at(-1).type),'play_card');
    await render(host,'sprint');
    await host.locator('#mallOfHorrorHand [data-card-id^="sprint_"]').first().click();
    await host.locator('#mallOfHorrorControls [data-character-id="s0_pinup"]').click();
    await host.locator('.moh-location[data-location="1"] > .moh-location-name').click();
    await host.locator('#mallOfHorrorControls').getByRole('button',{name:'Move survivor',exact:true}).click();
    assert.equal(await host.evaluate(()=>mallOfHorrorTestActions.at(-1).destination),1);
    assert(await host.evaluate(()=>!!mallOfHorrorTestActions.at(-1).sprint_card_id));
    await render(host,'cards');await card.click();await host.locator('.moh-heading h2').click();
    assert.equal(await host.locator('#mallOfHorrorControls').getByRole('button',{name:'Use card',exact:true}).count(),0);
    await card.click();await host.keyboard.press('Escape');
    assert.equal(await host.locator('#mallOfHorrorControls').getByRole('button',{name:'Use card',exact:true}).count(),0);
    await render(host,'waiting');
    const before=await host.evaluate(()=>mallOfHorrorTestActions.length);
    await host.locator('#mallOfHorrorExplainBtn').click();await pointClick(host,host.locator('#mallOfHorrorHand button:disabled').first());
    assert.equal(await host.locator('#mallOfHorrorDialog').evaluate(e=>e.open),true);
    assert.equal(await host.evaluate(()=>mallOfHorrorTestActions.length),before);await host.keyboard.press('Escape');
    await host.evaluate(()=>{window.mallOfHorrorProbeCount=0;const b=document.createElement('button');b.id='mallOfHorrorProbe';b.textContent='Probe';b.onclick=()=>mallOfHorrorProbeCount++;document.getElementById('mallOfHorrorPanel').append(b);});
    await host.locator('#mallOfHorrorExplainBtn').click();await host.locator('#mallOfHorrorProbe').click();
    assert.equal(await host.evaluate(()=>mallOfHorrorProbeCount),0);await host.keyboard.press('Escape');
    await host.locator('#mallOfHorrorProbe').click();assert.equal(await host.evaluate(()=>mallOfHorrorProbeCount),1);
    await host.locator('#mallOfHorrorProbe').evaluate(e=>e.remove());
    for(const width of [1440,1024,740,390,320]) {
      await host.setViewportSize({width,height:1000});
      for(const key of Object.keys(fixtures)){await render(host,key);await bounds(host,`${width}/${key}`);}
      await render(host,'move');
      await host.locator('#mallOfHorrorPanel').screenshot({path:`${output}/board-${width}.png`});
      await host.locator('#mallOfHorrorHelpBtn').click();await bounds(host,`${width}/help`);
      if(width===390)await host.locator('#mallOfHorrorDialog').screenshot({path:`${output}/help-mobile.png`});
      await host.keyboard.press('Escape');
    }
    await host.setViewportSize({width:390,height:900});await render(host,'move');
    const stat=host.locator('.moh-location-stats [data-moh-tip]').first();await pointClick(host,stat,true);
    assert.equal(await host.locator('#mallOfHorrorTooltip').isVisible(),true);
    const second=host.locator('.moh-location-stats [data-moh-tip]').nth(1);await pointClick(host,second,true);
    assert.match(await host.locator('#mallOfHorrorTooltip').innerText(),/Defense/);
    await host.locator('#mallOfHorrorTooltip').waitFor({state:'hidden',timeout:4500});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(`${output}/result.json`,JSON.stringify({ok:true,phases:Object.keys(fixtures),widths:[1440,1024,740,390,320],errors},null,2));
    console.log('UI checks passed:',Object.keys(fixtures).join(', '));
  } finally {for(const ctx of contexts)await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
