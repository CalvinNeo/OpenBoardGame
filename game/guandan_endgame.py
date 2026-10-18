"""Bounded, exact perfect-information search for sampled small endgames.

Only complete root panels are returned. Solving one sampled deal is not a
proof about the public-information game or the correctness of its posterior.
"""

import copy
import functools
import itertools
import math
import time
from typing import Dict, List, Optional, Tuple


COMBO_FIELDS = ("type", "size", "tier", "rank_value", "high_value", "uses_wild")


class IncompleteEndgame(Exception):
    """A root panel cannot be completed within its resource limits."""


class _CanonicalMasks:
    def __init__(self, groups: List[List[int]]):
        self.groups = []
        for indices in groups:
            prefixes = [0]
            for index in indices:
                prefixes.append(prefixes[-1] | (1 << index))
            self.groups.append((prefixes[-1], tuple(prefixes)))
        self.cache = {}

    def __getitem__(self, mask: int) -> int:
        if mask not in self.cache:
            normalized = 0
            for group_mask, prefixes in self.groups:
                normalized |= prefixes[bin(mask & group_mask).count("1")]
            self.cache[mask] = normalized
        return self.cache[mask]

    def all_masks(self):
        for parts in itertools.product(*(prefixes for group_mask, prefixes in self.groups)):
            mask = sum(parts)
            self.cache[mask] = mask
            yield mask


class EndgameSolver:
    def __init__(self, rules, state: Dict, observer: str,
                 deadline: Optional[float] = None, node_limit: int = 500000):
        self.rules = rules
        self.deadline = deadline
        self.node_limit = node_limit
        self.nodes = 0
        self.hits = 0
        self.table = {}
        self.moves_cache = {}
        self.check()
        self.level = state["level_rank"]
        self.config = state["config"]
        self.order = tuple(state["turn_order"])
        if len(self.order) != 4 or len(set(self.order)) != 4 or observer not in self.order:
            raise ValueError("four distinct players and a seated observer are required")
        if state.get("phase") != "playing":
            raise ValueError("endgame search requires a playing state")
        self.teams = tuple(state["player_teams"][actor] for actor in self.order)
        if len(set(self.teams)) != 2 or any(self.teams.count(team) != 2 for team in self.teams):
            raise ValueError("two teams of two are required")
        self.partners = tuple(
            next(other for other in range(4)
                 if other != actor and self.teams[other] == self.teams[actor])
            for actor in range(4)
        )
        self.observer_team = state["player_teams"][observer]
        self.levels = {team: data["level"] for team, data in state["teams"].items()}
        self.dealer_team = state["dealer_team"]
        self.cards = [sorted(state["players"][actor]["hand"], key=lambda card: card["id"])
                      for actor in self.order]
        all_ids = [card["id"] for hand in self.cards for card in hand]
        if len(set(all_ids)) != len(all_ids):
            raise ValueError("duplicate cards in sampled hands")
        if max(map(len, self.cards)) > 24:
            raise IncompleteEndgame("hand_limit")
        finish = tuple(self.order.index(actor) for actor in state.get("finish_order", []))
        if len(set(finish)) != len(finish):
            raise ValueError("duplicate finish places")
        if any((index in finish) != (not hand) for index, hand in enumerate(self.cards)):
            raise ValueError("finish places and remaining hands disagree")
        actor = self.order.index(state["current_turn"])
        if actor in finish:
            raise ValueError("current player has finished")
        self.canonical_masks = []
        self.combos = []
        self.combo_ids = {}
        self.plays = []
        self.maximum = 1000.0 if self.levels[self.dealer_team] >= 14 else 300.0
        possible_values = {}
        for order in itertools.permutations(range(4)):
            value = self.terminal(order)
            for length in range(5):
                possible_values.setdefault(order[:length], []).append(value)
        # Finish prefixes determine both settlement and active turn order.
        # Reuse these small tables at every node instead of scanning players
        # again for each forced pass and terminal check.
        self.terminal_values = {prefix: self.terminal(prefix) for prefix in possible_values}
        self.bounds = {prefix: (min(values), max(values)) for prefix, values in possible_values.items()}
        self.next_actors = {
            prefix: tuple(
                next((actor + offset) % 4 for offset in range(1, 5)
                     if (actor + offset) % 4 not in prefix)
                for actor in range(4)
            )
            for prefix in possible_values if len(prefix) < 4
        }
        current = state.get("current_trick")
        target = self.combo_id(current["combo"]) if current else -1
        for hand in self.cards:
            wild_count = sum(bool(rules._is_wild(card, self.level)) for card in hand)
            flush_possible = any(
                len({card["rank"] for card in hand
                     if card.get("suit") == suit and not rules._is_wild(card, self.level)}
                    .intersection(sequence)) + wild_count >= 5
                for suit in rules.SUITS for sequence, _high in rules.STRAIGHT_SEQUENCES
            )
            faces = {}
            for index, card in enumerate(hand):
                face = (card.get("rank"), card.get("suit") if flush_possible else None,
                        card.get("joker"), bool(rules._is_wild(card, self.level)))
                faces.setdefault(face, []).append(index)
            if math.prod(len(indices) + 1 for indices in faces.values()) > 8192:
                raise IncompleteEndgame("hand_limit")
            normalized = _CanonicalMasks(list(faces.values()))
            self.canonical_masks.append(normalized)
            plays = []
            for count, mask in enumerate(normalized.all_masks()):
                if count % 64 == 0:
                    self.check()
                if not mask:
                    continue
                selected = [card for index, card in enumerate(hand) if mask & (1 << index)]
                canonical = rules._evaluate_combo(selected, self.level, self.config)
                if not canonical:
                    continue
                usual = self.combo_id(canonical)
                alternate = rules._evaluate_combo_for_type(selected, self.level, self.config, "steel_plate")
                steel = self.combo_id(alternate) if alternate else usual
                plays.append((mask, usual, steel, len(selected)))
            plays.sort(key=lambda entry: (-entry[3], rules._combo_value(self.combos[entry[1]]), entry[0]))
            self.plays.append(plays)
        comparison_rows = []
        for before in self.combos:
            self.check()
            comparison_rows.append(tuple(rules._compare_combos(before, after, self.level, self.config)
                                         for after in self.combos))
        self.beats = tuple(comparison_rows)
        self.initial = (tuple((1 << len(hand)) - 1 for hand in self.cards), actor,
                        self.order.index(current["player_id"]) if current else -1,
                        target, int(state.get("pass_count") or 0), finish)
        self.check()

    def combo_id(self, combo: Dict) -> int:
        key = tuple(combo.get(name) for name in COMBO_FIELDS)
        if key not in self.combo_ids:
            self.combo_ids[key] = len(self.combos)
            self.combos.append(dict(combo))
        return self.combo_ids[key]

    def check(self) -> None:
        if self.nodes >= self.node_limit:
            raise IncompleteEndgame("node_limit")
        if self.deadline is not None and time.perf_counter() >= self.deadline:
            raise IncompleteEndgame("deadline")

    def terminal(self, finish: Tuple[int, ...]) -> Optional[float]:
        if not finish:
            return None
        winning = self.teams[finish[0]]
        partner = next((rank for rank, actor in enumerate(finish[1:], 2)
                        if self.teams[actor] == winning), None)
        if partner is None:
            if len(finish) < 3:
                return None
            partner = 4
        points = {2: 3, 3: 2, 4: 1}[partner]
        magnitude = points * 100.0
        if (winning == self.dealer_team and self.levels[winning] >= 14
                and (not self.config.get("require_partner_not_last_for_a") or partner != 4)):
            magnitude = 1000.0
        return magnitude if winning == self.observer_team else -magnitude

    def moves(self, actor: int, hand: int, target: int, leader: int) -> List[Tuple[int, int]]:
        key = actor, hand, target, leader
        if key in self.moves_cache:
            return self.moves_cache[key]
        steel = target >= 0 and self.combos[target]["type"] == "steel_plate"
        moves = []
        seen = set()
        for mask, usual, alternative, size in self.plays[actor]:
            combo = alternative if steel else usual
            if mask & hand == mask and (target < 0 or self.beats[target][combo]):
                identity = self.canonical_masks[actor][hand ^ mask], combo
                if identity in seen:
                    continue
                seen.add(identity)
                moves.append((mask, combo))
        if target >= 0:
            if self.teams[leader] == self.teams[actor]:
                moves.insert(0, (0, -1))
            else:
                moves.append((0, -1))
        moves.sort(key=lambda move: move[0] != hand)
        self.moves_cache[key] = moves
        return moves

    def transition(self, node: Tuple, move: Tuple[int, int]) -> Tuple:
        hands, actor, leader, target, passes, finish = node
        mask, combo = move
        if mask:
            after = list(hands)
            after[actor] = self.canonical_masks[actor][hands[actor] ^ mask]
            hands = tuple(after)
            if not hands[actor]:
                finish += (actor,)
            leader, target, passes = actor, combo, 0
        else:
            passes += 1
            needed = 4 - len(finish) - bool(hands[leader])
            if passes >= needed:
                next_actor = leader if hands[leader] else self.partners[leader]
                return hands, next_actor, -1, -1, 0, finish
        next_actor = self.next_actors[finish][actor]
        return hands, next_actor, leader, target, passes, finish

    def value(self, node: Tuple, alpha: float, beta: float) -> float:
        self.nodes += 1
        if self.nodes % 64 == 0:
            self.check()
        terminal = self.terminal_values[node[5]]
        if terminal is not None:
            return terminal
        old_alpha, old_beta = alpha, beta
        lower, upper = self.bounds[node[5]]
        if lower == upper:
            return lower
        if upper <= alpha:
            return upper
        if lower >= beta:
            return lower
        alpha, beta = max(alpha, lower), min(beta, upper)
        cached = self.table.get(node)
        preferred = None
        if cached is not None:
            self.hits += 1
            value, bound, preferred = cached
            if bound == "exact":
                return value
            if bound == "lower":
                alpha = max(alpha, value)
            else:
                beta = min(beta, value)
            if alpha >= beta:
                return value
        hands, actor, leader, target, passes, finish = node
        moves = self.moves(actor, hands[actor], target, leader)
        if preferred in moves:
            moves = [preferred] + [move for move in moves if move != preferred]
        maximize = self.teams[actor] == self.observer_team
        best = -1001.0 if maximize else 1001.0
        chosen = None
        for move in moves:
            value = self.value(self.transition(node, move), alpha, beta)
            if chosen is None or (value > best if maximize else value < best):
                best, chosen = value, move
            if maximize:
                alpha = max(alpha, best)
            else:
                beta = min(beta, best)
            if alpha >= beta or (maximize and best >= upper) or (not maximize and best <= lower):
                break
        if chosen is None:
            raise ValueError("no legal action in sampled endgame")
        bound = "upper" if best <= old_alpha else "lower" if best >= old_beta else "exact"
        self.table[node] = best, bound, chosen
        return best

    def action_move(self, action: Dict) -> Tuple[int, int]:
        actor = self.initial[1]
        legal = self.moves(actor, self.initial[0][actor], self.initial[3], self.initial[2])
        if action.get("type") == "pass":
            move = (0, -1)
        elif action.get("type") == "play":
            identifiers = action.get("card_ids")
            if not isinstance(identifiers, list) or not identifiers or len(set(identifiers)) != len(identifiers):
                raise ValueError("invalid root card list")
            hand_ids = {card["id"] for card in self.cards[actor]}
            wanted = set(identifiers)
            if not wanted <= hand_ids:
                raise ValueError("root card not in hand")
            mask = sum(1 << index for index, card in enumerate(self.cards[actor]) if card["id"] in wanted)
            combo = self.rules._evaluate_combo_for_type(
                [card for card in self.cards[actor] if card["id"] in wanted], self.level, self.config,
                self.combos[self.initial[3]]["type"] if self.initial[3] >= 0 else None)
            identifier = self.combo_ids.get(tuple(combo.get(name) for name in COMBO_FIELDS)) if combo else None
            remaining = self.canonical_masks[actor][self.initial[0][actor] ^ mask]
            move = next((candidate for candidate in legal
                         if self.canonical_masks[actor][self.initial[0][actor] ^ candidate[0]] == remaining
                         and candidate[1] == identifier), None)
        else:
            raise ValueError("invalid root action type")
        if move is None or move not in legal:
            raise ValueError("illegal root action")
        return move

    def root_actions(self) -> List[Dict]:
        actor = self.initial[1]
        return [{"type": "play", "card_ids": [card["id"] for index, card in enumerate(self.cards[actor])
                                               if mask & (1 << index)]} if mask else {"type": "pass"}
                for mask, combo in self.moves(actor, self.initial[0][actor], self.initial[3], self.initial[2])]

    def root_values(self, actions: List[Dict]) -> List[float]:
        self.check()
        moves = [self.action_move(action) for action in actions]
        values = []
        # A round can settle only at the finite point/match values produced by
        # ``terminal``.  Searching each root with a narrow window between two
        # adjacent values lets alpha-beta classify the root and reuse its
        # transposition bounds, while returning the same exact utility as a
        # full-window search.
        possible = sorted({
            self.terminal(order)
            for order in itertools.permutations(range(4))
        })
        for move in moves:
            self.check()
            child = self.transition(self.initial, move)
            minimum, maximum = self.bounds[child[5]]
            candidates = [value for value in possible if minimum <= value <= maximum]
            if len(candidates) <= 1:
                values.append(candidates[0] if candidates else self.value(child, -1001.0, 1001.0))
                continue
            lo, hi = 0, len(candidates) - 1
            while lo < hi:
                mid = (lo + hi) // 2
                threshold = (candidates[mid] + candidates[mid + 1]) / 2.0
                value = self.value(child, threshold - 0.5, threshold + 0.5)
                # Terminal utilities are integral and threshold is strictly
                # between adjacent candidates. A null-window result therefore
                # tells which side contains the exact root value; it need not
                # itself be the exact value returned by alpha-beta.
                if value < threshold:
                    hi = mid
                else:
                    lo = mid + 1
            values.append(candidates[lo])
        self.check()
        return values


def _action_key(action: Dict) -> Tuple:
    return action["type"], tuple(sorted(action.get("card_ids") or []))


def _paired_gain(reference: List[float], challenger: List[float]) -> Tuple[float, float]:
    deltas = [after - before for before, after in zip(reference, challenger)]
    mean = sum(deltas) / len(deltas)
    variance = sum((delta - mean) ** 2 for delta in deltas) / (len(deltas) - 1)
    return mean, mean - 1.64 * math.sqrt(variance / len(deltas))


def _world_key(state: Dict) -> Tuple:
    return tuple((actor, tuple(sorted(card["id"] for card in state["players"][actor]["hand"])))
                 for actor in state["turn_order"])


def _public_hands_determined(state: Dict, observer: str) -> bool:
    seen = set(state.get("seen_cards") or [])
    seen.update((state.get("current_trick") or {}).get("cards") or [])
    known = {actor: set() for actor in state["players"] if actor != observer}
    owners = {}
    for identifier, owner in (state.get("known_card_owners") or {}).items():
        try:
            identifier = int(identifier)
        except (TypeError, ValueError):
            return False
        if identifier in seen:
            continue
        if identifier in owners and owners[identifier] != owner:
            return False
        owners[identifier] = owner
        if owner in known:
            known[owner].add(identifier)
    if any(len(identifiers) > len(state["players"][actor]["hand"])
           for actor, identifiers in known.items()):
        return False
    unresolved = [actor for actor, identifiers in known.items()
                  if len(state["players"][actor]["hand"]) > len(identifiers)]
    return len(unresolved) <= 1


def _finish_is_maximal(rules, state: Dict, observer: str, reference: Dict) -> bool:
    from game import guandan_ai as ai

    hand = state["players"][observer]["hand"]
    cards = reference.get("card_ids") or []
    if (reference.get("type") != "play" or not hand or len(cards) != len(hand)
            or set(cards) != {card["id"] for card in hand}):
        return False
    current = state.get("current_trick") or {}
    if not rules._can_play_all(hand, state["level_rank"], state["config"], current.get("combo")):
        return False
    before = ai.call(rules, "_possible_round_value_bounds", state, observer)
    team = state["player_teams"][observer]
    can_win_match = team == state["dealer_team"] and state["teams"][team]["level"] >= 14
    upper = before[1] if before else (1000.0 if can_win_match else 300.0)
    projected = {**state, "finish_order": [*state.get("finish_order", []), observer]}
    after = ai.call(rules, "_possible_round_value_bounds", projected, observer)
    return after is not None and after[0] >= upper


def _public_uncontested_runout(rules, state: Dict, observer: str, reference: Dict,
                               deadline: Optional[float]) -> Optional[Dict]:
    """Prove a common runout against two unknown single-card hands.

    Every group, including the finishing group, is unbeatable for either
    remaining player. No future choice depends on their hidden assignment:
    the observer finishes second and its one-card teammate inherits the lead
    to finish third. This reaches the best possible loss after an enemy first.
    """
    from game import guandan_ai as ai

    finish = state.get("finish_order") or []
    hand = state["players"][observer]["hand"]
    if (state.get("phase") != "playing" or state.get("current_turn") != observer
            or len(finish) != 1 or rules._team_of(state, finish[0]) == rules._team_of(state, observer)
            or not 1 <= len(hand) <= 10):
        return None
    others = [pid for pid in state["turn_order"] if pid != observer and pid not in finish]
    if len(others) != 2 or any(len(state["players"][pid]["hand"]) != 1 for pid in others):
        return None
    limit = min(24, max(4, int(state.get("config", {}).get("bot_exact_endgame_max_cards", 20))))
    if len(hand) + 2 > limit:
        return None
    bounds = ai.call(rules, "_possible_round_value_bounds", state, observer)
    if bounds is None or bounds[1] != -100.0:
        return None
    own_ids = {card["id"] for card in hand}
    seen = set(state.get("seen_cards") or [])
    seen.update((state.get("current_trick") or {}).get("cards") or [])
    deck = rules._full_deck()
    deck_ids = {card["id"] for card in deck}
    if len(own_ids) != len(hand) or own_ids & seen or not (own_ids | seen) <= deck_ids:
        return None
    unknown = [card for card in deck if card["id"] not in own_ids | seen]
    if len(unknown) != 2:
        return None
    started = time.perf_counter()
    stop = started + max(0.0, float(state.get("config", {}).get("bot_exact_endgame_time_ms", 2500))) / 1000.0
    stop = min(stop, deadline) if deadline is not None else stop
    result = {"status": "incomplete", "applied": False, "changed": False,
              "reference": copy.deepcopy(reference), "candidates": [], "value_model": "terminal_round_v1",
              "scope": "proven_public_runout", "solver": "public_uncontested_runout_v1",
              "verification": {"status": "not_needed", "reason": "common_uncontested_continuation"}}

    def check() -> None:
        if time.perf_counter() >= stop:
            raise IncompleteEndgame("deadline")

    try:
        check()
        level, config = state["level_rank"], state.get("config", {})
        threshold = max(rules._single_order_value(card, level) for card in unknown)
        all_cards = (1 << len(hand)) - 1
        groups = {}
        roots = {}
        target = (state.get("current_trick") or {}).get("combo")
        for mask in range(1, all_cards + 1):
            check()
            selected = [card for index, card in enumerate(hand) if mask & (1 << index)]
            combo = rules._evaluate_combo(selected, level, config)
            if combo and (len(selected) > 1 or combo["rank_value"] >= threshold):
                groups[mask] = [card["id"] for card in selected]
            root_combo = rules._evaluate_combo_for_type(
                selected, level, config, target["type"] if target else None)
            if (root_combo and (len(selected) > 1 or root_combo["rank_value"] >= threshold)
                    and (not target or rules._compare_combos(target, root_combo, level, config))):
                roots[mask] = [card["id"] for card in selected]

        @functools.lru_cache(None)
        def cover(remaining: int) -> Optional[Tuple[int, ...]]:
            check()
            if not remaining:
                return ()
            first = remaining & -remaining
            best = None
            for mask in groups:
                if mask & first and mask & remaining == mask:
                    tail = cover(remaining ^ mask)
                    if tail is not None and (best is None or len(tail) + 1 < len(best)):
                        best = (mask,) + tail
            return best

        proofs = []
        for mask, cards in roots.items():
            tail = cover(all_cards ^ mask)
            if tail is not None:
                action = {"type": "play", "card_ids": cards}
                proofs.append({"action": action, "value": -100.0,
                               "runout": [cards] + [groups[group] for group in tail]})
        check()
        if not proofs:
            return None
        chosen = next((proof for proof in proofs if _action_key(proof["action"]) == _action_key(reference)), None)
        if chosen is None:
            chosen = min(proofs, key=lambda proof: (len(proof["runout"]), _action_key(proof["action"])))
        changed = _action_key(chosen["action"]) != _action_key(reference)
        result.update(status="complete", applied=True, changed=changed, candidates=proofs,
                      selected=chosen["action"], proposed=chosen["action"],
                      reason="public_runout_proven" if changed else "public_runout_reference",
                      certificate={"runout": chosen["runout"], "maximum_unseen_single": threshold,
                                   "opposing_first": finish[0], "team_value": -100.0})
        return result
    except IncompleteEndgame as error:
        result["reason"] = str(error)
        return result
    finally:
        result["elapsed_ms"] = (time.perf_counter() - started) * 1000.0


def compare_actions(rules, state: Dict, observer: str, reference: Dict,
                    deadline: Optional[float] = None) -> Dict:
    """Compare every physical root route on paired public sampled deals.

    Selection and confirmation use disjoint seeded sample streams. Terminal
    utility is never combined with heuristic scores. An incomplete panel or
    unconfirmed change keeps the reference within this completed comparison.
    Only interrupted panels fall back to the ordinary depth-limited search.
    """
    from game import guandan_trick as sampling

    config = state.get("config", {})
    result = {"status": "disabled", "applied": False, "changed": False, "reference": copy.deepcopy(reference),
              "candidates": [], "value_model": "terminal_round_v1", "solver": "exact_sampled_v1"}
    if not config.get("bot_exact_endgame_enabled", False) or not reference:
        return result
    determined = _public_hands_determined(state, observer)
    if config.get("bot_exact_endgame_public_only", False) and not determined:
        runout = _public_uncontested_runout(rules, state, observer, reference, deadline)
        if runout is not None:
            return runout
        result.update(status="skipped", reason="unresolved_hidden_ownership")
        return result
    counts = [len(data["hand"]) for data in state["players"].values()]
    limit = min(24, max(4, int(config.get("bot_exact_endgame_max_cards", 20))))
    if sum(counts) > limit:
        result.update(status="skipped", reason="outside_exact_scope")
        return result
    if _finish_is_maximal(rules, state, observer, reference):
        result.update(status="skipped", reason="maximal_team_finish")
        return result
    from game import guandan_ai as ai

    bounds = ai.call(rules, "_possible_round_value_bounds", state, observer)
    if bounds is not None and bounds[0] == bounds[1]:
        result.update(status="skipped", reason="settled_team_value")
        return result
    started = time.perf_counter()
    stop = started + max(0.0, float(config.get("bot_exact_endgame_time_ms", 2500))) / 1000.0
    budget = sampling.TrickBudget(min(stop, deadline) if deadline is not None else stop)
    count = max(4, min(32, int(config.get("bot_exact_endgame_worlds", 8))))
    if determined:
        count = 1
    node_limit = max(1, min(2000000, int(config.get("bot_exact_endgame_node_limit", 500000))))
    result.update(status="incomplete", requested_worlds=count, completed_worlds=0, nodes=0,
                  cache_hits=0, reused_worlds=0, distinct_worlds=0,
                  scope="public_sampled_endgame", verification={"status": "not_needed"})
    proposals = max(2, min(128, int(config.get("bot_exact_endgame_proposals", 64))))
    if determined:
        proposals = 1
    retained_odds = max(1.0, min(32.0, float(config.get("bot_exact_endgame_retained_group_odds", 16.0))))
    sampled_state = {**state, "config": {
        **config, "bot_determinize_samples": proposals, "bot_determinize_short_budget_samples": proposals,
        "bot_determinize_retained_group_odds": retained_odds,
    }}
    result["sampling"] = {"model": "retained_tail_v1", "proposals": proposals,
                          "retained_group_odds": retained_odds}
    solved_worlds = {}

    def evaluate(worlds: List[Dict], actions: Optional[List[Dict]] = None) -> Tuple[List[Dict], List[List[float]]]:
        values = None
        for world in worlds:
            budget.check()
            world_key = _world_key(world)
            cached = solved_worlds.get(world_key)
            if cached is not None and actions is not None:
                row = [cached[_action_key(action)] for action in actions]
                result["reused_worlds"] += 1
            else:
                solver = EndgameSolver(rules, world, observer, budget.deadline, node_limit)
                if actions is None:
                    actions = [copy.deepcopy(reference)]
                    seen = {_action_key(reference)}
                    for action in solver.root_actions():
                        key = _action_key(action)
                        if key not in seen:
                            seen.add(key)
                            actions.append(action)
                try:
                    row = solver.root_values(actions)
                    budget.check()
                finally:
                    result["nodes"] += solver.nodes
                    result["cache_hits"] += solver.hits
                solved_worlds[world_key] = {_action_key(action): value for action, value in zip(actions, row)}
                result["distinct_worlds"] = len(solved_worlds)
            if values is None:
                values = [[] for action in actions]
            budget.check()
            for column, value in zip(values, row):
                column.append(value)
            result["completed_worlds"] += 1
        return actions, values

    try:
        worlds = sampling.public_worlds(sampled_state, observer, count, budget, phase="exact_selection")
        actions, values = evaluate(worlds)
        if len(actions) < 2:
            result.update(status="skipped", reason="only_legal_route")
            return result
        records = [{"action": action, "world_values": column, "value": sum(column) / len(column)}
                   for action, column in zip(actions, values)]
        result["candidates"] = records
        best_index = max(range(len(records)), key=lambda index: records[index]["value"])
        best = records[best_index]
        if determined:
            gain = best["value"] - records[0]["value"]
            budget.check()
            result.update(status="complete", applied=True, changed=best_index != 0,
                          proposed=best["action"], selected=best["action"],
                          paired_gain=gain, paired_gain_lower=gain, scope="public_determined_endgame",
                          solver="exact_public_v1", reason="publicly_proven_change" if best_index else "publicly_optimal_reference")
            result["sampling"] = {"model": "public_partition", "proposals": 1}
            result["verification"] = {"status": "not_needed", "reason": "public_hands_determined"}
            return result
        gain, lower = _paired_gain(values[0], values[best_index])
        result.update(proposed=best["action"], paired_gain=gain, paired_gain_lower=lower)
        if best_index == 0 or lower <= 0.0:
            budget.check()
            result.update(status="complete", applied=True, selected=reference, reason="no_supported_change")
            return result
        result["verification"] = {"status": "incomplete"}
        worlds = sampling.public_worlds(sampled_state, observer, count, budget, phase="exact_confirmation")
        verified_actions, verified_values = evaluate(worlds, [actions[0], best["action"]])
        gain, lower = _paired_gain(verified_values[0], verified_values[1])
        passed = lower > 0.0
        result["verification"] = {
            "status": "complete", "passed": passed, "paired_gain": gain, "paired_gain_lower": lower,
            "candidates": [{"action": action, "world_values": column, "value": sum(column) / len(column)}
                           for action, column in zip(verified_actions, verified_values)],
        }
        budget.check()
        result.update(status="complete", applied=True, changed=passed,
                      selected=best["action"] if passed else reference,
                      reason="confirmed_change" if passed else "unconfirmed_change")
    except (IncompleteEndgame, sampling.IncompleteTrick) as error:
        result.update(status="incomplete", applied=False, reason=str(error))
    finally:
        result["elapsed_ms"] = (time.perf_counter() - started) * 1000.0
    return result


def confirm_mcts_action(rules, state: Dict, observer: str, reference: Dict,
                        proposal: Dict, deadline: Optional[float]) -> Dict:
    """Experiment: compare a completed MCTS choice with the heuristic action.

    The MCTS result is the incumbent. Never replace it using a partially
    sampled/solved panel, a mixture of terminal and heuristic utilities, a tie,
    or only one distinct sampled deal. This is not a public-information proof.
    """
    from game import guandan_trick as sampling

    config = state.get("config", {})
    result = {
        "status": "disabled", "applied": False, "changed": False,
        "reference": copy.deepcopy(reference), "proposal": copy.deepcopy(proposal),
        "selected": copy.deepcopy(reference), "candidates": [],
        "scope": "public_sampled_endgame", "solver": "exact_sampled_v1",
        "value_model": "terminal_round_v1", "completed_worlds": 0,
        "distinct_worlds": 0, "reused_worlds": 0, "nodes": 0,
        "timing_ms": {"sampling": 0.0, "construction": 0.0, "search": 0.0},
    }
    if not config.get("bot_post_mcts_exact_enabled", False):
        return result
    if not reference or not proposal or _action_key(reference) == _action_key(proposal):
        result.update(status="skipped", reason="same_or_missing_action")
        return result
    status = state.get("_ai_eval_cache", {}).get("mcts_anytime", {})
    if (not status.get("completed_depth") or status.get("fallback_to_reference")
            or status.get("completed_rounds", 0) < 3):
        result.update(status="skipped", reason="no_completed_mcts_comparison")
        return result
    total = sum(len(player["hand"]) for player in state["players"].values())
    maximum = min(28, int(config.get("bot_post_mcts_exact_max_cards", 28)))
    if state.get("phase") != "playing" or not 24 < total <= maximum:
        result.update(status="skipped", reason="outside_near_endgame_scope")
        return result
    count = int(config.get("bot_post_mcts_exact_worlds", 12))
    if not 4 <= count <= 32:
        result.update(status="skipped", reason="invalid_fixed_panel_size")
        return result
    started = time.perf_counter()
    remaining = deadline - started if deadline is not None else 0.0
    minimum = max(0.05, float(config.get("bot_post_mcts_exact_min_remaining_ms", 350)) / 1000.0)
    configured = max(0.0, float(config.get("bot_post_mcts_exact_time_ms", 1200)) / 1000.0)
    if remaining < minimum or configured <= 0.0:
        result.update(status="skipped", reason="insufficient_remaining_budget")
        return result
    stop = started + min(configured, remaining * 0.45)
    budget = sampling.TrickBudget(stop)
    node_limit = max(1, int(config.get("bot_exact_endgame_node_limit", 500000)))
    result.update(status="incomplete", requested_worlds=count,
                  budget_ms=(stop - started) * 1000.0,
                  sampling={"phase": "post_mcts_terminal_verification_v1",
                            "history": "full", "proposals": config.get("bot_determinize_samples", 5)})
    rows = []
    solved = {}
    stage = "sampling"
    stage_started = started

    def switch_stage(name):
        nonlocal stage, stage_started
        now = time.perf_counter()
        result["timing_ms"][stage] += (now - stage_started) * 1000.0
        stage, stage_started = name, now

    try:
        worlds = sampling.public_worlds(
            state, observer, count, budget,
            phase="post_mcts_terminal_verification_v1", full_history=True,
        )
        budget.check()
        if len(worlds) != count:
            raise sampling.IncompleteTrick("incomplete_fixed_world_panel")
        actions = [copy.deepcopy(reference), copy.deepcopy(proposal)]
        for world in worlds:
            budget.check()
            key = _world_key(world)
            if key in solved:
                row = solved[key]
                result["reused_worlds"] += 1
            else:
                switch_stage("construction")
                solver = EndgameSolver(rules, world, observer, stop,
                                       node_limit - result["nodes"])
                budget.check()
                switch_stage("search")
                try:
                    row = solver.root_values(actions)
                finally:
                    result["nodes"] += solver.nodes
                budget.check()
                if len(row) != 2 or not all(math.isfinite(value) for value in row):
                    raise ValueError("invalid_terminal_row")
                solved[key] = row
                result["distinct_worlds"] += 1
            rows.append(row)
            result["completed_worlds"] += 1
        budget.check()
        before = [row[0] for row in rows]
        after = [row[1] for row in rows]
        gain, lower_gain = _paired_gain(before, after)
        accepted = result["distinct_worlds"] >= 2 and lower_gain > 1e-9
        records = [
            {"action": action, "world_values": values, "value": sum(values) / count}
            for action, values in zip(actions, (before, after))
        ]
        budget.check()
        result.update(
            status="complete", candidates=records, paired_gain=gain,
            paired_gain_lower=lower_gain, confidence_z=1.64,
            evidence_model="approximate_paired_lower_bound_v1", applied=accepted,
            changed=accepted, selected=copy.deepcopy(proposal if accepted else reference),
            reason=("paired_terminal_gain" if accepted else
                    "insufficient_distinct_worlds" if result["distinct_worlds"] < 2 else
                    "equal_terminal_values" if before == after else "insufficient_paired_gain"),
        )
    except (IncompleteEndgame, sampling.IncompleteTrick, ValueError) as error:
        # Nothing from an incomplete panel may participate in action ranking.
        result.update(reason=str(error), candidates=[], applied=False, changed=False,
                      selected=copy.deepcopy(reference))
    finally:
        switch_stage(stage)
        result["elapsed_ms"] = (time.perf_counter() - started) * 1000.0
    return result

