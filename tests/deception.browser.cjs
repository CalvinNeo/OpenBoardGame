// ROOM_TEST_URL and PLAYWRIGHT_MODULE may point to an existing local setup.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8774';
const output = 'tmp/deception-qa';
fs.mkdirSync(output, {recursive:true});
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const pages = [], errors = [];
  async function newPage(mobile=false) {
    const context = await browser.newContext({viewport:{width:mobile?390:1440,height:960},isMobile:mobile,hasTouch:mobile});
    const p = await context.newPage(); pages.push(p);
    p.on('pageerror',e=>errors.push(e.message));
    await p.route('https://fonts.googleapis.com/**',r=>r.abort());
    await p.goto(base); await p.waitForFunction(()=>typeof socket!=='undefined'&&socket.connected&&cachedGameList);
    return p;
  }
  const view = p=>p.evaluate(()=>lastGameStatePayload.view);
  async function phase(p,value) {await p.waitForFunction(v=>lastGameStatePayload?.view.phase===v,value);}
  async function revision(p,previous) {await p.waitForFunction(v=>lastGameStatePayload.view.revision>v,previous);}
  async function layout(p,label) {
    const result=await p.evaluate(()=>{
      const bad=[...document.querySelectorAll('#deceptionPanel *')].filter(n=>{
        const r=n.getBoundingClientRect(); if(!r.width||!r.height||n.classList.contains('deception-sr-only')||n.closest('details:not([open])')&&!n.matches('summary'))return false;
        // Children inside vertically scrolled lists may be offscreen vertically, never horizontally.
        return r.right>innerWidth+1||r.left< -1||(n.clientWidth>0&&n.scrollWidth>n.clientWidth+2);
      }).map(n=>n.id||n.className);
      return {page:document.documentElement.scrollWidth>innerWidth+1,bad};
    });
    await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({path:`${output}/${label}.png`,fullPage:true});
    assert.deepEqual(result,{page:false,bad:[]},label+': '+JSON.stringify(result));
  }
  async function create(participants,advanced=false) {
    const host=participants[0];
    await host.evaluate(()=>socket.emit('room:create',{name:'Detective A',game_type:'deception'}));
    await host.waitForFunction(()=>roomSessionReady&&isGameAssetsLoaded('deception'));
    const room=await host.evaluate(()=>roomId);
    for(let i=1;i<participants.length;i++){
      await participants[i].evaluate(({room_id,i})=>socket.emit('room:join',{room_id,name:`Detective ${i}`}),{room_id:room,i});
      await participants[i].waitForFunction(()=>roomSessionReady&&isGameAssetsLoaded('deception'));
    }
    if(advanced){await host.locator('#deceptionWitness').check();assert(await host.locator('#deceptionAccomplice').isChecked());}
    for(const p of participants)await p.evaluate(()=>socket.emit('room:ready',{room_id:roomId,ready:true}));
    await host.waitForFunction(()=>!document.getElementById('startBtn').disabled);
    await host.locator('#startBtn').click();
    for(const p of participants)await phase(p,'crime');
    const roles={},ids={};
    for(const p of participants){const v=await view(p); roles[v.private.role] ||= p;ids[v.you]=p;}
    return {roles,ids,room};
  }
  async function chooseCrime(murderer){
    const v=await view(murderer),own=v.players.find(p=>p.player_id===v.you);
    await murderer.locator(`[data-card="${own.means[0].id}"]`).click();
    assert(await murderer.locator('.deception-pair-confirm button').first().isDisabled());
    await murderer.locator(`[data-card="${own.clues[0].id}"]`).click();
    await murderer.locator('.deception-pair-confirm button').filter({hasText:'Confirm'}).click();
    await phase(murderer,'scene_setup');
    return {player_id:v.you,means_id:own.means[0].id,clue_id:own.clues[0].id};
  }
  async function markers(forensic){
    await forensic.locator('#deceptionLocationChoices button').first().click();
    await forensic.locator('#deceptionDraft button').filter({hasText:'Confirm'}).click();
    await phase(forensic,'evidence');
    for(let i=0;i<6;i++){
      await forensic.locator('.deception-scene-toggle').nth(i).click();
      await forensic.locator('.deception-options button').first().click();
      const old=(await view(forensic)).revision;
      await forensic.locator('#deceptionDraft button').filter({hasText:'Confirm'}).click();
      await revision(forensic,old);
    }
    await phase(forensic,'discussion');
  }
  try {
    for(let i=0;i<4;i++)await newPage(i===1);
    assert.equal(await pages[0].locator('#deceptionPanel').evaluate(n=>n.children.length),0);
    let game=await create(pages), {roles,ids}=game;
    const initialRole=(await view(pages[1])).private.role;
    await pages[1].reload(); await phase(pages[1],'crime');
    await pages[1].waitForFunction(()=>isGameAssetsLoaded('deception'));
    assert.equal((await view(pages[1])).private.role,initialRole);
    const p=pages[0];
    await p.locator('#deceptionHelpBtn').click();assert(await p.locator('#deceptionDialog').evaluate(n=>n.open));
    await p.keyboard.press('Escape');assert.equal(await p.locator('#deceptionDialog').evaluate(n=>n.open),false);
    await p.locator('#deceptionExplainBtn').click();
    const disabled=await p.locator('#deceptionPresent').boundingBox();await p.mouse.click(disabled.x+disabled.width/2,disabled.y+disabled.height/2);
    assert(await p.locator('#deceptionDialog').evaluate(n=>n.open),'disabled button can be explained');
    await p.keyboard.press('Escape');
    await p.evaluate(()=>{window.deceptionQAClicks=0;const b=document.createElement('button');b.id='deceptionQAUnknown';b.textContent='QA';b.onclick=()=>window.deceptionQAClicks++;document.getElementById('deceptionPanel').append(b);});
    await p.locator('#deceptionExplainBtn').click();await p.locator('#deceptionQAUnknown').click();
    assert.equal(await p.evaluate(()=>window.deceptionQAClicks),0);
    await p.locator("#deceptionQAUnknown").focus(); await p.keyboard.press("Enter");
    assert.equal(await p.evaluate(()=>window.deceptionQAClicks),0,"Explain also blocks keyboard activation");
    await p.keyboard.press('Escape');await p.locator('#deceptionQAUnknown').evaluate(n=>n.remove());
    const mv = await view(roles.murderer), mh = mv.players.find(q=>q.player_id===mv.you);
    await roles.murderer.locator(`[data-card="${mh.means[0].id}"]`).click();
    await roles.murderer.keyboard.press('Escape');
    assert.equal(await roles.murderer.locator('.deception-pair-confirm').count(),0,'Esc cancels draft');
    await roles.murderer.locator(`[data-card="${mh.means[0].id}"]`).click();
    await roles.murderer.locator('.deception-heading h2').click();
    assert.equal(await roles.murderer.locator('.deception-pair-confirm').count(),0,'blank area cancels draft');
    const solution=await chooseCrime(roles.murderer);await markers(roles.forensic);
    for(const width of [1440,390,320]){await p.setViewportSize({width,height:960});await layout(p,`evidence-${width}`);}
    await p.setViewportSize({width:1440,height:960});
    const chatPlayer=roles.investigator;
    await chatPlayer.locator('#deceptionDiscussion').evaluate(n=>n.open=true);
    await chatPlayer.locator('#deceptionChatInput').fill('<b>My clue</b>');await chatPlayer.locator('#deceptionSend').click();
    await roles.forensic.waitForFunction(()=>document.getElementById('deceptionMessages').textContent.includes('<b>My clue</b>'));
    assert.equal(await roles.forensic.locator('#deceptionMessages b').count(),0,'chat is text, not HTML');
    assert(await roles.forensic.locator('#deceptionSend').isDisabled());
    const wrong=(await view(chatPlayer)).players.find(q=>q.player_id===solution.player_id).clues[1].id;
    await chatPlayer.locator(`[data-card="${solution.means_id}"]`).click();await chatPlayer.locator(`[data-card="${wrong}"]`).click();
    await chatPlayer.locator('.deception-pair-confirm button').filter({hasText:'Confirm'}).click();
    await chatPlayer.waitForFunction(()=>!lastGameStatePayload.view.legal_actions.includes('accuse'));
    assert.equal((await view(chatPlayer)).accusations[0].correct,false);
    assert((await chatPlayer.locator('#deceptionVerdict').textContent()).includes('不正确'));
    assert(await chatPlayer.locator('#deceptionVerdict').isVisible());
    for(let round=1;round<=3;round++){
      await roles.forensic.locator('#deceptionPresent').click();await phase(roles.forensic,'presentation');
      for(const pid of (await view(roles.forensic)).presentation_order){
        const speaker=ids[pid];await speaker.waitForFunction(pid=>lastGameStatePayload.view.current_turn===pid,pid);
        await speaker.locator('#deceptionFinish').click();
      }
      if(round===3)break;
      for(const q of pages)await phase(q,'round_review');
      await layout(p,`review-round-${round}`);
      for(const q of pages.slice(0,-1))await q.locator('#deceptionNext').click();
      await p.waitForFunction(()=>lastGameStatePayload.view.next_round_ready.length===3);
      assert.equal((await view(p)).round,round);
      await pages[pages.length-1].locator('#deceptionNext').click();
      await roles.forensic.waitForFunction(r=>lastGameStatePayload.view.round===r,round+1);
      await roles.forensic.locator('.deception-replace-targets button').first().click();
      await roles.forensic.locator('#deceptionReplacement .deception-options button').first().click();
      await roles.forensic.locator('#deceptionDraft button').filter({hasText:'Confirm'}).click();
      await phase(roles.forensic,'discussion');
      assert.equal((await view(roles.forensic)).discarded_scenes.length,round);
    }
    for(const q of pages)await phase(q,'game_over');
    assert.equal((await view(p)).end_reason,'three_rounds');await layout(p,'game-over-desktop');
    await p.setViewportSize({width:320,height:960});await layout(p,'game-over-320');
    for(const q of pages){await q.evaluate(()=>setRoomControlsCollapsed(false));await q.locator('#leaveBtn').click();await q.waitForFunction(()=>!currentRoomState);}
    await newPage();await newPage();
    game=await create(pages,true);roles=game.roles;ids=game.ids;
    const answer=await chooseCrime(roles.murderer), accuser=roles.investigator;
    await phase(accuser,'scene_setup');
    await accuser.locator(`[data-card="${answer.means_id}"]`).click();await accuser.locator(`[data-card="${answer.clue_id}"]`).click();
    await accuser.locator('.deception-pair-confirm button').filter({hasText:'Confirm'}).click();
    await phase(roles.murderer,'reversal');
    const witnessId=(await view(roles.witness)).you;
    await roles.murderer.locator(`[data-player="${witnessId}"] .deception-witness-button`).click();
    await roles.murderer.locator('.deception-pair-confirm button').filter({hasText:'Confirm'}).click();
    await phase(roles.murderer,'game_over');assert.equal((await view(roles.murderer)).end_reason,'witness_found');
    await roles.murderer.setViewportSize({width:1440,height:960});await layout(roles.murderer,'witness-reversal');
    // Touch tips replace previous content and expire; long names and max 12-player views fit.
    const mobile=pages[1]; await mobile.setViewportSize({width:390,height:960});
    await mobile.locator('#deceptionRound').tap();assert(await mobile.locator('#deceptionTooltip').isVisible());
    await mobile.locator('#deceptionBadgeCount').tap();assert((await mobile.locator('#deceptionTooltip').textContent()).includes('警徽'));
    await mobile.waitForFunction(()=>document.getElementById('deceptionTooltip').classList.contains('hidden'),null,{timeout:4500});
    const crowded=await view(mobile);
    while(crowded.players.length<12){const clone=structuredClone(crowded.players.find(q=>q.means.length));clone.player_id='qa'+crowded.players.length;clone.name='VeryLongUnbrokenDetectiveName'.repeat(3)+'特长名字';crowded.players.push(clone);}
    await mobile.evaluate(v=>renderDeceptionGameState({room_id:roomId,view:v}),crowded);
    for(const width of [390,320,1440]){await mobile.setViewportSize({width,height:960});await layout(mobile,`twelve-long-names-${width}`);}
    assert.deepEqual(errors,[]);
    console.log('PASS: real 4-player three-round game, 6-player witness reversal, privacy/reload, confirmations, Help/Explain, disabled controls, touch tips, safe chat, and 1440/390/320px layouts.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
