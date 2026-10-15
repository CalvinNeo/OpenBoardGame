"""Local-only interactive UI fixture server: python3 -m tests.dnd_starter_set_ui.

Useful for manual 320/390/1440 px layout, Help/Explain and action testing.
This does not add fixture endpoints to the production application.
"""
import copy
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from game.dnd_starter_set import DndStarterSetGame as Game
from tests.test_dnd_starter_set import make_state, act, combat, next_all

app = FastAPI()
app.mount('/static', StaticFiles(directory=Path(__file__).resolve().parents[1] / 'static'), name='static')
state = None
viewer = 'p0'


def fixture(key):
    global state, viewer
    viewer = 'dm' if key.startswith('dm') else 'visitor' if key == 'spectator' else 'p0'
    state = make_state(('wizard', 'cleric', 'rogue', 'fighter'), start=key != 'setup')
    if key == 'setup':
        return
    if key in ('combat', 'dm-combat', 'review', 'encounter', 'finished'):
        act(state, 'dm', 'level_up'); act(state, 'dm', 'level_up')
        combat(state, 'm1' if key == 'dm-combat' else 'p0')
    if key == 'review':
        while state['phase'] == 'combat': act(state, state['current_turn'], 'end_turn')
    if key in ('encounter', 'finished'):
        act(state, 'dm', 'resolve', outcome='peace', reason='队伍说服洞窟住民归还物资，并商定安全通行。')
    if key == 'finished':
        next_all(state); act(state, 'dm', 'travel', scene='keep')
        act(state, 'dm', 'finish', reason='带着新朋友与故事返回边陲要塞。'); next_all(state)
    if key == 'check':
        act(state, 'dm', 'request_check', target='p0', ability='arcana', kind='check', dc=15, mode=1)
    for h in state['heroes'].values():
        h['name'] += '·测试很长的冒险者姓名LongUnbrokenName'
    state['dm_note'] = 'PRIVATE_QA_NOTE_157'


@app.get('/fixture')
def get_fixture(key: str = 'setup'):
    fixture(key)
    return Game.get_public_view(state, viewer)


@app.post('/action')
async def do_action(request: Request):
    events, error = Game.apply_action(state, viewer, await request.json())
    return {'view': Game.get_public_view(state, viewer), 'error': error}


@app.get('/')
def index():
    return HTMLResponse('''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Borderlands UI QA</title>
<link rel="stylesheet" href="/static/style.css"><link rel="stylesheet" href="/static/games/dnd_starter_set.css">
<style>body{padding:12px}.qa-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.qa-toolbar select{max-width:100%}#qaError{color:#b22}</style>
<div class="qa-toolbar"><label>Fixture <select id="qaFixture"><option>setup</option><option>exploration</option><option>dm-exploration</option><option>combat</option><option>dm-combat</option><option>check</option><option>review</option><option>encounter</option><option>finished</option><option>spectator</option></select></label><button id="qaReload">Reset</button><span id="qaError"></span></div>
<div id="dndStarterSetHeaderActions"></div><div id="dndStarterSetPanel" class="dnd-panel"></div><template id="dndStarterSetDialog"></template>
<script>
var currentGameType='dnd_starter_set',currentRoomState={room_id:'qa',game_type:'dnd_starter_set',status:'in_game'},lastGameStatePayload;
var qaListeners={},socket={connected:true,on:(n,f)=>{(qaListeners[n]??=[]).push(f);}};
async function sendAction(a){const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});const result=await r.json();document.getElementById('qaError').textContent=result.error||'';if(result.error)(qaListeners['system:error']||[]).forEach(f=>f());lastGameStatePayload={game_type:currentGameType,room_id:'qa',view:result.view};renderDndStarterSetGameState(lastGameStatePayload);}
async function qaLoad(){const v=await(await fetch('/fixture?key='+document.getElementById('qaFixture').value)).json();lastGameStatePayload={game_type:currentGameType,room_id:'qa',view:v};document.getElementById('qaError').textContent='';renderDndStarterSetGameState(lastGameStatePayload);}
(async()=>{const doc=new DOMParser().parseFromString(await(await fetch('/static/games/dnd_starter_set.html')).text(),'text/html');for(const t of doc.querySelectorAll('template[data-game-target]')){const target=document.getElementById(t.dataset.gameTarget);if(t.dataset.gameMode==='replace')target.replaceWith(t.content.cloneNode(true));else target.append(t.content.cloneNode(true));}const s=document.createElement('script');s.src='/static/games/dnd_starter_set.js';s.onload=()=>{showDndStarterSetHeaderActions(true);qaLoad();};document.body.append(s);})();
document.getElementById('qaFixture').onchange=qaLoad;document.getElementById('qaReload').onclick=qaLoad;
</script>''')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8158, log_level='warning')
