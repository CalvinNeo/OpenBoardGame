// ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON may point to local installations.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8137';
const output = 'build/maskmen-ui';
fs.mkdirSync(output, {recursive:true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json,copy
from tests.test_maskmen import make_state,set_hands,bot_step
from game.maskmen import MaskmenGame as G,MASKS
s=make_state(6)
s['player_meta']['p1']['name']='VeryLongUnbrokenWrestlerNameToCheckEveryContainer'
s['player_meta']['p2']['name']='名字很长的摔跤手验证手机排版没有重叠'
s['current_turn']='p0';s['leader']='p0'
s['players']['p0']['hand']={m:3 for m in MASKS}
s['introduced']=['blue','pink','orange','green','purple']
s['relations']=[['green','pink'],['pink','blue'],['orange','pink'],['purple','grey']]
v={'playing':G.get_public_view(s,'p0')}
s['top']={'player_id':'p1','mask':'blue','count':1}
v['played_long']=G.get_public_view(s,'p0')
s['top']={'player_id':'p5','mask':'green','count':3}
v['blocked']=G.get_public_view(s,'p0')
s['top']=None;s['current_turn']='p1'
v['waiting']=G.get_public_view(s,'p0');v['spectator']=G.get_public_view(s,'visitor')
s['players']['p0']['hand']={m:int(m=='blue') for m in MASKS}
v['one_card']=G.get_public_view(s,'p0')
s=make_state(3)
while s['phase']=='playing':bot_step(s)
v['round_review']=G.get_public_view(s,'p0')
while s['phase']!='season_review':bot_step(s)
v['season_review']=G.get_public_view(s,'p0')
s['ready'].append('p0');v['ready']=G.get_public_view(s,'p0')
while not s['game_over']:bot_step(s)
v['finished']=G.get_public_view(s,'p0')
s=make_state(2);v['duel']=G.get_public_view(s,'p0')
print(json.dumps(v))
`], {encoding:'utf8'}));

async function render(page, key) {
  await page.evaluate(view => {
    window.maskmenFixtureRevision = (window.maskmenFixtureRevision || 1000) + 1;
    lastGameStatePayload = {room_id:roomId, game_type:'maskmen', view:{...view, revision:maskmenFixtureRevision}};
    renderMaskmenGameState(lastGameStatePayload);
  }, views[key]);
}
async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad=[...document.querySelectorAll('#maskmenPanel *, #maskmenDialog *, #maskmenHeaderActions *, #mobileExplainSlot *')].filter(el=>{
      if(!el.checkVisibility()) return false;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0 && r.height>0 && (r.left< -1 || r.right>innerWidth+1 ||
        (el.clientWidth && el.scrollWidth>el.clientWidth+1 && !['hidden','auto'].includes(s.overflowX)));
    }).map(el=>`${el.id||el.className}: ${el.textContent.slice(0,45)} ${el.clientWidth}/${el.scrollWidth} at ${el.getBoundingClientRect().left}`);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad};
  });
  assert(result.scroll<=result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad,[],`${label}: container overflow`);
}
async function pointClick(page, locator, touch=false) {
  await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();
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
    assert.equal(await host.locator('#maskmenPanel').evaluate(el=>el.children.length),0);
    assert.equal(await host.locator('script[src*="games/maskmen.js"]').count(),0);
    await host.evaluate(()=>socket.emit('room:create',{name:'Maskmen QA',game_type:'maskmen'}));
    await host.waitForFunction(()=>currentGameType==='maskmen'&&isGameAssetsLoaded('maskmen'));
    const rid=await host.evaluate(()=>roomId);
    await guest.evaluate(rid=>socket.emit('room:join',{room_id:rid,name:'Second wrestler'}),rid);
    await guest.waitForFunction(()=>currentGameType==='maskmen'&&isGameAssetsLoaded('maskmen'));
    await host.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await host.waitForFunction(()=>currentRoomState.players.length===3);
    for(const page of [host,guest]) await page.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);await host.locator('#startBtn').click();
    await host.waitForFunction(()=>lastGameStatePayload?.view.phase==='playing');
    const hostPid=await host.evaluate(()=>playerId);
    // A real season, including the actual server bot and each review barrier.
    for(let step=0;step<180;step++) {
      await host.waitForFunction(()=>lastGameStatePayload.view.phase!=='playing'||lastGameStatePayload.view.players.some(p=>p.player_id===lastGameStatePayload.view.current_turn&&!p.is_bot));
      const snapshot=await host.evaluate(()=>({phase:lastGameStatePayload.view.phase,turn:lastGameStatePayload.view.current_turn,revision:lastGameStatePayload.view.revision}));
      if(snapshot.phase==='season_review') break;
      if(snapshot.phase==='round_review') {
        await host.waitForFunction(()=>lastGameStatePayload.view.legal_actions.includes('next_round'));
        await host.locator('#maskmenNext').click();
        await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
        assert.equal(await host.locator('#maskmenNext').isDisabled(),true);
        await guest.waitForFunction(()=>lastGameStatePayload.view.legal_actions.includes('next_round'));
        assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.phase),'round_review');
        await guest.locator('#maskmenNext').click();
        await host.waitForFunction(()=>lastGameStatePayload.view.phase!=='round_review');
      } else {
        const page=snapshot.turn===hostPid?host:guest;
        await page.waitForFunction(()=>lastGameStatePayload.view.current_turn===playerId);
        if(await page.evaluate(()=>lastGameStatePayload.view.legal_plays.length>0)) {
          await page.locator('#maskmenHand button:enabled').first().click();
          assert.equal(await page.locator('#maskmenSelection').isVisible(),true);
          await page.locator('#maskmenPlay').click();
        } else await page.locator('#maskmenPass').click();
      }
      await host.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,snapshot.revision);
    }
    assert.equal(await host.evaluate(()=>lastGameStatePayload.view.phase),'season_review');
    await host.locator('#maskmenNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.ready.includes(playerId));
    assert.equal(await guest.evaluate(()=>lastGameStatePayload.view.season),1);
    await guest.locator('#maskmenNext').click();
    await host.waitForFunction(()=>lastGameStatePayload.view.season===2);
    const credentials=await host.evaluate(()=>({room:roomId,pid:playerId}));
    await host.reload();await host.waitForFunction(()=>isGameAssetsLoaded('maskmen')&&lastGameStatePayload?.view.season===2);
    assert.deepEqual(await host.evaluate(()=>({room:roomId,pid:playerId})),credentials);
    await guest.close();
    // Stop live server turns by leaving the room; fixtures then exercise the UI.
    await host.evaluate(()=>{socket.emit('room:leave',{});window.maskmenTestActions=[];sendAction=a=>maskmenTestActions.push(a);setRoomControlsCollapsed(true);});
    await render(host,'playing');
    await host.locator('#maskmenHand button[data-mask="blue"]').click();
    await host.locator('.maskmen-heading h2').click();assert.equal(await host.locator('#maskmenSelection').isVisible(),false);
    await host.locator('#maskmenHand button[data-mask="blue"]').click();
    await host.keyboard.press('Escape');assert.equal(await host.locator('#maskmenSelection').isVisible(),false);
    await host.locator('#maskmenHand button[data-mask="blue"]').click();
    await host.locator('#maskmenCounts [data-count="2"]').click();
    await host.locator('#maskmenPlay').click();
    assert.equal(await host.evaluate(()=>maskmenTestActions.at(-1).count),2);
    assert.equal(await host.evaluate(()=>maskmenTestActions.at(-1).mask),'blue');
    await render(host,'playing');await host.keyboard.press('Escape');
    await host.locator('#maskmenHelpBtn').click();
    assert.match(await host.locator('#maskmenDialogBody').textContent(),/恰好多|先赢 3/);
    await host.keyboard.press('Escape');assert.equal(await host.locator('#maskmenDialog').evaluate(e=>e.open),false);
    await render(host,'blocked');
    assert.equal(await host.locator('#maskmenHand button[data-mask="blue"]').isDisabled(),true);
    const before=await host.evaluate(()=>maskmenTestActions.length);
    await host.locator('#maskmenExplainBtn').click();await pointClick(host,host.locator('#maskmenHand button[data-mask="blue"]'));
    assert.match(await host.locator('#maskmenDialogBody').textContent(),/不能出|蓝面具/);
    assert.equal(await host.evaluate(()=>maskmenTestActions.length),before);
    await host.keyboard.press('Escape');
    await host.locator('#maskmenExplainBtn').click();
    await host.evaluate(()=>{window.maskmenProbeCount=0;const b=document.createElement('button');b.id='maskmenProbe';b.textContent='Probe';b.onclick=()=>maskmenProbeCount++;document.getElementById('maskmenPanel').append(b);});
    await host.locator('#maskmenProbe').click();assert.equal(await host.evaluate(()=>maskmenProbeCount),0);
    await host.keyboard.press('Escape');await host.locator('#maskmenProbe').evaluate(e=>e.remove());
    for(const width of [1440,768,390,320]) {
      await host.setViewportSize({width,height:width>500?1050:844});
      for(const key of ['playing','played_long','blocked','waiting','spectator','one_card','round_review','season_review','ready','finished','duel']) {
        await render(host,key);await bounds(host,`${width}/${key}`);
      }
      await render(host,'playing');
      await host.locator('#maskmenPanel').screenshot({path:`${output}/${width}.png`});
      if(width<=390) {
        await host.evaluate(()=>window.scrollTo(0,0));
        await host.screenshot({path:`${output}/${width}-viewport.png`});
        await host.locator('#maskmenHand button[data-mask="blue"]').click();
        await bounds(host,`${width}/selected`);
        await host.locator('#maskmenSelection').scrollIntoViewIfNeeded();
        await host.screenshot({path:`${output}/${width}-selection.png`});
        await host.keyboard.press('Escape');
      }
    }
    await render(host,'playing');
    await pointClick(host,host.locator('#maskmenSeason'),true);assert.equal(await host.locator('#maskmenTooltip').isVisible(),true);
    assert.match(await host.locator('#maskmenTooltip').textContent(),/赛季/);
    await pointClick(host,host.locator('#maskmenHandCount'),true);assert.match(await host.locator('#maskmenTooltip').textContent(),/手牌/);
    await host.waitForTimeout(3100);assert.equal(await host.locator('#maskmenTooltip').isVisible(),false);
    await host.locator('#maskmenPanel details').first().evaluate(e=>e.open=true);await bounds(host,'320/matrix');
    await host.locator('#maskmenHelpBtn').click();await bounds(host,'320/help');
    await host.locator('#maskmenDialog').screenshot({path:`${output}/help.png`});await host.keyboard.press('Escape');
    await render(host,'round_review');await host.locator('#maskmenNext').click();
    assert.equal(await host.evaluate(()=>maskmenTestActions.at(-1).type),'next_round');
    await render(host,'season_review');await host.locator('#maskmenNext').click();
    assert.equal(await host.evaluate(()=>maskmenTestActions.at(-1).type),'next_season');
    await render(host,'ready');assert.equal(await host.locator('#maskmenNext').isDisabled(),true);
    await host.setViewportSize({width:1440,height:1050});await render(host,'finished');
    assert.match(await host.locator('#maskmenHint').textContent(),/Final result/);
    await host.locator('#maskmenPanel').screenshot({path:`${output}/finished.png`});
    assert.deepEqual(errors,[]);
    console.log('Maskmen browser checks passed: real multiplayer + AI season, review barriers, reconnect, selection, Help/Explain, touch tips, and 44 responsive states.');
  } finally { for(const ctx of contexts) await ctx.close();await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
