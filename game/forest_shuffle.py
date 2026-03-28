import random
from typing import Dict, List, Optional, Set, Tuple


TREE_SPECIES = [
    "beech",
    "birch",
    "douglas_fir",
    "horse_chestnut",
    "linden_tree",
    "oak",
    "silver_fir",
    "sycamore",
]

TREE_SYMBOL_ORDER = [
    "birch",
    "beech",
    "linden_tree",
    "oak",
    "sycamore",
    "horse_chestnut",
    "douglas_fir",
    "silver_fir",
]

TREE_LABELS = {
    "beech": "Beech",
    "birch": "Birch",
    "douglas_fir": "Douglas Fir",
    "horse_chestnut": "Horse Chestnut",
    "linden_tree": "Linden Tree",
    "oak": "Oak",
    "silver_fir": "Silver Fir",
    "sycamore": "Sycamore",
}

SIDE_ORDER = ["top", "right", "bottom", "left"]
SIDE_OPPOSITE = {"top": "bottom", "bottom": "top", "left": "right", "right": "left"}
BAT_SPECIES = {
    "barbastelle_bat",
    "bechsteins_bat",
    "brown_long_eared_bat",
    "greater_horseshoe_bat",
}
BUTTERFLY_SPECIES = {
    "camberwell_beauty",
    "large_tortoiseshell",
    "peacock_butterfly",
    "purple_emperor",
    "silver_washed_fritillary",
}
MUSHROOM_SPECIES = {"chanterelle", "fly_agaric", "parasol_mushroom", "penny_bun"}
PAWED_SPECIES = {
    "beech_marten",
    "brown_bear",
    "european_badger",
    "european_fat_dormouse",
    "lynx",
    "raccoon",
    "red_fox",
    "squeaker",
    "wolf",
}
DEER_SPECIES = {"fallow_deer", "red_deer", "roe_deer"}
CLOVEN_SPECIES = {"fallow_deer", "red_deer", "roe_deer", "wild_boar"}
PLANT_SPECIES = {"blackberries", "moss", "tree_ferns", "wild_strawberries"}
AMPHIBIAN_SPECIES = {"common_toad", "fire_salamander", "tree_frog"}
INSECT_SPECIES = {"fireflies", "gnat", "stag_beetle", "violet_carpenter_bee"}
BIRD_SPECIES = {
    "bullfinch",
    "chaffinch",
    "eurasian_jay",
    "goshawk",
    "great_spotted_woodpecker",
    "tawny_owl",
}
TREE_COUNT_REMOVAL = {2: 30, 3: 20, 4: 10, 5: 0}
BASE_GAME_TREE_SPECIES_SET = set(TREE_SPECIES)
IMPLEMENTATION_NOTES = [
    "Split cards use synthetic pairings built from the official base-game species counts.",
    "Mole is included as a 0-point card, but its extra multi-play effect is not fully implemented yet.",
]

SPECIES_DEFS = {
    "beech": {
        "name": "Beech",
        "placement": "tree",
        "copies": 10,
        "cost": 1,
        "tags": {"tree"},
        "tree_species": "beech",
    },
    "birch": {
        "name": "Birch",
        "placement": "tree",
        "copies": 10,
        "cost": 0,
        "tags": {"tree"},
        "tree_species": "birch",
    },
    "douglas_fir": {
        "name": "Douglas Fir",
        "placement": "tree",
        "copies": 7,
        "cost": 2,
        "tags": {"tree"},
        "tree_species": "douglas_fir",
    },
    "horse_chestnut": {
        "name": "Horse Chestnut",
        "placement": "tree",
        "copies": 11,
        "cost": 1,
        "tags": {"tree"},
        "tree_species": "horse_chestnut",
    },
    "linden_tree": {
        "name": "Linden Tree",
        "placement": "tree",
        "copies": 9,
        "cost": 1,
        "tags": {"tree"},
        "tree_species": "linden_tree",
    },
    "oak": {
        "name": "Oak",
        "placement": "tree",
        "copies": 7,
        "cost": 2,
        "tags": {"tree"},
        "tree_species": "oak",
    },
    "silver_fir": {
        "name": "Silver Fir",
        "placement": "tree",
        "copies": 6,
        "cost": 2,
        "tags": {"tree"},
        "tree_species": "silver_fir",
    },
    "sycamore": {
        "name": "Sycamore",
        "placement": "tree",
        "copies": 6,
        "cost": 2,
        "tags": {"tree"},
        "tree_species": "sycamore",
    },
    "camberwell_beauty": {"name": "Camberwell Beauty", "placement": "top", "copies": 4, "cost": 0, "tags": {"butterfly"}},
    "large_tortoiseshell": {"name": "Large Tortoiseshell", "placement": "top", "copies": 4, "cost": 0, "tags": {"butterfly"}},
    "peacock_butterfly": {"name": "Peacock Butterfly", "placement": "top", "copies": 4, "cost": 0, "tags": {"butterfly"}},
    "purple_emperor": {"name": "Purple Emperor", "placement": "top", "copies": 4, "cost": 0, "tags": {"butterfly"}},
    "silver_washed_fritillary": {
        "name": "Silver-Washed Fritillary",
        "placement": "top",
        "copies": 4,
        "cost": 0,
        "tags": {"butterfly"},
    },
    "bullfinch": {"name": "Bullfinch", "placement": "top", "copies": 4, "cost": 1, "tags": {"bird"}},
    "chaffinch": {"name": "Chaffinch", "placement": "top", "copies": 4, "cost": 1, "tags": {"bird"}},
    "eurasian_jay": {"name": "Eurasian Jay", "placement": "top", "copies": 4, "cost": 1, "tags": {"bird"}},
    "goshawk": {"name": "Goshawk", "placement": "top", "copies": 4, "cost": 2, "tags": {"bird"}},
    "great_spotted_woodpecker": {
        "name": "Great Spotted Woodpecker",
        "placement": "top",
        "copies": 4,
        "cost": 1,
        "tags": {"bird"},
    },
    "red_squirrel": {"name": "Red Squirrel", "placement": "top", "copies": 4, "cost": 0, "tags": {"pawed"}},
    "tawny_owl": {"name": "Tawny Owl", "placement": "top", "copies": 4, "cost": 2, "tags": {"bird"}},
    "chanterelle": {"name": "Chanterelle", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"mushroom"}},
    "fly_agaric": {"name": "Fly Agaric", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"mushroom"}},
    "parasol_mushroom": {"name": "Parasol Mushroom", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"mushroom"}},
    "penny_bun": {"name": "Penny Bun", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"mushroom"}},
    "common_toad": {"name": "Common Toad", "placement": "bottom", "copies": 6, "cost": 0, "tags": {"amphibian"}},
    "blackberries": {"name": "Blackberries", "placement": "bottom", "copies": 3, "cost": 0, "tags": {"plant"}},
    "fireflies": {"name": "Fireflies", "placement": "bottom", "copies": 4, "cost": 0, "tags": {"insect"}},
    "fire_salamander": {
        "name": "Fire Salamander",
        "placement": "bottom",
        "copies": 3,
        "cost": 1,
        "tags": {"amphibian"},
    },
    "hedgehog": {"name": "Hedgehog", "placement": "bottom", "copies": 3, "cost": 1, "tags": {"pawed"}},
    "mole": {"name": "Mole", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"pawed"}},
    "moss": {"name": "Moss", "placement": "bottom", "copies": 3, "cost": 0, "tags": {"plant"}},
    "pond_turtle": {"name": "Pond Turtle", "placement": "bottom", "copies": 2, "cost": 2, "tags": set()},
    "stag_beetle": {"name": "Stag Beetle", "placement": "bottom", "copies": 2, "cost": 2, "tags": {"insect"}},
    "tree_ferns": {"name": "Tree Ferns", "placement": "bottom", "copies": 3, "cost": 1, "tags": {"plant"}},
    "tree_frog": {"name": "Tree Frog", "placement": "bottom", "copies": 3, "cost": 0, "tags": {"amphibian"}},
    "wild_strawberries": {"name": "Wild Strawberries", "placement": "bottom", "copies": 3, "cost": 0, "tags": {"plant"}},
    "wood_ant": {"name": "Wood Ant", "placement": "bottom", "copies": 3, "cost": 1, "tags": {"insect"}},
    "barbastelle_bat": {"name": "Barbastelle Bat", "placement": "left_right", "copies": 3, "cost": 1, "tags": {"bat"}},
    "bechsteins_bat": {"name": "Bechstein's Bat", "placement": "left_right", "copies": 3, "cost": 1, "tags": {"bat"}},
    "brown_long_eared_bat": {
        "name": "Brown Long-Eared Bat",
        "placement": "left_right",
        "copies": 3,
        "cost": 1,
        "tags": {"bat"},
    },
    "greater_horseshoe_bat": {
        "name": "Greater Horseshoe Bat",
        "placement": "left_right",
        "copies": 3,
        "cost": 1,
        "tags": {"bat"},
    },
    "european_hare": {"name": "European Hare", "placement": "left_right", "copies": 11, "cost": 0, "tags": {"hare"}},
    "beech_marten": {"name": "Beech Marten", "placement": "left_right", "copies": 5, "cost": 1, "tags": {"pawed"}},
    "brown_bear": {"name": "Brown Bear", "placement": "left_right", "copies": 3, "cost": 3, "tags": {"pawed"}},
    "european_badger": {"name": "European Badger", "placement": "left_right", "copies": 4, "cost": 1, "tags": {"pawed"}},
    "european_fat_dormouse": {
        "name": "European Fat Dormouse",
        "placement": "left_right",
        "copies": 4,
        "cost": 1,
        "tags": {"pawed"},
    },
    "fallow_deer": {
        "name": "Fallow Deer",
        "placement": "left_right",
        "copies": 4,
        "cost": 2,
        "tags": {"deer", "cloven"},
    },
    "gnat": {"name": "Gnat", "placement": "left_right", "copies": 3, "cost": 0, "tags": {"insect"}},
    "lynx": {"name": "Lynx", "placement": "left_right", "copies": 6, "cost": 1, "tags": {"pawed"}},
    "raccoon": {"name": "Raccoon", "placement": "left_right", "copies": 4, "cost": 1, "tags": {"pawed"}},
    "red_deer": {"name": "Red Deer", "placement": "left_right", "copies": 5, "cost": 2, "tags": {"deer", "cloven"}},
    "red_fox": {"name": "Red Fox", "placement": "left_right", "copies": 5, "cost": 2, "tags": {"pawed"}},
    "roe_deer": {"name": "Roe Deer", "placement": "left_right", "copies": 5, "cost": 2, "tags": {"deer", "cloven"}},
    "squeaker": {"name": "Squeaker", "placement": "left_right", "copies": 4, "cost": 0, "tags": {"pawed"}},
    "violet_carpenter_bee": {
        "name": "Violet Carpenter Bee",
        "placement": "left_right",
        "copies": 4,
        "cost": 1,
        "tags": {"insect"},
    },
    "wild_boar": {"name": "Wild Boar", "placement": "left_right", "copies": 5, "cost": 2, "tags": {"cloven"}},
    "wolf": {"name": "Wolf", "placement": "left_right", "copies": 4, "cost": 3, "tags": {"pawed"}},
}

SPECIES_ORDER = list(SPECIES_DEFS.keys())
BUTTERFLY_NAMES = {SPECIES_DEFS[species]["name"] for species in BUTTERFLY_SPECIES}


def _next_id(state: Dict, key: str) -> str:
    value = state["id_counters"].get(key, 0) + 1
    state["id_counters"][key] = value
    return f"{key}_{value}"


def _tag_set(species: str) -> Set[str]:
    tags = set(SPECIES_DEFS[species]["tags"])
    if species in BAT_SPECIES:
        tags.add("bat")
    if species in BUTTERFLY_SPECIES:
        tags.add("butterfly")
    if species in MUSHROOM_SPECIES:
        tags.add("mushroom")
    if species in PAWED_SPECIES:
        tags.add("pawed")
    if species in DEER_SPECIES:
        tags.add("deer")
    if species in CLOVEN_SPECIES:
        tags.add("cloven")
    if species in PLANT_SPECIES:
        tags.add("plant")
    if species in AMPHIBIAN_SPECIES:
        tags.add("amphibian")
    if species in INSECT_SPECIES:
        tags.add("insect")
    if species in BIRD_SPECIES:
        tags.add("bird")
    if species == "european_hare":
        tags.add("hare")
    return tags


def _species_label(species: str) -> str:
    return SPECIES_DEFS[species]["name"]


def _symbol_for_copy(species: str, copy_index: int) -> str:
    if species in TREE_LABELS:
        return species
    base_index = SPECIES_ORDER.index(species) % len(TREE_SYMBOL_ORDER)
    return TREE_SYMBOL_ORDER[(base_index + copy_index) % len(TREE_SYMBOL_ORDER)]


def _make_half(species: str, copy_index: int) -> Dict:
    definition = SPECIES_DEFS[species]
    return {
        "species": species,
        "name": definition["name"],
        "placement": definition["placement"],
        "cost": int(definition["cost"]),
        "tags": sorted(_tag_set(species)),
        "symbol": _symbol_for_copy(species, copy_index),
    }


def _make_tree_card(species: str, copy_index: int) -> Dict:
    definition = SPECIES_DEFS[species]
    return {
        "id": f"card_tree_{species}_{copy_index + 1}",
        "kind": "tree",
        "name": definition["name"],
        "species": species,
        "cost": int(definition["cost"]),
        "tags": ["tree"],
        "tree_species": definition["tree_species"],
        "payment_symbols": [definition["tree_species"]],
    }


def _expand_split_pools() -> Tuple[List[Dict], List[Dict], List[Dict]]:
    top_pool: List[Dict] = []
    bottom_pool: List[Dict] = []
    lr_pool: List[Dict] = []
    for species, definition in SPECIES_DEFS.items():
        placement = definition["placement"]
        if placement == "tree":
            continue
        for copy_index in range(int(definition["copies"])):
            half = _make_half(species, copy_index)
            if placement == "top":
                top_pool.append(half)
            elif placement == "bottom":
                bottom_pool.append(half)
            else:
                lr_pool.append(half)
    return top_pool, bottom_pool, lr_pool


def _make_split_card(card_id: str, orientation: str, first_half: Dict, second_half: Dict) -> Dict:
    halves: List[Dict] = []
    if orientation == "top_bottom":
        halves.append({**first_half, "slot": "top"})
        halves.append({**second_half, "slot": "bottom"})
    else:
        halves.append({**first_half, "slot": "left"})
        halves.append({**second_half, "slot": "right"})
    return {
        "id": card_id,
        "kind": "split",
        "orientation": orientation,
        "name": f"{halves[0]['name']} / {halves[1]['name']}",
        "halves": halves,
        "payment_symbols": sorted({half["symbol"] for half in halves}),
    }


def _build_base_deck(rng: random.Random) -> List[Dict]:
    deck: List[Dict] = []
    for species in TREE_SPECIES:
        copies = int(SPECIES_DEFS[species]["copies"])
        for copy_index in range(copies):
            deck.append(_make_tree_card(species, copy_index))

    top_pool, bottom_pool, lr_pool = _expand_split_pools()
    rng.shuffle(top_pool)
    rng.shuffle(bottom_pool)
    rng.shuffle(lr_pool)

    for index, (top_half, bottom_half) in enumerate(zip(top_pool, bottom_pool), start=1):
        deck.append(_make_split_card(f"card_tb_{index}", "top_bottom", top_half, bottom_half))

    for index in range(0, len(lr_pool), 2):
        left_half = lr_pool[index]
        right_half = lr_pool[index + 1]
        deck.append(_make_split_card(f"card_lr_{index // 2 + 1}", "left_right", left_half, right_half))

    rng.shuffle(deck)
    return deck


def _insert_winters(base_deck: List[Dict], player_count: int, rng: random.Random) -> List[Dict]:
    remove_count = TREE_COUNT_REMOVAL.get(player_count, 0)
    working = list(base_deck)
    rng.shuffle(working)
    if remove_count > 0:
        working = working[remove_count:]
    pile_size = len(working) // 3
    extra = len(working) % 3
    sizes = [pile_size, pile_size, pile_size]
    for index in range(extra):
        sizes[index] += 1
    piles: List[List[Dict]] = []
    cursor = 0
    for size in sizes:
        piles.append(working[cursor : cursor + size])
        cursor += size
    winter_cards = [
        {"id": "winter_1", "kind": "winter", "name": "Winter is coming"},
        {"id": "winter_2", "kind": "winter", "name": "Winter is coming"},
        {"id": "winter_3", "kind": "winter", "name": "Winter is coming"},
    ]
    bottom_pile = list(piles[2])
    hidden_winters = [winter_cards[0], winter_cards[1]]
    bottom_pile.extend(hidden_winters)
    rng.shuffle(bottom_pile)
    bottom_pile = [winter_cards[2]] + bottom_pile
    return list(piles[0]) + list(piles[1]) + bottom_pile


def _find_player_order(players: List[Dict]) -> List[str]:
    ordered = sorted(players, key=lambda item: item.get("seat", 0))
    return [player["player_id"] for player in ordered]


def _player_name_lookup(players: List[Dict]) -> Dict[str, str]:
    return {player["player_id"]: player.get("name") or player["player_id"] for player in players}


def _draw_from_deck(state: Dict, player_id: Optional[str], target: str, events: List[Dict], reason: str) -> Optional[Dict]:
    while state["deck"]:
        card = state["deck"].pop(0)
        if card["kind"] == "winter":
            state["winter_count"] += 1
            state["revealed_winters"].append(card["id"])
            events.append({"type": "forest_shuffle:winter", "payload": {"count": state["winter_count"], "reason": reason}})
            if state["winter_count"] >= 3:
                _finalize_game(state, events, "third_winter")
                return None
            continue
        if target == "hand" and player_id:
            hand = state["players"][player_id]["hand"]
            if len(hand) >= 10:
                return None
            hand.append(card)
        elif target == "clearing":
            state["clearing"].append(card)
        else:
            return None
        events.append({"type": "forest_shuffle:draw", "payload": {"player_id": player_id, "target": target, "card_id": card["id"], "reason": reason}})
        return card
    return None


def _card_public(card: Dict, include_hidden_halves: bool = True) -> Dict:
    if card["kind"] == "tree":
        return {
            "id": card["id"],
            "kind": "tree",
            "name": card["name"],
            "species": card["species"],
            "cost": card["cost"],
            "payment_symbols": list(card["payment_symbols"]),
            "tree_species": card["tree_species"],
        }
    if card["kind"] == "winter":
        return {"id": card["id"], "kind": "winter", "name": card["name"]}
    payload = {
        "id": card["id"],
        "kind": "split",
        "name": card["name"],
        "orientation": card["orientation"],
        "payment_symbols": list(card["payment_symbols"]),
    }
    if include_hidden_halves:
        payload["halves"] = [dict(half) for half in card["halves"]]
    else:
        payload["halves"] = [{"slot": half["slot"], "name": half["name"], "species": half["species"], "cost": half["cost"]} for half in card["halves"]]
    return payload


def _find_hand_index(hand: List[Dict], card_id: str) -> int:
    for index, card in enumerate(hand):
        if card["id"] == card_id:
            return index
    return -1


def _take_hand_card(player_state: Dict, card_id: str) -> Optional[Dict]:
    index = _find_hand_index(player_state["hand"], card_id)
    if index < 0:
        return None
    return player_state["hand"].pop(index)


def _preview_half(card: Dict, half_index: int) -> Optional[Dict]:
    if card["kind"] != "split":
        return None
    halves = card.get("halves") or []
    if half_index < 0 or half_index >= len(halves):
        return None
    return halves[half_index]


def _can_stack_with_existing(side_cards: List[Dict], species: str, side: str) -> bool:
    if not side_cards:
        return True
    if species == "common_toad" and side == "bottom":
        return len(side_cards) < 2 and all(card["species"] == "common_toad" for card in side_cards)
    if species == "european_hare" and side in {"left", "right"}:
        return all(card["species"] == "european_hare" for card in side_cards)
    return False


def _find_tree(player_state: Dict, tree_id: str) -> Optional[Dict]:
    for tree in player_state["forest"]["trees"]:
        if tree["id"] == tree_id:
            return tree
    return None


def _payment_symbols(card: Dict) -> Set[str]:
    return set(card.get("payment_symbols") or [])


def _tree_entry(tree: Dict) -> Dict:
    symbol = tree.get("tree_species")
    return {
        "entry_kind": "tree",
        "id": tree["id"],
        "species": tree["species"],
        "name": tree["name"],
        "tags": {"tree"},
        "card_symbol": symbol,
        "tree_species": tree.get("tree_species"),
        "side": None,
        "parent_tree_id": None,
    }


def _visible_entries(player_state: Dict) -> List[Dict]:
    items: List[Dict] = []
    for tree in player_state["forest"]["trees"]:
        items.append(_tree_entry(tree))
        for side in SIDE_ORDER:
            for card in tree["slots"][side]:
                items.append(
                    {
                        "entry_kind": "placed",
                        "id": card["id"],
                        "species": card["species"],
                        "name": card["name"],
                        "tags": set(card["tags"]),
                        "card_symbol": card.get("symbol"),
                        "tree_species": None,
                        "side": card["side"],
                        "parent_tree_id": tree["id"],
                    }
                )
    return items


def _count_species(player_state: Dict, species: str) -> int:
    return sum(1 for entry in _visible_entries(player_state) if entry["species"] == species)


def _count_tag(player_state: Dict, tag: str) -> int:
    return sum(1 for entry in _visible_entries(player_state) if tag in entry["tags"])


def _butterfly_score(player_state: Dict) -> int:
    remaining = {species: _count_species(player_state, species) for species in BUTTERFLY_SPECIES}
    score_table = {1: 0, 2: 3, 3: 6, 4: 12, 5: 20}
    total = 0
    while any(value > 0 for value in remaining.values()):
        size = 0
        for species in list(remaining.keys()):
            if remaining[species] > 0:
                remaining[species] -= 1
                size += 1
        total += score_table.get(size, 0)
    return total


def _slot_card_count(tree: Dict, side: str) -> int:
    return len(tree["slots"][side])


def _bee_at_species_count(player_state: Dict, tree_species: str) -> int:
    total = 0
    for tree in player_state["forest"]["trees"]:
        if tree.get("tree_species") != tree_species:
            continue
        for side in ("left", "right"):
            total += sum(1 for card in tree["slots"][side] if card["species"] == "violet_carpenter_bee")
    return total


def _bee_total_tree_bonus(player_state: Dict) -> int:
    return _count_species(player_state, "violet_carpenter_bee")


def _plain_tree_count(player_state: Dict) -> int:
    return len(player_state["forest"]["trees"])


def _comparison_tree_count(player_state: Dict) -> int:
    return _plain_tree_count(player_state) + _bee_total_tree_bonus(player_state)


def _tree_species_set(player_state: Dict) -> Set[str]:
    result: Set[str] = set()
    for tree in player_state["forest"]["trees"]:
        if tree["kind"] == "tree" and tree.get("tree_species"):
            result.add(tree["tree_species"])
    return result


def _fully_occupied_tree_count(player_state: Dict) -> int:
    total = 0
    for tree in player_state["forest"]["trees"]:
        if all(len(tree["slots"][side]) > 0 for side in SIDE_ORDER):
            total += 1
    return total


def _total_bottom_cards(player_state: Dict) -> int:
    return sum(len(tree["slots"]["bottom"]) for tree in player_state["forest"]["trees"])


def _species_points(state: Dict, player_id: str, player_state: Dict) -> Tuple[int, List[Dict]]:
    points = 0
    breakdown: List[Dict] = []
    entries = _visible_entries(player_state)
    all_players = list(state["players"].values())
    butterfly_total = _butterfly_score(player_state)
    bat_distinct = len({entry["species"] for entry in entries if entry["species"] in BAT_SPECIES})
    hare_total = _count_species(player_state, "european_hare")
    tree_species_total = len(_tree_species_set(player_state))
    for tree in player_state["forest"]["trees"]:
        if tree["kind"] == "sapling":
            continue
        species = tree["species"]
        value = 0
        if species == "beech":
            total_beeches = _count_species(player_state, "beech") + _bee_at_species_count(player_state, "beech")
            value = 5 if total_beeches >= 4 else 0
        elif species == "birch":
            value = 1
        elif species == "douglas_fir":
            value = 5
        elif species == "horse_chestnut":
            count = _count_species(player_state, "horse_chestnut") + _bee_at_species_count(player_state, "horse_chestnut")
            if count <= 0:
                value = 0
            elif count >= 7:
                value = 49 // max(_count_species(player_state, "horse_chestnut"), 1)
            else:
                table = {1: 1, 2: 4, 3: 9, 4: 16, 5: 25, 6: 36}
                total_value = table.get(count, 0)
                value = total_value // max(_count_species(player_state, "horse_chestnut"), 1)
        elif species == "linden_tree":
            own_count = _count_species(player_state, "linden_tree") + _bee_at_species_count(player_state, "linden_tree")
            max_count = max(
                _count_species(other, "linden_tree") + _bee_at_species_count(other, "linden_tree")
                for other in all_players
            )
            value = 3 if own_count >= max_count and max_count > 0 else 1
        elif species == "oak":
            value = 10 if tree_species_total >= 8 else 0
        elif species == "silver_fir":
            value = 2 * sum(len(tree["slots"][side]) for side in SIDE_ORDER)
        elif species == "sycamore":
            value = _plain_tree_count(player_state)
        points += value
        breakdown.append({"entry_id": tree["id"], "species": species, "name": tree["name"], "points": value})

    fireflies_total = _count_species(player_state, "fireflies")
    fire_salamander_total = _count_species(player_state, "fire_salamander")
    for tree in player_state["forest"]["trees"]:
        for side in SIDE_ORDER:
            for card in tree["slots"][side]:
                species = card["species"]
                value = 0
                if species in BAT_SPECIES:
                    value = 5 if bat_distinct >= 3 else 0
                elif species in BUTTERFLY_SPECIES:
                    count = _count_species(player_state, species)
                    value = butterfly_total // count if count else 0
                elif species == "chanterelle":
                    value = 0
                elif species == "fly_agaric":
                    value = 0
                elif species == "parasol_mushroom":
                    value = 0
                elif species == "penny_bun":
                    value = 0
                elif species == "common_toad":
                    slot_cards = tree["slots"]["bottom"]
                    value = 5 if len(slot_cards) >= 2 else 0
                elif species == "blackberries":
                    value = 2 * _count_tag(player_state, "plant")
                elif species == "fireflies":
                    total_value = {1: 0, 2: 10, 3: 15, 4: 20}.get(fireflies_total, 0)
                    value = total_value // fireflies_total if fireflies_total else 0
                elif species == "fire_salamander":
                    total_value = {1: 5, 2: 15, 3: 25}.get(fire_salamander_total, 0)
                    value = total_value // fire_salamander_total if fire_salamander_total else 0
                elif species == "hedgehog":
                    value = 2 * _count_tag(player_state, "butterfly")
                elif species == "mole":
                    value = 0
                elif species == "moss":
                    value = 10 if _comparison_tree_count(player_state) >= 10 else 0
                elif species == "pond_turtle":
                    value = 5
                elif species == "stag_beetle":
                    value = _count_tag(player_state, "pawed")
                elif species == "tree_ferns":
                    value = 6 * _count_tag(player_state, "amphibian")
                elif species == "tree_frog":
                    value = 5 * _count_species(player_state, "gnat")
                elif species == "wild_strawberries":
                    value = 10 if tree_species_total >= 8 else 0
                elif species == "wood_ant":
                    value = 2 * _total_bottom_cards(player_state)
                elif species == "european_hare":
                    value = hare_total
                elif species == "beech_marten":
                    value = 5 * _fully_occupied_tree_count(player_state)
                elif species == "brown_bear":
                    value = 0
                elif species == "european_badger":
                    value = 2
                elif species == "european_fat_dormouse":
                    opposite = SIDE_OPPOSITE.get(card["side"])
                    opposite_cards = tree["slots"][opposite]
                    value = 15 if any(other["species"] in BAT_SPECIES for other in opposite_cards) else 0
                elif species == "fallow_deer":
                    value = 3 * _count_tag(player_state, "cloven")
                elif species == "gnat":
                    value = _count_tag(player_state, "bat")
                elif species == "lynx":
                    value = 10 if _count_species(player_state, "roe_deer") > 0 else 0
                elif species == "raccoon":
                    value = 0
                elif species == "red_deer":
                    value = _plain_tree_count(player_state) + _count_tag(player_state, "plant")
                elif species == "red_fox":
                    value = 2 * hare_total
                elif species == "roe_deer":
                    symbol = card.get("symbol")
                    value = 3 * sum(1 for entry in entries if entry["card_symbol"] == symbol)
                elif species == "squeaker":
                    value = 1
                elif species == "violet_carpenter_bee":
                    value = 0
                elif species == "wild_boar":
                    value = 10 if _count_species(player_state, "squeaker") > 0 else 0
                elif species == "wolf":
                    value = 5 * _count_tag(player_state, "deer")
                elif species == "bullfinch":
                    value = 2 * _count_tag(player_state, "insect")
                elif species == "chaffinch":
                    value = 5 if tree.get("tree_species") == "beech" else 0
                elif species == "eurasian_jay":
                    value = 3
                elif species == "goshawk":
                    value = 3 * _count_tag(player_state, "bird")
                elif species == "great_spotted_woodpecker":
                    own = _comparison_tree_count(player_state)
                    max_other = max(_comparison_tree_count(other) for other in all_players)
                    value = 10 if own >= max_other and max_other > 0 else 0
                elif species == "red_squirrel":
                    value = 5 if tree.get("tree_species") == "oak" else 0
                elif species == "tawny_owl":
                    value = 5
                points += value
                breakdown.append({"entry_id": card["id"], "species": species, "name": card["name"], "points": value})

    def redistribute(predicate, total_value: int) -> None:
        nonlocal points
        items = [item for item in breakdown if predicate(item)]
        if not items:
            return
        current_total = sum(item["points"] for item in items)
        base = total_value // len(items)
        remainder = total_value % len(items)
        for index, item in enumerate(items):
            item["points"] = base + (1 if index < remainder else 0)
        points += total_value - current_total

    horse_count = _count_species(player_state, "horse_chestnut")
    if horse_count:
        total_count = horse_count + _bee_at_species_count(player_state, "horse_chestnut")
        horse_total = 49 if total_count >= 7 else {1: 1, 2: 4, 3: 9, 4: 16, 5: 25, 6: 36}.get(total_count, 0)
        redistribute(lambda item: item["species"] == "horse_chestnut", horse_total)

    redistribute(lambda item: item["name"] in BUTTERFLY_NAMES, butterfly_total)

    if fireflies_total:
        fireflies_value = {1: 0, 2: 10, 3: 15, 4: 20}.get(fireflies_total, 0)
        redistribute(lambda item: item["species"] == "fireflies", fireflies_value)

    if fire_salamander_total:
        salamander_value = {1: 5, 2: 15, 3: 25}.get(fire_salamander_total, 0)
        redistribute(lambda item: item["species"] == "fire_salamander", salamander_value)

    cave_points = len(player_state["forest"]["cave"])
    points += cave_points
    breakdown.append({"entry_id": "cave", "species": "cave", "name": "Cave", "points": cave_points})
    return points, breakdown


def _score_all_players(state: Dict) -> None:
    for player_id, player_state in state["players"].items():
        total, breakdown = _species_points(state, player_id, player_state)
        player_state["score"] = total
        player_state["score_breakdown"] = breakdown


def _finalize_game(state: Dict, events: List[Dict], reason: str) -> None:
    if state.get("game_over"):
        return
    _score_all_players(state)
    best_score = max((player["score"] for player in state["players"].values()), default=0)
    winner = [player_id for player_id, player in state["players"].items() if player["score"] == best_score]
    state["winner"] = winner
    state["game_over"] = True
    state["current_turn"] = None
    state["pending_action"] = None
    events.append({"type": "forest_shuffle:game_over", "payload": {"reason": reason, "winner": winner}})


def _advance_turn(state: Dict, player_id: str, events: List[Dict]) -> None:
    if state.get("game_over"):
        return
    if state.get("pending_action"):
        state["current_turn"] = player_id
        return
    if state["extra_turns_pending"] > 0:
        state["extra_turns_pending"] -= 1
        state["turn_number"] += 1
        state["current_turn"] = player_id
        events.append({"type": "forest_shuffle:extra_turn", "payload": {"player_id": player_id}})
        return
    order = state["player_order"]
    index = order.index(player_id)
    state["turn_number"] += 1
    state["current_turn"] = order[(index + 1) % len(order)]


def _maybe_clear_clearing(state: Dict, events: List[Dict]) -> None:
    if state.get("game_over"):
        return
    if len(state["clearing"]) < 10:
        return
    removed = list(state["clearing"])
    state["removed_from_game"].extend(card["id"] for card in removed)
    state["clearing"] = []
    events.append({"type": "forest_shuffle:clear_clearing", "payload": {"count": len(removed)}})


def _mushroom_active(card: Dict, state: Dict) -> bool:
    return int(card.get("active_from_turn", 0)) <= int(state["turn_number"])


def _trigger_existing_mushrooms(state: Dict, player_id: str, placed_card: Dict, events: List[Dict]) -> None:
    player_state = state["players"][player_id]
    for tree in player_state["forest"]["trees"]:
        for side in SIDE_ORDER:
            for existing in tree["slots"][side]:
                if not _mushroom_active(existing, state):
                    continue
                species = existing["species"]
                if species == "chanterelle" and placed_card["entry_kind"] == "tree":
                    _draw_from_deck(state, player_id, "hand", events, "chanterelle")
                elif species == "fly_agaric" and "pawed" in placed_card["tags"]:
                    _draw_from_deck(state, player_id, "hand", events, "fly_agaric")
                elif species == "parasol_mushroom" and placed_card.get("side") == "bottom":
                    _draw_from_deck(state, player_id, "hand", events, "parasol_mushroom")
                elif species == "penny_bun" and placed_card.get("side") == "top":
                    _draw_from_deck(state, player_id, "hand", events, "penny_bun")
                if state.get("game_over"):
                    return


def _set_free_play_pending(state: Dict, player_id: str, tags: Set[str], allow_multiple: bool, source_species: str) -> None:
    state["pending_action"] = {
        "type": "free_play",
        "player_id": player_id,
        "tags": sorted(tags),
        "allow_multiple": bool(allow_multiple),
        "source_species": source_species,
    }
    state["current_turn"] = player_id


def _resolve_effect(state: Dict, player_id: str, placed_card: Dict, events: List[Dict]) -> None:
    species = placed_card["species"]
    if species in {"beech", "birch", "great_spotted_woodpecker", "pond_turtle", "tree_ferns", "beech_marten", "tawny_owl"}:
        _draw_from_deck(state, player_id, "hand", events, species)
    elif species == "eurasian_jay":
        state["extra_turns_pending"] += 1
    elif species == "red_fox":
        count = _count_species(state["players"][player_id], "european_hare")
        for _ in range(count):
            _draw_from_deck(state, player_id, "hand", events, "red_fox")
            if state.get("game_over"):
                return
    elif species == "wolf":
        count = _count_tag(state["players"][player_id], "deer")
        for _ in range(count):
            _draw_from_deck(state, player_id, "hand", events, "wolf")
            if state.get("game_over"):
                return
    elif species == "brown_bear":
        cave = state["players"][player_id]["forest"]["cave"]
        cave.extend(state["clearing"])
        moved_count = len(state["clearing"])
        state["clearing"] = []
        events.append({"type": "forest_shuffle:brown_bear", "payload": {"player_id": player_id, "moved": moved_count}})
    elif species == "raccoon":
        hand_ids = [card["id"] for card in state["players"][player_id]["hand"]]
        state["pending_action"] = {"type": "raccoon", "player_id": player_id, "eligible_card_ids": hand_ids}
        state["current_turn"] = player_id
    elif species == "gnat":
        _set_free_play_pending(state, player_id, {"bat"}, True, species)
    elif species == "mole":
        events.append({"type": "forest_shuffle:mole_note", "payload": {"player_id": player_id}})


def _resolve_bonus(state: Dict, player_id: str, placed_card: Dict, bonus_active: bool, events: List[Dict]) -> None:
    if not bonus_active:
        return
    species = placed_card["species"]
    if species in {"douglas_fir", "oak", "wolf"}:
        state["extra_turns_pending"] += 1
    elif species == "silver_fir":
        _set_free_play_pending(state, player_id, {"pawed"}, False, species)
    elif species == "tawny_owl":
        _draw_from_deck(state, player_id, "hand", events, "tawny_owl_bonus")
        if not state.get("game_over"):
            _draw_from_deck(state, player_id, "hand", events, "tawny_owl_bonus")
    elif species == "fire_salamander":
        _set_free_play_pending(state, player_id, {"pawed"}, False, species)
    elif species == "hedgehog":
        _draw_from_deck(state, player_id, "hand", events, "hedgehog")
    elif species == "stag_beetle":
        _set_free_play_pending(state, player_id, {"bird"}, False, species)
    elif species == "brown_bear":
        _draw_from_deck(state, player_id, "hand", events, "brown_bear_bonus")
        if not state.get("game_over"):
            state["extra_turns_pending"] += 1
    elif species == "european_badger":
        _set_free_play_pending(state, player_id, {"pawed"}, False, species)
    elif species == "fallow_deer":
        _draw_from_deck(state, player_id, "hand", events, "fallow_deer")
        if not state.get("game_over"):
            _draw_from_deck(state, player_id, "hand", events, "fallow_deer")
    elif species == "red_deer":
        _set_free_play_pending(state, player_id, {"deer"}, False, species)
    elif species == "roe_deer":
        _draw_from_deck(state, player_id, "hand", events, "roe_deer")


def _placed_entry_from_tree(tree: Dict) -> Dict:
    return {
        "entry_kind": "tree",
        "id": tree["id"],
        "species": tree["species"],
        "name": tree["name"],
        "tags": {"tree"},
        "card_symbol": tree.get("tree_species"),
        "side": None,
        "tree_id": tree["id"],
    }


def _play_sapling(state: Dict, player_id: str, card: Dict, events: List[Dict]) -> None:
    player_state = state["players"][player_id]
    tree = {
        "id": _next_id(state, "tree"),
        "kind": "sapling",
        "species": "sapling",
        "name": "Tree Sapling",
        "tree_species": None,
        "source_card_id": card["id"],
        "slots": {side: [] for side in SIDE_ORDER},
    }
    player_state["forest"]["trees"].append(tree)
    events.append({"type": "forest_shuffle:play_sapling", "payload": {"player_id": player_id, "tree_id": tree["id"]}})


def _play_tree_card(state: Dict, player_id: str, card: Dict, use_effect_bonus: bool, bonus_active: bool, events: List[Dict]) -> None:
    player_state = state["players"][player_id]
    tree = {
        "id": _next_id(state, "tree"),
        "kind": "tree",
        "species": card["species"],
        "name": card["name"],
        "tree_species": card["tree_species"],
        "source_card_id": card["id"],
        "slots": {side: [] for side in SIDE_ORDER},
    }
    player_state["forest"]["trees"].append(tree)
    events.append({"type": "forest_shuffle:play_tree", "payload": {"player_id": player_id, "species": card["species"], "tree_id": tree["id"]}})
    _draw_from_deck(state, None, "clearing", events, "tree_reveal")
    if state.get("game_over"):
        return
    placed_entry = _placed_entry_from_tree(tree)
    _trigger_existing_mushrooms(state, player_id, placed_entry, events)
    if state.get("game_over") or not use_effect_bonus:
        return
    _resolve_effect(state, player_id, placed_entry, events)
    if state.get("game_over") or state.get("pending_action"):
        return
    _resolve_bonus(state, player_id, placed_entry, bonus_active, events)


def _play_split_card(
    state: Dict,
    player_id: str,
    card: Dict,
    half: Dict,
    tree_id: str,
    use_effect_bonus: bool,
    bonus_active: bool,
    events: List[Dict],
) -> Optional[str]:
    player_state = state["players"][player_id]
    tree = _find_tree(player_state, tree_id)
    if not tree:
        return "Tree not found."
    side = half["slot"]
    slot_cards = tree["slots"][side]
    if not _can_stack_with_existing(slot_cards, half["species"], side):
        return "Illegal slot for this card."
    placed = {
        "id": _next_id(state, "placed"),
        "source_card_id": card["id"],
        "name": half["name"],
        "species": half["species"],
        "side": side,
        "tags": list(half["tags"]),
        "symbol": half["symbol"],
        "hidden_half": card["halves"][1] if card["halves"][0]["slot"] == side else card["halves"][0],
        "active_from_turn": state["turn_number"] + 1 if half["species"] in MUSHROOM_SPECIES else state["turn_number"],
    }
    slot_cards.append(placed)
    events.append(
        {
            "type": "forest_shuffle:play_card",
            "payload": {"player_id": player_id, "species": half["species"], "tree_id": tree_id, "side": side},
        }
    )
    placed_entry = {
        "entry_kind": "placed",
        "id": placed["id"],
        "species": placed["species"],
        "name": placed["name"],
        "tags": set(placed["tags"]),
        "card_symbol": placed["symbol"],
        "side": side,
        "tree_id": tree_id,
    }
    _trigger_existing_mushrooms(state, player_id, placed_entry, events)
    if state.get("game_over") or not use_effect_bonus:
        return None
    _resolve_effect(state, player_id, placed_entry, events)
    if state.get("game_over") or state.get("pending_action"):
        return None
    _resolve_bonus(state, player_id, placed_entry, bonus_active, events)
    return None


def _complete_turn_if_ready(state: Dict, player_id: str, events: List[Dict]) -> None:
    if state.get("game_over"):
        return
    if state.get("pending_action"):
        state["current_turn"] = player_id
        return
    _maybe_clear_clearing(state, events)
    if state.get("game_over"):
        return
    _advance_turn(state, player_id, events)


def _play_from_hand(
    state: Dict,
    player_id: str,
    action: Dict,
    events: List[Dict],
    free_play: bool,
) -> Optional[str]:
    player_state = state["players"][player_id]
    card_id = action.get("card_id")
    if not isinstance(card_id, str):
        return "Missing card id."
    index = _find_hand_index(player_state["hand"], card_id)
    if index < 0:
        return "Card not found in hand."
    card = player_state["hand"][index]
    if action.get("play_as") == "sapling":
        removed = player_state["hand"].pop(index)
        _play_sapling(state, player_id, removed, events)
        _complete_turn_if_ready(state, player_id, events)
        return None

    pay_card_ids = action.get("pay_card_ids") or []
    if not isinstance(pay_card_ids, list):
        return "pay_card_ids must be a list."

    half: Optional[Dict] = None
    cost = 0
    if card["kind"] == "split":
        half_index = action.get("half_index")
        if not isinstance(half_index, int):
            return "Missing half_index."
        half = _preview_half(card, half_index)
        if not half:
            return "Invalid half."
        cost = int(half["cost"])
    else:
        cost = int(card["cost"])

    if free_play:
        if pay_card_ids:
            return "Free play cards cannot use payment."
        cost = 0
    if len(set(pay_card_ids)) != len(pay_card_ids):
        return "Duplicate payment cards are not allowed."
    if card_id in pay_card_ids:
        return "You cannot pay with the card you are playing."
    if len(pay_card_ids) != cost:
        return "Incorrect number of payment cards."

    payment_cards: List[Dict] = []
    payment_indexes = []
    for payment_id in pay_card_ids:
        payment_index = _find_hand_index(player_state["hand"], payment_id)
        if payment_index < 0:
            return "A payment card is not in hand."
        payment_indexes.append(payment_index)
    for payment_index in sorted(payment_indexes, reverse=True):
        payment_cards.append(player_state["hand"].pop(payment_index))
    payment_cards.reverse()
    for payment in payment_cards:
        state["clearing"].append(payment)
    played_card = player_state["hand"].pop(_find_hand_index(player_state["hand"], card_id))

    bonus_active = False
    if not free_play and cost > 0 and card["kind"] == "split" and half:
        bonus_active = all(half["symbol"] in _payment_symbols(payment) for payment in payment_cards)
    elif not free_play and cost > 0 and card["kind"] == "tree":
        bonus_active = all(card["tree_species"] in _payment_symbols(payment) for payment in payment_cards)

    if card["kind"] == "tree":
        _play_tree_card(state, player_id, played_card, not free_play, bonus_active, events)
    else:
        target_tree_id = action.get("target_tree_id")
        if not isinstance(target_tree_id, str):
            player_state["hand"].append(played_card)
            for payment in payment_cards:
                state["clearing"].remove(payment)
                player_state["hand"].append(payment)
            return "Missing target tree."
        error = _play_split_card(state, player_id, played_card, half, target_tree_id, not free_play, bonus_active, events)
        if error:
            player_state["hand"].append(played_card)
            for payment in payment_cards:
                state["clearing"].remove(payment)
                player_state["hand"].append(payment)
            return error

    pending = state.get("pending_action")
    if free_play and pending and pending.get("type") == "free_play":
        if not pending.get("allow_multiple"):
            state["pending_action"] = None
            _complete_turn_if_ready(state, player_id, events)
        else:
            state["current_turn"] = player_id
    else:
        _complete_turn_if_ready(state, player_id, events)
    return None


def _resolve_raccoon(state: Dict, player_id: str, action: Dict, events: List[Dict]) -> Optional[str]:
    pending = state.get("pending_action") or {}
    selected = action.get("card_ids") or []
    if not isinstance(selected, list):
        return "card_ids must be a list."
    eligible = set(pending.get("eligible_card_ids") or [])
    if any(card_id not in eligible for card_id in selected):
        return "Invalid card selection for cave."
    player_state = state["players"][player_id]
    moved = 0
    for card_id in selected:
        card = _take_hand_card(player_state, card_id)
        if card:
            player_state["forest"]["cave"].append(card)
            moved += 1
    for _ in range(moved):
        _draw_from_deck(state, player_id, "hand", events, "raccoon")
        if state.get("game_over"):
            break
    state["pending_action"] = None
    events.append({"type": "forest_shuffle:raccoon", "payload": {"player_id": player_id, "moved": moved}})
    if not state.get("game_over"):
        _complete_turn_if_ready(state, player_id, events)
    return None


def _free_play_matches(card: Dict, tags: Set[str]) -> bool:
    if card["kind"] == "tree":
        return "tree" in tags
    for half in card["halves"]:
        if tags.intersection(set(half["tags"])):
            return True
    return False


def _build_public_tree(tree: Dict) -> Dict:
    return {
        "id": tree["id"],
        "kind": tree["kind"],
        "species": tree["species"],
        "name": tree["name"],
        "tree_species": tree.get("tree_species"),
        "slots": {
            side: [
                {
                    "id": card["id"],
                    "source_card_id": card["source_card_id"],
                    "species": card["species"],
                    "name": card["name"],
                    "side": card["side"],
                    "tags": list(card["tags"]),
                    "symbol": card.get("symbol"),
                }
                for card in tree["slots"][side]
            ]
            for side in SIDE_ORDER
        },
    }


class ForestShuffleGame:
    game_id = "forest_shuffle"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Dict, players: List[Dict]) -> Dict:
        seed = config.get("seed")
        rng = random.Random(seed if seed is not None else random.randrange(1 << 30))
        player_order = _find_player_order(players)
        deck = _insert_winters(_build_base_deck(rng), len(players), rng)
        state = {
            "game_id": ForestShuffleGame.game_id,
            "config": {
                "seed": seed,
                "opening_mulligan_if_no_tree": bool(config.get("opening_mulligan_if_no_tree", False)),
            },
            "player_order": player_order,
            "player_names": _player_name_lookup(players),
            "players": {
                player["player_id"]: {
                    "player_id": player["player_id"],
                    "name": player.get("name") or player["player_id"],
                    "seat": player.get("seat", 0),
                    "hand": [],
                    "forest": {"trees": [], "cave": []},
                    "score": 0,
                    "score_breakdown": [],
                }
                for player in players
            },
            "deck": deck,
            "clearing": [],
            "revealed_winters": [],
            "winter_count": 0,
            "removed_from_game": [],
            "current_turn": player_order[0] if player_order else None,
            "pending_action": None,
            "extra_turns_pending": 0,
            "game_over": False,
            "winner": [],
            "turn_number": 1,
            "id_counters": {"tree": 0, "placed": 0},
            "implementation_notes": list(IMPLEMENTATION_NOTES),
        }
        for player_id in player_order:
            for _ in range(6):
                _draw_from_deck(state, player_id, "hand", [], "setup")
        if state["config"]["opening_mulligan_if_no_tree"]:
            for player_id in player_order:
                hand = state["players"][player_id]["hand"]
                if any(card["kind"] == "tree" for card in hand):
                    continue
                state["removed_from_game"].extend(card["id"] for card in hand)
                state["players"][player_id]["hand"] = []
                for _ in range(6):
                    _draw_from_deck(state, player_id, "hand", [], "mulligan")
        _score_all_players(state)
        return state

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "The game is already over."
        if not isinstance(action, dict):
            return [], "Action must be an object."
        events: List[Dict] = []
        pending = state.get("pending_action")
        active_player = pending.get("player_id") if pending else state.get("current_turn")
        if player_id != active_player:
            return [], "It is not your turn."

        action_type = action.get("type")
        if pending:
            if pending.get("type") == "free_play":
                if action_type == "finish_pending":
                    state["pending_action"] = None
                    _complete_turn_if_ready(state, player_id, events)
                    return events, None
                if action_type != "play_card":
                    return [], "Only play_card or finish_pending is allowed right now."
                free_tags = set(pending.get("tags") or [])
                card_id = action.get("card_id")
                if not isinstance(card_id, str):
                    return [], "Missing card id."
                player_state = state["players"][player_id]
                index = _find_hand_index(player_state["hand"], card_id)
                if index < 0:
                    return [], "Card not found in hand."
                if not _free_play_matches(player_state["hand"][index], free_tags):
                    return [], "That card cannot be played by this free-play effect."
                return events, _play_from_hand(state, player_id, action, events, True)
            if pending.get("type") == "raccoon":
                if action_type != "resolve_raccoon":
                    return [], "You must resolve the Raccoon effect."
                return events, _resolve_raccoon(state, player_id, action, events)
            return [], "Unsupported pending action."

        if action_type == "draw_cards":
            sources = action.get("sources") or []
            if not isinstance(sources, list):
                return [], "sources must be a list."
            player_state = state["players"][player_id]
            max_draws = min(2, max(0, 10 - len(player_state["hand"])))
            if max_draws <= 0:
                return [], "Your hand is already at the limit."
            if len(sources) != max_draws:
                return [], "You must choose the exact number of cards to draw."
            for source in sources:
                if not isinstance(source, dict):
                    return [], "Each draw source must be an object."
                zone = source.get("zone")
                if zone == "deck":
                    _draw_from_deck(state, player_id, "hand", events, "draw_action")
                elif zone == "clearing":
                    card_id = source.get("card_id")
                    if not isinstance(card_id, str):
                        return [], "Missing clearing card id."
                    for index, card in enumerate(state["clearing"]):
                        if card["id"] == card_id:
                            player_state["hand"].append(state["clearing"].pop(index))
                            events.append({"type": "forest_shuffle:take_clearing", "payload": {"player_id": player_id, "card_id": card_id}})
                            break
                    else:
                        return [], "Clearing card not found."
                else:
                    return [], "Unknown draw source."
                if state.get("game_over"):
                    return events, None
            _maybe_clear_clearing(state, events)
            _advance_turn(state, player_id, events)
            return events, None

        if action_type == "play_card":
            return events, _play_from_hand(state, player_id, action, events, False)

        return [], "Unknown action."

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        _score_all_players(state)
        players_view = []
        for player_id in state["player_order"]:
            player_state = state["players"][player_id]
            player_view = {
                "player_id": player_id,
                "name": player_state["name"],
                "seat": player_state["seat"],
                "hand_count": len(player_state["hand"]),
                "hand": [_card_public(card) for card in player_state["hand"]] if player_id == viewer_id else [],
                "forest": {
                    "trees": [_build_public_tree(tree) for tree in player_state["forest"]["trees"]],
                    "cave_count": len(player_state["forest"]["cave"]),
                },
                "score": player_state["score"],
                "score_breakdown": player_state["score_breakdown"] if state.get("game_over") else [],
            }
            players_view.append(player_view)
        pending = state.get("pending_action")
        return {
            "game_id": ForestShuffleGame.game_id,
            "you": viewer_id,
            "current_turn": state.get("current_turn"),
            "turn_number": state.get("turn_number", 1),
            "winter_count": state.get("winter_count", 0),
            "revealed_winters": list(state.get("revealed_winters") or []),
            "deck_count": len(state.get("deck") or []),
            "clearing": [_card_public(card) for card in state.get("clearing") or []],
            "players": players_view,
            "pending_action": dict(pending) if pending else None,
            "game_over": bool(state.get("game_over")),
            "winner": list(state.get("winner") or []),
            "implementation_notes": list(state.get("implementation_notes") or []),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pending = state.get("pending_action")
        if pending and pending.get("player_id") != bot_id:
            return None
        player_state = state["players"][bot_id]
        if pending and pending.get("type") == "raccoon":
            return {"type": "resolve_raccoon", "card_ids": []}
        if pending and pending.get("type") == "free_play":
            required_tags = set(pending.get("tags") or [])
            for card in player_state["hand"]:
                if card["kind"] == "tree":
                    continue
                if any(required_tags.intersection(set(half["tags"])) for half in card["halves"]):
                    for tree in player_state["forest"]["trees"]:
                        for half_index, half in enumerate(card["halves"]):
                            if required_tags.intersection(set(half["tags"])) and _can_stack_with_existing(tree["slots"][half["slot"]], half["species"], half["slot"]):
                                return {"type": "play_card", "card_id": card["id"], "half_index": half_index, "target_tree_id": tree["id"]}
            return {"type": "finish_pending"}
        if state.get("current_turn") != bot_id:
            return None
        for card in list(player_state["hand"]):
            if card["kind"] == "tree" and len(player_state["hand"]) - 1 >= card["cost"]:
                pay_cards = [other["id"] for other in player_state["hand"] if other["id"] != card["id"]][: card["cost"]]
                return {"type": "play_card", "card_id": card["id"], "pay_card_ids": pay_cards}
        for card in list(player_state["hand"]):
            if card["kind"] != "split":
                continue
            for tree in player_state["forest"]["trees"]:
                for half_index, half in enumerate(card["halves"]):
                    side_cards = tree["slots"][half["slot"]]
                    if not _can_stack_with_existing(side_cards, half["species"], half["slot"]):
                        continue
                    if len(player_state["hand"]) - 1 < half["cost"]:
                        continue
                    pay_cards = [other["id"] for other in player_state["hand"] if other["id"] != card["id"]][: half["cost"]]
                    return {
                        "type": "play_card",
                        "card_id": card["id"],
                        "half_index": half_index,
                        "target_tree_id": tree["id"],
                        "pay_card_ids": pay_cards,
                    }
        if player_state["hand"]:
            return {"type": "play_card", "card_id": player_state["hand"][0]["id"], "play_as": "sapling"}
        return {"type": "draw_cards", "sources": [{"zone": "deck"}, {"zone": "deck"}], "delay_ms": 250}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
