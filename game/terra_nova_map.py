"""Printed bridgeheads on the base 2–4-player map (KOSMOS rules, p. 2).

These are a fixed component transcription, not a general rule allowing players
to bridge arbitrary river crossings. Coordinates match terra_nova_data.MAP_ROWS.
"""

BRIDGE_ENDPOINTS = (
    ("A5", "C5"), ("A8", "B9"), ("B2", "C1"), ("B3", "C5"),
    ("B6", "C5"), ("B9", "C8"), ("C3", "D1"), ("C3", "D4"),
    ("C3", "E3"), ("C7", "D5"), ("C8", "D9"), ("D7", "E6"),
    ("D7", "E9"), ("D7", "F7"), ("E5", "G5"), ("E6", "F7"),
    ("E6", "G6"), ("F3", "G5"), ("F3", "H3"), ("F7", "G6"),
    ("G2", "H3"), ("G2", "I2"), ("G8", "H6"), ("G8", "I8"),
    ("H10", "I9"),
)

BRIDGE_SITES = [
    {"id": f"bridge_{index}", "cell_ids": list(endpoints)}
    for index, endpoints in enumerate(BRIDGE_ENDPOINTS, 1)
]
