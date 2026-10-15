// Run against a local application: ROOM_TEST_URL and PLAYWRIGHT_MODULE may override defaults.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8769';

(async () => {
    const browser = await chromium.launch({channel:'chrome', headless:true});
    const pages = [], errors = [];
    const output = 'build/colt-express-ui';
    fs.mkdirSync(output, {recursive:true});
    async function state(page) { return page.evaluate(() => lastGameStatePayload?.view); }
    async function send(page, action) {
        const revision = (await state(page)).revision;
        await page.evaluate(a => sendAction(a), action);
        await page.waitForFunction(r => lastGameStatePayload?.view?.revision > r, revision);
    }
    async function layout(page, name) {
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height:950});
            const overflow = await page.evaluate(() => ({page:document.documentElement.scrollWidth > innerWidth,
                panel:document.querySelector('#coltExpressPanel').scrollWidth > document.querySelector('#coltExpressPanel').clientWidth}));
            assert.deepEqual(overflow, {page:false,panel:false}, `${name} ${width}`);
            await page.screenshot({path:`${output}/${width}-${name}.jpg`,fullPage:true});
        }
    }
    try {
        for (let index=0;index<3;index++) {
            const context = await browser.newContext({viewport:{width:1440,height:950}});
            const page = await context.newPage(); pages.push(page);
            page.on('pageerror', e=>errors.push(e.message));
            await page.route('https://fonts.googleapis.com/**', r=>r.abort());
            await page.goto(base);
            await page.waitForFunction(()=>typeof socket!=='undefined' && socket.connected && cachedGameList);
        }
        assert.equal(await pages[0].locator('script[src*="colt_express.js"]').count(),0);
        await pages[0].evaluate(()=>socket.emit('room:create',{name:'Colt QA A',game_type:'colt_express',config:{seed:158}}));
        await pages[0].waitForFunction(()=>roomSessionReady && currentGameType==='colt_express');
        const room = await pages[0].evaluate(()=>roomId);
        for (let i=1;i<3;i++) {
            await pages[i].evaluate(({room,i})=>socket.emit('room:join',{room_id:room,name:`Colt QA ${i}`}),{room,i});
            await pages[i].waitForFunction(()=>roomSessionReady && currentGameType==='colt_express');
        }
        for (const page of pages) {
            await page.waitForFunction(()=>isGameAssetsLoaded('colt_express'));
            await page.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
        }
        await pages[0].waitForFunction(()=>!document.getElementById('startBtn').disabled);
        await pages[0].locator('#startBtn').click();
        for (const page of pages) await page.waitForFunction(()=>lastGameStatePayload?.view?.game_id==='colt_express');
        const byId = new Map();
        for (const page of pages) byId.set((await state(page)).you,page);
        let initial = await state(pages[0]);
        const actor = byId.get(initial.current_turn);
        await actor.locator('#coltExpressHelpBtn').click();
        await actor.locator('#coltExpressDialog[open]').waitFor();
        await actor.keyboard.press('Escape');
        assert.equal(await actor.locator('#coltExpressDialog').evaluate(e=>e.open),false);
        await actor.locator('[data-ce-action]').first().click();
        assert.equal(await actor.locator('[data-ce-confirm]').count(),1);
        await actor.keyboard.press('Escape');
        assert.equal(await actor.locator('[data-ce-confirm]').count(),0);
        await actor.locator('[data-ce-action]').first().click();
        const before = (await state(actor)).revision;
        await actor.locator('[data-ce-confirm]').click();
        await actor.waitForFunction(r=>lastGameStatePayload.view.revision>r,before);
        await actor.locator('#coltExpressExplainBtn').click();
        const disabled = actor.locator('#coltExpressPanel button:disabled[data-ce-explain]').first();
        const rect = await disabled.boundingBox();
        if (rect) {
            await actor.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
            await actor.locator('#coltExpressDialog[open]').waitFor();
            assert.equal((await state(actor)).revision,before+1);
            await actor.keyboard.press('Escape');
        } else await actor.keyboard.press('Escape');
        await layout(actor,'real-program');
        await actor.reload();
        await actor.waitForFunction(()=>isGameAssetsLoaded('colt_express') && lastGameStatePayload?.view?.game_id==='colt_express');
        assert.equal(await actor.evaluate(()=>roomId),room);
        assert.equal((await state(actor)).revision,before+1);
        const reviewed = new Set(); let executed=false, steps=0;
        while (!(await state(pages[0])).game_over && steps++<500) {
            const view = await state(pages[0]);
            if (view.phase==='round_end') {
                reviewed.add(view.round);
                if (view.round===1) await layout(actor,'real-review');
                // Other two acknowledgments cannot advance the human's review.
                for (const page of pages.slice(1)) {
                    const v = await state(page);
                    await send(page,v.legal_actions.find(a=>a.type==='next_round'));
                }
                assert.equal((await state(pages[0])).phase,'round_end');
                assert.equal((await state(pages[0])).round,view.round);
                const nextButton=pages[0].locator('[data-ce-direct]').filter({hasText:'Next Round'});
                await nextButton.click();
                await pages[0].waitForFunction(r=>lastGameStatePayload.view.round>r || lastGameStatePayload.view.game_over,view.round);
            } else {
                const page=byId.get(view.current_turn), own=await state(page);
                if (own.phase==='execute'&&!executed) {await layout(page,'real-execute');executed=true;}
                const legal=own.legal_actions;
                assert(legal.length,JSON.stringify({phase:own.phase,turn:own.current_turn,you:own.you}));
                await send(page,legal.find(a=>a.type!=='draw') || legal[0]);
            }
            const latest=(await state(pages[0])).revision;
            for (const page of pages) await page.waitForFunction(r=>lastGameStatePayload.view.revision>=r,latest);
        }
        assert.deepEqual([...reviewed],[1,2,3,4,5]);
        assert((await state(pages[0])).game_over);
        await layout(pages[0],'real-final');

        // A mixed room must advance through bots, yet retain the human review barrier.
        const mixed=pages[0];
        await mixed.evaluate(()=>{
            window.coltQaBotEvents=[];
            socket.on('game:state', data => window.coltQaBotEvents.push(...(data.events || []).filter(e=>e.type==='bot:action')));
            socket.emit('room:create',{name:'Colt QA human',game_type:'colt_express',config:{seed:159}});
        });
        await mixed.waitForFunction(old=>currentRoomState?.status==='lobby' && roomId!==old,room);
        for(let i=0;i<5;i++) {
            await mixed.evaluate(()=>socket.emit('room:add_bot',{}));
            await mixed.waitForFunction(n=>currentRoomState.players.length===n,i+2);
        }
        await mixed.evaluate(()=>socket.emit('room:ready',{ready:true}));
        await mixed.waitForFunction(()=>!document.getElementById('startBtn').disabled);
        await mixed.locator('#startBtn').click();
        await mixed.waitForFunction(()=>lastGameStatePayload?.view?.players?.length===6);
        let humanSteps=0;
        while((await state(mixed)).phase!=='round_end' && humanSteps++<30) {
            await mixed.waitForFunction(()=>lastGameStatePayload.view.phase==='round_end' || lastGameStatePayload.view.legal_actions.length>0);
            const view=await state(mixed);
            if(view.phase==='round_end') break;
            await send(mixed,view.legal_actions.find(a=>a.type!=='draw') || view.legal_actions[0]);
        }
        await mixed.waitForFunction(()=>lastGameStatePayload.view.phase==='round_end' && lastGameStatePayload.view.next_ready.length===5);
        assert.equal((await state(mixed)).round,1);
        const botEvents=await mixed.evaluate(()=>window.coltQaBotEvents);
        assert(botEvents.length>5);
        assert(botEvents.every(e=>JSON.stringify(Object.keys(e.payload.action))==='["type"]'));
        await layout(mixed,'real-six-player-review');

        // Retry loading this game's assets through the normal UI after a failed response.
        const retryContext=await browser.newContext({viewport:{width:390,height:950}});
        const retry=await retryContext.newPage(); let attempts=0;
        retry.on('pageerror', e=>errors.push(e.message));
        await retry.route('**/static/games/colt_express.html?*', route=>{
            attempts++;
            return attempts===1 ? route.fulfill({status:503,body:'Unavailable'}) : route.continue();
        });
        await retry.goto(base);
        await retry.waitForFunction(()=>typeof socket!=='undefined' && socket.connected);
        await retry.evaluate(()=>socket.emit('room:create',{name:'Colt retry QA',game_type:'colt_express'}));
        await retry.locator('#gameAssetsRetryBtn').waitFor({state:'visible'});
        await retry.evaluate(()=>setRoomControlsCollapsed(true));
        await retry.locator('#gameAssetsRetryBtn').click();
        await retry.waitForFunction(()=>isGameAssetsLoaded('colt_express'));
        assert.equal(attempts,2);
        assert.equal(await retry.locator('script[src*="/colt_express.js"]').count(),1);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({steps,reviewed:[...reviewed],game_over:true,botEvents:botEvents.length,retryAttempts:attempts,errors,output}));
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
