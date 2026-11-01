const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8873';
const output = 'build/pokemon-adventure-ui';
fs.mkdirSync(output, {recursive: true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy,json
from game.pokemon_adventure import PokemonAdventureGame as G,_begin_scoring
from tests.test_pokemon_adventure import players,ready_state,draw_card,put_hand
roster=players(5)
roster[0]['name']='VeryLongTrainerNameWithoutSpaces训练家'
s=G.init_game({'seed':128},roster)
v={'opening':G.get_public_view(s,'p1')}
s=ready_state(count=5)
s['player_meta']['p1']['name']=roster[0]['name']
v['turn']=G.get_public_view(s,'p1')
for species in ['pikachu','charizard','snorlax','zapdos','mew','team_rocket']:
 t=copy.deepcopy(s)
 draw_card(t,species)
 v[species]=G.get_public_view(t,'p1')
 if species in ['charizard','snorlax']:
  G.apply_action(t,'p1',{'type':'replace_card','slot':1})
  v[species+'_ability']=G.get_public_view(t,'p1')
  if species=='charizard':
   G.apply_action(t,'p1',{'type':'peek_card','slot':2})
   v['private']=G.get_public_view(t,'p1')
t=copy.deepcopy(s)
put_hand(t,'p1',['bulbasaur:0','ditto:0','pikachu:0','bulbasaur:1','pikachu:1','eevee:0'])
_begin_scoring(t,'all_revealed','p1')
v['ditto']=G.get_public_view(t,'p1')
while t['phase']=='ditto_choice':
 c=t['ditto_choices'][0]
 G.apply_action(t,c['player_id'],{'type':'choose_ditto','slot':c['slot'],'neighbor_slot':c['neighbors'][0]})
v['summary']=G.get_public_view(t,'p1')
t['game_over']=True;t['winner']=[t['last_round_summary']['winner']]
v['final']=G.get_public_view(t,'p1')
v['spectator']=G.get_public_view(s,'visitor')
print(json.dumps(v))
`], {encoding:'utf8'}));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'pokemon_adventure';
    setGamePanelVisibility(currentGameType);
    window.safariCaptured = [];
    sendAction = action => window.safariCaptured.push(action);
    renderPokemonAdventureGameState({room_id:roomId, game_type:'pokemon_adventure', view});
  }, views[key]);
}
async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#pokemonAdventurePanel *, #pokemonAdventureDialog *')].filter(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!rect.width || !rect.height || element.closest('dialog:not([open])')) return false;
      return rect.left < -1 || rect.right > innerWidth + 1 ||
        element.clientWidth && element.scrollWidth > element.clientWidth + 1 && !['auto','hidden','clip'].includes(style.overflowX);
    }).map(element => ({id:element.id, class:element.className, text:element.textContent.slice(0,60), width:element.clientWidth, scroll:element.scrollWidth}));
    return {width:innerWidth, scroll:document.documentElement.scrollWidth, bad};
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: element overflow ${JSON.stringify(result.bad)}`);
}
async function slot(page, player, position) {
  return page.locator(`[data-pa-player="${player}"][data-pa-slot="${position}"]`);
}
async function choose(page, player, position) {
  await (await slot(page,player,position)).click();
}
async function confirm(page) {
  await page.locator('#pokemonAdventureHand .pa-slot-confirm').click();
  return page.evaluate(() => safariCaptured.at(-1));
}

(async () => {
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="games/pokemon_adventure.js"]').count(),0);
    assert.equal(await page.locator('#pokemonAdventurePanel').evaluate(element=>element.children.length),0);
    await page.evaluate(() => socket.emit('room:create',{name:'Safari Browser QA',game_type:'pokemon_adventure',config:{seed:128}}));
    await page.waitForFunction(() => currentGameType === 'pokemon_adventure' && isGameAssetsLoaded('pokemon_adventure'));
    await page.evaluate(() => socket.emit('room:add_bot',{}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'pokemon_adventure');
    const human = await page.evaluate(()=>lastGameStatePayload.view.you);
    await choose(page,human,0);
    assert.equal(await page.evaluate(()=>lastGameStatePayload.view.players.find(player=>player.player_id===playerId).initial_reveal_done),false);
    await page.locator('#pokemonAdventureHand .pa-slot-confirm').click();
    await page.waitForFunction(()=>lastGameStatePayload?.view.phase==='turn' && lastGameStatePayload.view.current_turn===playerId);
    await page.locator('#pokemonAdventureDrawDeckBtn').click();
    await page.waitForFunction(()=>lastGameStatePayload?.view.phase==='drawn');
    const before = await page.evaluate(()=>JSON.stringify(lastGameStatePayload.view));
    const savedRoom = await page.evaluate(()=>roomId);
    await page.reload();
    await page.waitForFunction(()=>isGameAssetsLoaded('pokemon_adventure') && lastGameStatePayload?.view.phase==='drawn');
    assert.equal(await page.evaluate(()=>roomId),savedRoom);
    assert.equal(await page.evaluate(()=>JSON.stringify(lastGameStatePayload.view)),before);

    for (const width of [320,390,1024,1440]) {
      await page.setViewportSize({width,height:width<500?844:1000});
      for (const phase of ['opening','turn','pikachu','charizard_ability','snorlax_ability','mew','ditto','summary','final','spectator']) {
        await render(page,phase);
        await bounds(page,`${width}/${phase}`);
      }
      await render(page,'pikachu');
      await page.screenshot({path:`${output}/playing-${width}.png`,fullPage:true});
      await render(page,'summary');
      await page.screenshot({path:`${output}/summary-${width}.png`,fullPage:true});
    }

    await page.setViewportSize({width:390,height:844});
    await render(page,'opening');
    await choose(page,'p1',2);
    assert.equal(await page.evaluate(()=>safariCaptured.length),0);
    assert.deepEqual(await confirm(page),{type:'initial_reveal',slot:2});
    await render(page,'pikachu');
    await choose(page,'p1',4);
    assert.deepEqual(await confirm(page),{type:'replace_card',slot:4});
    await render(page,'charizard_ability');
    await choose(page,'p1',2);
    assert.deepEqual(await confirm(page),{type:'peek_card',slot:2});
    await render(page,'snorlax_ability');
    await choose(page,'p1',0);await choose(page,'p1',5);
    assert.deepEqual(await confirm(page),{type:'swap_cards',slots:[0,5]});
    await render(page,'mew');
    await choose(page,'p2',0);await choose(page,'p1',1);
    assert.deepEqual(await confirm(page),{type:'steal_card',target_player_id:'p2',target_slot:0,slot:1});
    for (const phase of ['zapdos','team_rocket']) {
      await render(page,phase);await choose(page,'p1',3);
      assert.deepEqual(await confirm(page),{type:'replace_card',slot:3});
      assert.equal(await page.locator('#pokemonAdventureDiscardBtn').isDisabled(),true);
    }
    await render(page,'ditto');await choose(page,'p1',1);await choose(page,'p1',0);
    assert.deepEqual(await confirm(page),{type:'choose_ditto',slot:1,neighbor_slot:0});
    await render(page,'summary');await page.locator('#pokemonAdventureNextRoundBtn').click();
    assert.deepEqual(await page.evaluate(()=>safariCaptured.at(-1)),{type:'next_round'});
    await render(page,'final');assert.equal(await page.locator('#pokemonAdventureNextRoundBtn').isVisible(),false);
    await render(page,'private');assert.equal(await page.locator('#pokemonAdventureHand .private').count(),1);

    await render(page,'opening');
    const card = await slot(page,'p1',2);
    await card.dispatchEvent('pointerdown',{pointerId:73,pointerType:'touch',clientX:200,clientY:200});
    await card.dispatchEvent('pointermove',{pointerId:73,pointerType:'touch',clientX:200,clientY:250});
    await card.dispatchEvent('pointerup',{pointerId:73,pointerType:'touch',clientX:200,clientY:250});
    await card.dispatchEvent('click');
    assert.equal(await page.locator('#pokemonAdventureHand .selected').count(),0,'scroll must not select a card');
    await page.waitForTimeout(600);
    await choose(page,'p1',1);await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pokemonAdventureHand .selected').count(),0);
    await page.locator('#pokemonAdventureHelpBtn').click();
    await page.locator('#pokemonAdventureDialog[open]').waitFor();
    await bounds(page,'mobile help');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#pokemonAdventureDialog').evaluate(element=>element.open),false);

    await render(page,'zapdos');
    await page.locator('#pokemonAdventureExplainBtn').click();
    const disabled = page.locator('#pokemonAdventureDiscardBtn');
    await disabled.scrollIntoViewIfNeeded();
    const rect = await disabled.boundingBox();
    await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
    await page.locator('#pokemonAdventureDialog[open]').waitFor();
    assert.match(await page.locator('#pokemonAdventureDialogBody').innerText(),/抽/);
    assert.equal(await page.evaluate(()=>safariCaptured.length),0,'Explain must not dispatch an action');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.body.classList.contains('pa-explaining')),false);

    await render(page,'mew');
    await choose(page,'p2',0);
    assert.equal(await page.locator('#pokemonAdventurePlayers .selected').count(),0,'Mew cannot select hidden cards');

    await render(page,'turn');
    await page.evaluate(()=>{currentGameType='cabo';setGamePanelVisibility('cabo');});
    assert.equal(await page.locator('#pokemonAdventurePanel').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('pa-your-turn')),false);
    assert.deepEqual(errors,[]);
    console.log('Passed: live start/reconnect, 4 widths × 10 states, 6 abilities, review, gestures, Help/Explain/Esc, lazy loading and game switch.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
