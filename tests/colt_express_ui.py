"""Local-only Colt Express UI fixtures: python3 -m tests.colt_express_ui.

Serves deterministic real engine views for responsive layout and interaction QA.
No endpoints are added to the production application.
"""
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from game.colt_express import ColtExpressGame as Game, _end_round

app = FastAPI()
app.mount('/static', StaticFiles(directory=Path(__file__).resolve().parents[1] / 'static'), name='static')
state = None
viewer = 'p0'
fixture_lock = Lock()


def step():
    pid = state['current_turn']
    if state['phase'] == 'round_end':
        pid = next(pid for pid in state['turn_order'] if pid not in state['next_ready'])
    action = Game.bot_move(state, pid)
    _, error = Game.apply_action(state, pid, action)
    if error:
        raise ValueError(error)


def fixture(key):
    global state, viewer
    people = [{'player_id': f'p{i}', 'name': name, 'seat': i} for i, name in enumerate(
        ['沙漠来客', '珍珠女士', '午夜枪手', '火车大盗', '陌路医生', '荒野幽灵'])]
    state = Game.init_game({'seed': 158}, people)
    viewer = state['current_turn']
    if key == 'ghost':
        state['players'][viewer]['role'] = 'ghost'
        state['players'][viewer]['ghost_available'] = True
    if key in ('execute', 'review', 'finished', 'long-names', 'event'):
        while state['phase'] == 'program':
            step()
        viewer = state['current_turn']
    if key == 'review':
        while state['phase'] != 'round_end':
            step()
        viewer = 'p0'
    if key == 'event':
        while state['phase'] != 'round_end':
            step()
        state['round'] = 5
        state['round_cards'][4]['event'] = 'pickpocket'
        for i, player in enumerate(state['players'].values(), start=1):
            player['car'] = i
            player['level'] = 'inside'
        for car in state['cars']:
            for token in car['loot']['inside'][:]:
                if token['type'] == 'purse' and car['index'] != 1:
                    car['loot']['inside'].remove(token)
                    state['cars'][1]['loot']['inside'].append(token)
        _end_round(state)
        viewer = state['current_turn'] or 'p0'
    if key == 'finished':
        while not state['game_over']:
            step()
        viewer = 'p0'
    if key == 'long-names':
        for person in state['player_meta'].values():
            person['name'] += '·很长很长的匪徒名字LongUnbrokenBanditName'
    if key == 'spectator':
        viewer = 'visitor'
    return Game.get_public_view(state, viewer)


@app.get('/fixture')
def get_fixture(key: str = 'program'):
    with fixture_lock:
        return fixture(key)


@app.post('/action')
async def do_action(request: Request):
    global viewer
    action = await request.json()
    with fixture_lock:
        _, error = Game.apply_action(state, viewer, action)
        return {'view': Game.get_public_view(state, viewer), 'error': error}


@app.get('/')
def index():
    return HTMLResponse('''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colt Express UI QA</title>
<link rel="stylesheet" href="/static/style.css"><link rel="stylesheet" href="/static/games/colt_express.css">
<style>body{padding:12px}.qa-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.qa-toolbar select{max-width:100%}#qaError{color:#b22}#coltExpressPanel{max-width:1400px;margin:auto}#coltExpressHeaderActions{gap:8px;margin-bottom:10px}</style>
<div class="qa-toolbar"><label>Fixture <select id="qaFixture"><option>program</option><option>ghost</option><option>execute</option><option>event</option><option>review</option><option>finished</option><option>spectator</option><option>long-names</option></select></label><button id="qaReload">Reset</button><span id="qaError"></span></div>
<div id="coltExpressHeaderActions"></div><div id="coltExpressPanel"></div><template id="coltExpressDialog"></template>
<script>
var currentGameType='colt_express',currentRoomState={room_id:'qa',game_type:'colt_express',status:'in_game'},lastGameStatePayload;
var qaListeners={},socket={connected:true,on:(n,f)=>{(qaListeners[n]??=[]).push(f);}};
async function sendAction(a){const r=await fetch('/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});const result=await r.json();document.getElementById('qaError').textContent=result.error||'';if(result.error)(qaListeners['system:error']||[]).forEach(f=>f());lastGameStatePayload={game_type:currentGameType,room_id:'qa',view:result.view};renderColtExpressGameState(lastGameStatePayload);}
async function qaLoad(){const v=await(await fetch('/fixture?key='+document.getElementById('qaFixture').value)).json();lastGameStatePayload={game_type:currentGameType,room_id:'qa',view:v};document.getElementById('qaError').textContent='';renderColtExpressGameState(lastGameStatePayload);}
(async()=>{const doc=new DOMParser().parseFromString(await(await fetch('/static/games/colt_express.html')).text(),'text/html');for(const t of doc.querySelectorAll('template[data-game-target]')){const target=document.getElementById(t.dataset.gameTarget);if(t.dataset.gameMode==='replace')target.replaceWith(t.content.cloneNode(true));else target.append(t.content.cloneNode(true));}const s=document.createElement('script');s.src='/static/games/colt_express.js';s.onload=()=>{showColtExpressHeaderActions(true);qaLoad();};document.body.append(s);})();
document.getElementById('qaFixture').onchange=qaLoad;document.getElementById('qaReload').onclick=qaLoad;
</script>''')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8159, log_level='warning')
