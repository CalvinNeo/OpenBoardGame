"""Dice Throne: a playable two-player Barbarian vs Moon Elf duel."""
from __future__ import annotations
import copy, random
from typing import Dict, List, Optional, Tuple
from .dice_throne_data import RULES, HEROES, CARDS, DECKS

_ACTIONS = ["choose_hero","roll","toggle_keep","confirm_roll","use_ability","play_card","buy_upgrade","sell_card","defend","pass","end_phase","next_round"]
CONFIG_SCHEMA = {"type":"object","properties":{"seed":{"type":["integer","string","null"]}},"additionalProperties":False}
ACTION_SCHEMA = {"type":"object","properties":{
    "type":{"enum":_ACTIONS},"revision":{"type":"integer","minimum":0},"hero":{"enum":["barbarian","moon_elf"]},"index":{"type":"integer","minimum":0,"maximum":4},
    "ability_id":{"type":"string"},"card_id":{"type":"string"},"target":{"type":"string"},"level":{"type":"integer","minimum":2,"maximum":3}
},"required":["type","revision"],"additionalProperties":False}

_ABILITY_COSTS = {"rage":3, "lunar_eclipse":3, "reckless":2, "blinding_shot":2, "eclipse":2, "overpower":2, "exploding_arrow":2, "mighty_blow":2, "demising_shot":2, "covered_shot":2}

def _seeded(state):
    r = random.Random(); r.setstate(state["rng_state"]); return r

def _draw(state, pid, count=1):
    p = state["players"][pid]
    for _ in range(count):
        if len(p["hand"]) >= RULES.get("max_hand", 6):
            break
        if not state["deck"]:
            state["deck"] = list(state["discard"]); state["discard"] = []
            if not state["deck"]: break
        r = _seeded(state); i = r.randrange(len(state["deck"])); state["rng_state"] = r.getstate()
        p["hand"].append(state["deck"].pop(i))

def _hero_abilities(hero, upgrades):
    result = []
    for a in HEROES[hero]["abilities"]:
        level = max([u["level"] for u in upgrades if u.get("ability") == a["id"]] or [1])
        result.append((a, level))
    return result

def _counts(dice):
    c = {}
    for d in dice:
        face = d.get("face") if isinstance(d, dict) else d
        c[face] = c.get(face, 0) + 1
    return c

def _condition(a, dice):
    cond = a.get("condition", {}); c = _counts(dice)
    if any(c.get(k, 0) < v for k,v in cond.get("counts", {}).items()): return False
    if "straight" in cond:
        values = sorted({d.get("value") for d in dice if isinstance(d, dict) and isinstance(d.get("value"), int)})
        need = cond["straight"]
        if len(values) < need or not any(all(values[i + j] == values[i] + j for j in range(need)) for i in range(len(values) - need + 1)):
            return False
    return True

def _ability_cost(aid): return _ABILITY_COSTS.get(aid, 1)

def _status(p, sid, n=1):
    if sid:
        p["statuses"][sid] = min(3, p["statuses"].get(sid, 0) + n)

def _remove_status(p, sid, n=1):
    if sid in p["statuses"]:
        p["statuses"][sid] -= n
        if p["statuses"][sid] <= 0: p["statuses"].pop(sid, None)

def _damage(state, target, amount, kind="normal"):
    p = state["players"][target]
    amount = max(0, int(amount))
    if p["statuses"].get("targeted"):
        amount += 2; _remove_status(p, "targeted")
    if kind not in ("ultimate", "undefendable") and p["statuses"].get("evasive"):
        # deterministic defense token: the token absorbs the first attack once.
        _remove_status(p, "evasive"); return 0
    p["health"] = max(0, p["health"] - amount)
    return amount

class DiceThroneGame:
    game_id = "dice_throne"; min_players = 2; max_players = 2

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) != 2: raise ValueError("Dice Throne requires exactly 2 players")
        cfg = dict(config or {}); seed = cfg.get("seed")
        if seed is None: seed = random.randrange(2**31)
        order = [p["player_id"] for p in sorted(players, key=lambda p:(p.get("seat",0),p["player_id"]))]
        r = random.Random(str(seed)); r.shuffle(order)
        state = {"game_id":"dice_throne","config":{"seed":seed},"revision":0,"phase":"choose_hero","current_player":order[0],"turn_order":order,
                 "player_meta":{p["player_id"]:dict(p) for p in players},"players":{p["player_id"]:{"hero":None,"health":50,"combat_points":2,"statuses":{},"hand":[],"upgrades":[]} for p in players},
                 "dice":[],"kept":[False]*5,"rolls":0,"rng_state":r.getstate(),"deck":[],"discard":[],"winner":[],"game_over":False,"round":1,"turn_count":0,"round_review":[],"next_round_ready":[]}
        return state

    @staticmethod
    def _start(state):
        # Build the shared deck first, then deal the opening four cards to each hero.
        state["deck"] = []
        for pid in state["turn_order"]:
            state["deck"].extend(DECKS.get(state["players"][pid]["hero"], []))
        r = _seeded(state); r.shuffle(state["deck"]); state["rng_state"] = r.getstate()
        for pid in state["turn_order"]:
            _draw(state, pid, 4)
        state["phase"] = "main_1"; state["current_player"] = state["turn_order"][0]; state["turn_count"] = 0

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players",{}) or state.get("game_over"): return []
        phase, cur = state.get("phase"), state.get("current_player")
        p = state["players"][player_id]
        if phase == "choose_hero": return ["choose_hero"] if not p["hero"] else []
        if phase == "round_review": return ["next_round"] if player_id not in state["next_round_ready"] else []
        if phase == "defensive_roll": return ["defend","pass"] if cur == player_id else []
        if cur != player_id: return []
        if phase == "main_1" or phase == "main_2": return ["play_card","buy_upgrade","sell_card","end_phase","pass"]
        if phase == "offensive_roll":
            actions = ["toggle_keep", "confirm_roll", "pass"]
            if state.get("rolls", 0) < 3:
                actions.insert(0, "roll")
            return actions
        if phase == "targeting": return ["use_ability","play_card","pass"]
        return []

    @staticmethod
    def _error(state, msg): return [], msg

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or action.get("revision") != state.get("revision"): return [], "stale revision"
        typ = action.get("type"); pid = player_id
        if pid not in state.get("players",{}) or typ not in _ACTIONS: return [], "invalid action"
        if typ not in DiceThroneGame.get_legal_actions(state, pid): return [], "action not available"
        before = copy.deepcopy(state); p = state["players"][pid]; events=[]
        try:
            if typ == "choose_hero":
                hero = action.get("hero")
                if hero not in HEROES or any(x["hero"] == hero for x in state["players"].values()): raise ValueError("hero unavailable")
                p["hero"] = hero
                if all(x["hero"] for x in state["players"].values()): DiceThroneGame._start(state)
            elif typ == "roll":
                if state["rolls"] >= 3: raise ValueError("no rolls remaining")
                r = _seeded(state); faces=HEROES[p["hero"]]["dice_faces"]
                state["dice"] = [d if state["kept"][i] else {"face": r.choice(faces), "value": r.randint(1, 6)} for i,d in enumerate(state["dice"] or [None]*5)]
                state["rng_state"] = r.getstate(); state["rolls"] += 1
            elif typ == "toggle_keep":
                i=action.get("index");
                if not isinstance(i,int) or i<0 or i>=len(state["dice"]): raise ValueError("invalid die")
                state["kept"][i] = not state["kept"][i]
            elif typ == "confirm_roll":
                if not state["dice"]: raise ValueError("roll first")
                state["phase"]="targeting"
            elif typ == "use_ability":
                aid=action.get("ability_id"); target=action.get("target") or next(x for x in state["turn_order"] if x != pid)
                if target not in state["players"] or target == pid: target = next(x for x in state["turn_order"] if x != pid)
                found=next(((a,l) for a,l in _hero_abilities(p["hero"],p["upgrades"]) if a["id"]==aid),None)
                if not found or not _condition(found[0],state["dice"]): raise ValueError("ability pattern not met")
                a,l=found; cost=_ability_cost(aid)
                if p["combat_points"] < cost: raise ValueError("not enough combat points")
                p["combat_points"] -= cost; other=state["players"][target]; dmg=a.get("damage") or 0
                if isinstance(dmg,str): dmg=3
                if a.get("scales"):
                    key=next(iter(a["scales"])); dmg=a["scales"][key][min(2,_counts(state["dice"]).get(key,1)-1)]
                # Damage is held until the defender passes or resolves defense.
                dealt = int(dmg)
                for sid in a.get("self_status",[]): _status(p,sid)
                for sid in a.get("opponent_status",[]): _status(other,sid)
                if a.get("heal"): p["health"] = min(50,p["health"] + a["heal"])
                if a.get("return_damage"): _damage(state,pid,a["return_damage"],a.get("return_damage_type","normal"))
                state["pending_attack"]={"attacker":pid,"defender":target,"damage":dealt,"damage_type":a.get("damage_type","combat"),"ability_id":aid}
                state["phase"]="defensive_roll"; state["current_player"]=target
            elif typ == "defend":
                hero=p["hero"]; r=_seeded(state); faces=HEROES[hero]["dice_faces"]; rolls=[r.choice(faces) for _ in range(HEROES[hero]["defense"]["dice"])] ; state["rng_state"]=r.getstate(); atk=state.get("pending_attack") or {}; attacker=state["players"][atk.get("attacker")]
                incoming = int(atk.get("damage", 0))
                if hero=="barbarian":
                    p["health"] = min(50,p["health"] + 2*rolls.count("heart"))
                    _damage(state, atk.get("defender"), incoming, atk.get("damage_type", "normal"))
                else:
                    _damage(state,atk.get("attacker"),rolls.count("arrow")//2,"normal")
                    prevented = incoming // 2 if rolls.count("foot") >= 2 else 0
                    _damage(state, atk.get("defender"), incoming - prevented, atk.get("damage_type", "normal"))
                state["phase"]="main_2"; state["current_player"]=atk.get("attacker"); state["pending_attack"]=None
            elif typ == "pass":
                if state["phase"] == "defensive_roll":
                    atk=state.get("pending_attack") or {}; _damage(state, atk.get("defender"), atk.get("damage", 0), atk.get("damage_type", "normal")); state["phase"]="main_2"; state["current_player"]=atk.get("attacker"); state["pending_attack"]=None
                elif state["phase"] == "targeting":
                    state["phase"]="main_2"
                else: state["phase"]="round_review"; state["current_player"]=None; state["round_review"]=[{"player_id":pid,"text":"completed the turn"}]
            elif typ == "end_phase":
                if state["phase"]=="main_1":
                    state["phase"]="offensive_roll"; state["dice"]=[]; state["kept"]=[False]*5; state["rolls"]=0
                else:
                    state["phase"]="round_review"; state["current_player"]=None; state["round_review"]=[{"player_id":pid,"text":"completed the round"}]; state["next_round_ready"]=[]
            elif typ == "sell_card":
                cid=action.get("card_id");
                if cid not in p["hand"]: raise ValueError("card not in hand")
                p["hand"].remove(cid); state["discard"].append(cid); p["combat_points"] = min(15,p["combat_points"]+1)
            elif typ == "play_card":
                cid=action.get("card_id");
                if cid not in p["hand"] or cid not in CARDS: raise ValueError("card not in hand")
                card=CARDS[cid];
                if p["combat_points"] < card["cost"]: raise ValueError("not enough combat points")
                p["combat_points"]-=card["cost"]; p["hand"].remove(cid); state["discard"].append(cid)
                if card.get("effect")=="upgrade": p["upgrades"].append({"ability":card["ability"],"level":card["level"]})
                elif card.get("cardid")=="getting_paid": p["combat_points"]=min(15,p["combat_points"]+2)
                elif "status" in card.get("description","").lower(): _status(state["players"][action.get("target") or next(x for x in state["turn_order"] if x!=pid)],"stun")
            elif typ == "buy_upgrade":
                aid=action.get("ability_id"); level=action.get("level",2); cid=next((k for k,v in CARDS.items() if v.get("hero")==p["hero"] and v.get("ability")==aid and v.get("level")==level),None)
                if not cid or p["combat_points"]<CARDS[cid]["cost"]: raise ValueError("upgrade unavailable")
                p["combat_points"]-=CARDS[cid]["cost"]; p["upgrades"].append({"ability":aid,"level":level})
            elif typ == "next_round":
                state["next_round_ready"].append(pid)
                if len(state["next_round_ready"]) == len(state["turn_order"]):
                    state["next_round_ready"]=[]; state["round"]+=1; state["current_player"]=next(x for x in state["turn_order"] if x!=pid); state["phase"]="main_1"; state["turn_count"]+=1
                    for q in state["turn_order"]: state["players"][q]["combat_points"]=min(15,state["players"][q]["combat_points"]+1); _draw(state,q,1)
            state["revision"] += 1
            if any(x["health"]<=0 for x in state["players"].values()):
                state["game_over"]=True; state["phase"]="game_over"; state["current_player"]=None
                best=max(x["health"] for x in state["players"].values()); state["winner"]=[pid for pid,x in state["players"].items() if x["health"]==best]
            events.append({"type":"dice_throne:"+typ,"payload":{"player_id":pid,"type":typ}})
            return events,None
        except (ValueError, KeyError, StopIteration) as exc:
            state.clear(); state.update(before); return [], str(exc)

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players=[]
        for pid in state["turn_order"]:
            p=state["players"][pid]; players.append({"player_id":pid,"name":state["player_meta"][pid].get("name",pid),"hero":p["hero"],"health":p["health"],"combat_points":p["combat_points"],"max_health":50,"statuses":[{"id":k,"stacks":v} for k,v in p["statuses"].items()],"hand_count":len(p["hand"]),"upgrades":[f"{u['ability']}_{u['level']}" for u in p["upgrades"]],"is_bot":bool(state["player_meta"][pid].get("is_bot"))})
        own=state["players"].get(viewer_id,{}); hand=[]
        for cid in own.get("hand",[]):
            card=copy.deepcopy(CARDS.get(cid,{})); card["id"]=cid; hand.append(card)
        abilities=[]
        if own.get("hero") and state["phase"] in ("targeting","offensive_roll"):
            for a,l in _hero_abilities(own["hero"],own["upgrades"]): abilities.append({"id":a["id"],"name":a["name"],"cost":_ability_cost(a["id"]),"available":state["phase"]=="targeting" and _condition(a,state.get("dice",[])) and own["combat_points"]>=_ability_cost(a["id"]),"target":"opponent","description":a["description"]})
        return {"game_id":"dice_throne","revision":state["revision"],"phase":state["phase"],"current_player":state.get("current_player"),"players":players,"you":viewer_id,"your_hand":hand,"dice":[{"index":i,"face":(d.get("face") if isinstance(d,dict) else d),"kept":state["kept"][i]} for i,d in enumerate(state.get("dice",[]))],"roll_count":state.get("rolls",0),"abilities":abilities,"pending_attack":copy.deepcopy(state.get("pending_attack")),"discard_count":len(state.get("discard",[])),"legal_actions":DiceThroneGame.get_legal_actions(state,viewer_id),"winner":list(state.get("winner",[])),"game_over":state.get("game_over",False),"round_review":copy.deepcopy(state.get("round_review",[])),"next_round_ready":list(state.get("next_round_ready",[])),"round":state.get("round",1),"log":copy.deepcopy(state.get("round_review",[]))}

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal=DiceThroneGame.get_legal_actions(state,bot_id)
        if not legal:return None
        if "choose_hero" in legal:
            taken = {p["hero"] for p in state["players"].values() if p.get("hero")}
            hero = "moon_elf" if "moon_elf" not in taken else "barbarian"
            return {"type":"choose_hero","hero":hero,"revision":state["revision"],"delay_ms":250}
        if "next_round" in legal:return {"type":"next_round","revision":state["revision"],"delay_ms":350}
        if "roll" in legal:return {"type":"roll","revision":state["revision"],"delay_ms":450}
        if "confirm_roll" in legal and state.get("rolls",0)>=1:return {"type":"confirm_roll","revision":state["revision"],"delay_ms":350}
        if "use_ability" in legal:
            for a,l in _hero_abilities(state["players"][bot_id]["hero"],state["players"][bot_id]["upgrades"]):
                if _condition(a,state.get("dice",[])) and state["players"][bot_id]["combat_points"]>=_ability_cost(a["id"]): return {"type":"use_ability","ability_id":a["id"],"revision":state["revision"],"delay_ms":400}
            return {"type":"pass","revision":state["revision"],"delay_ms":300}
        if "defend" in legal:return {"type":"defend","revision":state["revision"],"delay_ms":400}
        if "end_phase" in legal:return {"type":"end_phase","revision":state["revision"],"delay_ms":300}
        return {"type":legal[0],"revision":state["revision"],"delay_ms":300}

    @staticmethod
    def serialize(state): return copy.deepcopy(state)
    @staticmethod
    def deserialize(payload):
        state = copy.deepcopy(payload)
        def tuples(value):
            if isinstance(value, list):
                return tuple(tuples(item) for item in value)
            if isinstance(value, dict):
                return {key: tuples(item) for key, item in value.items()}
            return value
        if isinstance(state.get("rng_state"), list):
            state["rng_state"] = tuples(state["rng_state"])
        return state
