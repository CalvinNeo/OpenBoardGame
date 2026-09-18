from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class GameTag:
    tag_id: str
    label: str
    emoji: str
    description: str


# Keep this tuple in display order. Tags intentionally overlap: they describe both
# broad board-game families and useful table experiences/mechanisms.
GAME_TAGS: Tuple[GameTag, ...] = (
    GameTag("filler", "毛线", "🧶", "Light, quick, and easy to teach"),
    GameTag("push_your_luck", "赌狗", "🎰", "Push-your-luck, dice, or betting"),
    GameTag("puzzle", "解谜", "🧩", "Logic, deduction, or code breaking"),
    GameTag("euro", "德式", "⚙️", "Strategy, efficiency, and resource management"),
    GameTag("ameritrash", "美式", "💥", "Theme-first conflict or adventure"),
    GameTag("cooperative", "合作", "🤝", "Players work toward a shared victory"),
    GameTag("bluffing", "诈唬", "🎭", "Bluffing, hidden roles, or social deduction"),
    GameTag("trick_taking", "吃墩", "🃏", "Trick-taking or climbing card play"),
    GameTag("auction", "竞拍", "🔨", "Auctions, bidding, or market valuation"),
    GameTag("creative", "创意", "🎨", "Drawing, clues, words, or imagination"),
    GameTag("abstract", "抽象", "♟️", "Spatial or combinatorial strategy"),
)

GAME_TAG_BY_ID: Dict[str, GameTag] = {tag.tag_id: tag for tag in GAME_TAGS}
GAME_TAG_ORDER: Dict[str, int] = {tag.tag_id: index for index, tag in enumerate(GAME_TAGS)}


# Game IDs live here rather than in the browser so every client receives the same
# classification. The tuple order does not affect filtering; GAME_TAGS controls
# display order.
GAME_TAG_IDS: Dict[str, Tuple[str, ...]] = {
    "abraca_what": ("filler", "puzzle", "bluffing"),
    "acquire": ("euro", "auction"),
    "age_of_war": ("filler", "push_your_luck", "ameritrash"),
    "aidixit": ("filler", "creative"),
    "ark_nova": ("euro",),
    "azul": ("euro", "abstract"),
    "blitz_sketch": ("filler", "creative"),
    "blokus": ("abstract",),
    "bohnanza_dice": ("filler", "push_your_luck"),
    "bomb_busters": ("puzzle", "cooperative"),
    "cabo": ("filler", "puzzle", "bluffing"),
    "carcassonne": ("euro",),
    "cat_in_box": ("puzzle", "trick_taking"),
    "celestia": ("filler", "push_your_luck", "ameritrash"),
    "century_spice_road": ("euro",),
    "citadels": ("euro", "bluffing"),
    "coyote": ("filler", "push_your_luck", "bluffing"),
    "criminal_dance": ("filler", "bluffing"),
    "cyber_pictures": ("filler", "creative"),
    "davinci_code": ("filler", "puzzle"),
    "decrypto": ("puzzle", "creative"),
    "draw_guess": ("filler", "creative"),
    "dumb_questions": ("filler", "creative"),
    "emerald_skulls": ("filler", "push_your_luck", "auction"),
    "fake_artist": ("filler", "bluffing", "creative"),
    "fang_niao": ("filler",),
    "felix": ("filler", "bluffing", "auction"),
    "flip7": ("filler", "push_your_luck"),
    "forest_shuffle": ("euro",),
    "gizmos": ("euro",),
    "gold_rush": ("push_your_luck", "ameritrash"),
    "guandan": ("trick_taking",),
    "halli_galli": ("filler",),
    "hanabi": ("puzzle", "cooperative"),
    "high_society": ("filler", "auction"),
    "hot_streak": ("filler", "push_your_luck", "auction"),
    "impression_flower": ("filler", "creative"),
    "in_a_grove": ("filler", "puzzle", "bluffing"),
    "incan_gold": ("filler", "push_your_luck", "ameritrash"),
    "isle_of_skye": ("euro", "auction"),
    "istanbul": ("euro",),
    "kobayakawa": ("filler", "push_your_luck", "bluffing"),
    "kronologic": ("puzzle",),
    "lost_code": ("puzzle", "push_your_luck"),
    "manila": ("push_your_luck", "euro", "auction"),
    "nine_upper": ("filler", "bluffing", "creative"),
    "patchwork": ("euro", "abstract"),
    "perfect_mismatch": ("filler", "creative"),
    "point_salad": ("filler", "euro"),
    "poison": ("filler", "push_your_luck"),
    "project_l": ("euro", "abstract"),
    "ra": ("euro", "auction"),
    "rebel_princess": ("trick_taking",),
    "scout": ("filler", "trick_taking"),
    "six_nimmt": ("filler",),
    "skull": ("filler", "bluffing"),
    "splendor": ("euro",),
    "splendor_pokemon": ("euro",),
    "subtext": ("filler", "creative"),
    "tacta": ("filler", "abstract"),
    "tagiron": ("puzzle",),
    "texas_holdem": ("push_your_luck", "bluffing"),
    "the_gang": ("push_your_luck", "cooperative"),
    "things_in_rings": ("filler", "puzzle", "cooperative"),
    "trekking_history": ("euro",),
    "tucano": ("filler", "push_your_luck"),
    "turing_machine": ("puzzle",),
    "wandering_towers": ("filler", "euro", "ameritrash"),
    "wavelength": ("filler", "cooperative", "creative"),
    "witchs_brew": ("euro", "bluffing"),
    "wriggle_roulette": ("filler", "push_your_luck", "bluffing"),
    "word_decode": ("filler", "puzzle", "creative"),
    "yahtzee": ("filler", "push_your_luck"),
}


def get_game_tags(game_id: str) -> List[GameTag]:
    tag_ids = GAME_TAG_IDS.get(game_id, ())
    selected = set(tag_ids)
    return [tag for tag in GAME_TAGS if tag.tag_id in selected]


def serialize_game_tags(game_id: str) -> List[Dict[str, object]]:
    return [
        {
            "id": tag.tag_id,
            "label": tag.label,
            "emoji": tag.emoji,
            "description": tag.description,
            "order": GAME_TAG_ORDER[tag.tag_id],
        }
        for tag in get_game_tags(game_id)
    ]
