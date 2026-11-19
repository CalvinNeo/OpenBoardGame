import copy
from typing import Dict


MISSION_COUNT = 66
AUDIO_MISSIONS = {19, 30, 42, 54, 66}
MISSION_SOURCES = (
    "https://www.cocktailgames.com/wp-content/uploads/2023/10/BombBusters_rules_EN.pdf",
    "https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/",
    "https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/PDFs/Bomb%20Busters%20FAQ%20(2025-07-11).pdf",
)

MISSION_SETUPS = (
    (6, 0, 0, 0, 0), (8, 2, 2, 0, 0), (10, 0, 0, 1, 1),
    (12, 2, 2, 1, 1), (12, 2, 3, 1, 1), (12, 4, 4, 1, 1),
    (12, 0, 0, 1, 2), (12, 2, 3, 1, 2), (12, 2, 2, 1, 1),
    (12, 4, 4, 1, 1), (12, 2, 2, 0, 0), (12, 4, 4, 1, 1),
    (12, 0, 0, 3, 3), (12, 2, 3, 2, 2), (12, 0, 0, 1, 3),
    (12, 2, 3, 1, 1), (12, 0, 0, 2, 3), (12, 0, 0, 2, 2),
    (12, 2, 3, 1, 1), (12, 2, 2, 2, 2), (12, 0, 0, 1, 2),
    (12, 4, 4, 1, 1), (12, 0, 0, 1, 3), (12, 0, 0, 2, 2),
    (12, 0, 0, 2, 2), (12, 0, 0, 2, 2), (12, 4, 4, 1, 1),
    (12, 4, 4, 2, 2), (12, 0, 0, 3, 3), (12, 4, 4, 1, 2),
    (12, 0, 0, 2, 3), (12, 0, 0, 2, 2), (12, 0, 0, 2, 3),
    (12, 0, 0, 1, 1), (12, 4, 4, 2, 3), (12, 2, 2, 1, 3),
    (12, 0, 0, 2, 2), (12, 0, 0, 2, 2), (12, 4, 4, 2, 3),
    (12, 0, 0, 3, 3), (12, 0, 0, 1, 3), (12, 4, 4, 1, 3),
    (12, 0, 0, 3, 3), (12, 0, 0, 1, 3), (12, 0, 0, 2, 2),
    (12, 4, 4, 0, 0), (12, 0, 0, 2, 3), (12, 3, 3, 2, 2),
    (12, 0, 0, 2, 2), (12, 2, 2, 2, 2), (12, 0, 0, 1, 1),
    (12, 0, 0, 3, 3), (12, 0, 0, 2, 2), (12, 0, 0, 0, 0),
    (12, 0, 0, 2, 2), (12, 0, 0, 2, 3), (12, 0, 0, 1, 1),
    (12, 0, 0, 2, 2), (12, 0, 0, 2, 3), (12, 0, 0, 2, 3),
    (12, 0, 0, 1, 1), (12, 0, 0, 2, 2), (12, 0, 0, 2, 2),
    (12, 0, 0, 1, 1), (12, 0, 0, 3, 3), (12, 2, 2, 2, 2),
)

TWO_PLAYER_SETUPS = {
    4: (12, 4, 4, 1, 1), 5: (12, 2, 3, 2, 2), 6: (12, 4, 4, 2, 2),
    7: (12, 0, 0, 1, 3), 8: (12, 4, 4, 1, 3), 9: (12, 4, 4, 2, 2),
    11: (12, 4, 4, 0, 0), 12: (12, 4, 4, 2, 2), 14: (12, 4, 4, 3, 3),
    15: (12, 0, 0, 2, 3), 16: (12, 4, 4, 2, 2), 17: (12, 0, 0, 3, 3),
    18: (12, 0, 0, 3, 3), 20: (12, 4, 4, 2, 3), 21: (12, 0, 0, 2, 2),
    23: (12, 0, 0, 2, 3), 24: (12, 0, 0, 3, 3), 25: (12, 0, 0, 3, 3),
    28: (12, 4, 4, 3, 3), 32: (12, 0, 0, 3, 3), 33: (12, 0, 0, 3, 3),
    35: (12, 4, 4, 3, 3), 36: (12, 4, 4, 2, 3), 37: (12, 0, 0, 3, 3),
    38: (12, 0, 0, 3, 3), 39: (12, 4, 4, 3, 3), 41: (12, 2, 2, 2, 3),
    45: (12, 0, 0, 3, 3), 47: (12, 0, 0, 3, 3), 48: (12, 3, 3, 3, 3),
    49: (12, 0, 0, 3, 3), 50: (12, 4, 4, 3, 3), 51: (12, 0, 0, 2, 2),
    52: (12, 4, 4, 3, 3), 53: (12, 0, 0, 3, 3), 55: (12, 0, 0, 2, 3),
    56: (12, 0, 0, 3, 3), 57: (12, 0, 0, 2, 2), 58: (12, 0, 0, 3, 3),
    59: (12, 0, 0, 3, 3), 60: (12, 0, 0, 3, 3), 61: (12, 0, 0, 2, 2),
    62: (12, 0, 0, 3, 3), 63: (12, 0, 0, 3, 3), 64: (12, 0, 0, 2, 2),
}

MISSION_RULES = {
    1: "Cut matching pairs. A Solo Cut needs all four copies, or the final two. No shared equipment.",
    2: "Yellow wires match by color, not by their decimal sorting positions. No shared equipment.",
    3: "Cutting red explodes the bomb. Reveal red only when your remaining wires are all red. Shared equipment unlocks after two matching blue wires are cut.",
    4: "Use the standard cut, information and equipment rules. Two players use four yellow wires.",
    5: "Only two of the three public yellow candidates were dealt. The unused candidate stays secret.",
    6: "Four yellow wires match by color. Cut them in pairs, or Solo Cut all remaining yellow wires.",
    7: "Only one of the public red candidates was dealt. Do not assume every marker is present.",
    8: "Combine blue, yellow, red, candidate markers, equipment and your personal detector.",
    9: "The second priority number needs two cuts of the first. The third needs two cuts of both earlier numbers. A player left with only blocked values causes an explosion.",
    10: "Start the 15-minute timer (12 minutes with two players). Volunteer to act instead of following seats. With more than two players, do not take consecutive turns unless you alone have wires.",
    11: "All four blue wires matching the danger number behave as red wires. They must only be revealed when nothing safe remains in that hand.",
    12: "Equipment needs two cuts of its own number AND two cuts of its additional number.",
    13: "Identify all three red wires in one special action. Any wrong selection explodes. Ordinary Reveal Red is unavailable. Initial clue values are random.",
    14: "The rookie's failed Dual Cut explodes immediately. The rookie cannot use Stabilizer.",
    15: "Equipment starts hidden. Completing the displayed number reveals and immediately unlocks the next equipment, then draws another number.",
    16: "The three priority numbers unlock in order only after ALL FOUR wires of each preceding number are cut.",
    17: "Rhett's clues mean NOT this value. Rhett gives two false initial clues, cannot use equipment, and failed cuts in Rhett's hand reveal the declared value as a negative clue.",
    18: "Reveal a number, run a radar check on every rack, and nominate someone to cut that number. Turn order resumes to the director's left. No initial clues.",
    19: "Audio companion mission. Use the official mission recording externally and apply its announced instructions with the shared companion controls.",
    20: "Each rack's final dealt wire is unsorted at its far right. X-marked wires ignore ALL equipment, including radar and personal detectors.",
    21: "All clues reveal odd/even rather than the wire's exact number. Yellow clues remain yellow.",
    22: "Initial clues name two values absent from your hand. After the first yellow pair, choose a clue to give the player on your left.",
    23: "Identify all four wires of the special number in one action or explode. Until then, lose one hidden equipment each round. Succeeding unlocks all equipment left.",
    24: "Clues show how many wires of that value are on THIS rack, including cut wires, rather than their value. Use ×1, ×2 or ×3.",
    25: "Do not say a wire number aloud. Use gestures or descriptions. Report an accidental spoken number to advance the detonator.",
    26: "Choose a visible number and attempt that value, then turn its card over. Refresh the uncompleted numbers when all are face down. Pass for free only if none is in your hand.",
    27: "Personal detectors are unavailable. After the first yellow pair, choose one of the randomly drawn clue values in Captain order.",
    28: "Captain Careless cannot use any equipment or personal detector. Their failed Dual Cut explodes immediately.",
    29: "Before a turn, the player to the right secretly predicts a number. Cutting that number costs one detonator step. The active player receives the prediction card afterwards.",
    30: "Audio companion mission with a shuffled number deck. Follow the official recording using the shared companion controls.",
    31: "Choose one personal constraint A–E. If you cannot obey it at the start of a turn, discard it permanently and continue normally.",
    32: "Everyone obeys the shared constraint. The Captain may replace it before a turn. Pass for free if unable to obey. Red reveals ignore constraints.",
    33: "Use odd/even clues throughout, including initial clues, failed cuts and Post-It.",
    34: "Only the secret weakest link must obey their private constraint. Guess their identity AND constraint. A wrong guess costs one step. If they cannot act, lose two steps and reveal all roles.",
    35: "Each rack has an unsorted blue X-wire at the far right. These wires ignore equipment and cannot be cut until ALL four yellow wires are cut.",
    36: "Only an end of the five-number priority line is available. After cutting a pair of that end value, choose which end comes next.",
    37: "Everyone obeys the shared constraint, replaced whenever a number validates. If a whole round passes without a legal cut, lose one step and draw a new constraint.",
    38: "Only the Captain sees the back of their reversed wire. Only the Captain may cut it, without equipment. A failed cut using it explodes.",
    39: "Identify all four special-number wires together or explode. An eight-card clue deck shrinks once each round until then. Afterwards its cards grant matching clues.",
    40: "Clues show rack multiplicity (×1, ×2 or ×3), counting both cut and uncut wires, instead of exact values.",
    41: "Yellow tripwires are identified singly on teammates' racks. A correct identification rewinds one step. A miss costs one step and gives a clue. Hitting red explodes.",
    42: "Audio companion mission. Follow the official recording and use the shared controls for its announced changes.",
    43: "Nano holds a hidden reserve and moves between 1 and 12 each turn, bouncing at the ends. Cut its current number to take and insert a reserve wire. Its reserve must also be cleared.",
    44: "A cut costs 1 oxygen for values 1–4, 2 for 5–8, or 3 for 9–12. The shared reserve has twice the player count and refills before the Captain's turn. Passing costs one step.",
    45: "Reveal a number and volunteer to cut it. The Captain may nominate a player instead. A player without that value gives a clue and loses one step.",
    46: "All four blue 7s must be cut last, together, when the active player's remaining wires are all blue 7s. Finding a 7 early is a normal failed cut. Yellow wires still match only other yellow wires.",
    47: "Spend two visible Number cards. Their sum or absolute difference is the value to cut. Refresh all twelve when none remain. Passing costs one step.",
    48: "Identify the three yellow wires in a single special action. A wrong non-red selection gives clues and costs just one step.",
    49: "Before cutting, give oxygen equal to the declared number to ONE teammate. Starting oxygen per player is 7/6/5/4 for 2/3/4/5 players. Passing costs a step. No talking underwater.",
    50: "Color markers and validation tracking are hidden after setup. Clues are announced once but not left attached to wires. Remember their locations.",
    51: "The director draws a number and nominates who must cut it. A nominee without it gives a clue and costs a step. Continue to the director's left. One extra detonator step.",
    52: "All clues are negative. Each player starts with two false clues. A failed cut marks its declared value as NOT the target's value.",
    53: "No detonator. Nano starts at 0. Each successful turn moves +1, or −1 if its cut matches Nano's current number. A failed cut moves +2. Reaching 12 explodes.",
    54: "Audio companion with personal oxygen and an eleven-red-wire reserve. Cuts cost depth 1/2/3 oxygen. Each validation grants one oxygen to everyone. Follow the recording for reserve changes.",
    55: "Complete public challenges to rewind the detonator one step per challenge.",
    56: "Each player has one reversed wire visible only to teammates. Cut your own reversed wire without equipment. Failing explodes. Targeting another player's reversed wire costs a step.",
    57: "Each validated number activates its paired constraint, replacing the previous one. Pass for free if blocked. A full blocked round explodes.",
    58: "No Info tokens, even after misses. Everyone's Double Detector recharges every turn.",
    59: "Nano starts on 7 in a shuffled number line. Cut its current value or move only forward to another value. Choose its direction afterwards. Passing costs a step and reverses Nano.",
    60: "Complete public challenges to rewind the detonator one step per challenge.",
    61: "Obey your personal constraint. Before the Captain's turn the team may rotate all constraints. Replace your constraint by a random F–L at the cost of one step. A full blocked round explodes.",
    62: "Validate any of the public reward numbers to rewind the detonator one step.",
    63: "The Captain starts with 14/18/24/30 oxygen for 2/3/4/5 players. Spend the cut value into reserve and pass ALL remaining oxygen left after your turn. The Captain collects reserve each round.",
    64: "Each player has two reversed wires, the lower at the far left and the higher at the far right. Cut your own without equipment. Failing explodes. Targeting a teammate's reversed wire costs one step.",
    65: "Cut only a value on your public Number cards. After each turn give one faceup card to a teammate. Validated cards turn face down. Passing when blocked costs one step. Requires 3–5 players.",
    66: "Audio finale. After each cut move in a direction whose constraint matches. On striped action cells a successful matching ACTION cut performs the announced action without moving. Follow the external official recording.",
}

CONSTRAINTS = {
    "A": "Cut only even blue values.", "B": "Cut only odd blue values.",
    "C": "Cut only blue values 1–6.", "D": "Cut only blue values 7–12.",
    "E": "Cut only blue values 4–9.", "F": "Do not cut blue values 4–9.",
    "G": "Do not use shared or personal equipment.",
    "H": "Do not target marked wires. Failed cuts involving you give no clue.",
    "I": "Do not target a teammate rack's rightmost uncut wire.",
    "J": "Do not target a teammate rack's leftmost uncut wire.",
    "K": "Do not Solo Cut.", "L": "Failed cuts cost two detonator steps.",
}

EQUIPMENT = {
    "not_equal": (1, "Label ≠", "Mark two adjacent different-valued wires in your racks."),
    "walkie_talkies": (2, "Walkie-Talkies", "Exchange one uncut wire with a teammate. Both incoming wires are re-sorted."),
    "triple_detector": (3, "Triple Detector", "Declare a blue value against three uncut wires on one teammate rack."),
    "post_it": (4, "Post-It", "Place a clue on one of your blue wires."),
    "super_detector": (5, "Super Detector", "Declare a blue value against all uncut wires on one teammate rack."),
    "rewinder": (6, "Rewinder", "Recover one detonator step."),
    "batteries": (7, "Emergency Batteries", "Recharge one or two used personal detectors."),
    "radar": (8, "General Radar", "Choose a number. Every rack reports whether it has an uncut wire of that value."),
    "stabilizer": (9, "Stabilizer", "Your next Dual Cut this turn cannot explode or advance the detonator."),
    "x_or_y": (10, "X or Y Ray", "Declare two values from your hand against one teammate wire."),
    "coffee": (11, "Coffee Mug", "Skip your turn and choose who acts next."),
    "equal": (12, "Label =", "Mark two adjacent equal-valued wires in your racks."),
    "false_bottom": (0, "False Bottom", "Instantly add two equipment cards when the first yellow pair is cut."),
    "single_label": (2, "Single Wire Label", "Mark a blue wire whose value occurs only once on that rack."),
    "emergency_drop": (3, "Emergency Drop", "At validation, instantly recharge all previously used equipment."),
    "fast_pass": (9, "Fast Pass", "Solo Cut two matching wires even when other copies remain."),
    "disintegrator": (10, "Disintegrator", "At validation, draw an available numbered clue and cut all wires of that number."),
    "grappling_hook": (11, "Grappling Hook", "Take a teammate's uncut wire and insert it into your rack."),
}

EQUIPMENT_BANS = {
    "not_equal": {52}, "walkie_talkies": {3, 20, 35},
    "post_it": {44, 45, 47, 49, 51, 54, 58, 59, 63, 65},
    "rewinder": {53}, "batteries": {27, 46, 58}, "stabilizer": {53},
    "x_or_y": {26, 44, 45, 47, 49, 51, 54, 59, 63, 65},
    "coffee": {3, 10, 45}, "equal": {3, 52},
    "false_bottom": {41}, "disintegrator": {57, 58},
}


def get_mission(number: int, player_count: int) -> Dict:
    if isinstance(number, bool) or not isinstance(number, int) or not 1 <= number <= MISSION_COUNT:
        raise ValueError("Bomb Busters mission must be an integer from 1 to 66")
    if not 2 <= player_count <= 5:
        raise ValueError("Bomb Busters requires 2 to 5 players")
    if number in (34, 65) and player_count == 2:
        raise ValueError(f"Mission {number} requires 3 to 5 players")
    setup = TWO_PLAYER_SETUPS.get(number, MISSION_SETUPS[number - 1]) if player_count == 2 else MISSION_SETUPS[number - 1]
    blue_max, yellow_count, yellow_pool, red_count, red_pool = setup
    if number == 41:
        yellow_count = yellow_pool = min(player_count, 4)
    result = {
        "id": number, "name": f"Mission {number:02d}", "blue_min": 1,
        "blue_max": blue_max, "copies_per_blue": 4,
        "yellow_count": yellow_count, "yellow_pool": yellow_pool,
        "red_count": red_count, "red_pool": red_pool,
        "color_max": blue_max - 1, "rules": MISSION_RULES[number],
        "audio_companion": number in AUDIO_MISSIONS,
        "min_players": 3 if number in (34, 65) else 2,
    }
    return copy.deepcopy(result)


if len(MISSION_SETUPS) != MISSION_COUNT or set(MISSION_RULES) != set(range(1, MISSION_COUNT + 1)):
    raise ValueError("Bomb Busters campaign catalog is incomplete")
