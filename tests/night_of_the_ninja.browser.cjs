// Run with a local uvicorn server and PLAYWRIGHT_MODULE pointing to Playwright.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8146';
const output = 'build/night-ninja-ui';
fs.mkdirSync(output, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json,copy
from tests.test_night_of_the_ninja import make_state,activate,apply,house
from game.night_of_the_ninja import NightOfTheNinjaGame as G,_score,_start_reveal
s=make_state(11)
s['player_meta']['p1']['name']='LongUnbrokenNinjaNameForMobileOverflowVerification'
s['player_meta']['p2']['name']='名字非常长的玩家用于移动端布局检查'
v={'draft':G.get_public_view(s,'p0'),'spectator':G.get_public_view(s,'guest')}
for c in ['spy_1','mystic_1','shapeshifter_1','gravedigger_2','troublemaker_3','spirit_merchant_4','thief_5','judge_6','blind_assassin_1','shinobi_1']:
 t=copy.deepcopy(s)
 t['players']['p0']['honor']=[2,3]
 t['players']['p1']['honor']=[4,3,2]
 t['discard']=['shinobi_5','mastermind']
 activate(t,c,hands={'p1':['mirror_monk','martyr']})
 v['target_'+c]=G.get_public_view(t,'p0')
 if c=='gravedigger_2':continue
 kw={'targets':['p1','p2'] if c=='shapeshifter_1' else ['p1']}
 if c=='spirit_merchant_4':kw.update(mode='honor',token_index=0)
 if c=='thief_5':kw.update(token_index=0)
 apply(t,'p0','target',**kw)
 v['decision_'+c]=G.get_public_view(t,'p0')
 if t['phase']=='react':v['reaction']=G.get_public_view(t,'p1')
t=copy.deepcopy(s)
for p in t['players'].values():p['hand']=[]
t['players']['p0']['hand']=['spy_1','spy_3','spy_6']
_start_reveal(t)
v['reveal']=G.get_public_view(t,'p0')
t['night_index']=5
t['players']['p0']['hand']=['mastermind']
_start_reveal(t)
v['mastermind']=G.get_public_view(t,'p0')
t['submissions']={}
_score(t)
v['review']=G.get_public_view(t,'p0')
t['players']['p0']['honor']=[4,4,4,4]
_score(t)
v['finished']=G.get_public_view(t,'p0')
print(json.dumps(v))
`], {encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));

async function bounds(page, label) {
  const r = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#nightNinjaPanel *, #nightNinjaDialog *')].filter(el => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return r.width && r.height && (r.left < -1 || r.right > innerWidth+1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth+1 && !['auto','scroll','hidden'].includes(s.overflowX)));
    }).map(el => `${el.className || el.id}: ${el.textContent.slice(0,45)} (${el.clientWidth}/${el.scrollWidth})`);
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,bad};
  });
  assert(r.scroll <= r.width, `${label} page overflow ${JSON.stringify(r)}`);
  assert.deepEqual(r.bad,[],`${label} container overflow`);
}
async function render(page,key) {
  await page.evaluate(view => renderNightNinjaGameState({room_id:roomId,game_type:'night_of_the_ninja',view}),fixtures[key]);
}
async function pointClick(page,locator,touch=false) {
  await locator.scrollIntoViewIfNeeded();
  const r=await locator.boundingBox();
  if(touch) await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  else await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const contexts=[], pages=[], errors=[];
  try {
    for(let i=0;i<4;i++) {
      const context=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});
      const page=await context.newPage();contexts.push(context);pages.push(page);
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('https://fonts.googleapis.com/**',r=>r.abort());
      await page.goto(base);
      await page.waitForFunction(()=>typeof socket!=='undefined' && socket.connected && cachedGameList);
    }
    const page=pages[0];
    assert.equal(await page.locator('#nightNinjaPanel').evaluate(el=>el.children.length),0);
    assert.equal(await page.locator('script[src*="games/night_of_the_ninja.js"]').count(),0);
    await page.evaluate(()=>socket.emit('room:create',{name:'Akira',game_type:'night_of_the_ninja',config:{seed:146}}));
    await page.waitForFunction(()=>currentGameType==='night_of_the_ninja' && isGameAssetsLoaded('night_of_the_ninja'));
    const room=await page.evaluate(()=>roomId);
    for(let i=1;i<4;i++) {
      await pages[i].evaluate(({room,i})=>socket.emit('room:join',{room_id:room,name:['Akira','Yuki','Ren','Sora'][i]}),{room,i});
      await pages[i].waitForFunction(()=>isGameAssetsLoaded('night_of_the_ninja'));
    }
    for(const p of pages) await p.evaluate(()=>socket.emit('room:ready',{ready:true}));
    await page.waitForFunction(()=>currentRoomState.players.length===4 && currentRoomState.players.every(p=>p.ready));
    await page.locator('#startBtn').click();
    for(const p of pages) await p.waitForFunction(()=>lastGameStatePayload?.view.game_id==='night_of_the_ninja');
    for(let step=0;step<2;step++) {
      for(const p of pages) {
        const candidate=p.locator('#nnSurface [data-nn-card]:not(:disabled)').first();
        await candidate.click();await p.locator('[data-nn-action="draft"]').click();
      }
      await page.waitForFunction(step=>lastGameStatePayload.view.phase!=='draft' || lastGameStatePayload.view.draft_step>step+1,step);
    }
    const saved=await page.evaluate(()=>({room:roomId,player:playerId,window:lastGameStatePayload.view.window_id}));
    await page.reload();
    await page.waitForFunction(s=>roomId===s.room && playerId===s.player && isGameAssetsLoaded('night_of_the_ninja') && lastGameStatePayload?.view.window_id===s.window,saved);
    let played=false;
    for(let step=0;step<100;step++) {
      const state=await page.evaluate(()=>lastGameStatePayload.view);
      if(state.phase==='round_end')break;
      for(const p of pages) {
        const v=await p.evaluate(()=>lastGameStatePayload.view);
        const legal=v.legal_actions[0];if(!legal)continue;
        if(legal==='next_round')break;
        if(legal==='reveal') {
          if(['spy','mystic'].includes(v.night_phase)) {
            const cards=p.locator('#nnSurface [data-nn-card]:not(:disabled)');
            if(await cards.count()) {await cards.first().click();played=true;}
          }
          await p.locator('[data-nn-action="reveal"]').click();
        } else if(legal==='target') {
          const target=p.locator('[data-nn-target]:not(:disabled)').first();await target.click();
          await p.locator('[data-nn-action="target"]').click();
        } else if(legal==='decide')await p.locator('[data-nn-action="decide:continue"]').click();
        else if(legal==='mastermind')await p.locator('[data-nn-action="mastermind:no"]').click();
        else throw new Error('unexpected phase '+legal);
        await p.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,v.revision);
      }
      await page.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,state.revision);
    }
    assert(played,'real round should use an information card');
    assert.equal(await page.evaluate(()=>lastGameStatePayload.view.phase),'round_end');
    for(const p of pages.slice(0,3))await p.locator('[data-nn-action="next_round"]').click();
    assert.equal(await page.evaluate(()=>lastGameStatePayload.view.round),1);
    await pages[3].locator('[data-nn-action="next_round"]').click();
    await page.waitForFunction(()=>lastGameStatePayload.view.round===2);
    console.log('PASS real four-player draft, reveal, private peek, round review, all-player confirmation, reload');

    await page.evaluate(()=>{window.nnTestActions=[];window.sendAction=a=>window.nnTestActions.push(a);});
    await render(page,'draft');
    await page.evaluate(()=>setRoomControlsCollapsed(true));
    assert(await page.locator('body').evaluate(el=>el.classList.contains('nn-needs-action')));
    await page.locator('#nightNinjaHelpBtn').click();
    assert((await page.locator('#nnDialogBody').innerText()).includes('等概率'));
    await bounds(page,'help');await page.keyboard.press('Escape');
    assert.equal(await page.locator('#nightNinjaDialog').evaluate(el=>el.open),false);
    await page.locator('#nightNinjaExplainBtn').click();
    await pointClick(page,page.locator('[data-nn-action="draft"]'));
    assert.equal(await page.locator('#nightNinjaDialog').evaluate(el=>el.open),true);
    assert.equal(await page.evaluate(()=>nnTestActions.length),0);
    await page.keyboard.press('Escape');
    await page.locator('[data-nn-card]').first().click();
    await page.locator('.nn-night').click();
    assert.equal(await page.locator('.nn-card.is-selected').count(),0);
    await page.locator('[data-nn-card]').first().click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('.nn-card.is-selected').count(),0);
    await render(page,'target_shapeshifter_1');
    await page.locator('[data-nn-target="p1"]').click();await page.locator('[data-nn-target="p2"]').click();
    await page.locator('[data-nn-action="target"]').click();
    assert.deepEqual(await page.evaluate(()=>nnTestActions.at(-1).targets),['p1','p2']);
    await render(page,'target_gravedigger_2');
    await page.locator('[data-nn-card="mastermind"]').click();
    assert(await page.locator('[data-nn-action="decide:play"]').isDisabled());
    await page.locator('[data-nn-action="decide:hold"]').click();
    assert.equal(await page.evaluate(()=>nnTestActions.at(-1).card_id),'mastermind');
    await render(page,'reaction');
    await page.locator('[data-nn-action="react:mirror_monk"]').click();
    assert.equal(await page.evaluate(()=>nnTestActions.at(-1).choice),'mirror_monk');
    for(const width of [1440,390,320]) {
      await page.setViewportSize({width,height:width===1440?1100:900});
      for(const key of Object.keys(fixtures)){await render(page,key);await bounds(page,`${width} ${key}`);}
      await render(page,'reveal');
      const last=page.locator('.nn-card').last();await last.scrollIntoViewIfNeeded();
      const top=await page.locator('.nn-cards').evaluate(el=>el.scrollTop);
      await last.click();assert.equal(await page.locator('.nn-cards').evaluate(el=>el.scrollTop),top);
      if(width<600) {
        const hint=page.locator('.nn-score [data-nn-tip]');await pointClick(page,hint,true);
        assert.equal(await page.locator('#nnTooltip').evaluate(el=>el.hidden),false);
        await page.waitForTimeout(3150);
        assert.equal(await page.locator('#nnTooltip').evaluate(el=>el.hidden),true);
      }
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS Help/Explain disabled controls, Esc, selection, reactions, mobile tips, all phases 1440/390/320, no overflow');
  }catch(error){
    console.error('Browser errors:',errors);
    for(let i=0;i<pages.length;i++) {
      console.error('Page',i,await pages[i].evaluate(()=>({player:playerId,phase:lastGameStatePayload?.view.phase,legal:lastGameStatePayload?.view.legal_actions,html:document.getElementById('nnSurface')?.innerText.slice(0,3000)})));
      await pages[i].screenshot({path:`${output}/failure-${i}.png`,fullPage:true});
    }
    throw error;
  }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
