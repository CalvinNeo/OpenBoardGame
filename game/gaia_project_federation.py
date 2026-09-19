"""Exact, node-weighted Steiner validation for player-selected federations.

The search is used on submission only. It shares no state with the game engine.
"""
import heapq
from typing import Dict, List, Set


def connected_components(nodes: Set[str], neighbors: Dict[str, List[str]]) -> List[Set[str]]:
    remaining = set(nodes)
    result = []
    while remaining:
        root = min(remaining)
        component, stack = {root}, [root]
        remaining.remove(root)
        while stack:
            current = stack.pop()
            for neighbor in neighbors[current]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    stack.append(neighbor)
        result.append(component)
    return result


def minimum_satellites(neighbors: Dict[str, List[str]], allowed: Set[str],
                       terminals: List[Set[str]], free: Set[str], bound: int,
                       strengths: List[int], threshold: int) -> int:
    """Return minimum cost for any sufficient subset of the selected clusters.

    Dreyfus–Wagner dynamic programming joins terminal subsets at a common node;
    Dijkstra propagates each result using 0/1 node costs. Values above the
    submitted cost are pruned. No heuristic can reject a legal federation.
    """
    if not terminals:
        return bound + 1
    nodes = sorted(allowed)
    index = {key: i for i, key in enumerate(nodes)}
    costs = [int(key not in free) for key in nodes]
    edges = [[index[n] for n in neighbors[key] if n in index] for key in nodes]
    infinity = bound + 1
    table = {}
    power = {0: 0}
    best = infinity
    # Each terminal is an entire directly-connected building cluster.
    for mask in range(1, 1 << len(terminals)):
        bit = mask & -mask
        which = bit.bit_length() - 1
        power[mask] = power[mask ^ bit] + strengths[which]
        values = [infinity] * len(nodes)
        if mask == bit:
            for node in terminals[which]:
                if node in index:
                    values[index[node]] = 0
        else:
            part = (mask - 1) & mask
            while part:
                other = mask ^ part
                if part < other and part in table and other in table:
                    left, right = table[part], table[other]
                    for i in range(len(nodes)):
                        values[i] = min(values[i], left[i] + right[i] - costs[i])
                part = (part - 1) & mask
        queue = [(cost, i) for i, cost in enumerate(values) if cost <= bound]
        heapq.heapify(queue)
        while queue:
            cost, i = heapq.heappop(queue)
            if cost != values[i]:
                continue
            for j in edges[i]:
                candidate = cost + costs[j]
                if candidate < values[j] and candidate <= bound:
                    values[j] = candidate
                    heapq.heappush(queue, (candidate, j))
        table[mask] = values
        if power[mask] >= threshold:
            best = min(best, min(values))
            if best <= bound:
                return best
    return best
