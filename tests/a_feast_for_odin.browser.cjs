// Local UI verification: set PLAYWRIGHT_MODULE, PYTHON and ROOM_TEST_URL.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8786';
const output = '.data/odin-validation/ui';
fs.mkdirSync(output, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-X','utf8','-c', `
import json, copy
from tests.test_a_feast_for_odin import new_game, pending_state
from game.a_feast_for_odin import AFeastForOdinGame as G, new_board, _begin_income, _finish_feast, _finish_game, _settle
from game.a_feast_for_odin_data import GOODS, OCCUPATIONS, effect
s=new_game(4);s['current_turn']='p0'
p=s['players']['p0'];p['stock']={g:2 for g in GOODS};p['stock']['silver']=15
p['ships']=[{'kind':k,'ore':0} for k in ('whaler','knarr','longship')]
p['boards'] += [new_board(k) for k in ('iceland','stone_house','long_house','shed')]
p['hand']=['orient:0','farmer:0'];p['occupations']=['tutor:0','miller:0','farm_shop:0']
s['player_meta']['p2']['name']='很长的维京探险家名字ABCDEFGHIJKLMNOPQRSTUVWXYZ'
views={'action':G.get_public_view(s,'p0'),'spectator':G.get_public_view(s,'visitor')}
def pending_fixture(kind,**kwargs):
 t=copy.deepcopy(s);t['active']={'space':'hunt1','action':'hunt1','used':True,'gains':{}}
 t['pending']=[effect(kind,main=True,**kwargs)];_settle(t);return t
for mode in ('hunt','whale','pillage'):
 t=pending_fixture('hunt',mode=mode,boats=3);t['players']['p0']['stock']['stone']=4;t['players']['p0']['weapons']['sword']=3
 views[mode]=G.get_public_view(t,'p0')
for kind,kwargs in [('upgrade',dict(count=3,steps=2)),('mountain',dict(counts=[3,2])),('occupation',dict(count=2)),('timing',{}),('special_sale',dict(count=2)),('explore',dict(tier=3))]:
 t=pending_fixture(kind,**kwargs)
 views[kind]=G.get_public_view(t,'p0')
t=copy.deepcopy(s);t.update(current_turn=None,active=None,pending=[],phase='prepare');views['prepare']=G.get_public_view(t,'p0')
_begin_income(t);views['feast']=G.get_public_view(t,'p0')
for pid in t['order']:_finish_feast(t,pid)
views['review']=G.get_public_view(t,'p0')
t.update(phase='final_placement',round=7,ready=[]);views['final']=G.get_public_view(t,'p0')
_finish_game(t);views['over']=G.get_public_view(t,'p0')
print(json.dumps(views))
`], {encoding:'utf8',maxBuffer:15*1024*1024}));

async function setup(page) {
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.goto(base);
  await page.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
}
async function bounds(page,label) {
  const issues=await page.evaluate(()=>{
    const bad=[...document.querySelectorAll('#odinPanel *, #odinDialog[open] *')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      if(!r.width||!r.height||s.display==='none')return false;
      // Children clipped by a scrolling list are allowed to be outside its viewport.
      if(el.closest('.od-inventory,.od-options,.od-action-list,.od-card-list,.od-log') &&
         !el.matches('.od-inventory,.od-options,.od-action-list,.od-card-list,.od-log')) {
        const parent=el.closest('.od-inventory,.od-options,.od-action-list,.od-card-list,.od-log').getBoundingClientRect();
        if(r.top>=parent.bottom||r.bottom<=parent.top)return false;
      }
      return r.left < -1 || r.right>innerWidth+1 ||
        (el.clientWidth&&el.scrollWidth>el.clientWidth+1&&!['auto','scroll','hidden','clip'].includes(s.overflowX));
    }).map(el=>`${el.className||el.id} ${el.textContent.slice(0,35)}`);
    return {overflow:document.documentElement.scrollWidth>innerWidth,bad};
  });
  assert.deepEqual(issues,{overflow:false,bad:[]},label);
}
async function render(page,key) {
  await page.evaluate(view=>{
    clearOdinState();playerId=view.you;roomSessionReady=true;
    renderRoomState({room_id:'odin-test',game_type:'a_feast_for_odin',status:'in_game',host_id:'p0',players:view.players,game_config:{}});
    setGamePanelVisibility('a_feast_for_odin');renderGameState({room_id:'odin-test',game_type:'a_feast_for_odin',view});
    window.scrollTo(0,0);
  },fixtures[key]);
  await page.locator('.od-wordmark').waitFor({state:'visible'});
}
async function intercept(page) {
  await page.evaluate(()=>{
    window.odinCaptured=[];
    const original=socket.emit.bind(socket);
    socket.emit=(event,...args)=>event==='game:action'?odinCaptured.push(args[0]):original(event,...args);
  });
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const errors=[];
  try {
    if(!process.env.ODIN_SKIP_LIVE) {
    const live=await browser.newPage({viewport:{width:1440,height:1100}});
    live.on('pageerror',error=>{errors.push(error.message);console.error('UI error:',error.message);});
    await setup(live);
    assert.equal(await live.locator('script[src*="games/a_feast_for_odin.js"]').count(),0);
    let broken=false;
    await live.route('**/static/games/a_feast_for_odin.css?*',route=>{
      if(!broken){broken=true;return route.abort();}return route.continue();
    });
    await live.evaluate(()=>socket.emit('room:create',{name:'维京测试',game_type:'a_feast_for_odin',config:{seed:126}}));
    await live.locator('#gameAssetsRetryBtn').waitFor({state:'visible'});
    await live.locator('#gameAssetsRetryBtn').click();
    await live.waitForFunction(()=>isGameAssetsLoaded('a_feast_for_odin'));
    await live.locator('#odinRounds').selectOption('6');
    await live.evaluate(()=>socket.emit('room:add_bot',{room_id:roomId}));
    await live.waitForFunction(()=>currentRoomState.players.length===2);
    await live.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await live.waitForFunction(()=>currentRoomState.players.every(p=>p.ready));
    await live.evaluate(()=>emitRoomStart());
    await live.waitForFunction(()=>lastGameStatePayload?.view?.game_id==='a_feast_for_odin');
    await live.locator('.od-wordmark').waitFor({state:'visible'});
    assert.equal(await live.evaluate(()=>lastGameStatePayload.view.rounds),6);
    // A real submitted action, followed by automatic bot resolution and a round barrier.
    for(let i=0;i<90;i++) {
      await live.waitForFunction(()=>{
        const v=lastGameStatePayload.view;
        return v.phase==='round_end'||(v.phase==='action'?v.current_turn===playerId:v.moves.length>0);
      },null,{timeout:20000});
      const state=await live.evaluate(()=>({revision:lastGameStatePayload.view.revision,phase:lastGameStatePayload.view.phase,moves:lastGameStatePayload.view.moves}));
      if(state.phase==='round_end')break;
      if(state.phase==='action') {
        if(state.moves.some(m=>m.type==='end_turn'))await live.locator('[data-od-action="direct:end_turn"]').click();
        else if(state.moves.some(m=>m.type==='occupy')) {
          const choice=live.locator('.od-action:not(:disabled)').first();
          if(await choice.count()) {
            await choice.click();await live.getByRole('button',{name:'Confirm',exact:true}).click();
          } else await live.locator('[data-od-action="direct:pass"]').click();
        } else {
          const choice=live.locator('.od-console [data-od-action^="move:"]:not(:disabled)').first();
          await choice.click();
          const confirm=live.getByRole('button',{name:'Confirm',exact:true});
          if(await confirm.count())await confirm.click();
        }
      } else if(state.phase==='prepare') {
        await live.getByRole('button',{name:'Ready',exact:true}).click();
        await live.waitForFunction(()=>lastGameStatePayload.view.phase!=='prepare'||lastGameStatePayload.view.ready.includes(playerId));
      } else if(state.phase==='feast') {
        await live.getByRole('button',{name:'Auto Feed',exact:true}).click();
        await live.waitForFunction(()=>lastGameStatePayload.view.phase!=='feast'||lastGameStatePayload.view.feast_done.includes(playerId));
      }
      await live.waitForFunction(revision=>lastGameStatePayload.view.revision!==revision,state.revision);
    }
    await live.waitForFunction(()=>lastGameStatePayload.view.phase==='round_end',null,{timeout:20000});
    await bounds(live,'real room review');
    await live.getByRole('button',{name:'Next Round',exact:true}).click();
    await live.waitForFunction(()=>lastGameStatePayload.view.round===2);
    console.log('Actual Socket.IO, 6-round config, AI turn, asset retry and review barrier passed');
    await live.close();
    }

    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    page.on('pageerror',error=>errors.push(error.message));
    await setup(page);await page.evaluate(()=>ensureGameAssets('a_feast_for_odin'));await intercept(page);
    let checks=0;
    for(const width of [320,360,393,768,1024,1440]) {
      await page.setViewportSize({width,height:1050});
      for(const key of Object.keys(fixtures)) {
        await render(page,key);await bounds(page,`${key} ${width}`);checks++;
        if(['action','over'].includes(key)) {
          for(const tab of ['harbor','islands','jobs','home']) {
            await page.locator(`[data-od-action="tab:${tab}"]`).click();
            await bounds(page,`${tab} ${width}`);checks++;
          }
          for(let b=1;b<5;b++) {
            await page.locator(`[data-od-action="board:${b}"]`).click();
            await bounds(page,`board ${b} ${width}`);checks++;
          }
          await page.locator('[data-od-action="board:0"]').click();
        }
        if(key==='action') {
          for(const category of ['build','hunt','market','craft','trade','sail','occupation']) {
            await page.locator(`[data-od-action="group:${category}"]`).click();
            await bounds(page,`${category} ${width}`);checks++;
          }
        }
        if(['upgrade','pillage','occupation'].includes(key)) {
          const choice=page.locator('.od-console [data-od-action^="move:"]:not(:disabled)').first();
          await choice.click();await bounds(page,`${key} selection ${width}`);checks++;
          await page.keyboard.press('Escape');
        }
        if((width===393||width===1440)&&['action','feast','pillage','review','over'].includes(key))
          await page.screenshot({path:`${output}/${key}-${width}.png`,fullPage:true});
      }
    }
    await render(page,'action');
    await page.locator('#odinHelpBtn').click();
    assert.equal(await page.locator('#odinDialog').evaluate(el=>el.open),true);
    await bounds(page,'Help');await page.keyboard.press('Escape');
    await page.locator('#odinExplainBtn').click();
    const disabled=page.locator('.od-cell.od-negative:disabled').first();
    const box=await disabled.boundingBox();
    await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
    assert.equal(await page.locator('#odinDialog').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#odinExplainBtn').getAttribute('aria-pressed'),'false');
    await page.keyboard.press('Escape');
    // Unknown controls cannot act in Explain mode.
    await page.evaluate(()=>{const b=document.createElement('button');b.id='odinUnknown';b.textContent='Unknown';b.onclick=()=>window.odinUnexpected=true;document.querySelector('#odinRoot').append(b);});
    await page.locator('#odinExplainBtn').click();await page.locator('#odinUnknown').click();
    assert.equal(await page.evaluate(()=>!!window.odinUnexpected),false);
    await page.keyboard.press('Escape');
    // Placement preview, rotation, mirror, blank cancellation and authoritative payload.
    await render(page,'action');
    await page.locator('[data-od-action="good:rune"]').click();
    await page.locator('[data-od-action="rotate"]').click();
    await page.locator('[data-od-action="flip"]').click();
    await page.locator('[data-od-action="cell:0:10"]').click();
    assert.equal(await page.locator('.od-ghost').count(),2);
    await page.getByRole('button',{name:'Confirm placement',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>odinCaptured.at(-1).action),{type:'place',revision:fixtures.action.revision,board:0,good:'rune',x:0,y:10,rotation:1,flip:true});
    await render(page,'action');await page.locator('[data-od-action="good:rune"]').click();
    await page.locator('.od-wordmark').click();assert.equal(await page.locator('.od-placement').count(),0);
    await render(page,'feast');
    await page.locator('.od-feast .od-options button').first().click();
    assert.equal(await page.locator('.od-feast .od-selection').count(),1);
    await page.locator('.od-feast').getByRole('button',{name:'Confirm',exact:true}).click();
    assert.equal(await page.evaluate(()=>odinCaptured.at(-1).action.type),'serve');
    await render(page,'review');await page.getByRole('button',{name:'Next Round',exact:true}).click();
    assert.equal(await page.evaluate(()=>odinCaptured.at(-1).action.type),'next_round');

    const mobile=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    mobile.on('pageerror',error=>errors.push(error.message));
    await setup(mobile);await mobile.evaluate(()=>ensureGameAssets('a_feast_for_odin'));await render(mobile,'action');
    const resources=mobile.locator('.od-resources [data-od-tip]');
    await resources.nth(0).tap();assert.equal(await mobile.locator('#odinTip').isVisible(),true);
    await resources.nth(1).tap();assert.match(await mobile.locator('#odinTip').textContent(),/木材/);
    await mobile.waitForTimeout(3100);assert.equal(await mobile.locator('#odinTip').isVisible(),false);
    await mobile.locator('#odinHelpBtn').tap();await bounds(mobile,'mobile Help');
    await mobile.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log(`${checks} viewport/state checks passed; placement, Help/Explain, keyboard, touch tooltips passed`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
