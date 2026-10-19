"""Dice Throne (Season One Rerolled) reference data.

The dictionaries in this module deliberately contain rules data only.  The
state machine in :mod:`game.dice_throne` is responsible for validating and
resolving these effects.  Ability conditions use symbol counts (swords,
hearts, powers / arrows, feet, moons); ``straight`` means distinct consecutive
die values.  Damage values are those of the level-I character sheets.
"""

RULES = {
    "max_health": 50,
    "starting_cp": 2,
    "starting_hand": 4,
    "max_hand": 6,
    "max_cp": 15,
    "roll_attempts": 3,
    "dice": 5,
    "first_turn_skips_income": True,
}

STATUSES = {
    "stun": {"name": "Stun", "icon": "💫", "limit": 1,
             "description": "Skip the next offensive roll phase; remove after it."},
    "concussion": {"name": "Concussion", "icon": "💥", "limit": 1,
                   "description": "Skip the next income phase; remove after it."},
    "targeted": {"name": "Targeted", "icon": "🎯", "limit": 1,
                 "description": "The next incoming attack deals +2 damage; then remove."},
    "entangle": {"name": "Entangle", "icon": "🪢", "limit": 1,
                 "description": "The next offensive roll loses one roll attempt; then remove."},
    "blind": {"name": "Blind", "icon": "🙈", "limit": 3,
              "description": "At the start of the next offensive attack roll one die; 1–2 makes the attack fail."},
    "evasive": {"name": "Evasive", "icon": "💨", "limit": 3,
                "description": "When taking damage, roll 1 die; on 1–2 evade that damage and spend one token."},
}


def _ability(id_, name, condition, description, damage=None, damage_type="normal",
             heal=None, self_status=None, opponent_status=None, extra=None):
    d = {"id": id_, "name": name, "condition": condition,
         "description": description, "damage": damage, "damage_type": damage_type,
         "heal": heal, "self_status": self_status or [],
         "opponent_status": opponent_status or []}
    if extra:
        d.update(extra)
    return d


BARBARIAN_ABILITIES = [
    _ability("smack", "Smack", {"counts": {"sword": 3}}, "3+ swords: deal 4/6/8 damage for 3/4/5 swords.", damage=4, extra={"scales": {"sword": [4, 6, 8]}}),
    _ability("sturdy_blow", "Sturdy Blow", {"counts": {"sword": 2, "power": 2}}, "2 swords + 2 powers: deal 4 undefendable damage.", damage=4, damage_type="undefendable"),
    _ability("mighty_blow", "Mighty Blow", {"straight": 4}, "Small straight (4 consecutive values): deal 9 damage.", damage=9),
    _ability("crit_bash", "Crit Bash", {"counts": {"power": 4}}, "4+ powers: deal 5 undefendable damage and inflict Stun.", damage=5, damage_type="undefendable", opponent_status=["stun"]),
    _ability("fortitude", "Fortitude", {"counts": {"heart": 3}}, "3/4/5 hearts: heal 4/5/6.", heal=4, extra={"scales": {"heart": [4, 5, 6]}}),
    _ability("overpower", "Overpower", {"counts": {"sword": 3, "power": 2}}, "3 swords + 2 powers: roll 3 dice for their sum as damage; 14+ also Concussion.", damage="sum3", opponent_status=["concussion"], extra={"concussion_if": 14}),
    _ability("reckless", "Reckless", {"straight": 5}, "Large straight: deal 15 damage and take 4 undefendable return damage.", damage=15, extra={"return_damage": 4, "return_damage_type": "undefendable"}),
    _ability("rage", "Rage", {"counts": {"power": 5}}, "5 powers: deal 15 ultimate damage and inflict Stun.", damage=15, damage_type="ultimate", opponent_status=["stun"]),
]

MOON_ELF_ABILITIES = [
    _ability("longbow", "Longbow", {"counts": {"arrow": 3}}, "3+ arrows: deal 4/5/7 damage for 3/4/5 arrows.", damage=4, extra={"scales": {"arrow": [4, 5, 7]}}),
    _ability("demising_shot", "Demising Shot", {"counts": {"arrow": 3, "moon": 2}}, "3 arrows + 2 moons: deal 4 damage and inflict Targeted.", damage=4, opponent_status=["targeted"]),
    _ability("entangling_shot", "Entangling Shot", {"straight": 4}, "Small straight: deal 7 damage and inflict Entangle.", damage=7, opponent_status=["entangle"]),
    _ability("eclipse", "Eclipse", {"counts": {"moon": 4}}, "4+ moons: deal 7 damage and inflict Blind, Entangle and Targeted.", damage=7, opponent_status=["blind", "entangle", "targeted"]),
    _ability("covered_shot", "Covered Shot", {"counts": {"arrow": 2, "foot": 3}}, "2 arrows + 3 feet: deal 7 damage and gain Evasive.", damage=7, self_status=["evasive"]),
    _ability("exploding_arrow", "Exploding Arrow", {"counts": {"arrow": 1, "moon": 3}}, "1 arrow + 3 moons: roll 5 dice; base 3 damage +1 per arrow/foot, destroy 1 CP per moon, and inflict Blind.", damage=3, opponent_status=["blind"], extra={"roll_five": True, "damage_per": {"arrow": 1, "foot": 1}, "destroy_cp_per": {"moon": 1}}),
    _ability("blinding_shot", "Blinding Shot", {"straight": 5}, "Large straight: deal 8 damage, inflict Blind and gain Evasive.", damage=8, self_status=["evasive"], opponent_status=["blind"]),
    _ability("lunar_eclipse", "Lunar Eclipse", {"counts": {"moon": 5}}, "5 moons: deal 12 ultimate damage, inflict Blind, Entangle and Targeted, and gain Evasive.", damage=12, damage_type="ultimate", self_status=["evasive"], opponent_status=["blind", "entangle", "targeted"]),
]

HEROES = {
    "barbarian": {
        "name": "Barbarian", "name_zh": "野蛮人", "icon": "🪓",
        "dice_faces": ["sword", "sword", "sword", "heart", "heart", "power"],
        "symbol_icons": {"sword": "⚔️", "heart": "❤️", "power": "💪"},
        "abilities": BARBARIAN_ABILITIES,
        "defense": {"id": "thick_skin", "name": "Thick Skin", "dice": 3,
                     "description": "Roll 3 dice; heal 2 for each heart."},
    },
    "moon_elf": {
        "name": "Moon Elf", "name_zh": "月精灵", "icon": "🌙",
        "dice_faces": ["arrow", "arrow", "arrow", "foot", "foot", "moon"],
        "symbol_icons": {"arrow": "➶", "foot": "👣", "moon": "🌙"},
        "abilities": MOON_ELF_ABILITIES,
        "defense": {"id": "missed_me", "name": "Missed Me", "dice": 5,
                     "description": "Roll 5 dice; return damage equal to floor(arrows/2). If 2+ feet, prevent half incoming damage."},
    },
}


# Universal cards are the 18 cards in each Season One character deck.  Hero
# cards below contain every named card (8 level-II/III upgrades and 4 actions)
# from the Barbarian and Moon Elf sheets; the engine may expose a curated
# subset while the remaining entries are retained for future completeness.
_UNIVERSAL = [
    ("transference", "Transference!", 2, "main", "Transfer 1 status token between two players."),
    ("what_status", "What Status Effects?", 2, "main", "Remove all status tokens from a chosen player."),
    ("vegas_baby", "Vegas Baby!", 0, "main", "Roll 1 die; gain half its value rounded up as CP."),
    ("get_outta_here", "Get That Outta Here!", 1, "main", "Remove 1 status token from a chosen player."),
    ("triple_up", "Triple Up!", 2, "instant", "Draw 3 cards."),
    ("double_up", "Double Up!", 1, "instant", "Draw 2 cards."),
    ("bye_bye", "Bye, Bye!", 2, "instant", "Remove 1 status token from a chosen player."),
    ("tip_it", "Tip It!", 1, "instant", "Increase or decrease any die by 1 (1 and 6 are bounds)."),
    ("getting_paid", "Getting Paid!", 0, "instant", "Gain 2 CP."),
    ("not_this_time", "Not This Time!", 1, "roll", "Prevent 6 incoming damage."),
    ("twice_as_wild", "Twice as Wild!", 3, "roll", "Change the values of any two dice."),
    ("try_try_again", "Try, Try Again!", 1, "roll", "Reroll up to two dice."),
    ("so_wild", "So Wild!", 2, "roll", "Change the value of any one die."),
    ("samesies", "Samesies!", 1, "roll", "Copy the value of one of your other dice."),
    ("one_more_time", "One More Time!", 1, "roll", "Gain one additional offensive roll attempt."),
    ("helping_hand", "Helping Hand!", 1, "roll", "Force an opponent's die to reroll."),
    ("better_d", "Better D!", 0, "roll", "Gain one additional defensive roll attempt."),
    ("six_it", "Six-It!", 1, "roll", "Change one of your dice to 6."),
]

CARDS = {sid: {"cardid": sid, "name": n, "cost": c,
               "timing": t, "target": "any_player", "effect": "text",
               "description": d, "hero": None, "copies": 1}
         for sid, n, c, t, d in _UNIVERSAL}


def _upgrade(hero, ability, level, cost, description):
    cid = f"{hero}_{ability}_{level}"
    return cid, {"cardid": cid, "name": f"{ability.replace('_', ' ').title()} {level}",
                 "cost": cost, "timing": "main", "target": "self", "effect": "upgrade",
                 "ability": ability, "level": level, "description": description,
                 "hero": hero, "copies": 1}


# Costs and names follow the character sheets.  Upgrade text is intentionally
# explicit so the UI can display it even when an individual resolver is added
# later.
_UPGRADES = [
    ("barbarian", "smack", 2, 2, "5/7/9 damage; 4+ matching dice becomes undefendable."),
    ("barbarian", "smack", 3, 3, "6/8/10 damage; 4+ matching dice becomes undefendable."),
    ("barbarian", "sturdy_blow", 2, 1, "5 undefendable damage."),
    ("barbarian", "sturdy_blow", 3, 1, "6 undefendable damage."),
    ("barbarian", "mighty_blow", 2, 2, "8 undefendable damage."),
    ("barbarian", "crit_bash", 2, 2, "5 undefendable damage and Stun; unlock Crit Smash."),
    ("barbarian", "fortitude", 2, 2, "Heal 5/6/7."),
    ("barbarian", "overpower", 2, 2, "Roll 3 dice for damage; 10+ also Concussion; unlock War Cry."),
    ("barbarian", "reckless", 2, 2, "Deal 20 damage and take 5 undefendable return damage."),
    ("barbarian", "thick_skin", 2, 3, "Heal twice the number of hearts rolled."),
    ("moon_elf", "longbow", 2, 2, "4/6/8 damage; 4+ matching dice inflicts Entangle."),
    ("moon_elf", "longbow", 3, 3, "5/7/9 damage; 3+ matching dice inflicts Entangle."),
    ("moon_elf", "demising_shot", 2, 2, "6 damage and Targeted; unlock Focus."),
    ("moon_elf", "covered_shot", 2, 1, "9 damage and Evasive; unlock Evasive Action."),
    ("moon_elf", "exploding_arrow", 2, 2, "Arrow adds 2 damage, foot adds 1; moon destroys 1 CP; Blind."),
    ("moon_elf", "exploding_arrow", 3, 3, "Arrow adds 2 damage, foot adds 1; moon destroys 1 CP; Blind and Entangle."),
    ("moon_elf", "entangling_shot", 2, 2, "9 damage and Entangle."),
    ("moon_elf", "blinding_shot", 2, 2, "10 damage, Blind and Evasive; unlock Lunar Blessing."),
    ("moon_elf", "eclipse", 2, 2, "9 damage and Blind, Entangle, Targeted; unlock Moon Shadow."),
    ("moon_elf", "missed_me", 2, 3, "Roll 5 dice; return floor(arrows/2), prevent half damage with 2+ feet."),
]
for h, a, level, c, d in _UPGRADES:
    cid, card = _upgrade(h, a, level, c, d)
    CARDS[cid] = card

_ACTIONS = [
    ("barbarian", "concuss", "Concuss!", 1, "main", "Inflict Concussion on a chosen opponent."),
    ("barbarian", "head_bash", "Head Bash!", 0, "roll", "After dealing 8+ damage, inflict Concussion."),
    ("barbarian", "get_some", "Get Some!", 2, "roll", "Roll 5 dice; add 1 damage per sword and inflict Concussion."),
    ("barbarian", "feelin_good", "Feelin' Good!", 0, "instant", "Roll 3 dice; heal 1 + 2 per heart."),
    ("moon_elf", "moon_magic", "Moon Magic!", 4, "main", "Gain Evasive; inflict Blind, Entangle and Targeted."),
    ("moon_elf", "take_that", "Take That!", 0, "roll", "Roll 1 die: arrow +2 damage, foot Entangle, moon Blind."),
    ("moon_elf", "get_some", "Get Some!", 2, "roll", "Roll 5 dice; add 1 damage per sword and inflict Concussion."),
    ("moon_elf", "feelin_good", "Feelin' Good!", 0, "instant", "Roll 3 dice; heal 1 + 2 per heart."),
]
for h, sid, name, cost, timing, desc in _ACTIONS:
    cid = f"{h}_{sid}"
    CARDS[cid] = {"cardid": cid, "name": name, "cost": cost, "timing": timing,
                   "target": "opponent" if h == "moon_elf" and sid != "feelin_good" else "self",
                   "effect": "text", "description": desc, "hero": h, "copies": 1}

DECKS = {
    "barbarian": [k for k, c in CARDS.items() if c["hero"] in (None, "barbarian")],
    "moon_elf": [k for k, c in CARDS.items() if c["hero"] in (None, "moon_elf")],
}

