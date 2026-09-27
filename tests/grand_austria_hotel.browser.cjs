// Local server: python -m uvicorn app:app --port 8872
// PLAYWRIGHT_MODULE and PYTHON can select already-installed runtimes.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8872';
const out = path.resolve('build/grand-austria-hotel');
fs.mkdirSync(out, {recursive:true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy,json
from tests.test_grand_austria_hotel import playing
from game.grand_austria_hotel import GrandAustriaHotelGame as G,_end_round,_queue,_settle
from game.grand_austria_hotel_data import effect,hire
s=playing()
p=s['players']['0']
p['cafe']=[{'id':'60','served':{'cake':1}}, {'id':'73','served':{'wine':1,'coffee':2}}, {'id':'90','served':{}}]
p['hand']=['1','4','13','17','29','38']
p['staff']=['15','24','31','40']
s['revision']=100
views={'turn':G.get_public_view(s,'0')}
reward=copy.deepcopy(s)
_queue(reward,'0',[hire(3,offer=True)])
_settle(reward)
reward['revision']=101
views['reward']=G.get_public_view(reward,'0')
review=copy.deepcopy(s)
_end_round(review)
review['revision']=102
views['review']=G.get_public_view(review,'0')
views['spectator']=G.get_public_view(s,'watcher')
print(json.dumps(views))
`], {encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}}));

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const pages=[], errors=[];
  async function page() {
    const context=await browser.newContext({viewport:{width:1280,height:980}});
    const p=await context.newPage();pages.push(p);
    p.on('pageerror', e=>errors.push(e.message));
    await p.route('https://fonts.googleapis.com/**',r=>r.abort());
    await p.goto(base);
    await p.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected);
    return p;
  }
  async function confirm(p) {
    const revision=await p.evaluate(()=>lastGameStatePayload.view.revision);
    await p.locator('#grandAustriaRoot [data-gah-action="confirm"]').click();
    await p.waitForFunction(rev=>lastGameStatePayload.view.revision>rev,revision);
  }
  async function bounds(p,label) {
    const result=await p.evaluate(()=>({
      width:innerWidth,body:document.documentElement.scrollWidth,
      overflow:[...document.querySelectorAll('#grandAustriaRoot *')].filter(e=>{
        const r=e.getBoundingClientRect();
        return r.width>0&&r.height>0&&getComputedStyle(e).display!=='inline'&&e.tagName!=='SELECT'&&e.scrollWidth>e.clientWidth+2;
      }).map(e=>({tag:e.tagName,cls:e.className,w:e.clientWidth,scroll:e.scrollWidth})).slice(0,12)
    }));
    assert(result.body<=result.width,`${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.overflow,[],`${label}: component overflow`);
  }
  async function fixture(p,key) {
    await p.evaluate(v=>{window.showGrandAustriaHeaderActions(true);window.renderGrandAustriaGameState({view:v,room_id:'preview'});},fixtures[key]);
  }
  try {
    const a=await page(), b=await page();
    assert.equal(await a.locator('#grandAustriaRoot').count(),0,'assets must be lazy');
    await a.evaluate(()=>socket.emit('room:create',{name:'Vienna Hotel',game_type:'grand_austria_hotel',config:{seed:4}}));
    await a.waitForFunction(()=>currentRoomState?.game_type==='grand_austria_hotel'&&isGameAssetsLoaded('grand_austria_hotel'));
    const rid=await a.evaluate(()=>roomId);
    await b.evaluate(rid=>socket.emit('room:join',{name:'Café Mozart',room_id:rid}),rid);
    await b.waitForFunction(()=>currentRoomState?.players.length===2&&isGameAssetsLoaded('grand_austria_hotel'));
    await a.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await b.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await a.waitForFunction(()=>currentRoomState.players.every(p=>p.ready));
    await a.evaluate(()=>socket.emit('room:start',{room_id:roomId}));
    await b.waitForFunction(()=>lastGameStatePayload?.view.phase==='setup_guest');
    for(const p of [b,a]) {
      await p.locator('#grandAustriaRoot [data-gah-action="market"]').first().click();
      await confirm(p);
    }
    for(const p of [a,b]) for(const room of [0,1,2]) {
      await p.locator(`#grandAustriaRoot [data-gah-action="room"][data-room="${room}"]`).click();
      await confirm(p);
    }
    await a.waitForFunction(()=>lastGameStatePayload.view.phase==='turn');
    const initialDice=await a.evaluate(()=>lastGameStatePayload.view.dice.reduce((a,b)=>a+b,0));
    await a.locator('#grandAustriaRoot [data-gah-action="die"]:not(:disabled)').first().click();
    await confirm(a);
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.dice.reduce((a,b)=>a+b,0)),initialDice-1);
    await fixture(a,'turn');
    for(const width of [1280,768,393,320]) {
      await a.setViewportSize({width,height:980});
      await bounds(a,`${width}px`);
      await a.screenshot({path:path.join(out,`${width}.png`),fullPage:true});
    }
    await a.setViewportSize({width:1280,height:980});
    await a.locator('#grandAustriaHelp').click();
    assert(await a.locator('#grandAustriaDialog').evaluate(e=>e.open));
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#grandAustriaDialog').evaluate(e=>e.open),false);
    const disabled=a.locator('#grandAustriaRoot [data-gah-action="die"]:disabled').first();
    await disabled.scrollIntoViewIfNeeded();
    await a.locator('#grandAustriaExplain').click();
    const r=await disabled.boundingBox();
    await a.mouse.click(r.x+r.width/2,r.y+r.height/2);
    assert(await a.locator('#grandAustriaDialog').evaluate(e=>e.open),'disabled controls must be explainable');
    assert.equal(await a.locator('#grandAustriaExplain').getAttribute('aria-pressed'),'false');
    await a.keyboard.press('Escape');
    await a.locator('#grandAustriaRoot [data-gah-action="die"]:not(:disabled)').first().click();
    assert(await a.locator('#grandAustriaRoot [data-gah-action="confirm"]').count());
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#grandAustriaRoot [data-gah-action="confirm"]').count(),0);
    await fixture(a,'reward');
    await bounds(a,'staff choice');
    assert(await a.locator('.gah-options button').count());
    await fixture(a,'review');
    await bounds(a,'round review');
    assert.equal(await a.locator('.gah-review-player').count(),2);
    await a.screenshot({path:path.join(out,'review.png'),fullPage:true});
    await fixture(a,'spectator');
    assert.equal(await a.locator('#grandAustriaRoot [data-gah-action="die"]:not(:disabled)').count(),0);
    const touchContext=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const mobile=await touchContext.newPage();
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(base);
    await mobile.waitForFunction(()=>typeof ensureGameAssets==='function');
    await mobile.evaluate(async()=>{await ensureGameAssets('grand_austria_hotel');document.getElementById('grandAustriaPanel').classList.remove('hidden');document.querySelectorAll('#grandAustriaPanel.hidden').forEach(e=>e.classList.remove('hidden'));});
    // The lobby parent may be hidden; use the existing panel inside a visible test container.
    await mobile.evaluate(()=>{document.body.append(document.getElementById('grandAustriaPanel'));document.body.append(document.getElementById('grandAustriaHeaderActions'));});
    await fixture(mobile,'turn');
    const token=mobile.locator('.gah-resource [data-gah-tip]').first();
    await token.tap();
    assert(await mobile.locator('#grandAustriaTip').isVisible());
    await mobile.waitForTimeout(3200);
    assert.equal(await mobile.locator('#grandAustriaTip').isVisible(),false);
    await bounds(mobile,'touch layout');
    assert.deepEqual(errors,[]);
    console.log('Grand Austria Hotel: real room setup, die action, 4 viewport widths, Help, disabled Explain, Esc, reward, review, spectator and touch tips passed.');
  } finally {
    for(const p of pages){await p.evaluate(()=>{if(typeof socket!=='undefined')socket.emit('room:leave',{});}).catch(()=>{});}
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
