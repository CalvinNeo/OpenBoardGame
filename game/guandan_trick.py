"""Paired, public-information whole-trick evaluation for heuristic leads.

This is an experimental model, independent of the additive root scorer. Each
sample follows an actor-local response policy to a rule-defined event boundary.
Neither partial trajectories nor a mixture of old/new scores form a ranking.
"""

import copy
import hashlib
import itertools
import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from game import guandan as rules
from game import guandan_ai as ai


class IncompleteTrick(Exception):
    """A complete paired comparison cannot be published."""


@dataclass
class TrickBudget:
    deadline: Optional[float] = None

    def check(self) -> None:
        # Independent of complete_heuristic_scoring: shadow work must be bounded.
        if self.deadline is not None and time.perf_counter() >= self.deadline:
            raise IncompleteTrick("deadline")


def _call(name: str, *args, **kwargs):
    return ai.call(rules, name, *args, **kwargs)


def public_worlds(state: Dict, observer: str, count: int, budget: TrickBudget) -> List[Dict]:
    """Sample only public evidence; even sampler fallbacks contain no real hands."""
    budget.check()
    fields = ("config", "turn_order", "player_meta", "player_teams", "teams", "dealer_team",
              "level_rank", "round_number", "phase", "current_turn", "current_trick", "pass_count",
              "trick_plays", "finish_order", "visible_card_id", "seen_cards", "pass_limits",
              "known_card_owners", "game_over", "winner_team")
    source = {key: copy.deepcopy(state[key]) for key in fields if key in state}
    source.update(_ai_eval_cache={}, game_start_time=0.0, tribute=None)
    source["players"] = {
        pid: {"hand": copy.deepcopy(pdata["hand"]) if pid == observer else [None] * len(pdata["hand"]),
              "finished": pdata.get("finished", False), "finish_rank": pdata.get("finish_rank"),
              "round_ready": False}
        for pid, pdata in state["players"].items()
    }
    # The sampler consumes public actions, never saved initial/final hands.
    source["round_memories"] = [
        {key: copy.deepcopy(entry[key]) for key in ("round_number", "level_rank", "tricks") if key in entry}
        for entry in state.get("round_memories", [])
    ]
    known = set(source.get("seen_cards") or [])
    known.update((source.get("current_trick") or {}).get("cards") or [])
    own = {c["id"] for c in source["players"][observer]["hand"]}
    deck_ids = {c["id"] for c in rules._full_deck()}
    counts = {pid: len(pdata["hand"]) for pid, pdata in source["players"].items()}
    if known & own or len(deck_ids - known) != sum(counts.values()):
        raise IncompleteTrick("inconsistent_public_counts")
    owners = {}
    for raw_id, pid in (source.get("known_card_owners") or {}).items():
        try:
            cid = int(raw_id)
        except (ValueError, TypeError):
            raise IncompleteTrick("invalid_known_owner")
        if cid in known:
            continue
        if cid not in deck_ids or pid not in counts or ((cid in own) != (pid == observer)):
            raise IncompleteTrick("inconsistent_known_owner")
        owners[cid] = pid
    if any(sum(owner == pid for owner in owners.values()) > size for pid, size in counts.items()):
        raise IncompleteTrick("too_many_known_cards")
    seed_key = _call("_heuristic_score_cache_key", source, observer, 0)
    seed = hashlib.blake2b(repr(seed_key).encode(), digest_size=8).digest()
    rng = random.Random(int.from_bytes(seed, "big"))
    worlds = []
    # Force a fixed inexpensive posterior proposal count. Timing must not
    # change the public panel or enable the costly sequence decomposition.
    previous = getattr(ai._CORE_LOCAL, "determinize_sampling_budget", None)
    ai._CORE_LOCAL.determinize_sampling_budget = 0.0
    try:
        for _ in range(count):
            budget.check()
            world = _call("_determinize_state", source, observer, rng, deadline=budget.deadline)
            budget.check()
            if not world.get("_ai_sampled_world"):
                raise IncompleteTrick("unsampled_world")
            cards = [card for pdata in world["players"].values() for card in pdata["hand"]]
            ids = [card["id"] for card in cards if isinstance(card, dict)]
            if len(ids) != len(cards) or len(set(ids)) != len(ids) or set(ids) != deck_ids - known:
                raise IncompleteTrick("invalid_world_partition")
            for pid, size in counts.items():
                hand_ids = {c["id"] for c in world["players"][pid]["hand"]}
                if len(hand_ids) != size or any(cid not in hand_ids for cid, owner in owners.items() if owner == pid):
                    raise IncompleteTrick("invalid_world_assignment")
            if {c["id"] for c in world["players"][observer]["hand"]} != own:
                raise IncompleteTrick("changed_observer_hand")
            worlds.append(world)
    finally:
        if previous is None:
            delattr(ai._CORE_LOCAL, "determinize_sampling_budget")
        else:
            ai._CORE_LOCAL.determinize_sampling_budget = previous
    return worlds


def world_id(state: Dict) -> str:
    assignment = tuple((pid, tuple(sorted(c["id"] for c in state["players"][pid]["hand"])))
                       for pid in state["turn_order"])
    return hashlib.blake2b(repr(assignment).encode(), digest_size=8).hexdigest()


def resource_plan(hand: List[Dict], level: int, budget: TrickBudget) -> Dict:
    """One feasible physical cover, not a sum of incompatible potential uses.

    Greedy candidate generation is a bounded approximation, not optimal hand
    solving. A wildcard committed to a straight is unavailable to every later
    group. Strength adjusts each group's pace once, rather than earning an
    extra independent inventory bonus.
    """
    remaining = list(hand)
    groups = []
    pace = 0.0
    while remaining:
        budget.check()
        info = rules._hand_info(remaining, level)
        # Generate physical groups without invoking the legacy feature sum.
        # Prefer long groups; only generate shorter shapes when needed.
        options = [entry["cards"] for entry in rules._find_bomb_candidates(remaining, level, info=info)]
        options += rules._list_steel_plate_options(remaining, level, 0, info=info)
        options += rules._list_three_pairs_options(remaining, level, 0, info=info)
        if max(map(len, options), default=0) < 6:
            options += rules._list_straight_options(remaining, level, 0, info=info)
            options += rules._list_full_house_options(remaining, level, 0, info=info)
        if not options:
            options = rules._list_rank_group_options(remaining, level, 0, 3, info=info)
        if not options:
            options = rules._list_rank_group_options(remaining, level, 0, 2, info=info)
        if not options:
            options = [[c["id"]] for c in remaining]
        by_id = rules._map_hand_by_id(remaining)
        candidates = []
        for cards in options:
            combo = rules._evaluate_combo([by_id[cid] for cid in cards], level, {})
            if combo:
                candidates.append((cards, combo))
        if not candidates:
            raise IncompleteTrick("no_resource_cover")
        cards, combo = max(candidates, key=lambda row: (
            len(row[0]), row[1]["type"] in rules.BOMB_TYPES,
            -sum(rules._is_wild(by_id[cid], level) for cid in row[0]),
            rules._combo_value(row[1]), tuple(sorted(row[0])),
        ))
        selected = set(cards)
        if not selected or len(selected) != len(cards) or not selected <= {c["id"] for c in remaining}:
            raise IncompleteTrick("invalid_resource_cover")
        groups.append({"cards": list(cards), "type": combo["type"]})
        if combo["type"] in rules.BOMB_TYPES:
            group_pace = 0.7
        else:
            value = rules._combo_value(combo)
            low, high = (5, 14) if combo["type"] in ("straight", "three_pairs", "steel_plate") else (49, 100)
            strength = max(0.0, min(1.0, (value - low) / (high - low)))
            group_pace = 1.0 - 0.3 * strength
        pace += group_pace
        remaining = [c for c in remaining if c["id"] not in selected]
    budget.check()
    return {"groups": groups, "pace": pace}


def team_value(state: Dict, observer: str, budget: TrickBudget, plans: Dict) -> float:
    """Expected *one* team settlement value from a residual-hand race model.

    Plackett-Luce weights over all possible remaining finish orders smooth a
    noisy greedy cover. Its pace/seat assumptions are a continuation prior,
    not a calibrated win probability. Completed places are never predicted
    again. Same-team observers have identical values; opponents have opposites.
    """
    budget.check()
    if state.get("game_over"):
        return 1000.0 if state.get("winner_team") == rules._team_of(state, observer) else -1000.0
    settled = _call("_settled_round_value", state, observer)
    if settled is not None:
        return settled
    prefix = list(state.get("finish_order") or [])
    active = [pid for pid in state["turn_order"] if pid not in prefix]
    weights = {}
    leader = state.get("current_turn") if state.get("current_trick") is None else None
    rotated = list(active)
    if leader in rotated:
        offset = rotated.index(leader)
        rotated = rotated[offset:] + rotated[:offset]
    for pid in active:
        hand = state["players"][pid]["hand"]
        key = (state["level_rank"], tuple(sorted(c["id"] for c in hand)))
        if key not in plans:
            plans[key] = resource_plan(hand, state["level_rank"], budget)
        # Only a closed trick grants a definite next-lead advantage. At a
        # finish event the top play is still contestable; invent no winner.
        delay = rotated.index(pid) / len(active) if leader in active else 0.0
        weights[pid] = math.exp(-(plans[key]["pace"] + delay) / 2.0)
    total = 0.0
    projected = dict(state)
    for tail in itertools.permutations(active):
        probability = 1.0
        for index, pid in enumerate(tail[:-1]):
            probability *= weights[pid] / sum(weights[other] for other in tail[index:])
        projected["finish_order"] = prefix + list(tail)
        total += probability * _call("_settled_round_value", projected, observer)
    budget.check()
    return total


def response_action(state: Dict, actor: str, rng: random.Random) -> Dict:
    """A bounded actor-local policy: finish, protect partner, or contest cheaply.

    This intentionally uses only the actor's physical cards and public facts.
    It never maximizes a sampled all-hands leaf value (strategy fusion), nor
    calls the additive root scorer. Voluntary pass and control preservation
    remain uncertain policy assumptions represented by sampling.
    """
    hand = state["players"][actor]["hand"]
    trick = state.get("current_trick")
    if not trick:
        raise IncompleteTrick("response_without_trick")
    level, config = state["level_rank"], state.get("config", {})
    if rules._can_play_all(hand, level, config, trick["combo"]):
        return {"type": "play", "card_ids": [c["id"] for c in hand]}
    if rules._team_of(state, actor) == rules._team_of(state, trick["player_id"]):
        return {"type": "pass"}
    options = rules._list_hint_options(state, actor)
    by_id = rules._map_hand_by_id(hand)
    counts = {}
    for card in hand:
        if not rules._is_wild(card, level) and not rules._is_joker(card):
            counts[card["rank"]] = counts.get(card["rank"], 0) + 1
    ranked = []
    for ids in options:
        combo = rules._evaluate_play_combo(state, [by_id[cid] for cid in ids])
        if not combo:
            continue
        is_bomb = combo["type"] in rules.BOMB_TYPES
        wilds = sum(rules._is_wild(by_id[cid], level) for cid in ids)
        # Rank alternatives on local material use only. No future ownership is
        # read from the sampled world; those hands belong only to the referee.
        breaks_bomb = any(0 < sum(by_id[cid].get("rank") == rank for cid in ids) < count
                          for rank, count in counts.items() if count >= 4)
        key = (is_bomb, breaks_bomb, wilds, len(ids) if is_bomb else 0, rules._combo_value(combo), tuple(ids))
        ranked.append((key, list(ids)))
    if not ranked:
        return {"type": "pass"}
    ranked.sort(key=lambda row: row[0])
    cost, ids = ranked[0]
    threat = 1 <= len(state["players"][trick["player_id"]]["hand"]) <= 2
    play_chance = 0.95 if threat else (0.15 if cost[0] else 0.8)
    if (cost[1] or cost[2]) and not threat:
        play_chance *= 0.5
    if rng.random() >= play_chance:
        return {"type": "pass"}
    return {"type": "play", "card_ids": ids}


@dataclass
class TrickPlan:
    action: Dict
    world: str
    actions: List[Dict]
    consumed: Dict[str, List[int]]
    remaining: Dict[str, List[int]]
    finish_order: List[str]
    boundary: str
    winner: Optional[str]
    next_leader: Optional[str]
    opponent_finished: bool
    value: float

    def explain(self, observer: str) -> Dict:
        # Simulated replies are explicitly labelled. Do not publish fabricated
        # opponents' residual hands as though they were known live information.
        return {
            "sampled": True, "world": self.world, "actions": self.actions,
            "consumed": self.consumed, "remaining": self.remaining[observer],
            "hand_counts": {pid: len(cards) for pid, cards in self.remaining.items()},
            "finish_order": self.finish_order, "boundary": self.boundary,
            "winner": self.winner, "next_leader": self.next_leader,
            "opponent_finished": self.opponent_finished, "value": self.value,
        }


def trace_plan(world: Dict, observer: str, action: Dict, rng: random.Random,
               budget: TrickBudget, max_actions: int, plans: Dict) -> TrickPlan:
    """Finish the response window, including responses after a player goes out.

    A finished player's place cannot be recovered, but other players may still
    contest the final play and change the next leader. Only actual settlement
    or a closed trick is a leaf; a depth/time cutoff is never a scored leaf.
    """
    budget.check()
    if not world.get("_ai_sampled_world"):
        raise IncompleteTrick("unsampled_world")
    state = _call("_clone_search_state", world)
    original_order = list(state.get("finish_order") or [])
    consumed = {pid: [] for pid in state["turn_order"]}
    actions = []
    actor = observer
    winner = None
    next_leader = None
    for step in range(max_actions):
        budget.check()
        selected = action if step == 0 else response_action(state, actor, rng)
        previous_top = (state.get("current_trick") or {}).get("player_id")
        _events, error = rules.GuandanGame.apply_action(state, actor, copy.deepcopy(selected))
        if error:
            raise IncompleteTrick("illegal_simulated_action: " + error)
        actions.append({"player_id": actor, **copy.deepcopy(selected)})
        consumed[actor].extend(selected.get("card_ids") or [])
        budget.check()
        if state.get("game_over") or _call("_settled_round_value", state, observer) is not None:
            boundary = "round_settled"
        elif state.get("current_trick") is None:
            boundary = "trick_closed"
            winner, next_leader = previous_top, state.get("current_turn")
        else:
            actor = state.get("current_turn")
            if actor is None:
                raise IncompleteTrick("no_actor")
            continue
        value = team_value(state, observer, budget, plans)
        new_finishers = state.get("finish_order", [])[len(original_order):]
        return TrickPlan(
            copy.deepcopy(action), world_id(world), actions, consumed,
            {pid: [c["id"] for c in pdata["hand"]] for pid, pdata in state["players"].items()},
            list(state.get("finish_order") or []), boundary, winner, next_leader,
            any(rules._team_of(state, pid) != rules._team_of(state, observer) for pid in new_finishers),
            value,
        )
    raise IncompleteTrick("action_limit")


def compare_leads(state: Dict, observer: str, scored: List[Tuple], deadline: Optional[float] = None) -> Dict:
    """Publish only complete paired panels; shadow mode never changes selection."""
    config = state.get("config", {})
    mode = config.get("bot_trick_boundary_mode", "shadow")
    result = {"mode": mode, "status": "disabled", "applied": False, "candidates": []}
    if mode not in ("shadow", "replace") or state.get("current_trick") or len(scored) < 2:
        return result
    count = max(2, min(16, int(config.get("bot_trick_boundary_worlds", 4))))
    width = max(2, min(8, int(config.get("bot_trick_boundary_candidates", 4))))
    max_actions = max(1, min(128, int(config.get("bot_trick_boundary_max_actions", 40))))
    started = time.perf_counter()
    stop = started + max(0.0, float(config.get("bot_trick_boundary_time_ms", 250))) / 1000.0
    budget = TrickBudget(min(stop, deadline) if deadline is not None else stop)
    reference_entry = max(scored, key=lambda row: row[1])
    alternatives = [row for row in scored if row is not reference_entry]
    alternatives.sort(key=lambda row: (-row[1], tuple(sorted(row[0] or []))))
    candidates = [reference_entry] + alternatives[:width - 1]
    result.update(status="incomplete", candidate_count=len(candidates), requested_worlds=count,
                  scope="heuristic_finalists", policy="actor_local_response_v1", value_model="residual_race_v1")
    try:
        worlds = public_worlds(state, observer, count, budget)
        plans = {}
        for cards, old_score, _components in candidates:
            if not cards:
                raise IncompleteTrick("non_lead_candidate")
            action = {"type": "play", "card_ids": list(cards)}
            traces = [trace_plan(world, observer, action, random.Random(index), budget, max_actions, plans)
                      for index, world in enumerate(worlds)]
            values = [trace.value for trace in traces]
            result["candidates"].append({
                "action": action, "heuristic_score": old_score,
                "value": sum(values) / len(values), "world_values": values,
                "plans": [trace.explain(observer) for trace in traces],
            })
        budget.check()
    except IncompleteTrick as exc:
        # Completed prefixes are diagnostic only and may never change ranking.
        result.update(reason=str(exc), elapsed_ms=(time.perf_counter() - started) * 1000)
        return result
    records = result["candidates"]
    reference = records[0]
    best = max(records, key=lambda row: row["value"])
    deltas = [a - b for a, b in zip(best["world_values"], reference["world_values"])]
    mean = sum(deltas) / len(deltas)
    variance = sum((delta - mean) ** 2 for delta in deltas) / (len(deltas) - 1)
    lower = mean - 1.64 * math.sqrt(variance / len(deltas))
    # No old score is added to Q. Weak evidence simply keeps the reference.
    # Auto's later MCTS/minimax guards still use legacy score units. Keep this
    # experiment isolated until those consumers migrate to the same objective.
    applied = (mode == "replace" and config.get("bot_mode") == "heuristic"
               and count >= 4 and (best is reference or lower > 0.0))
    selected = best if applied else reference
    result.update(status="complete", applied=applied, paired_gain=mean, paired_gain_lower=lower,
                  reference=reference["action"], proposed=best["action"], selected=selected["action"],
                  ranking=[row["action"] for row in sorted(records, key=lambda row: row["value"], reverse=True)],
                  elapsed_ms=(time.perf_counter() - started) * 1000)
    return result
