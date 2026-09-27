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
p['staff']=['15','24','31','40','2','21']
p['used_staff']=['2']
s['revision']=100
views={'turn':G.get_public_view(s,'0')}
reward=copy.deepcopy(s)
reward['staff_deck']=['1','13','38']
_queue(reward,'0',[hire(3,offer=True)])
_settle(reward)
reward['revision']=101
views['reward']=G.get_public_view(reward,'0')
review=copy.deepcopy(s)
_end_round(review)
review['revision']=102
views['review']=G.get_public_view(review,'0')
views['spectator']=G.get_public_view(s,'watcher')
recruit=copy.deepcopy(s)
recruit['players']['0']['cafe']=recruit['players']['0']['cafe'][:1]
recruit['revision']=103
views['recruit']=G.get_public_view(recruit,'0')
staff_hire=copy.deepcopy(s)
_queue(staff_hire,'0',[hire(3)])
_settle(staff_hire)
staff_hire['revision']=104
views['staff_hire']=G.get_public_view(staff_hire,'0')
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
  async function overlay(p,host,label) {
    const layer=p.locator(`[data-gah-selection-host="${host}"] > .gah-selection-overlay`);
    assert(await layer.isVisible(),`${host}: contextual selection overlay`);
    const alpha=await layer.evaluate(e=>Number(getComputedStyle(e).backgroundColor.match(/[\d.]+/g)[3]));
    assert(alpha>0&&alpha<1,'selection backdrop must be translucent');
    assert(await layer.getByRole('button',{name:'Cancel',exact:true}).isVisible());
    if(label)assert(await layer.getByRole('button',{name:label,exact:true}).isVisible());
    await bounds(p,`${host} overlay`);
    return layer;
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
      await overlay(p,'market','Recruit');
      await confirm(p);
    }
    for(const p of [a,b]) for(const room of [0,1,2]) {
      await p.locator(`#grandAustriaRoot [data-gah-action="room"][data-room="${room}"]`).click();
      await overlay(p,'hotel','Prepare');
      await confirm(p);
    }
    await a.waitForFunction(()=>lastGameStatePayload.view.phase==='turn');
    const initialDice=await a.evaluate(()=>lastGameStatePayload.view.dice.reduce((a,b)=>a+b,0));
    await a.locator('#grandAustriaRoot [data-gah-action="die"]:not(:disabled)').first().click();
    await overlay(a,'dice','Confirm');
    await confirm(a);
    assert.equal(await a.evaluate(()=>lastGameStatePayload.view.dice.reduce((a,b)=>a+b,0)),initialDice-1);
    await fixture(a,'turn');
    await a.evaluate(()=>{window.gahBrowserSent=[];window.gahBrowserOriginalSend=sendAction;window.sendAction=m=>window.gahBrowserSent.push(m);});
    await a.locator('#grandAustriaHand summary').click();
    for(const [kind,label] of [['round','🔁 每轮一次'],['once','⚡ 立即一次'],['permanent','∞ 永久生效'],['end','🏁 终局计分']]) {
      assert.equal(await a.locator(`#grandAustriaHand .gah-timing-${kind}`).first().textContent(),label);
    }
    await a.locator('#grandAustriaStaff summary').click();
    assert.equal(await a.locator('#grandAustriaStaff .gah-staff-used').textContent(),'本轮已用');
    await a.locator('#grandAustriaHand').screenshot({path:path.join(out,'staff-timings.png')});
    for(const width of [1280,768,393,320]) {
      await a.setViewportSize({width,height:980});
      await bounds(a,`${width}px`);
      await a.screenshot({path:path.join(out,`${width}.png`),fullPage:true});
      if(width<650) {
        const docked=a.locator('#grandAustriaExplainBtn');
        assert.equal(await docked.evaluate(e=>e.parentElement.id),'mobileExplainSlot','mobile Explain must use shared dock');
        await docked.click();assert.equal(await docked.getAttribute('aria-pressed'),'true');
        await docked.click();assert.equal(await docked.getAttribute('aria-pressed'),'false','docked Explain can exit its own capture mode');
      }
      await fixture(a,'recruit');
      await a.locator('#grandAustriaRoot [data-gah-action="market"]').first().click();
      await overlay(a,'market','Recruit');
      await a.screenshot({path:path.join(out,`guest-overlay-${width}.png`),fullPage:true});
      await a.locator('.gah-selection-overlay [data-gah-action="cancel"]').click();
      assert.equal(await a.locator('.gah-selection-overlay').count(),0);
      await fixture(a,'turn');
    }
    await a.setViewportSize({width:1280,height:980});
    const icons=await a.evaluate(()=>{
      const help=document.getElementById('grandAustriaHelpBtn'),explain=document.getElementById('grandAustriaExplainBtn');
      return {help:getComputedStyle(help,'::before').content,helpSize:help.getBoundingClientRect().width,explainRing:getComputedStyle(explain,'::before').borderRadius,helpName:help.getAttribute('aria-label'),explainName:explain.getAttribute('aria-label')};
    });
    assert.equal(icons.help,'"?"');assert.equal(icons.helpSize,36);assert.equal(icons.explainRing,'50%');
    assert.equal(icons.helpName,'Help');assert.equal(icons.explainName,'Explain');
    await a.locator('#grandAustriaHelpBtn').click();
    assert(await a.locator('#grandAustriaDialog').evaluate(e=>e.open));
    assert((await a.locator('#grandAustriaDialogBody').textContent()).includes('终局计分(🏁)'));
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#grandAustriaDialog').evaluate(e=>e.open),false);
    const disabled=a.locator('#grandAustriaRoot [data-gah-action="die"]:disabled').first();
    await disabled.scrollIntoViewIfNeeded();
    await a.locator('#grandAustriaExplainBtn').click();
    assert.equal(await disabled.evaluate(e=>getComputedStyle(e).outlineStyle),'dashed');
    const r=await disabled.boundingBox();
    await a.mouse.click(r.x+r.width/2,r.y+r.height/2);
    assert(await a.locator('#grandAustriaDialog').evaluate(e=>e.open),'disabled controls must be explainable');
    assert.equal(await a.locator('#grandAustriaExplainBtn').getAttribute('aria-pressed'),'false');
    await a.keyboard.press('Escape');
    await a.locator('#grandAustriaRoot [data-gah-action="die"]:not(:disabled)').first().click();
    assert(await a.locator('#grandAustriaRoot [data-gah-action="confirm"]').count());
    await a.keyboard.press('Escape');
    assert.equal(await a.locator('#grandAustriaRoot [data-gah-action="confirm"]').count(),0);
    await a.locator('#grandAustriaExplainBtn').click();
    await a.locator('#grandAustriaLog summary').click();
    assert.equal(await a.locator('#grandAustriaLog').evaluate(e=>e.open),false,'unexplained controls must not activate');
    await a.keyboard.press('Escape');
    await a.locator('#grandAustriaExplainBtn').click();
    await a.locator('#grandAustriaHand button[data-staff="38"]').click();
    const explainedStaff=await a.locator('#grandAustriaDialogBody').textContent();
    assert(explainedStaff.includes('立即一次(⚡)')&&explainedStaff.includes('全部订单'),'Explain must identify this staff card and timing');
    await a.keyboard.press('Escape');
    assert.deepEqual(await a.evaluate(()=>gahBrowserSent),[],'Explain and cancellation must not send actions');
    await a.locator('#grandAustriaRoot [data-gah-action="guest"][data-guest="73"]').click();
    await overlay(a,'cafe');
    await a.locator('#grandAustriaRoot [data-gah-action="room"][data-room="0"]').click();
    await overlay(a,'hotel','Check In');
    await a.keyboard.press('Escape');
    await fixture(a,'staff_hire');
    await a.locator('#grandAustriaHand button[data-staff="38"]').click();
    await overlay(a,'hand','Hire');
    await a.screenshot({path:path.join(out,'staff-overlay-1280.png'),fullPage:true});
    await a.locator('.gah-brand').click();
    assert.equal(await a.locator('.gah-selection-overlay').count(),0,'blank space cancels');
    await fixture(a,'reward');
    await bounds(a,'staff choice');
    assert(await a.locator('.gah-options button').count());
    await a.locator('.gah-options button[data-staff="13"]').click();
    await overlay(a,'command','Hire');
    assert((await a.locator('.gah-selection-overlay').textContent()).includes('∞ 永久生效'));
    await a.locator('.gah-selection-overlay [data-gah-action="confirm"]').click();
    assert.deepEqual(await a.evaluate(()=>gahBrowserSent),[fixtures.reward.moves.find(m=>m.type==='hire'&&m.staff==='13')]);
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
    await mobile.locator('#grandAustriaHand summary').click();
    await mobile.locator('#grandAustriaHand .gah-timing-round').first().tap();
    assert((await mobile.locator('#grandAustriaTip').textContent()).includes('每轮一次(🔁)'));
    await mobile.locator('#grandAustriaHand .gah-timing-end').first().tap();
    assert((await mobile.locator('#grandAustriaTip').textContent()).includes('终局计分(🏁)'));
    assert.equal(await mobile.locator('.gah-selection-overlay').count(),0,'timing tips do not select a card');
    await mobile.waitForTimeout(3200);
    assert.equal(await mobile.locator('#grandAustriaTip').isVisible(),false);
    await fixture(mobile,'staff_hire');
    await mobile.locator('#grandAustriaHand button[data-staff="1"]').tap();
    await overlay(mobile,'hand','Hire');
    await mobile.screenshot({path:path.join(out,'staff-overlay-393.png'),fullPage:true});
    await mobile.locator('.gah-selection-overlay [data-gah-action="cancel"]').tap();
    await mobile.locator('#grandAustriaExplainBtn').tap();
    assert.equal(await mobile.locator('#grandAustriaExplainBtn').getAttribute('aria-pressed'),'true');
    await mobile.locator('#grandAustriaExplainBtn').tap();
    assert.equal(await mobile.locator('#grandAustriaExplainBtn').getAttribute('aria-pressed'),'false');
    await bounds(mobile,'touch layout');
    assert.deepEqual(errors,[]);
    console.log('Grand Austria Hotel: real room setup, translucent contextual overlays, shared Help/Explain icons and mobile dock, disabled/card Explain, four staff timings, cancellation, exact hire submission, 4 viewport widths and touch tips passed.');
  } finally {
    for(const p of pages){await p.evaluate(()=>{if(typeof socket!=='undefined')socket.emit('room:leave',{});}).catch(()=>{});}
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
