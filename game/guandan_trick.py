"""Paired, public-information continuation evaluation for heuristic finalists.

This is an experimental model, independent of the additive root scorer. Each
sample follows an actor-local policy to a rule-defined event boundary.
Neither partial trajectories nor a mixture of old/new scores form a ranking.
"""

import copy
import functools
import hashlib
import itertools
import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from game import guandan as rules
from game import guandan_ai as ai


_VALUE_EPSILON = 1e-8
_ROUND_ROLLOUT_CARDS = 32


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


def public_worlds(state: Dict, observer: str, count: int, budget: TrickBudget,
                  phase: str = "selection") -> List[Dict]:
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
    if phase != "selection":
        seed_key += ("trick_panel", phase)
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


def _resource_group_pace(combo: Dict) -> float:
    if combo["type"] in rules.BOMB_TYPES:
        return 0.7
    value = rules._combo_value(combo)
    low, high = (5, 14) if combo["type"] in ("straight", "three_pairs", "steel_plate") else (49, 100)
    strength = max(0.0, min(1.0, (value - low) / (high - low)))
    return 1.0 - 0.3 * strength


def _exact_resource_plan(hand: List[Dict], level: int, budget: TrickBudget) -> Dict:
    by_first = [[] for _card in hand]
    for size in range(1, len(hand) + 1):
        for indexes in itertools.combinations(range(len(hand)), size):
            budget.check()
            cards = [hand[index] for index in indexes]
            combo = rules._evaluate_combo(cards, level, {})
            if combo:
                mask = sum(1 << index for index in indexes)
                by_first[indexes[0]].append((mask, _resource_group_pace(combo), combo["type"]))

    @functools.lru_cache(None)
    def solve(remaining: int) -> Tuple[float, Tuple]:
        budget.check()
        if not remaining:
            return 0.0, ()
        first = (remaining & -remaining).bit_length() - 1
        alternatives = []
        for mask, cost, kind in by_first[first]:
            if mask & remaining != mask:
                continue
            tail_cost, tail = solve(remaining ^ mask)
            alternatives.append((cost + tail_cost, ((mask, kind),) + tail))
        return min(alternatives)

    pace, cover = solve((1 << len(hand)) - 1)
    groups = [{"cards": [card["id"] for index, card in enumerate(hand) if mask & (1 << index)],
               "type": kind} for mask, kind in cover]
    budget.check()
    return {"groups": groups, "pace": pace, "exact": True}


def resource_plan(hand: List[Dict], level: int, budget: TrickBudget) -> Dict:
    """Minimize one physical cover's pace, not incompatible resource credits.

    Up to eight cards use all legal physical subsets. Longer hands compare
    bounded complete covers with distinct allocation priorities, regenerating
    candidates after consumption. Their minimum is approximate, not a proof
    of globally optimal decomposition or of a calibrated continuation value.
    """
    budget.check()
    hand = sorted(hand, key=lambda card: card["id"])
    if len(hand) <= 8:
        return _exact_resource_plan(hand, level, budget)
    candidates_by_hand = {}

    def candidates(remaining: List[Dict]) -> List[Tuple]:
        signature = tuple(card["id"] for card in remaining)
        if signature in candidates_by_hand:
            return candidates_by_hand[signature]
        budget.check()
        info = rules._hand_info(remaining, level)
        options = [entry["cards"] for entry in rules._find_bomb_candidates(remaining, level, info=info)]
        for generator in (rules._list_steel_plate_options, rules._list_three_pairs_options,
                          rules._list_straight_options, rules._list_full_house_options):
            budget.check()
            options.extend(generator(remaining, level, 0, info=info))
        for size in (3, 2):
            budget.check()
            options.extend(rules._list_rank_group_options(remaining, level, 0, size, info=info))
        options.extend([card["id"]] for card in remaining)
        by_id = rules._map_hand_by_id(remaining)
        entries = []
        for cards in sorted({tuple(sorted(option)) for option in options}):
            budget.check()
            combo = rules._evaluate_combo([by_id[card_id] for card_id in cards], level, {})
            if combo:
                wilds = sum(rules._is_wild(by_id[card_id], level) for card_id in cards)
                entries.append((cards, combo, wilds))
        candidates_by_hand[signature] = entries
        return entries

    covers = []
    for preferred in ((), rules.BOMB_TYPES, ("three_pairs",), ("full_house",), ("straight", "straight_flush")):
        remaining = list(hand)
        groups = []
        pace = 0.0
        while remaining:
            budget.check()
            options = candidates(remaining)
            if not options:
                raise IncompleteTrick("no_resource_cover")
            cards, combo, _wilds = max(options, key=lambda row: (
                row[1]["type"] in preferred, len(row[0]), row[1]["type"] in rules.BOMB_TYPES,
                -row[2], rules._combo_value(row[1]), row[0],
            ))
            selected = set(cards)
            if len(selected) != len(cards) or not selected <= {card["id"] for card in remaining}:
                raise IncompleteTrick("invalid_resource_cover")
            groups.append({"cards": list(cards), "type": combo["type"]})
            pace += _resource_group_pace(combo)
            remaining = [card for card in remaining if card["id"] not in selected]
        if not groups:
            raise IncompleteTrick("no_resource_cover")
        covers.append({"groups": groups, "pace": pace, "exact": False})
    budget.check()
    return min(covers, key=lambda plan: (plan["pace"], tuple(tuple(group["cards"]) for group in plan["groups"])))


def team_value(state: Dict, observer: str, budget: TrickBudget, plans: Dict) -> float:
    """Expected *one* team settlement value from a residual-hand race model.

    Plackett-Luce weights over all possible remaining finish orders smooth a
    resource-cover estimate. Its pace/seat assumptions are a continuation prior,
    not a calibrated win probability. Legal immediate finishes and forced
    passes advance through the rules before predicting any remaining places.
    Same-team observers have identical values; opponents have opposites.
    """
    budget.check()
    if state.get("game_over"):
        return 1000.0 if state.get("winner_team") == rules._team_of(state, observer) else -1000.0
    settled = _call("_settled_round_value", state, observer)
    if settled is not None:
        return settled
    actor = state.get("current_turn")
    player = state["players"].get(actor)
    if state.get("phase") == "playing" and player and not player.get("finished"):
        hand = player["hand"]
        current_combo = (state.get("current_trick") or {}).get("combo")
        continuation = None
        if hand and rules._can_play_all(hand, state["level_rank"], state.get("config", {}), current_combo):
            continuation = {"type": "play", "card_ids": [card["id"] for card in hand]}
        elif hand and current_combo and not rules._list_hint_options({**state, "_ai_eval_cache": {}}, actor):
            continuation = {"type": "pass"}
        if continuation is not None:
            budget.check()
            successor = _call("_clone_search_state", state)
            _, error = rules.GuandanGame.apply_action(successor, actor, continuation)
            budget.check()
            if error:
                reason = "illegal_forced_pass" if continuation["type"] == "pass" else "illegal_immediate_finish"
                raise IncompleteTrick(reason + ": " + error)
            return team_value(successor, observer, budget, plans)
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


def _response_window(state: Dict, actor: str) -> List[str]:
    responders = []
    passes = int(state.get("pass_count") or 0) + 1
    needed = rules._trick_passes_needed(state)
    current = actor
    while passes < needed and len(responders) < len(state["turn_order"]):
        current = rules._next_active_player(state, current)
        if current is None or current == actor or current == state["current_trick"]["player_id"]:
            break
        responders.append(current)
        passes += 1
    return responders


def _short_finish_profile(state: Dict, actor: str, target: str) -> Dict:
    """Count one/two-card finishing hands from public ownership, not samples."""
    count = len(state["players"][target]["hand"])
    if count not in (1, 2):
        return {}
    available, locked = _call("_teammate_public_response_pool", state, actor, target)
    draws = count - len(locked)
    if not 0 <= draws <= len(available):
        return {}
    level = state["level_rank"]
    values = {}
    if draws <= 1:
        hands = [locked] if draws == 0 else [locked + [card] for card in available]
        for hand in hands:
            combo = rules._evaluate_combo(hand, level, {})
            if combo:
                value = rules._combo_value(combo)
                values[value] = values.get(value, 0) + 1
    else:
        info = rules._hand_info(available, level)
        wilds = len(info["wild_cards"])
        for rank, cards in info["normals_by_rank"].items():
            ways = math.comb(len(cards), 2) + len(cards) * wilds
            value = rules._point_order_value(rank, level)
            values[value] = values.get(value, 0) + ways
        if wilds >= 2:
            value = rules._point_order_value(level, level)
            values[value] = values.get(value, 0) + math.comb(wilds, 2)
        for kind, value in (("jokers_small", 90), ("jokers_big", 100)):
            values[value] = values.get(value, 0) + math.comb(len(info[kind]), 2)
    return {"count": count, "total": math.comb(len(available), draws), "values": values}


def _short_finish_risk(profile: Dict, combo: Dict) -> float:
    if not profile or not profile["total"]:
        return 0.0
    expected = "single" if profile["count"] == 1 else "pair"
    if combo["type"] != expected:
        return 0.0
    threshold = rules._combo_value(combo)
    return sum(weight for value, weight in profile["values"].items() if value > threshold) / profile["total"]


def response_action(state: Dict, actor: str, rng: random.Random) -> Dict:
    """An actor-local policy with public short-hand defence and cheap relays.

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
    own_team = rules._team_of(state, actor)
    leader = trick["player_id"]
    teammate_top = rules._team_of(state, leader) == own_team
    window = _response_window(state, actor)
    targets = [player for player in window if rules._team_of(state, player) != own_team
               and len(state["players"][player]["hand"]) in (1, 2)]
    leader_count = len(state["players"][leader]["hand"])
    last_defender = (not teammate_top and leader_count in (1, 2)
                     and not state["players"][leader].get("finished")
                     and not any(rules._team_of(state, player) == own_team for player in window))
    if last_defender:
        targets.append(leader)
    profiles = [_short_finish_profile(state, actor, player) for player in targets]
    initial_risk = max((_short_finish_risk(profile, trick["combo"]) for profile in profiles), default=0.0)
    options = rules._list_hint_options({**state, "_ai_eval_cache": {}}, actor)
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
        ranked.append((key, list(ids), combo))
    if not ranked:
        return {"type": "pass"}
    ranked.sort(key=lambda row: row[0])
    if initial_risk > 0.0 or last_defender:
        defenses = [(max((_short_finish_risk(profile, combo) for profile in profiles), default=0.0),
                     cost, ids) for cost, ids, combo in ranked]
        remaining_risk, _cost, ids = min(defenses)
        if last_defender or remaining_risk < initial_risk - 1e-9:
            return {"type": "play", "card_ids": ids}
    if teammate_top:
        if (trick["combo"]["type"] != "single" or state["players"][leader].get("finished")
                or leader_count < 3 or any(not player.get("finished") and len(player["hand"]) <= 2
                                          for player_id, player in state["players"].items()
                                          if rules._team_of(state, player_id) != own_team)):
            return {"type": "pass"}
        _available, locked = _call("_teammate_public_response_pool", state, actor, leader)
        return_control = max((rules._single_order_value(card, level) for card in locked), default=0)
        natural_ranks = set(counts)
        straight_ranks = set().union(*(set(sequence) for sequence, _high in rules.STRAIGHT_SEQUENCES
                                       if set(sequence) <= natural_ranks))
        for cost, ids, combo in ranked:
            if (combo["type"] == "single" and not cost[2]
                    and counts.get(by_id[ids[0]].get("rank"), 0) == 1
                    and by_id[ids[0]].get("rank") not in straight_ranks
                    and rules._combo_value(combo) <= ai.LOW_SINGLE_VALUE_MAX
                    and return_control > rules._combo_value(combo)):
                return {"type": "play", "card_ids": ids} if rng.random() < 0.8 else {"type": "pass"}
        return {"type": "pass"}
    cost, ids, _combo = ranked[0]
    threat = 1 <= leader_count <= 2
    play_chance = 0.95 if threat else (0.15 if cost[0] else 0.8)
    if (cost[1] or cost[2]) and not threat:
        play_chance *= 0.5
    if rng.random() >= play_chance:
        return {"type": "pass"}
    return {"type": "play", "card_ids": ids}


def continuation_action(state: Dict, actor: str, cache: Optional[Dict] = None) -> Dict:
    """Choose from one actor's cards and public evidence, never sampled faces."""
    fields = ("config", "turn_order", "player_meta", "player_teams", "teams", "dealer_team",
              "level_rank", "round_number", "phase", "current_turn", "current_trick", "pass_count",
              "trick_plays", "finish_order", "visible_card_id", "seen_cards", "pass_limits",
              "known_card_owners", "game_over", "winner_team")
    view = {key: state[key] for key in fields if key in state}
    view.update(_ai_sampled_world=False, _ai_eval_cache={}, game_start_time=0.0, tribute=None)
    view["config"] = {**state.get("config", {}), "bot_mode": "heuristic", "bot_trick_boundary_mode": "off"}
    view["players"] = {
        player: {"hand": list(data["hand"]) if player == actor else [None] * len(data["hand"]),
                 "finished": data.get("finished", False), "finish_rank": data.get("finish_rank"),
                 "round_ready": False}
        for player, data in state["players"].items()
    }
    view["round_memories"] = [
        {key: entry[key] for key in ("round_number", "level_rank", "tricks") if key in entry}
        for entry in state.get("round_memories", [])
    ]
    key = _call("_heuristic_score_cache_key", view, actor, view["config"].get("bot_search_depth", 4))
    if cache is not None and key in cache:
        return copy.deepcopy(cache[key])
    current_combo = (view.get("current_trick") or {}).get("combo")
    hand = view["players"][actor]["hand"]
    if hand and rules._can_play_all(hand, view["level_rank"], view["config"], current_combo):
        action = {"type": "play", "card_ids": [card["id"] for card in hand]}
    elif current_combo and not rules._list_hint_options(view, actor):
        action = {"type": "pass"}
    else:
        with ai.complete_heuristic_scoring():
            cards = _call("_bot_select_play", view, actor, view["config"].get("bot_search_depth", 4))
            if cards:
                cards = _call("_prefer_bomb_closeout_upgrade", view, actor, cards)
        if not cards and not current_combo:
            raise IncompleteTrick("no_continuation_action")
        action = {"type": "play", "card_ids": list(cards)} if cards else {"type": "pass"}
    if cache is not None:
        cache[key] = copy.deepcopy(action)
    return action


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
               budget: TrickBudget, max_actions: int, plans: Dict, finish_round: bool = False) -> TrickPlan:
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
        selected = action if step == 0 else (
            continuation_action(state, actor, plans.setdefault("continuation_actions", {}))
            if finish_round else response_action(state, actor, rng)
        )
        previous_top = (state.get("current_trick") or {}).get("player_id")
        _events, error = rules.GuandanGame.apply_action(state, actor, copy.deepcopy(selected))
        if error:
            raise IncompleteTrick("illegal_simulated_action: " + error)
        actions.append({"player_id": actor, **copy.deepcopy(selected)})
        consumed[actor].extend(selected.get("card_ids") or [])
        budget.check()
        if state.get("game_over") or _call("_settled_round_value", state, observer) is not None:
            boundary = "round_settled"
        elif state.get("current_trick") is None and not finish_round:
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


def _paired_gain(reference: List[float], challenger: List[float]) -> Tuple[float, float]:
    deltas = [selected - original for selected, original in zip(challenger, reference)]
    mean = sum(deltas) / len(deltas)
    variance = sum((delta - mean) ** 2 for delta in deltas) / (len(deltas) - 1)
    return mean, mean - 1.64 * math.sqrt(variance / len(deltas))


def _panel_candidates(state: Dict, observer: str, scored: List[Tuple], width: int,
                      budget: TrickBudget) -> List[Tuple]:
    reference = max(scored, key=lambda row: row[1])
    ordered = [reference] + sorted((row for row in scored if row is not reference),
                                  key=lambda row: (-row[1], tuple(sorted(row[0] or []))))
    by_id = rules._map_hand_by_id(state["players"][observer]["hand"])
    entries = []
    for row in ordered:
        budget.check()
        cards = row[0]
        if cards is None:
            if not state.get("current_trick"):
                raise IncompleteTrick("pass_without_trick")
            entries.append((row, ("pass", 0), ("pass",), ("pass",)))
            continue
        if not cards or any(card_id not in by_id for card_id in cards):
            raise IncompleteTrick("invalid_candidate_cards")
        selected = [by_id[card_id] for card_id in cards]
        combo = rules._evaluate_combo(selected, state["level_rank"], state.get("config", {}))
        if not combo:
            raise IncompleteTrick("invalid_candidate_combo")
        family = (combo["type"], combo["size"])
        lane = family + (combo.get("rank_value"), combo.get("high_value"),
                         sum(rules._is_wild(card, state["level_rank"]) for card in selected))
        faces = tuple(sorted((card.get("rank") or 0, card.get("suit") or "", card.get("joker") or "")
                             for card in selected))
        entries.append((row, family, lane, faces))
    selected_entries = [entries[0]]
    if entries[0][0][0] is not None:
        pass_entry = next((entry for entry in entries[1:] if entry[0][0] is None), None)
        if pass_entry is not None:
            selected_entries.append(pass_entry)
    for identity in (1, 2, 3):
        for entry in entries[1:]:
            if len(selected_entries) >= width:
                break
            if all(entry[identity] != previous[identity] for previous in selected_entries):
                selected_entries.append(entry)
    return [reference] + sorted((entry[0] for entry in selected_entries[1:]),
                                key=lambda row: (-row[1], tuple(sorted(row[0] or []))))


def compare_leads(state: Dict, observer: str, scored: List[Tuple], deadline: Optional[float] = None) -> Dict:
    """Publish only complete paired panels; shadow mode never changes selection."""
    config = state.get("config", {})
    mode = config.get("bot_trick_boundary_mode", "shadow")
    result = {"mode": mode, "status": "disabled", "applied": False, "candidates": []}
    if mode not in ("shadow", "replace") or len(scored) < 2:
        return result
    total_cards = sum(len(data["hand"]) for data in state["players"].values())
    if total_cards > _ROUND_ROLLOUT_CARDS:
        result.update(status="skipped", reason="outside_round_rollout_scope", hand_cards=total_cards)
        return result
    count = max(2, min(16, int(config.get("bot_trick_boundary_worlds", 4))))
    width = max(2, min(8, int(config.get("bot_trick_boundary_candidates", 4))))
    max_actions = max(1, min(128, int(config.get("bot_trick_boundary_max_actions", 40))))
    started = time.perf_counter()
    stop = started + max(0.0, float(config.get("bot_trick_boundary_time_ms", 250))) / 1000.0
    budget = TrickBudget(min(stop, deadline) if deadline is not None else stop)
    result.update(status="incomplete", candidate_count=0, requested_worlds=count,
                  scope="heuristic_endgame_finalists", policy="actor_local_heuristic_v1", value_model="terminal_round_v1",
                  comparison="independent_confirmation_v1", sampling="public_position_paired_v2",
                  root="follow" if state.get("current_trick") else "lead", candidates_model="diverse_routes_v1")
    public_key = _call("_heuristic_score_cache_key", state, observer, 0)
    plans = {}

    def evaluate(action: Dict, worlds: List[Dict], phase: str) -> Dict:
        traces = []
        for index, world in enumerate(worlds):
            seed_key = (public_key, "trick_response", phase, index)
            seed = int.from_bytes(hashlib.blake2b(repr(seed_key).encode(), digest_size=8).digest(), "big")
            traces.append(trace_plan(world, observer, action, random.Random(seed), budget,
                                     max_actions * 4, plans, finish_round=True))
        values = [trace.value for trace in traces]
        return {"action": action, "value": sum(values) / len(values), "world_values": values,
                "plans": [trace.explain(observer) for trace in traces]}

    try:
        candidates = _panel_candidates(state, observer, scored, width, budget)
        result["candidate_count"] = len(candidates)
        if len(candidates) < 2:
            result.update(status="skipped", reason="equivalent_candidates",
                          elapsed_ms=(time.perf_counter() - started) * 1000)
            return result
        worlds = public_worlds(state, observer, count, budget)
        for cards, old_score, _components in candidates:
            action = {"type": "pass"} if cards is None else {"type": "play", "card_ids": list(cards)}
            result["candidates"].append({**evaluate(action, worlds, "selection"), "heuristic_score": old_score})
        records = result["candidates"]
        reference = records[0]
        best = max(records, key=lambda row: row["value"])
        if best["value"] <= reference["value"] + _VALUE_EPSILON:
            best = reference
        mean, lower = _paired_gain(reference["world_values"], best["world_values"])
        result["verification"] = {"status": "not_needed"}
        verified = best is reference
        if best is not reference and count >= 4 and lower > _VALUE_EPSILON:
            result["verification"] = {"status": "incomplete", "requested_worlds": count}
            verification_worlds = public_worlds(state, observer, count, budget, phase="verification")
            verification_reference = evaluate(reference["action"], verification_worlds, "verification")
            verification_best = evaluate(best["action"], verification_worlds, "verification")
            verification_mean, verification_lower = _paired_gain(
                verification_reference["world_values"], verification_best["world_values"],
            )
            verified = verification_lower > _VALUE_EPSILON
            result["verification"] = {
                "status": "complete", "requested_worlds": count, "passed": verified,
                "paired_gain": verification_mean, "paired_gain_lower": verification_lower,
                "candidates": [verification_reference, verification_best],
            }
        budget.check()
    except IncompleteTrick as exc:
        # Completed prefixes are diagnostic only and may never change ranking.
        result.update(reason=str(exc), elapsed_ms=(time.perf_counter() - started) * 1000)
        return result
    # No old score is added to Q. Weak evidence simply keeps the reference.
    # Auto's later MCTS/minimax guards still use legacy score units. Keep this
    # experiment isolated until those consumers migrate to the same objective.
    applied = (mode == "replace" and config.get("bot_mode") == "heuristic"
               and count >= 4 and verified)
    selected = best if applied else reference
    result.update(status="complete", applied=applied, paired_gain=mean, paired_gain_lower=lower,
                  reference=reference["action"], proposed=best["action"], selected=selected["action"],
                  ranking=[row["action"] for row in sorted(records, key=lambda row: row["value"], reverse=True)],
                  elapsed_ms=(time.perf_counter() - started) * 1000)
    return result
