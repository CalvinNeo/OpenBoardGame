// Run against a local server with PLAYWRIGHT_MODULE pointing to Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8768';
const output = process.env.MIND_QA_OUTPUT || 'tmp/mind-the-lines-qa';
fs.mkdirSync(output, {recursive: true});

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const contexts = [], errors = [];
  let passed = false;
  async function page(mobile = false) {
    const context = await browser.newContext({viewport: {width: mobile ? 390 : 1440, height: 960}, hasTouch: mobile, isMobile: mobile});
    contexts.push(context);
    const result = await context.newPage();
    result.on('pageerror', error => errors.push(error.message));
    await result.route('https://fonts.googleapis.com/**', route => route.abort());
    await result.goto(base);
    await result.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return result;
  }
  async function view(p) { return p.evaluate(() => lastGameStatePayload.view); }
  async function phase(p, value) { await p.waitForFunction(value => lastGameStatePayload?.view.phase === value, value); }
  async function layout(p, label) {
    const overflow = await p.evaluate(() => {
      const panel = document.getElementById('mindTheLinesPanel');
      const bad = [...panel.querySelectorAll('*')].filter(n => {
        const r = n.getBoundingClientRect();
        if (!r.width || !r.height || n.closest('svg')) return false;
        return r.right > innerWidth + 1 || r.left < -1;
      }).map(n => n.id || n.className);
      return {page: document.documentElement.scrollWidth > innerWidth + 1, bad};
    });
    assert.deepEqual(overflow, {page: false, bad: []}, `${label}: ${JSON.stringify(overflow)}`);
    await p.locator('#mindTheLinesPanel').screenshot({path: `${output}/${label}.png`});
  }
  async function draw(p, touch = false) {
    await p.locator('#mindTheLinesBoard').scrollIntoViewIfNeeded();
    const v = await view(p), rect = await p.locator('#mindTheLinesBoard').boundingBox();
    const line = v.your_board.sides[0][Math.min(10, v.your_board.sides[0].length - 1)];
    const xy = (x,y) => ({x: rect.x + rect.width*x/1000, y: rect.y + rect.height*y/1000});
    const a = xy(line[0],line[1]), b = xy(line[2],line[3]);
    if (touch) {
      const cdp = await p.context().newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [a]});
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [b]});
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await cdp.detach();
    } else {
      await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(b.x,b.y,{steps: 5}); await p.mouse.up();
    }
    await p.waitForFunction(() => lastGameStatePayload.view.your_drawing.segments.length > 0);
  }
  try {
    const a = await page(), b = await page(true), pages = [a,b];
    assert.equal(await a.locator('#mindTheLinesPanel').evaluate(n => n.children.length), 0);
    await a.evaluate(() => socket.emit('room:create', {name:'Artist A',game_type:'mind_the_lines'}));
    await a.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('mind_the_lines'));
    const room = await a.evaluate(() => roomId);
    await b.evaluate(room_id => socket.emit('room:join', {room_id,name:'Artist B'}), room);
    await b.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('mind_the_lines'));
    assert.deepEqual(await a.evaluate(() => getMindTheLinesConfig()), {difficulty:'easy',draw_seconds:120});
    await a.locator('#mindTheLinesDuration').selectOption('0');
    for (const p of pages) await p.evaluate(() => socket.emit('room:ready', {room_id:roomId,ready:true}));
    await a.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await a.locator('#startBtn').click();
    for (const p of pages) await phase(p, 'ready');
    assert.equal((await view(a)).your_words.length, 2);
    await layout(a, 'ready-desktop'); await layout(b, 'ready-mobile');
    await a.locator('#mindTheLinesHelpBtn').click();
    assert.equal(await a.locator('#mindTheLinesModal').evaluate(n => n.open), true);
    await a.keyboard.press('Escape');
    await a.evaluate(() => {
      window.mindQaUnexplainedClicks = 0;
      const n=document.createElement('button'); n.id='mindQaUnexplained'; n.textContent='QA action';
      n.onclick=()=>{window.mindQaUnexplainedClicks++;}; document.getElementById('mindTheLinesPanel').append(n);
    });
    await a.locator('#mindTheLinesExplainBtn').click();
    await a.locator('#mindQaUnexplained').click();
    assert.equal(await a.evaluate(()=>window.mindQaUnexplainedClicks),0,'Explain blocks buttons without descriptions');
    await a.keyboard.press('Escape');
    await a.locator('#mindQaUnexplained').evaluate(n=>n.remove());
    assert.equal(await a.locator('#mindTheLinesModal').evaluate(n => n.open), false);
    await a.locator('#mindTheLinesExplainBtn').click();
    const undo = await a.locator('#mindTheLinesUndo').boundingBox();
    await a.mouse.click(undo.x + undo.width/2, undo.y + undo.height/2);
    assert.equal(await a.locator('#mindTheLinesModal').evaluate(n => n.open), true, 'disabled tool explanation');
    await a.keyboard.press('Escape');
    for (const p of pages) await p.locator('#mindTheLinesReady').click();
    for (const p of pages) await phase(p, 'drawing');
    await draw(a); await draw(b,true);
    await a.locator('#mindTheLinesFlip').click();
    await a.waitForFunction(()=>lastGameStatePayload.view.your_drawing.side===1);
    assert.equal((await view(a)).your_drawing.segments.length,0,'flipping starts a clean face');
    await a.locator('#mindTheLinesUndo').click();
    await a.waitForFunction(()=>lastGameStatePayload.view.your_drawing.side===0 && lastGameStatePayload.view.your_drawing.segments.length>0);
    const beforeErase=await view(a), oldCount=beforeErase.your_drawing.segments.length;
    const line=beforeErase.your_board.sides[0][beforeErase.your_drawing.segments[0]];
    await a.locator('#mindTheLinesEraser').click();
    const eraserBox=await a.locator('#mindTheLinesBoard').boundingBox();
    await a.mouse.click(eraserBox.x+(line[0]+line[2])/2000*eraserBox.width,eraserBox.y+(line[1]+line[3])/2000*eraserBox.height);
    await a.waitForFunction(count=>lastGameStatePayload.view.your_drawing.segments.length<count,oldCount);
    await a.locator('#mindTheLinesUndo').click();
    await a.waitForFunction(count=>lastGameStatePayload.view.your_drawing.segments.length===count,oldCount);
    await a.locator('#mindTheLinesPen').click();
    await b.locator('#mindTheLinesStats [data-mind-tip]').first().tap();
    await b.locator('#mindTheLinesTip').waitFor({state:'visible'});
    const firstTip=await b.locator('#mindTheLinesTip').textContent();
    await b.locator('#mindTheLinesClock').tap();
    assert.notEqual(await b.locator('#mindTheLinesTip').textContent(),firstTip,'new touch hint replaces old hint');
    await b.locator('#mindTheLinesTip').waitFor({state:'hidden',timeout:5000});
    const saved = (await view(a)).your_drawing;
    await a.reload();
    await a.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view.phase === 'drawing' && isGameAssetsLoaded('mind_the_lines'));
    assert.deepEqual((await view(a)).your_drawing, saved, 'draft survives reconnect');
    await a.locator('#mindTheLinesRotate').click();
    await a.waitForFunction(() => lastGameStatePayload.view.your_drawing.rotation === 1);
    await a.locator('#mindTheLinesUndo').click();
    await a.waitForFunction(() => lastGameStatePayload.view.your_drawing.rotation === 0);
    await layout(a,'drawing-desktop'); await layout(b,'drawing-mobile');
    await b.setViewportSize({width:320,height:850}); await layout(b,'drawing-320');
    for (let round=1;round<=4;round++) {
      if(round>1) {
        for(const p of pages) await p.locator('#mindTheLinesReady').click();
        for(const p of pages) await phase(p,'drawing');
        await draw(a); await draw(b,true);
      }
      const answers = new Set((await Promise.all(pages.map(view))).flatMap(v=>v.your_words.map(w=>w.id)));
      for(const p of pages) await p.locator('#mindTheLinesSubmit').click();
      for(const p of pages) await phase(p,'oracle');
      if(round===1) {
        await layout(a,'oracle-desktop'); await layout(b,'oracle-320');
        await a.locator('[data-mind-drawing]').first().click();
        assert.equal(await a.locator('#mindTheLinesModal').evaluate(n=>n.open),true);
        await a.keyboard.press('Escape');
      }
      for(let turn=0;turn<4;turn++) {
        const state = await view(a), actor = (await view(b)).you===state.current_turn ? b : a;
        const card = state.cards.find(c=>!c.eliminated_by && !answers.has(c.id));
        assert(card,'a remaining decoy exists');
        await actor.locator(`[data-mind-card="${card.id}"]`).click();
        await actor.locator('[data-mind-action="eliminate"]').click();
        await a.waitForFunction(revision=>lastGameStatePayload.view.revision>revision,state.revision);
        await b.waitForFunction(revision=>lastGameStatePayload.view.revision>revision,state.revision);
      }
      const ending = round===4?'game_over':'round_result';
      for(const p of pages) await phase(p,ending);
      assert.equal((await view(a)).errors,0);
      if(round===1) {
        await layout(a,'result-desktop'); await layout(b,'result-320');
        const before = (await view(a)).your_board.id;
        await a.locator('#mindTheLinesNextRound').click();
        await a.waitForFunction(()=>lastGameStatePayload.view.players.find(p=>p.player_id===lastGameStatePayload.view.you).next_round_ready);
        assert.equal((await view(a)).phase,'round_result','waits for second human');
        await b.locator('#mindTheLinesNextRound').click();
        for(const p of pages) await phase(p,'ready');
        assert.notEqual((await view(a)).your_board.id,before,'board passes clockwise');
      } else if(round<4) {
        for(const p of pages) await p.locator('#mindTheLinesNextRound').click();
        for(const p of pages) await phase(p,'ready');
      }
    }
    assert.equal((await view(a)).game_over,true);
    await layout(a,'final-desktop'); await layout(b,'final-320');
    assert.deepEqual(errors,[]);
    passed = true;
    console.log('Mind the Lines browser checks passed: four rounds, two players, draft/reconnect, touch, rotation/undo, Help/Explain, result gate, desktop/390/320px.');
  } finally {
    if (!passed) for (let i=0; i<contexts.length; i++) {
      const p=contexts[i].pages()[0];
      if(p) {
        await p.screenshot({path:`${output}/failure-${i}.png`,fullPage:true});
        console.log(`Page ${i} failure state:`, await p.evaluate(()=>({phase: typeof lastGameStatePayload !== 'undefined' && lastGameStatePayload?.view.phase, text: document.getElementById('mindTheLinesPanel')?.innerText, errors: document.getElementById('log')?.innerText})).catch(()=>null));
      }
    }
    await Promise.all(contexts.map(c=>c.close())); await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
