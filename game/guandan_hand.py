"""Bounded, resource-conserving hand partitions, not a game-tree search."""

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable, Dict, List, Optional, Tuple


WILD = 13
SMALL_JOKER = 14
BIG_JOKER = 15
Resources = Tuple[int, ...]
Cover = Tuple[Resources, ...]
_COMPLETE_COVERS: Dict[Resources, Cover] = {}
_CACHE_LIMIT = 4096


@dataclass(frozen=True)
class HandPartition:
    groups: Cover
    lower_bound: int
    complete: bool
    nodes: int = 0

    @property
    def turns(self) -> int:
        return len(self.groups)


def hand_resources(hand: List[Dict], level_rank: int) -> Resources:
    counts = [0] * 16
    for card in hand:
        joker = card.get("joker")
        if joker in ("small", "big"):
            index = BIG_JOKER if joker == "big" else SMALL_JOKER
        elif card.get("suit") == "hearts" and card.get("rank") == level_rank:
            index = WILD
        else:
            index = card["rank"] - 2
        counts[index] += 1
    return tuple(counts)


@lru_cache(maxsize=1024)
def resource_groups(counts: Resources) -> Cover:
    """All legal group consumptions; flushes and straights both cost one play."""
    groups = set()

    def expand(requirements: Tuple[Tuple[int, int], ...], fixed: Tuple = ()) -> None:
        resources = [0] * 16
        for index, quantity in fixed:
            if counts[index] < quantity:
                return
            resources[index] = quantity

        def fill(position: int, wilds: int) -> None:
            if position == len(requirements):
                resources[WILD] = wilds
                groups.add(tuple(resources))
                return
            index, quantity = requirements[position]
            for substitute in range(max(0, quantity - counts[index]),
                                    min(quantity, counts[WILD] - wilds) + 1):
                resources[index] = quantity - substitute
                fill(position + 1, wilds + substitute)
            resources[index] = 0

        fill(0, 0)

    for index, quantity in enumerate(counts):
        if quantity:
            single = [0] * 16
            single[index] = 1
            groups.add(tuple(single))
    for rank in range(13):
        for size in range(2, counts[rank] + counts[WILD] + 1):
            expand(((rank, size),))
        if counts[rank] + counts[WILD] < 3:
            continue
        for pair in range(13):
            if pair != rank and counts[pair] + counts[WILD] >= 2:
                expand(((rank, 3), (pair, 2)))
        expand(((rank, 3),), ((SMALL_JOKER, 2),))
        expand(((rank, 3),), ((BIG_JOKER, 2),))
    for length, quantity in ((5, 1), (3, 2), (2, 3)):
        sequences = [(12,) + tuple(range(length - 1))]
        sequences.extend(tuple(range(start, start + length)) for start in range(14 - length))
        for sequence in sequences:
            expand(tuple((rank, quantity) for rank in sequence))
    expand((), ((SMALL_JOKER, 2),))
    expand((), ((BIG_JOKER, 2),))
    expand((), ((SMALL_JOKER, 2), (BIG_JOKER, 2)))
    return tuple(sorted(groups, key=lambda group: (-sum(group), group)))


class _PartitionInterrupted(Exception):
    pass


def partition_hand(
    hand: List[Dict], level_rank: int, *, node_limit: int = 512,
    expired: Optional[Callable[[], bool]] = None,
) -> HandPartition:
    """Return a feasible cover and a proved lower bound within bounded work."""
    counts = hand_resources(hand, level_rank)
    cached = _COMPLETE_COVERS.get(counts)
    if cached is not None:
        return HandPartition(cached, len(cached), True)
    if not hand:
        return HandPartition((), 0, True)
    if expired is not None and expired():
        singles = tuple(tuple(int(index == category) for index in range(16))
                        for category, quantity in enumerate(counts) for _ in range(quantity))
        return HandPartition(singles, 1, False)

    groups = resource_groups(counts)
    group_set = set(groups)
    indexed = tuple(tuple((index, quantity) for index, quantity in enumerate(group) if quantity)
                    for group in groups)
    sizes = tuple(sum(group) for group in groups)
    by_category = tuple(tuple(position for position, group in enumerate(groups) if group[index])
                        for index in range(16))

    def valid(position: int, remaining: Resources) -> bool:
        return all(remaining[index] >= quantity for index, quantity in indexed[position])

    def remove(position: int, remaining: Resources) -> Resources:
        updated = list(remaining)
        for index, quantity in indexed[position]:
            updated[index] -= quantity
        return tuple(updated)

    remaining = counts
    greedy = []
    for position, group in enumerate(groups):
        while valid(position, remaining):
            greedy.append(group)
            remaining = remove(position, remaining)
    best = tuple(greedy)
    lower_bound = math.ceil(len(hand) / sizes[0])
    nodes = 0

    @lru_cache(maxsize=None)
    def search(remaining: Resources, moves_left: int) -> Optional[Cover]:
        nonlocal nodes
        nodes += 1
        if nodes > node_limit or (nodes % 16 == 0 and expired is not None and expired()):
            raise _PartitionInterrupted
        total = sum(remaining)
        if not total:
            return ()
        if moves_left <= 0 or total > moves_left * sizes[0]:
            return None
        if remaining in group_set:
            return (remaining,)
        if moves_left == 1:
            return None
        viable = None
        for index, quantity in enumerate(remaining):
            if not quantity:
                continue
            options = [position for position in by_category[index] if valid(position, remaining)]
            if viable is None or len(options) < len(viable):
                viable = options
            if len(viable) == 1:
                break
        for position in viable or ():
            child = search(remove(position, remaining), moves_left - 1)
            if child is not None:
                return (groups[position],) + child
        return None

    complete = False
    try:
        for target in range(lower_bound, len(best)):
            if expired is not None and expired():
                raise _PartitionInterrupted
            solution = search(counts, target)
            if solution is not None:
                best = solution
                complete = True
                break
            lower_bound = target + 1
        else:
            complete = True
    except _PartitionInterrupted:
        pass
    if complete:
        if len(_COMPLETE_COVERS) >= _CACHE_LIMIT:
            _COMPLETE_COVERS.clear()
        _COMPLETE_COVERS[counts] = best
    return HandPartition(best, lower_bound, complete, nodes)
