// Local browser verification; set PLAYWRIGHT_MODULE, PYTHON and ROOM_TEST_URL.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8776';
const output = '.data/orloj-validation/ui';
fs.mkdirSync(output, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-X','utf8','-c', `
import json, copy
from tests.test_orloj import new_game, pending_state
from game.orloj import OrlojGame as G
from game.orloj_data import RESOURCES
s=new_game(4)
views={'turn':G.get_public_view(s,'p0')}
for kind in ('build','workshop','apostle','sculptor','painter','mastery'):
 t=pending_state(kind)
 t['players']['p0']['resources']=dict.fromkeys(RESOURCES,8)
 t['players']['p0']['warehouse']=[]
 views[kind]=G.get_public_view(t,'p0')
t=copy.deepcopy(s)
t['phase']='round_end';t['calls']=1;t['next_ready']=['p1']
t['review']=[{'player_id':pid,'before':3,'remaining':1,'repaired':2,'bonus':0,'points':-1} for pid in t['order']]
views['review']=G.get_public_view(t,'p0')
views['spectator']=G.get_public_view(s,'visitor')
t=pending_state('workshop')
t['market']=[None,None,t['market'][2]];t['workshop_deck']=[]
views['empty_market']=G.get_public_view(t,'p0')
views['reward']=G.get_public_view(pending_state('moon'),'p0')
while not s['game_over']:
 pid=next(p for p in s['order'] if G.get_legal_actions(s,p))
 _,err=G.apply_action(s,pid,G.bot_move(s,pid));assert not err,err
views['over']=G.get_public_view(s,'p0')
print(json.dumps(views))
`], {encoding:'utf8',maxBuffer:12*1024*1024}));

async function setup(page) {
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.goto(base);
  await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
}
async function bounds(page,label) {
  const issues=await page.evaluate(()=>{
    const bad=[...document.querySelectorAll('#orlojPanel *, #orlojDialog[open] *')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      if(!r.width||!r.height||s.display==='none')return false;
      return r.left < -1 || r.right>innerWidth+1 ||
        (el.clientWidth&&el.scrollWidth>el.clientWidth+1&&!['auto','scroll','hidden'].includes(s.overflowX));
    }).map(el=>`${el.className||el.id} ${el.textContent.slice(0,35)}`);
    return {overflow:document.documentElement.scrollWidth>innerWidth,bad};
  });
  assert.deepEqual(issues,{overflow:false,bad:[]},label);
}
async function render(page,key) {
  await page.evaluate(view=>{
    clearOrlojState();playerId=view.you;roomSessionReady=true;
    renderRoomState({room_id:'orloj-test',game_type:'orloj',status:'in_game',host_id:'p0',players:view.players,game_config:{}});
    setGamePanelVisibility('orloj');renderGameState({room_id:'orloj-test',game_type:'orloj',view});
    window.scrollTo(0,0);
  },fixtures[key]);
  await page.locator('.or-wordmark').waitFor({state:'visible'});
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const errors=[];
  try {
    const live=await browser.newPage({viewport:{width:1440,height:1100}});
    live.on('pageerror',error=>errors.push(error.message));
    await setup(live);
    assert.equal(await live.locator('script[src*="games/orloj.js"]').count(),0);
    let broken=false;
    await live.route('**/static/games/orloj.css?*',route=>{
      if(!broken){broken=true;return route.abort();}return route.continue();
    });
    await live.evaluate(()=>socket.emit('room:create',{name:'天文钟匠',game_type:'orloj',config:{seed:125}}));
    await live.locator('#gameAssetsRetryBtn').waitFor({state:'visible'});
    await live.locator('#gameAssetsRetryBtn').click();
    await live.waitForFunction(()=>isGameAssetsLoaded('orloj'));
    await live.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await live.waitForFunction(()=>currentRoomState.players.length===2);
    await live.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await live.waitForFunction(()=>currentRoomState.players.every(p=>p.ready));
    await live.evaluate(()=>emitRoomStart());
    await live.waitForFunction(()=>lastGameStatePayload?.view?.game_id==='orloj');
    await live.locator('.or-wordmark').waitFor({state:'visible'});
    // Real Socket.IO actions through rendered controls, followed by bot turns.
    for(let i=0;i<70;i++) {
      const s=await live.evaluate(()=>({revision:lastGameStatePayload.view.revision,phase:lastGameStatePayload.view.phase,
        moves:lastGameStatePayload.view.moves,turns:lastGameStatePayload.view.players.map(p=>p.turns)}));
      if(s.turns.every(n=>n>=2)||s.phase==='round_end')break;
      if(!s.moves.length){await live.waitForFunction(()=>lastGameStatePayload.view.moves.length,{timeout:15000});continue;}
      const direct=await live.locator('#orlojRoot [data-or-action^="direct:"]:not(:disabled)').all();
      if(direct.length)await direct[direct.length-1].click();
      else {
        const choice=live.locator('#orlojRoot [data-or-action^="move:"]:not(:disabled)').first();
        await choice.click();
        await live.getByRole('button',{name:'Confirm',exact:true}).click();
      }
      await live.waitForFunction(revision=>lastGameStatePayload.view.revision!==revision,s.revision);
    }
    await bounds(live,'real room');
    console.log('Actual Socket.IO room, AI turns and failed-resource retry passed');
    await live.close();
    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    page.on('pageerror',error=>errors.push(error.message));
    await setup(page);
    await page.evaluate(()=>ensureGameAssets('orloj'));
    let checks=0;
    for(const width of [320,360,393,768,1024,1440]) {
      await page.setViewportSize({width,height:1050});
      for(const key of Object.keys(fixtures)) {
        await render(page,key);
        await bounds(page,`${key} ${width}`);checks++;
        if(['turn','over'].includes(key)) {
          for(const tab of ['clock','calendar','workshop','mastery','apostles']) {
            await page.locator(`[data-or-action="tab:${tab}"]`).click();
            await bounds(page,`${tab} ${width}`);checks++;
          }
          await page.locator('[data-or-action="tab:clock"]').click();
        }
        if(['build','workshop','apostle','painter'].includes(key)) {
          const selectable=page.locator('[data-or-action^="move:"]:not(:disabled)').first();
          if(await selectable.count()) {
            await selectable.click();await bounds(page,`${key} selection ${width}`);checks++;
            await page.keyboard.press('Escape');
          }
        }
        if((width===393||width===1440)&&['turn','build','workshop','review','over'].includes(key))
          await page.screenshot({path:`${output}/${key}-${width}.png`,fullPage:true});
      }
    }
    await render(page,'turn');
    await page.locator('#orlojHelpBtn').click();
    assert.equal(await page.locator('#orlojDialog').evaluate(el=>el.open),true);
    await bounds(page,'Help');
    await page.keyboard.press('Escape');
    await page.locator('[data-or-action="tab:apostles"]').click();
    await page.locator('#orlojExplainBtn').click();
    const disabled=page.locator('.or-apostle:disabled').first();
    const box=await disabled.boundingBox();
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await page.locator('#orlojDialog').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#orlojExplainBtn').getAttribute('aria-pressed'),'false');
    await page.keyboard.press('Escape');
    const mobile=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    mobile.on('pageerror',error=>errors.push(error.message));
    await setup(mobile);await mobile.evaluate(()=>ensureGameAssets('orloj'));await render(mobile,'turn');
    const resources=mobile.locator('.or-resources [data-or-tip]');
    await resources.nth(0).tap();assert.equal(await mobile.locator('#orlojTip').isVisible(),true);
    await resources.nth(1).tap();assert.match(await mobile.locator('#orlojTip').textContent(),/木材/);
    await mobile.waitForTimeout(3150);assert.equal(await mobile.locator('#orlojTip').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log(`${checks} responsive checks; Help/Escape, disabled Explain, mobile tooltips passed`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
