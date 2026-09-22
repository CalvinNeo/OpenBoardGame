// Game assets are fetched only when entering that game. Keep URLs versioned when assets change.
const GAME_ASSETS = {
  "cheaty_mages": {
    "scripts": ["/static/games/cheaty_mages.js?v=2"],
    "styles": ["/static/cheaty_mages.css?v=1"],
    "markup": "/static/games/cheaty_mages.html?v=1",
    "panel": "cheatyMagesPanel",
    "header": "showCheatyMagesHeaderActions"
  },
  "las_vegas": {
    "scripts": ["/static/games/las_vegas.js?v=2"],
    "styles": ["/static/las_vegas.css?v=1"],
    "markup": "/static/games/las_vegas.html?v=1",
    "panel": "lasVegasPanel",
    "header": "showLasVegasHeaderActions"
  },
  "for_sale": {
    "scripts": ["/static/games/for_sale.js?v=1"],
    "styles": ["/static/for_sale.css?v=1"],
    "panel": "forSalePanel",
    "header": "showForSaleHeaderActions"
  },
  "blokus": {
    "scripts": [
      "/static/games/blokus.js?v=app_v6"
    ],
    "styles": [],
    "panel": "blokusPanel",
    "header": "showBlokusHeaderActions",
    "markup": "/static/games/blokus.html?v=1"
  },
  "carcassonne": {
    "scripts": [
      "/static/games/carcassonne.js?v=app_v6"
    ],
    "styles": [],
    "panel": "carcassonnePanel",
    "header": "showCarcassonneHeaderActions",
    "markup": "/static/games/carcassonne.html?v=1"
  },
  "azul": {
    "scripts": [
      "/static/games/azul.js?v=app_v5"
    ],
    "styles": [],
    "panel": "azulPanel",
    "header": "showAzulHeaderActions",
    "markup": "/static/games/azul.html?v=1"
  },
  "draw_guess": {
    "scripts": [
      "/static/games/draw_guess.js?v=app_v4"
    ],
    "styles": [],
    "panel": "drawGuessPanel",
    "markup": "/static/games/draw_guess.html?v=1"
  },
  "cyber_pictures": {
    "scripts": [
      "/static/games/cyber_pictures.js?v=app_v4"
    ],
    "styles": [],
    "panel": "cyberPicturesPanel",
    "markup": "/static/games/cyber_pictures.html?v=1"
  },
  "blitz_sketch": {
    "scripts": [
      "/static/games/blitz_sketch.js?v=app_v4"
    ],
    "styles": [],
    "panel": "blitzSketchPanel",
    "markup": "/static/games/blitz_sketch.html?v=1"
  },
  "fake_artist": {
    "scripts": [
      "/static/games/fake_artist.js?v=app_v4"
    ],
    "styles": [],
    "panel": "fakeArtistPanel",
    "header": "showFakeArtistHeaderActions",
    "markup": "/static/games/fake_artist.html?v=1"
  },
  "things_in_rings": {
    "scripts": [
      "/static/games/things_in_rings.js?v=app_v5"
    ],
    "styles": [],
    "panel": "thingsInRingsPanel",
    "header": "showThingsInRingsHeaderActions",
    "markup": "/static/games/things_in_rings.html?v=1"
  },
  "impression_flower": {
    "scripts": [
      "/static/games/impression_flower.js?v=app_v4"
    ],
    "styles": [],
    "panel": "impressionFlowerPanel",
    "markup": "/static/games/impression_flower.html?v=1"
  },
  "gizmos": {
    "scripts": [
      "/static/games/gizmos.js?v=app_v6"
    ],
    "styles": [
      "/static/gizmos.css?v=2"
    ],
    "panel": "gizmosPanel",
    "header": "showGizmosHeaderActions",
    "markup": "/static/games/gizmos.html?v=1"
  },
  "century_spice_road": {
    "scripts": [
      "/static/games/century_spice_road.js?v=app_v7"
    ],
    "styles": [],
    "panel": "centurySpiceRoadPanel",
    "header": "showCenturyHeaderActions",
    "markup": "/static/games/century_spice_road.html?v=1"
  },
  "splendor": {
    "scripts": [
      "/static/games/splendor.js?v=app_v4"
    ],
    "styles": [],
    "panel": "splendorPanel",
    "markup": "/static/games/splendor.html?v=1"
  },
  "splendor_pokemon": {
    "scripts": [
      "/static/games/splendor_pokemon.js?v=app_v6"
    ],
    "styles": [],
    "panel": "pokemonSplendorPanel",
    "header": "showPokemonSplendorHeaderActions",
    "markup": "/static/games/splendor_pokemon.html?v=1"
  },
  "project_l": {
    "scripts": [
      "/static/games/project_l.js?v=app_v4"
    ],
    "styles": [],
    "panel": "projectLPanel",
    "header": "showProjectLHeaderActions",
    "markup": "/static/games/project_l.html?v=1"
  },
  "decrypto": {
    "scripts": [
      "/static/games/decrypto.js?v=app_v4"
    ],
    "styles": [],
    "panel": "decryptoPanel",
    "header": "showDecryptoHeaderActions",
    "markup": "/static/games/decrypto.html?v=1"
  },
  "wavelength": {
    "scripts": [
      "/static/games/wavelength.js?v=app_v4"
    ],
    "styles": [],
    "panel": "wavelengthPanel",
    "header": "showWavelengthHeaderActions",
    "markup": "/static/games/wavelength.html?v=1"
  },
  "dumb_questions": {
    "scripts": [
      "/static/games/dumb_questions.js?v=app_v1"
    ],
    "styles": [],
    "panel": "dumbQuestionsPanel",
    "header": "showDumbQuestionsHeaderActions",
    "markup": "/static/games/dumb_questions.html?v=1"
  },
  "nine_upper": {
    "scripts": [
      "/static/games/nine_upper.js?v=app_v2"
    ],
    "styles": [],
    "panel": "nineUpperPanel",
    "header": "showNineUpperHeaderActions",
    "markup": "/static/games/nine_upper.html?v=1"
  },
  "word_decode": {
    "scripts": [
      "/static/games/word_decode.js?v=app_v4"
    ],
    "styles": [],
    "panel": "wordDecodePanel",
    "header": "showWordDecodeHeaderActions",
    "markup": "/static/games/word_decode.html?v=1"
  },
  "trekking_history": {
    "scripts": [
      "/static/games/trekking.js?v=app_v4"
    ],
    "styles": [],
    "panel": "trekkingPanel",
    "header": "showTrekkingHeaderActions",
    "markup": "/static/games/trekking_history.html?v=1"
  },
  "aidixit": {
    "scripts": [
      "/static/games/aidixit.js?v=app_v4"
    ],
    "styles": [],
    "panel": "aidixitPanel",
    "markup": "/static/games/aidixit.html?v=1"
  },
  "hanabi": {
    "scripts": [
      "/static/games/hanabi.js?v=app_v4"
    ],
    "styles": [],
    "panel": "hanabiPanel",
    "markup": "/static/games/hanabi.html?v=1"
  },
  "the_gang": {
    "scripts": [
      "/static/games/gang.js?v=app_v4"
    ],
    "styles": [],
    "panel": "theGangPanel",
    "header": "showGangHeaderActions",
    "markup": "/static/games/the_gang.html?v=1"
  },
  "cat_in_box": {
    "scripts": [
      "/static/games/cat_in_box.js?v=app_v5"
    ],
    "styles": [],
    "panel": "catInBoxPanel",
    "header": "showCatInBoxHeaderActions",
    "markup": "/static/games/cat_in_box.html?v=1"
  },
  "point_salad": {
    "scripts": [
      "/static/games/point_salad.js?v=app_v4"
    ],
    "styles": [],
    "panel": "pointSaladPanel",
    "header": "showPointSaladHeaderActions",
    "markup": "/static/games/point_salad.html?v=1"
  },
  "forest_shuffle": {
    "scripts": [
      "/static/games/forest_shuffle.js?v=app_v6"
    ],
    "styles": [],
    "panel": "forestShufflePanel",
    "header": "showForestShuffleHeaderActions",
    "markup": "/static/games/forest_shuffle.html?v=1"
  },
  "patchwork": {
    "scripts": [
      "/static/games/patchwork.js?v=app_v7"
    ],
    "styles": [],
    "panel": "patchworkPanel",
    "header": "showPatchworkHeaderActions",
    "markup": "/static/games/patchwork.html?v=1"
  },
  "isle_of_skye": {
    "scripts": [
      "/static/games/isle_of_skye.js?v=app_v6"
    ],
    "styles": [],
    "panel": "skyePanel",
    "header": "showSkyeHeaderActions",
    "markup": "/static/games/isle_of_skye.html?v=1"
  },
  "six_nimmt": {
    "scripts": [
      "/static/games/six_nimmt.js?v=app_v4"
    ],
    "styles": [],
    "panel": "sixNimmtPanel",
    "markup": "/static/games/six_nimmt.html?v=1"
  },
  "skull": {
    "scripts": [
      "/static/games/skull.js?v=app_v4"
    ],
    "styles": [],
    "panel": "skullPanel",
    "markup": "/static/games/skull.html?v=1"
  },
  "rebel_princess": {
    "scripts": [
      "/static/games/rebel_princess_hints.js?v=2",
      "/static/games/rebel_princess.js?v=app_v4"
    ],
    "styles": [
      "/static/rebel_princess.css?v=4"
    ],
    "panel": "rebelPrincessPanel",
    "markup": "/static/games/rebel_princess.html?v=1"
  },
  "guandan": {
    "scripts": [
      "/static/games/guandan.js?v=app_v13"
    ],
    "styles": [],
    "panel": "guandanPanel",
    "header": "showGuandanHeaderActions",
    "markup": "/static/games/guandan.html?v=1"
  },
  "cabo": {
    "scripts": [
      "/static/games/cabo.js?v=app_v8"
    ],
    "styles": [],
    "panel": "caboPanel",
    "markup": "/static/games/cabo.html?v=1"
  },
  "flip7": {
    "scripts": [
      "/static/games/flip7.js?v=app_v4"
    ],
    "styles": [],
    "panel": "flip7Panel",
    "markup": "/static/games/flip7.html?v=1"
  },
  "hot_streak": {
    "scripts": [
      "/static/games/hot_streak.js?v=app_v3"
    ],
    "styles": [],
    "panel": "hotStreakPanel",
    "header": "showHotStreakHeaderActions",
    "markup": "/static/games/hot_streak.html?v=1"
  },
  "acquire": {
    "scripts": [
      "/static/games/acquire.js?v=app_v1"
    ],
    "styles": [],
    "panel": "acquirePanel",
    "header": "showAcquireHeaderActions",
    "markup": "/static/games/acquire.html?v=1"
  },
  "abraca_what": {
    "scripts": [
      "/static/games/abraca_what.js?v=app_v4"
    ],
    "styles": [],
    "panel": "abracaPanel",
    "header": "showAbracaHeaderActions",
    "markup": "/static/games/abraca_what.html?v=1"
  },
  "fang_niao": {
    "scripts": [
      "/static/games/fang_niao.js?v=app_v4"
    ],
    "styles": [],
    "panel": "fangNiaoPanel",
    "header": "showFangNiaoHeaderActions",
    "markup": "/static/games/fang_niao.html?v=1"
  },
  "perfect_mismatch": {
    "scripts": [
      "/static/games/perfect_mismatch.js?v=app_v4"
    ],
    "styles": [],
    "panel": "mismatchPanel",
    "markup": "/static/games/perfect_mismatch.html?v=1"
  },
  "coyote": {
    "scripts": [
      "/static/games/coyote.js?v=app_v4"
    ],
    "styles": [],
    "panel": "coyotePanel",
    "markup": "/static/games/coyote.html?v=1"
  },
  "in_a_grove": {
    "scripts": [
      "/static/games/in_a_grove.js?v=app_v6"
    ],
    "styles": [],
    "panel": "inAGrovePanel",
    "header": "showInAGroveHeaderActions",
    "markup": "/static/games/in_a_grove.html?v=1"
  },
  "citadels": {
    "scripts": [
      "/static/games/citadels.js?v=app_v7"
    ],
    "styles": [],
    "panel": "citadelsPanel",
    "header": "showCitadelsHeaderActions",
    "markup": "/static/games/citadels.html?v=1"
  },
  "tagiron": {
    "scripts": [
      "/static/games/tagiron.js?v=app_v5"
    ],
    "styles": [],
    "panel": "tagironPanel",
    "header": "showTagironHeaderActions",
    "markup": "/static/games/tagiron.html?v=1"
  },
  "davinci_code": {
    "scripts": [
      "/static/games/davinci_code.js?v=app_v4"
    ],
    "styles": [],
    "panel": "davinciCodePanel",
    "header": "showDaVinciCodeHeaderActions",
    "markup": "/static/games/davinci_code.html?v=1"
  },
  "lost_code": {
    "scripts": [
      "/static/games/lost_code.js?v=app_v4"
    ],
    "styles": [],
    "panel": "lostCodePanel",
    "header": "showLostCodeHeaderActions",
    "markup": "/static/games/lost_code.html?v=1"
  },
  "criminal_dance": {
    "scripts": [
      "/static/games/criminal_dance.js?v=app_v5"
    ],
    "styles": ["/static/criminal_dance.css?v=1"],
    "panel": "criminalDancePanel",
    "header": "showCriminalDanceHeaderActions",
    "markup": "/static/games/criminal_dance.html?v=2"
  },
  "turing_machine": {
    "scripts": [
      "/static/games/turing_machine.js?v=app_v6"
    ],
    "styles": [],
    "panel": "turingMachinePanel",
    "header": "showTuringMachineHeaderActions",
    "markup": "/static/games/turing_machine.html?v=1"
  },
  "kronologic": {
    "scripts": [
      "/static/games/kronologic.js?v=app_v3"
    ],
    "styles": [],
    "panel": "kronologicPanel",
    "header": "showKronologicHeaderActions",
    "markup": "/static/games/kronologic.html?v=1"
  },
  "halli_galli": {
    "scripts": [
      "/static/games/halli_galli.js?v=app_v4"
    ],
    "styles": [],
    "panel": "halliPanel",
    "markup": "/static/games/halli_galli.html?v=1"
  },
  "texas_holdem": {
    "scripts": [
      "/static/games/texas_holdem.js?v=app_v4"
    ],
    "styles": [],
    "panel": "texasHoldemPanel",
    "markup": "/static/games/texas_holdem.html?v=1"
  },
  "yahtzee": {
    "scripts": [
      "/static/games/yahtzee.js?v=app_v4"
    ],
    "styles": [],
    "panel": "yahtzeePanel",
    "markup": "/static/games/yahtzee.html?v=1"
  },
  "istanbul": {
    "scripts": [
      "/static/games/istanbul_hints.js?v=1",
      "/static/games/istanbul.js?v=3"
    ],
    "styles": [
      "/static/istanbul.css?v=2"
    ],
    "panel": "istanbulPanel",
    "header": "showIstanbulHeaderActions",
    "markup": "/static/games/istanbul.html?v=1"
  },
  "gold_rush": {
    "scripts": [
      "/static/games/gold_rush.js?v=app_v4"
    ],
    "styles": [],
    "panel": "goldRushPanel",
    "header": "showGoldRushHeaderActions",
    "markup": "/static/games/gold_rush.html?v=1"
  },
  "age_of_war": {
    "scripts": [
      "/static/games/age_of_war.js?v=app_v5"
    ],
    "styles": [],
    "panel": "ageOfWarPanel",
    "header": "showAgeOfWarHeaderActions",
    "markup": "/static/games/age_of_war.html?v=1"
  },
  "wandering_towers": {
    "scripts": [
      "/static/games/wandering_towers.js?v=app_v10"
    ],
    "styles": [],
    "panel": "wanderingTowersPanel",
    "header": "showWanderingTowersHeaderActions",
    "markup": "/static/games/wandering_towers.html?v=1"
  },
  "incan_gold": {
    "scripts": [
      "/static/games/incan_gold.js?v=app_v4"
    ],
    "styles": [],
    "panel": "incanGoldPanel",
    "markup": "/static/games/incan_gold.html?v=1"
  },
  "celestia": {
    "scripts": [
      "/static/games/celestia.js?v=app_v2"
    ],
    "styles": [],
    "panel": "celestiaPanel",
    "header": "showCelestiaHeaderActions",
    "markup": "/static/games/celestia.html?v=1"
  },
  "manila": {
    "scripts": [
      "/static/games/manila.js?v=app_v4"
    ],
    "styles": [],
    "panel": "manilaPanel",
    "header": "showManilaHeaderActions",
    "markup": "/static/games/manila.html?v=1"
  },
  "kobayakawa": {
    "scripts": [
      "/static/games/kobayakawa.js?v=app_v4"
    ],
    "styles": [],
    "panel": "kobayakawaPanel",
    "markup": "/static/games/kobayakawa.html?v=1"
  },
  "high_society": {
    "scripts": [
      "/static/games/high_society.js?v=app_v1"
    ],
    "styles": [],
    "panel": "highSocietyPanel",
    "header": "showHighSocietyHeaderActions",
    "markup": "/static/games/high_society.html?v=1"
  },
  "poison": {
    "scripts": [
      "/static/games/poison.js?v=app_v1"
    ],
    "styles": [],
    "panel": "poisonPanel",
    "header": "showPoisonHeaderActions",
    "markup": "/static/games/poison.html?v=1"
  },
  "bohnanza_dice": {
    "scripts": [
      "/static/games/bohnanza_dice.js?v=app_v8"
    ],
    "styles": [],
    "panel": "bohnanzaDicePanel",
    "header": "showBohnanzaDiceHeaderActions",
    "markup": "/static/games/bohnanza_dice.html?v=1"
  },
  "emerald_skulls": {
    "scripts": [
      "/static/games/emerald_skulls.js?v=app_v3"
    ],
    "styles": [],
    "panel": "emeraldSkullsPanel",
    "header": "showEmeraldSkullsHeaderActions",
    "markup": "/static/games/emerald_skulls.html?v=1"
  },
  "wriggle_roulette": {
    "scripts": [
      "/static/games/wriggle_roulette.js?v=app_v1"
    ],
    "styles": [],
    "panel": "wriggleRoulettePanel",
    "header": "showWriggleRouletteHeaderActions",
    "markup": "/static/games/wriggle_roulette.html?v=1"
  },
  "catan_starfarers": {
    "scripts": [
      "/static/games/catan_starfarers.js?v=app_v4"
    ],
    "styles": [
      "/static/catan_starfarers.css?v=app_v4"
    ],
    "panel": "catanStarfarersPanel",
    "header": "showCatanStarfarersHeaderActions",
    "markup": "/static/games/catan_starfarers.html?v=1"
  },
  "take_time": {
    "scripts": [
      "/static/games/take_time.js?v=2"
    ],
    "styles": [
      "/static/take_time.css?v=2"
    ],
    "panel": "takeTimePanel",
    "header": "showTakeTimeHeaderActions",
    "markup": "/static/games/take_time.html?v=1"
  },
  "eternal_decks": {
    "scripts": [
      "/static/games/eternal_decks.js?v=1"
    ],
    "styles": [
      "/static/eternal_decks.css?v=1"
    ],
    "panel": "eternalDecksPanel",
    "header": "showEternalDecksHeaderActions",
    "markup": "/static/games/eternal_decks.html?v=1"
  },
  "ponzi_scheme": {
    "scripts": [
      "/static/games/ponzi_scheme.js?v=2"
    ],
    "styles": [
      "/static/ponzi_scheme.css?v=1"
    ],
    "panel": "ponziSchemePanel",
    "header": "showPonziSchemeHeaderActions",
    "markup": "/static/games/ponzi_scheme.html?v=1"
  },
  "red_doors": {
    "scripts": [
      "/static/games/red_doors.js?v=4"
    ],
    "styles": [
      "/static/red_doors.css?v=3"
    ],
    "panel": "redDoorsPanel",
    "header": "showRedDoorsHeaderActions",
    "markup": "/static/games/red_doors.html?v=1"
  },
  "cryptid": {
    "scripts": [
      "/static/games/cryptid.js?v=4"
    ],
    "styles": [
      "/static/cryptid.css?v=3"
    ],
    "panel": "cryptidPanel",
    "header": "showCryptidHeaderActions",
    "markup": "/static/games/cryptid.html?v=1"
  },
  "boomerang_australia": {
    "scripts": [
      "/static/games/boomerang_australia.js?v=2"
    ],
    "styles": [
      "/static/boomerang_australia.css?v=1"
    ],
    "panel": "boomerangAustraliaPanel",
    "header": "showBoomerangAustraliaHeaderActions"
  },
  "spirit_island": {
    "scripts": [
      "/static/games/spirit_island_map.js?v=1",
      "/static/games/spirit_island_navigation.js?v=1",
      "/static/games/spirit_island.js?v=3"
    ],
    "styles": [
      "/static/spirit_island.css?v=2"
    ],
    "panel": "spiritIslandPanel",
    "header": "showSpiritIslandHeaderActions"
  },
  "terra_nova": {
    "scripts": [
      "/static/games/terra_nova.js?v=1"
    ],
    "styles": [
      "/static/terra_nova.css?v=1"
    ],
    "panel": "terraNovaPanel",
    "header": "showTerraNovaHeaderActions"
  },
  "bomb_busters": {
    "scripts": [
      "/static/games/bomb_busters.js?v=app_v2"
    ],
    "styles": [],
    "panel": "bombBustersPanel",
    "header": "showBombBustersHeaderActions",
    "markup": "/static/games/bomb_busters.html?v=1"
  },
  "felix": {
    "scripts": [
      "/static/games/felix.js?v=app_v1"
    ],
    "styles": [],
    "panel": "felixPanel",
    "header": "showFelixHeaderActions",
    "markup": "/static/games/felix.html?v=1"
  },
  "tacta": {
    "scripts": [
      "/static/games/tacta.js?v=app_v7"
    ],
    "styles": [],
    "panel": "tactaPanel",
    "header": "showTactaHeaderActions",
    "markup": "/static/games/tacta.html?v=1"
  },
  "subtext": {
    "scripts": [
      "/static/games/subtext.js?v=app_v1"
    ],
    "styles": [],
    "panel": "subtextPanel",
    "header": "showSubtextHeaderActions",
    "markup": "/static/games/subtext.html?v=1"
  },
  "tucano": {
    "scripts": [
      "/static/games/tucano.js?v=app_v2"
    ],
    "styles": [
      "/static/tucano.css?v=app_v2"
    ],
    "panel": "tucanoPanel",
    "header": "showTucanoHeaderActions",
    "markup": "/static/games/tucano.html?v=1"
  },
  "witchs_brew": {
    "scripts": [
      "/static/games/witchs_brew.js?v=app_v1"
    ],
    "styles": [],
    "panel": "witchsBrewPanel",
    "header": "showWitchsBrewHeaderActions",
    "markup": "/static/games/witchs_brew.html?v=1"
  },
  "ra": {
    "scripts": [
      "/static/games/ra.js?v=app_v7"
    ],
    "styles": [],
    "panel": "raPanel",
    "header": "showRaHeaderActions",
    "markup": "/static/games/ra.html?v=1"
  },
  "scout": {
    "scripts": [
      "/static/games/scout.js?v=app_v4"
    ],
    "styles": [],
    "panel": "scoutPanel",
    "header": "showScoutHeaderActions",
    "markup": "/static/games/scout.html?v=1"
  },
  "ark_nova": {
    "scripts": [
      "/static/games/ark_nova.js?v=app_v24"
    ],
    "styles": [
      "/static/ark_nova.css?v=app_v21"
    ],
    "panel": "arkNovaPanel",
    "header": "showArkNovaHeaderActions"
  },
  "gaia_project": {
    "scripts": [
      "/static/games/gaia_project.js?v=gaia_v4"
    ],
    "styles": [
      "/static/gaia_project.css?v=gaia_v3"
    ],
    "panel": "gaiaProjectPanel",
    "header": "showGaiaProjectHeaderActions"
  },
  "castles_of_burgundy": {
    "scripts": [
      "/static/games/castles_of_burgundy.js?v=2"
    ],
    "styles": [
      "/static/castles_of_burgundy.css?v=2"
    ],
    "panel": "burgundyPanel",
    "header": "showBurgundyHeaderActions"
  },
  "love_letter": {
    "scripts": [
      "/static/games/love_letter.js?v=2"
    ],
    "styles": [
      "/static/love_letter.css?v=1"
    ],
    "panel": "loveLetterPanel",
    "header": "showLoveLetterHeaderActions"
  }
};

const gameAssetLoads = new Map();
const loadedGameAssets = new Set();
const gameAssetErrors = new Map();
const gameResourceLoads = new Map();

function isGameAssetsLoaded(gameType) {
  return loadedGameAssets.has(gameType);
}

function syncGameAssetsStatus(gameType) {
  const status = document.getElementById("gameAssetsStatus");
  const message = document.getElementById("gameAssetsMessage");
  const retry = document.getElementById("gameAssetsRetryBtn");
  const pending = Boolean(gameType) && !isGameAssetsLoaded(gameType);
  const failed = gameAssetErrors.has(gameType);
  status.classList.toggle("hidden", !pending);
  status.classList.toggle("room-feedback-error", failed);
  message.textContent = failed ? "Could not load this game. Check your connection and retry." : "Loading game...";
  retry.classList.toggle("hidden", !failed);
}

function loadGameResource(url, type) {
  if (gameResourceLoads.has(url)) return gameResourceLoads.get(url);
  const request = new Promise((resolve, reject) => {
    const element = document.createElement(type === "style" ? "link" : "script");
    if (type === "style") {
      element.rel = "stylesheet";
      element.href = url;
    } else {
      element.src = url;
      element.async = false;
    }
    element.onload = () => resolve();
    element.onerror = () => {
      element.remove();
      reject(new Error(`Could not load ${url}`));
    };
    document.head.appendChild(element);
  }).catch((error) => {
    gameResourceLoads.delete(url);
    throw error;
  });
  gameResourceLoads.set(url, request);
  return request;
}

function loadGameMarkup(url) {
  if (gameResourceLoads.has(url)) return gameResourceLoads.get(url);
  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
      const source = document.createElement("template");
      source.innerHTML = await response.text();
      const fragments = Array.from(source.content.children);
      // Validate the complete response before touching the live DOM (including HTML fallbacks).
      if (!fragments.length || fragments.some((fragment) =>
        fragment.tagName !== "TEMPLATE" || !fragment.dataset.gameTarget ||
        !["contents", "replace"].includes(fragment.dataset.gameMode) ||
        !document.getElementById(fragment.dataset.gameTarget)
      )) throw new Error(`Invalid game interface: ${url}`);
      fragments.forEach((fragment) => {
        const target = document.getElementById(fragment.dataset.gameTarget);
        if (fragment.dataset.gameMode === "contents") target.replaceChildren(fragment.content);
        else target.replaceWith(fragment.content);
      });
    } finally {
      window.clearTimeout(timeout);
    }
  })().catch((error) => {
    gameResourceLoads.delete(url);
    throw error;
  });
  gameResourceLoads.set(url, request);
  return request;
}

function ensureGameAssets(gameType) {
  if (isGameAssetsLoaded(gameType)) return Promise.resolve();
  if (gameAssetLoads.has(gameType)) return gameAssetLoads.get(gameType);
  gameAssetErrors.delete(gameType);
  const request = (async () => {
    const assets = GAME_ASSETS[gameType];
    if (!assets) throw new Error(`Unknown game: ${gameType}`);
    // DOM and styles must exist before legacy game scripts bind their controls.
    await Promise.all([
      ...(assets.markup ? [loadGameMarkup(assets.markup)] : []),
      ...assets.styles.map((url) => loadGameResource(url, "style")),
    ]);
    // Keep each game's helpers ahead of its entry point, including on retries.
    for (const url of assets.scripts) await loadGameResource(url, "script");
    loadedGameAssets.add(gameType);
  })().catch((error) => {
    gameAssetLoads.delete(gameType);
    gameAssetErrors.set(gameType, error);
    throw error;
  }).finally(() => {
    if (typeof currentGameType !== "undefined") syncGameAssetsStatus(currentGameType);
  });
  gameAssetLoads.set(gameType, request);
  if (typeof currentGameType !== "undefined") syncGameAssetsStatus(currentGameType);
  return request;
}

document.getElementById("gameAssetsRetryBtn").addEventListener("click", () => {
  if (currentRoomState) renderRoomState(currentRoomState);
});
