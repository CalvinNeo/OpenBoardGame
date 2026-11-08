"""Static board data for Ticket to Ride (North America, 2004 base map).

City coordinates, the 100 route segments and the 30 destination tickets were
transcribed from the published North America board. Coordinates are laid out on a
1000x640 canvas so the client can draw the map without any extra assets.
"""

from typing import Dict, List, Tuple

# Eight train-car colours plus the multicoloured Locomotive (🚂) wild card.
CARD_COLORS: Tuple[str, ...] = ("red", "orange", "yellow", "green",
                               "blue", "purple", "white", "black")
LOCOMOTIVE = "locomotive"
ALL_CARD_TYPES: Tuple[str, ...] = CARD_COLORS + (LOCOMOTIVE,)

# 12 of each colour and 14 locomotives make the 110 card deck.
CARDS_PER_COLOR = 12
LOCOMOTIVE_CARDS = 14

TRAINS_PER_PLAYER = 45
STARTING_HAND = 4
STARTING_TICKETS = 3
STARTING_TICKETS_MIN_KEEP = 2
DRAW_TICKETS = 3
DRAW_TICKETS_MIN_KEEP = 1
FACE_UP_SLOTS = 5
FACE_UP_LOCOMOTIVE_LIMIT = 3
LONGEST_PATH_BONUS = 10

ROUTE_POINTS: Dict[int, int] = {1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15}

# In 2-3 player games only one track of a double route may ever be claimed.
DOUBLE_ROUTE_MAX_PLAYERS = 3

CITIES: Dict[str, Dict[str, object]] = {
    'Atlanta': {"name": 'Atlanta', "x": 780.6, "y": 405.2, "lx": -12.0, "ly": 0.0, "anchor": 'end'},
    'Boston': {"name": 'Boston', "x": 945.2, "y": 132.1, "lx": -0.0, "ly": -12.0, "anchor": 'middle'},
    'Calgary': {"name": 'Calgary', "x": 234.7, "y": 82.3, "lx": -0.0, "ly": -12.0, "anchor": 'middle'},
    'Charleston': {"name": 'Charleston', "x": 871.9, "y": 411.9, "lx": 10.4, "ly": -6.0, "anchor": 'start'},
    'Chicago': {"name": 'Chicago', "x": 683.9, "y": 258.3, "lx": -0.0, "ly": -23.0, "anchor": 'middle'},
    'Dallas': {"name": 'Dallas', "x": 554.5, "y": 498.6, "lx": 10.4, "ly": 6.0, "anchor": 'start'},
    'Denver': {"name": 'Denver', "x": 390.3, "y": 351.3, "lx": -11.5, "ly": 19.9, "anchor": 'end'},
    'Duluth': {"name": 'Duluth', "x": 563.6, "y": 201.1, "lx": -10.4, "ly": -6.0, "anchor": 'end'},
    'El Paso': {"name": 'El Paso', "x": 377.7, "y": 521.3, "lx": -8.5, "ly": 14.7, "anchor": 'end'},
    'Helena': {"name": 'Helena', "x": 332.7, "y": 206.4, "lx": -10.4, "ly": 6.0, "anchor": 'end'},
    'Houston': {"name": 'Houston', "x": 595.4, "y": 535.7, "lx": 11.5, "ly": 19.9, "anchor": 'start'},
    'Kansas City': {"name": 'Kansas City', "x": 554.9, "y": 334.6, "lx": 8.5, "ly": -14.7, "anchor": 'start'},
    'Las Vegas': {"name": 'Las Vegas', "x": 207.5, "y": 425.3, "lx": -6.0, "ly": -10.4, "anchor": 'end'},
    'Little Rock': {"name": 'Little Rock', "x": 623.3, "y": 419.6, "lx": -10.4, "ly": 6.0, "anchor": 'end'},
    'Los Angeles': {"name": 'Los Angeles', "x": 144.7, "y": 479.8, "lx": -8.5, "ly": 14.7, "anchor": 'end'},
    'Miami': {"name": 'Miami', "x": 903.7, "y": 559.8, "lx": 12.0, "ly": 0.0, "anchor": 'start'},
    'Montreal': {"name": 'Montreal', "x": 875.4, "y": 78.2, "lx": -0.0, "ly": -12.0, "anchor": 'middle'},
    'Nashville': {"name": 'Nashville', "x": 731.0, "y": 372.1, "lx": -10.4, "ly": 6.0, "anchor": 'end'},
    'New Orleans': {"name": 'New Orleans', "x": 686.0, "y": 524.7, "lx": -12.0, "ly": 0.0, "anchor": 'end'},
    'New York': {"name": 'New York', "x": 893.9, "y": 202.4, "lx": 14.7, "ly": 8.5, "anchor": 'start'},
    'Oklahoma City': {"name": 'Oklahoma City', "x": 535.4, "y": 415.9, "lx": 14.7, "ly": -8.5, "anchor": 'start'},
    'Omaha': {"name": 'Omaha', "x": 534.7, "y": 287.1, "lx": 19.9, "ly": 11.5, "anchor": 'start'},
    'Phoenix': {"name": 'Phoenix', "x": 261.6, "y": 486.2, "lx": -8.5, "ly": -14.7, "anchor": 'end'},
    'Pittsburgh': {"name": 'Pittsburgh', "x": 811.6, "y": 244.6, "lx": -8.5, "ly": -14.7, "anchor": 'end'},
    'Portland': {"name": 'Portland', "x": 82.3, "y": 198.1, "lx": -10.4, "ly": -6.0, "anchor": 'end'},
    'Raleigh': {"name": 'Raleigh', "x": 844.7, "y": 350.7, "lx": 19.9, "ly": 11.5, "anchor": 'start'},
    'Saint Louis': {"name": 'Saint Louis', "x": 638.3, "y": 336.3, "lx": 0.0, "ly": 23.0, "anchor": 'middle'},
    'Salt Lake City': {"name": 'Salt Lake City', "x": 262.6, "y": 322.2, "lx": -0.0, "ly": -12.0, "anchor": 'middle'},
    'San Francisco': {"name": 'San Francisco', "x": 68.4, "y": 382.4, "lx": 0.0, "ly": 23.0, "anchor": 'middle'},
    'Santa Fe': {"name": 'Santa Fe', "x": 383.0, "y": 436.3, "lx": -10.4, "ly": -6.0, "anchor": 'end'},
    'Sault St. Marie': {"name": 'Sault St. Marie', "x": 688.5, "y": 139.2, "lx": -0.0, "ly": -12.0, "anchor": 'middle'},
    'Seattle': {"name": 'Seattle', "x": 103.6, "y": 149.2, "lx": -10.4, "ly": -6.0, "anchor": 'end'},
    'Toronto': {"name": 'Toronto', "x": 795.2, "y": 158.9, "lx": 14.7, "ly": 8.5, "anchor": 'start'},
    'Vancouver': {"name": 'Vancouver', "x": 108.1, "y": 98.7, "lx": -10.4, "ly": -6.0, "anchor": 'end'},
    'Washington': {"name": 'Washington', "x": 901.6, "y": 287.4, "lx": 12.0, "ly": 0.0, "anchor": 'start'},
    'Winnipeg': {"name": 'Winnipeg', "x": 453.4, "y": 92.6, "lx": 10.4, "ly": -6.0, "anchor": 'start'},
}

CITY_IDS: Tuple[str, ...] = tuple(sorted(CITIES))

# id -> route. Parallel tracks of a double route share both cities and are kept
# adjacent so the client can draw them side by side.
ROUTES: Dict[str, Dict[str, object]] = {
    'vancouver--calgary--0': {"a": 'Vancouver', "b": 'Calgary', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'vancouver--seattle--0': {"a": 'Vancouver', "b": 'Seattle', "length": 1, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'vancouver--seattle--1': {"a": 'Vancouver', "b": 'Seattle', "length": 1, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'seattle--calgary--0': {"a": 'Seattle', "b": 'Calgary', "length": 4, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'seattle--helena--0': {"a": 'Seattle', "b": 'Helena', "length": 6, "color": 'yellow', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'seattle--portland--0': {"a": 'Seattle', "b": 'Portland', "length": 1, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'seattle--portland--1': {"a": 'Seattle', "b": 'Portland', "length": 1, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'portland--salt-lake-city--0': {"a": 'Portland', "b": 'Salt Lake City', "length": 6, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'portland--san-francisco--0': {"a": 'Portland', "b": 'San Francisco', "length": 5, "color": 'green', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'portland--san-francisco--1': {"a": 'Portland', "b": 'San Francisco', "length": 5, "color": 'purple', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'san-francisco--salt-lake-city--0': {"a": 'San Francisco', "b": 'Salt Lake City', "length": 5, "color": 'orange', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'san-francisco--salt-lake-city--1': {"a": 'San Francisco', "b": 'Salt Lake City', "length": 5, "color": 'white', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'san-francisco--los-angeles--0': {"a": 'San Francisco', "b": 'Los Angeles', "length": 3, "color": 'yellow', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'san-francisco--los-angeles--1': {"a": 'San Francisco', "b": 'Los Angeles', "length": 3, "color": 'purple', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'los-angeles--las-vegas--0': {"a": 'Los Angeles', "b": 'Las Vegas', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'los-angeles--phoenix--0': {"a": 'Los Angeles', "b": 'Phoenix', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'los-angeles--el-paso--0': {"a": 'Los Angeles', "b": 'El Paso', "length": 6, "color": 'black', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'calgary--winnipeg--0': {"a": 'Calgary', "b": 'Winnipeg', "length": 6, "color": 'white', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'calgary--helena--0': {"a": 'Calgary', "b": 'Helena', "length": 4, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'helena--winnipeg--0': {"a": 'Helena', "b": 'Winnipeg', "length": 4, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'helena--salt-lake-city--0': {"a": 'Helena', "b": 'Salt Lake City', "length": 3, "color": 'purple', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'helena--denver--0': {"a": 'Helena', "b": 'Denver', "length": 4, "color": 'green', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'helena--duluth--0': {"a": 'Helena', "b": 'Duluth', "length": 6, "color": 'orange', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'helena--omaha--0': {"a": 'Helena', "b": 'Omaha', "length": 5, "color": 'red', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'salt-lake-city--denver--0': {"a": 'Salt Lake City', "b": 'Denver', "length": 3, "color": 'red', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'salt-lake-city--denver--1': {"a": 'Salt Lake City', "b": 'Denver', "length": 3, "color": 'yellow', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'las-vegas--salt-lake-city--0': {"a": 'Las Vegas', "b": 'Salt Lake City', "length": 3, "color": 'orange', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'phoenix--denver--0': {"a": 'Phoenix', "b": 'Denver', "length": 5, "color": 'white', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'phoenix--santa-fe--0': {"a": 'Phoenix', "b": 'Santa Fe', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'phoenix--el-paso--0': {"a": 'Phoenix', "b": 'El Paso', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'winnipeg--sault-st-marie--0': {"a": 'Winnipeg', "b": 'Sault St. Marie', "length": 6, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'winnipeg--duluth--0': {"a": 'Winnipeg', "b": 'Duluth', "length": 4, "color": 'black', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'duluth--sault-st-marie--0': {"a": 'Duluth', "b": 'Sault St. Marie', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'duluth--toronto--0': {"a": 'Duluth', "b": 'Toronto', "length": 6, "color": 'purple', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'duluth--chicago--0': {"a": 'Duluth', "b": 'Chicago', "length": 3, "color": 'red', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'duluth--omaha--0': {"a": 'Duluth', "b": 'Omaha', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'duluth--omaha--1': {"a": 'Duluth', "b": 'Omaha', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'omaha--chicago--0': {"a": 'Omaha', "b": 'Chicago', "length": 4, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'omaha--kansas-city--0': {"a": 'Omaha', "b": 'Kansas City', "length": 1, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'omaha--kansas-city--1': {"a": 'Omaha', "b": 'Kansas City', "length": 1, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'kansas-city--saint-louis--0': {"a": 'Kansas City', "b": 'Saint Louis', "length": 2, "color": 'blue', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'kansas-city--saint-louis--1': {"a": 'Kansas City', "b": 'Saint Louis', "length": 2, "color": 'purple', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'kansas-city--oklahoma-city--0': {"a": 'Kansas City', "b": 'Oklahoma City', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'kansas-city--oklahoma-city--1': {"a": 'Kansas City', "b": 'Oklahoma City', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'oklahoma-city--little-rock--0': {"a": 'Oklahoma City', "b": 'Little Rock', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'oklahoma-city--dallas--0': {"a": 'Oklahoma City', "b": 'Dallas', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'oklahoma-city--dallas--1': {"a": 'Oklahoma City', "b": 'Dallas', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'dallas--little-rock--0': {"a": 'Dallas', "b": 'Little Rock', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'dallas--houston--0': {"a": 'Dallas', "b": 'Houston', "length": 1, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'dallas--houston--1': {"a": 'Dallas', "b": 'Houston', "length": 1, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'houston--new-orleans--0': {"a": 'Houston', "b": 'New Orleans', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'el-paso--houston--0': {"a": 'El Paso', "b": 'Houston', "length": 6, "color": 'green', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'el-paso--dallas--0': {"a": 'El Paso', "b": 'Dallas', "length": 4, "color": 'red', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'el-paso--oklahoma-city--0': {"a": 'El Paso', "b": 'Oklahoma City', "length": 5, "color": 'yellow', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'el-paso--santa-fe--0': {"a": 'El Paso', "b": 'Santa Fe', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'santa-fe--oklahoma-city--0': {"a": 'Santa Fe', "b": 'Oklahoma City', "length": 3, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'oklahoma-city--denver--0': {"a": 'Oklahoma City', "b": 'Denver', "length": 4, "color": 'red', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'santa-fe--denver--0': {"a": 'Santa Fe', "b": 'Denver', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'denver--kansas-city--0': {"a": 'Denver', "b": 'Kansas City', "length": 4, "color": 'black', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'denver--kansas-city--1': {"a": 'Denver', "b": 'Kansas City', "length": 4, "color": 'orange', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'denver--omaha--0': {"a": 'Denver', "b": 'Omaha', "length": 4, "color": 'purple', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'new-orleans--miami--0': {"a": 'New Orleans', "b": 'Miami', "length": 6, "color": 'red', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'new-orleans--atlanta--0': {"a": 'New Orleans', "b": 'Atlanta', "length": 4, "color": 'orange', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'new-orleans--atlanta--1': {"a": 'New Orleans', "b": 'Atlanta', "length": 4, "color": 'yellow', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'new-orleans--little-rock--0': {"a": 'New Orleans', "b": 'Little Rock', "length": 3, "color": 'green', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'little-rock--nashville--0': {"a": 'Little Rock', "b": 'Nashville', "length": 3, "color": 'white', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'little-rock--saint-louis--0': {"a": 'Little Rock', "b": 'Saint Louis', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'saint-louis--nashville--0': {"a": 'Saint Louis', "b": 'Nashville', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'saint-louis--pittsburgh--0': {"a": 'Saint Louis', "b": 'Pittsburgh', "length": 5, "color": 'green', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'saint-louis--chicago--0': {"a": 'Saint Louis', "b": 'Chicago', "length": 2, "color": 'green', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'saint-louis--chicago--1': {"a": 'Saint Louis', "b": 'Chicago', "length": 2, "color": 'white', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'chicago--pittsburgh--0': {"a": 'Chicago', "b": 'Pittsburgh', "length": 3, "color": 'black', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'chicago--pittsburgh--1': {"a": 'Chicago', "b": 'Pittsburgh', "length": 3, "color": 'orange', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'chicago--toronto--0': {"a": 'Chicago', "b": 'Toronto', "length": 4, "color": 'white', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'sault-st-marie--montreal--0': {"a": 'Sault St. Marie', "b": 'Montreal', "length": 5, "color": 'black', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'toronto--montreal--0': {"a": 'Toronto', "b": 'Montreal', "length": 3, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'sault-st-marie--toronto--0': {"a": 'Sault St. Marie', "b": 'Toronto', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'toronto--pittsburgh--0': {"a": 'Toronto', "b": 'Pittsburgh', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'pittsburgh--new-york--0': {"a": 'Pittsburgh', "b": 'New York', "length": 2, "color": 'white', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'pittsburgh--new-york--1': {"a": 'Pittsburgh', "b": 'New York', "length": 2, "color": 'green', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'pittsburgh--washington--0': {"a": 'Pittsburgh', "b": 'Washington', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'pittsburgh--raleigh--0': {"a": 'Pittsburgh', "b": 'Raleigh', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'nashville--raleigh--0': {"a": 'Nashville', "b": 'Raleigh', "length": 3, "color": 'black', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'nashville--atlanta--0': {"a": 'Nashville', "b": 'Atlanta', "length": 1, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'nashville--pittsburgh--0': {"a": 'Nashville', "b": 'Pittsburgh', "length": 4, "color": 'yellow', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'atlanta--miami--0': {"a": 'Atlanta', "b": 'Miami', "length": 5, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'atlanta--charleston--0': {"a": 'Atlanta', "b": 'Charleston', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'atlanta--raleigh--0': {"a": 'Atlanta', "b": 'Raleigh', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'atlanta--raleigh--1': {"a": 'Atlanta', "b": 'Raleigh', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'charleston--miami--0': {"a": 'Charleston', "b": 'Miami', "length": 4, "color": 'purple', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'raleigh--charleston--0': {"a": 'Raleigh', "b": 'Charleston', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'raleigh--washington--0': {"a": 'Raleigh', "b": 'Washington', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'raleigh--washington--1': {"a": 'Raleigh', "b": 'Washington', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'washington--new-york--0': {"a": 'Washington', "b": 'New York', "length": 2, "color": 'orange', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'washington--new-york--1': {"a": 'Washington', "b": 'New York', "length": 2, "color": 'black', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'new-york--boston--0': {"a": 'New York', "b": 'Boston', "length": 2, "color": 'yellow', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'new-york--boston--1': {"a": 'New York', "b": 'Boston', "length": 2, "color": 'red', "parallel": 1, "parallel_count": 2, "offset": 4.5},
    'new-york--montreal--0': {"a": 'New York', "b": 'Montreal', "length": 3, "color": 'blue', "parallel": 0, "parallel_count": 1, "offset": 0.0},
    'boston--montreal--0': {"a": 'Boston', "b": 'Montreal', "length": 2, "color": 'gray', "parallel": 0, "parallel_count": 2, "offset": -4.5},
    'boston--montreal--1': {"a": 'Boston', "b": 'Montreal', "length": 2, "color": 'gray', "parallel": 1, "parallel_count": 2, "offset": 4.5},
}

ROUTE_IDS: Tuple[str, ...] = tuple(ROUTES)

DESTINATIONS: Dict[str, Dict[str, object]] = {
    'los-angeles--new-york': {"a": 'Los Angeles', "b": 'New York', "points": 21},
    'duluth--houston': {"a": 'Duluth', "b": 'Houston', "points": 8},
    'sault-st-marie--nashville': {"a": 'Sault St. Marie', "b": 'Nashville', "points": 8},
    'new-york--atlanta': {"a": 'New York', "b": 'Atlanta', "points": 6},
    'portland--nashville': {"a": 'Portland', "b": 'Nashville', "points": 17},
    'vancouver--montreal': {"a": 'Vancouver', "b": 'Montreal', "points": 20},
    'duluth--el-paso': {"a": 'Duluth', "b": 'El Paso', "points": 10},
    'toronto--miami': {"a": 'Toronto', "b": 'Miami', "points": 10},
    'portland--phoenix': {"a": 'Portland', "b": 'Phoenix', "points": 11},
    'dallas--new-york': {"a": 'Dallas', "b": 'New York', "points": 11},
    'calgary--salt-lake-city': {"a": 'Calgary', "b": 'Salt Lake City', "points": 7},
    'calgary--phoenix': {"a": 'Calgary', "b": 'Phoenix', "points": 13},
    'los-angeles--miami': {"a": 'Los Angeles', "b": 'Miami', "points": 20},
    'winnipeg--little-rock': {"a": 'Winnipeg', "b": 'Little Rock', "points": 11},
    'san-francisco--atlanta': {"a": 'San Francisco', "b": 'Atlanta', "points": 17},
    'kansas-city--houston': {"a": 'Kansas City', "b": 'Houston', "points": 5},
    'los-angeles--chicago': {"a": 'Los Angeles', "b": 'Chicago', "points": 16},
    'denver--pittsburgh': {"a": 'Denver', "b": 'Pittsburgh', "points": 11},
    'chicago--santa-fe': {"a": 'Chicago', "b": 'Santa Fe', "points": 9},
    'vancouver--santa-fe': {"a": 'Vancouver', "b": 'Santa Fe', "points": 13},
    'boston--miami': {"a": 'Boston', "b": 'Miami', "points": 12},
    'chicago--new-orleans': {"a": 'Chicago', "b": 'New Orleans', "points": 7},
    'montreal--atlanta': {"a": 'Montreal', "b": 'Atlanta', "points": 9},
    'seattle--new-york': {"a": 'Seattle', "b": 'New York', "points": 22},
    'denver--el-paso': {"a": 'Denver', "b": 'El Paso', "points": 4},
    'helena--los-angeles': {"a": 'Helena', "b": 'Los Angeles', "points": 8},
    'winnipeg--houston': {"a": 'Winnipeg', "b": 'Houston', "points": 12},
    'montreal--new-orleans': {"a": 'Montreal', "b": 'New Orleans', "points": 13},
    'sault-st-marie--oklahoma-city': {"a": 'Sault St. Marie', "b": 'Oklahoma City', "points": 9},
    'seattle--los-angeles': {"a": 'Seattle', "b": 'Los Angeles', "points": 9},
}

DESTINATION_IDS: Tuple[str, ...] = tuple(DESTINATIONS)


def route_pair_key(route_id: str) -> Tuple[str, str]:
    """Both tracks of a double route share this key."""
    route = ROUTES[route_id]
    return tuple(sorted((route["a"], route["b"])))  # type: ignore[return-value]


def city_neighbors() -> Dict[str, List[Tuple[str, str]]]:
    """city -> [(other city, route id)] used for path finding and ticket checks."""
    graph: Dict[str, List[Tuple[str, str]]] = {city: [] for city in CITIES}
    for route_id, route in ROUTES.items():
        graph[route["a"]].append((route["b"], route_id))
        graph[route["b"]].append((route["a"], route_id))
    return graph
