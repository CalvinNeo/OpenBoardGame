(() => {
  "use strict";
  const root = document.querySelector(".dice-throne-shell");
  if (!root) return;
  const gamePanel = root.closest(".game-panel");
  const gameHeading = gamePanel?.querySelector(".game-panel-title h2");
  let previousGameTitle = null;
  const $ = id => document.getElementById(`diceThrone${id}`);
  let view = null;
  let pending = false;
  let selected = null;
  let explainMode = false;
  let tipTimer = null;
  let focusBeforeDialog = null;
  let pointerStart = null;
  let blockedPointer = false;
  let suppressUntil = 0;
  let layoutFrame = null;
  const activity = [];
  let activityLegend = "Public activity: Health (❤️), Combat Points (⚡), Cards (🃏), Damage (🗡️).";

  // One vocabulary for the board, Help, Explain and icon tooltips.
  const terms = {
    health: ["Health", "❤️", "Your remaining life. A hero at 0 Health is knocked out."],
    cp: ["Combat Points", "⚡", "CP pays for cards; maximum 15. Sell a card to gain 1 CP."],
    card: ["Cards", "🃏", "Your hand is private. Only the opponent's hand count is public; maximum 6 cards."],
    sword: ["Sword", "⚔️", "Barbarian die symbol, used in attack patterns."],
    heart: ["Heart", "❤️", "Barbarian die symbol, used by Fortitude and Thick Skin."],
    power: ["Power", "💪", "Barbarian die symbol, used in heavy attacks."],
    arrow: ["Arrow", "🏹", "Moon Elf die symbol, used in ranged attacks."],
    foot: ["Foot", "👣", "Moon Elf die symbol, used in Covered Shot and defense."],
    moon: ["Moon", "🌙", "Moon Elf die symbol, used in magical attacks."],
    damage: ["Damage", "🗡️", "Reduces the defender's Health after the response is resolved."],
    heal: ["Healing", "💚", "Restores your Health, up to 50."],
    defense: ["Defense", "🛡️", "Resolve your hero's defensive roll before incoming damage, or pass to take the attack."],
    ultimate: ["Ultimate", "👑", "A five-symbol ability whose damage cannot be defended or prevented."],
    upgrade: ["Upgrade", "⬆️", "Play a hero upgrade card in a main phase to improve the matching ability. See its current effect in Abilities."],
    dice: ["Dice", "🎲", "Roll five dice, normally up to three attempts. Statuses and cards can change the limit shown on the tray. Keep individual dice between rolls."],
    kept: ["Kept", "🔒", "This die will stay unchanged on your next roll. Click it again to release it."],
    main: ["Main", "🧭", "Printed card timing: main phase."],
    roll: ["Roll", "🎲", "Printed card timing: roll phase."],
    instant: ["Instant", "✨", "Printed card timing: instant."],
  };
  const heroes = {};
  const abilityCatalog = {};
  let activeTab = "abilities";
  const listScroll = {abilities: 0, hand: 0};
  const phases = {
    choose_hero: "Choose a hero", main_1: "Main I", offensive_roll: "Offensive roll",
    targeting: "Choose an ability", defensive_roll: "Defense", main_2: "Main II",
    round_review: "Round review", game_over: "Game over",
  };
  const wordKeys = {
    health: "health", cp: "cp", "combat points": "cp", cards: "card", card: "card",
    sword: "sword", swords: "sword", heart: "heart", hearts: "heart", power: "power", powers: "power",
    arrow: "arrow", arrows: "arrow", foot: "foot", feet: "foot", moon: "moon", moons: "moon",
    stun: "stun", concussion: "concussion", targeted: "targeted", entangle: "entangle",
    blind: "blind", evasive: "evasive", damage: "damage", heal: "heal", healing: "heal",
    ultimate: "ultimate", upgrade: "upgrade", upgrades: "upgrade", dice: "dice", die: "dice",
  };
  let wordPattern = new RegExp(`\\b(${Object.keys(wordKeys).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
  const termFor = key => terms[key] || [String(key).replaceAll("_", " "), "✦", "Hero symbol or status."];
  const named = key => `${termFor(key)[0]} (${termFor(key)[1]})`;
  function syncCatalog(next) {
    Object.entries(next.hero_catalog || {}).forEach(([id, hero]) => {
      heroes[id] = {...hero, faces: [...new Set(hero.dice_faces || [])]};
      Object.entries(hero.symbol_icons || {}).forEach(([key, icon]) => {
        const name = (hero.symbol_names?.[key] || key.replaceAll("_", " ")).split(" · ")[0];
        if (!terms[key]) terms[key] = [name, icon, `${hero.name} die symbol, used in ability patterns and defense.`];
        wordKeys[name.toLowerCase()] = key;
      });
      (hero.abilities || []).forEach(ability => { abilityCatalog[ability.id] = ability; });
    });
    Object.entries(next.status_catalog || {}).forEach(([id, status]) => {
      terms[id] = [status.name, status.icon, status.description];
      wordKeys[status.name.toLowerCase()] = id;
    });
    (next.abilities || []).forEach(ability => { abilityCatalog[ability.id] = {...abilityCatalog[ability.id], ...ability}; });
    activityLegend = `Public activity: Health (❤️), Combat Points (⚡), Cards (🃏), Damage (🗡️). Dice symbols: ${[...new Set(Object.values(heroes).flatMap(hero => hero.faces))].map(named).join(", ")}.`;
    wordPattern = new RegExp(`\\b(${Object.keys(wordKeys).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
  }
  const heroName = id => heroes[id] ? `${heroes[id].name} (${heroes[id].icon})` : "Hero not chosen";
  const labelPlayer = id => view?.players?.find(player => player.player_id === id)?.name || id || "Player";
  const ownPlayer = () => view?.players?.find(player => player.player_id === view.you);
  const legal = type => Boolean(view && !pending && view.legal_actions?.includes(type));
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function describe(node, title, body, tooltip = false) {
    node.dataset.dtExplain = title;
    node.dataset.dtDescription = body;
    if (tooltip) node.dataset.dtTip = `${title} — ${body}`;
    return node;
  }
  function token(key, text) {
    const term = termFor(key);
    return describe(el("span", `dt-token dt-tone-${key}`, text || `${term[1]} ${term[0]}`), named(key), term[2], true);
  }
  function richText(node, text) {
    let offset = 0;
    for (const match of String(text || "").matchAll(wordPattern)) {
      node.append(document.createTextNode(text.slice(offset, match.index)));
      node.append(token(wordKeys[match[0].toLowerCase()]));
      offset = match.index + match[0].length;
    }
    node.append(document.createTextNode(String(text || "").slice(offset)));
    return node;
  }
  function namedText(text) {
    return String(text || "").replace(wordPattern, word => named(wordKeys[word.toLowerCase()]));
  }
  function button(text, className, action, description) {
    const node = el("button", className, text);
    node.type = "button";
    if (description) describe(node, text, description);
    node.addEventListener("click", event => {
      event.stopPropagation();
      action();
    });
    return node;
  }
  function send(action) {
    if (!legal(action.type)) return;
    hideTip();
    action.revision = view.revision;
    pending = true;
    selected = null;
    render();
    if (typeof sendAction === "function") sendAction(action);
    else if (typeof socket !== "undefined") socket.emit("game:action", {room_id: typeof roomId !== "undefined" ? roomId : null, action});
  }
  function openDialog(title, content) {
    hideTip();
    const dialog = $("Dialog");
    focusBeforeDialog = document.activeElement;
    $("DialogTitle").textContent = title;
    $("DialogBody").replaceChildren(typeof content === "string" ? el("p", "", content) : content);
    if (!dialog.open) dialog.showModal();
    $("DialogClose").focus();
  }
  function setExplain(value) {
    explainMode = value;
    root.classList.toggle("dt-explaining", value);
    $("ExplainBtn").setAttribute("aria-pressed", String(value));
    $("ExplainNotice").classList.toggle("hidden", !value);
    hideTip();
    scheduleMobileLayout();
  }
  function scheduleMobileLayout() {
    if (layoutFrame != null) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      if (!view || root.clientWidth >= 600 || $("Arena").classList.contains("hidden")) {
        root.style.removeProperty("--dt-list-height");
        return;
      }
      const list = activeTab === "hand" ? $("Hand") : $("AbilityList");
      // Use document position, so scrolling the page never resizes its content.
      // Reserve room for the collapsed log and bottom padding, while allowing
      // very short screens to scroll rather than squeezing cards unreadably.
      const listTop = list.getBoundingClientRect().top + window.scrollY;
      const viewportHeight = window.visualViewport?.height || innerHeight;
      const height = Math.max(168, Math.min(340, Math.floor(viewportHeight - listTop - 44)));
      root.style.setProperty("--dt-list-height", `${height}px`);
    });
  }
  function showTip(node, temporary = false) {
    if (!node?.dataset.dtTip || explainMode) return;
    clearTimeout(tipTimer);
    const box = $("Tooltip");
    box.textContent = node.dataset.dtTip;
    box.classList.remove("hidden");
    const rect = node.getBoundingClientRect();
    const bounds = box.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left))}px`;
    box.style.top = `${rect.bottom + bounds.height + 16 < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - bounds.height - 6)}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    $("Tooltip").classList.add("hidden");
  }
  function requirement(id) {
    const node = el("div", "dt-requirement");
    const condition = abilityCatalog[id]?.condition || {};
    if (condition.straight) {
      node.append(token("dice", `🎲 ${condition.straight}-straight`));
    } else {
      Object.entries(condition.counts || {}).forEach(([key, count]) => node.append(token(key, `${termFor(key)[1]} ×${count}`)));
    }
    return node;
  }
  function conditionText(id) {
    const condition = abilityCatalog[id]?.condition || {};
    if (condition.straight) return `${condition.straight} consecutive values on Dice (🎲).`;
    return Object.entries(condition.counts || {}).map(([key, count]) => `${count} ${named(key)}`).join(" + ");
  }
  function helpContent() {
    const content = el("div", "dt-rules");
    function section(title, text) {
      const node = el("section", "dt-rule-section");
      node.append(el("h3", "", title), el("p", "", text));
      content.append(node);
      return node;
    }
    section("The duel", `Choose two different heroes from the eight Season One Rerolled champions: ${Object.keys(heroes).map(heroName).join(", ")}. Start at 50 ${named("health")}, 2 ${named("cp")} and 4 ${named("card")}. Reduce your opponent to 0 Health (❤️) to win. Final results remain visible.`);
    section("This digital edition", nextEditionText());
    section("1 · Main I", "Play or sell Cards (🃏), then Start rolling. Select a card to reveal its in-place Play / Sell / Cancel overlay. Selling gains 1 Combat Point (⚡). Main (🧭) cards are used in a main phase; Roll (🎲) cards modify rolled dice; Instant (✨) cards can be used when their listed timing permits. Hover an unavailable card or its Play button to see the reason. On a phone, tap the card or muted Play button for a three-second tooltip; each new tap replaces the previous tip. If a target, die, value or status is still required, Play explains the missing choice. Hero decks and discards are separate, and only your own hand is visible.");
    section("2 · Roll → attack", "Roll five Dice (🎲), up to three attempts. Tap a die to Keep (🔒) or release it. Each die shows its number and symbol. Confirm the roll, choose a matching ability, then confirm on its overlay. Abilities have no Combat Points (⚡) cost. Skip attack advances without attacking. Abilities and Hand share one panel; switch tabs to consult either without scrolling the page.");
    section("3 · Defense", "Normal Damage (🗡️) allows the defender to use the hero's Defense (🛡️), or Pass. After Defend, the dice tray shows the actual defense Dice (🎲), final Damage (🗡️) taken, damage blocked by the roll, and any Healing (💚), Combat Points (⚡), status gains or total return damage. This result stays through Main II and round review until the next turn, including after reconnect. Pass does not roll defense dice. Each hero's defensive dice and effects are listed below. Undefendable damage skips the defensive roll; Ultimate (👑) damage also ignores prevention. The defender acknowledges these attacks with Pass. Roll (🎲) and Instant (✨) cards follow the available action window, with no cards allowed after an Ultimate is confirmed. Status tokens resolve as described in the glossary. The attack and defensive roll remain in the public battle log.");
    section("4 · Main II → review", "Play or sell cards, then Finish turn. Both players confirm Next Round after reviewing the turn; Bots confirm automatically. The other hero then takes the next turn, receiving 1 Combat Point (⚡) and drawing 1 Card (🃏), except for the opening turn. Health (❤️) is capped at 50 and CP at 15. This digital edition limits the hand to 6 cards on draw, and reshuffles only that hero's own discard pile when its deck runs out.");
    const legend = section("Symbols & colors", "The same symbols, names and colors are used on the board, in tooltips and in Explain.");
    const grid = el("div", "dt-legend");
    Object.keys(terms).forEach(key => {
      const item = el("div", "dt-legend-item");
      item.append(token(key, named(key)), el("p", "", namedText(terms[key][2])));
      grid.append(item);
    });
    legend.append(grid);
    for (const [id, hero] of Object.entries(heroes)) {
      const details = el("details", "dt-rule-section");
      details.append(el("summary", "", `${heroName(id)} · ability reference`));
      details.append(el("p", "", `${hero.name_zh || hero.name} · ${hero.subtitle}`));
      details.append(heroFaceReference(hero));
      const defense = hero.defense;
      if (defense) details.append(el("p", "", `Defense (🛡️) · ${defense.name}: ${namedText(defense.description || "")} (${defense.dice} Dice 🎲)`));
      const ids = (hero.abilities || []).map(ability => ability.id);
      ids.forEach(key => {
        const ability = abilityCatalog[key];
        const entry = el("div", "dt-rule-ability");
        entry.append(el("strong", "", ability.name), el("p", "", `Pattern: ${conditionText(key)}`), richText(el("p"), ability.description));
        details.append(entry);
      });
      content.append(details);
    }
    section("Controls", "Click a hero's name on either player panel or in the hero picker to see all six numbered Dice (🎲) faces, including repeated symbols. Close or Esc returns to the board. On phones, status tokens show symbols and counts; tap for their names and effects. The current phase remains in the phase strip, and Battle log contains the detailed activity. Abilities and Hand use the remaining screen height and scroll inside their panel; short screens can still scroll the page. Help opens these rules. Explain lets you inspect a die, resource, status, card, ability or disabled control without taking an action. It blocks other controls until you inspect a target or press Esc. Hover a static icon on desktop or tap it on a phone for a three-second tooltip; the latest tap replaces the previous tip. Click empty space or Cancel to deselect a card. Scrolling preserves the selection. Esc closes the dialog or cancels the selection. Battle log retains recent public actions, including defensive rolls after reconnect; opponent card identities are never shown.");
    return content;
  }
  function nextEditionText() {
    return view?.edition_note || "A playable digital adaptation of all eight Season One Rerolled heroes. Status spending and companions are automated, and upgrade effects use the values shown here. The displayed descriptions specify this edition's behavior; full printed card-by-card parity is not claimed.";
  }
  function heroFaceName(hero, key) {
    return `${hero.symbol_names?.[key] || termFor(key)[0]} (${hero.symbol_icons?.[key] || termFor(key)[1]})`;
  }
  function heroFaceReference(hero) {
    const grid = el("div", "dt-face-reference");
    grid.setAttribute("aria-label", "Six dice faces");
    (hero.dice_faces || []).forEach((key, index) => {
      const face = el("div", "dt-reference-face");
      face.setAttribute("aria-label", `Face ${index + 1}: ${heroFaceName(hero, key)}`);
      face.append(el("span", "dt-reference-value", index + 1), el("span", "dt-reference-symbol", hero.symbol_icons?.[key] || termFor(key)[1]), el("span", "dt-reference-name", hero.symbol_names?.[key] || termFor(key)[0]));
      grid.append(face);
    });
    return grid;
  }
  function showHeroDice(id) {
    const hero = heroes[id];
    if (!hero) return;
    const content = el("div", "dt-hero-reference");
    content.append(el("p", "", "Each die has these six faces. Repeated symbols appear on multiple sides."), heroFaceReference(hero));
    if (hero.defense) content.append(el("p", "", `Defense (🛡️) · ${hero.defense.name}: ${hero.defense.dice} Dice (🎲). ${namedText(hero.defense.description)}`));
    openDialog(`${hero.name_zh || hero.name} · ${heroName(id)} · Dice (🎲)`, content);
  }
  function heroNameButton(id) {
    const hero = heroes[id];
    const node = button(hero.name_zh || hero.name, "dt-hero-name-button", () => showHeroDice(id));
    node.dataset.hero = id;
    node.setAttribute("aria-haspopup", "dialog");
    node.setAttribute("aria-label", `${hero.name_zh || hero.name} · View dice faces`);
    return describe(node, `${heroName(id)} · Dice (🎲)`, (hero.dice_faces || []).map((key, index) => `${index + 1}: ${heroFaceName(hero, key)}`).join("; "));
  }
  function renderHeroPicker() {
    const choosing = view.phase === "choose_hero";
    $("HeroPicker").classList.toggle("hidden", !choosing);
    if (!choosing) return;
    const list = $("HeroChoices");
    list.replaceChildren();
    Object.entries(heroes).forEach(([id, hero]) => {
      const active = selected?.kind === "hero" && selected.id === id;
      const node = el("article", `dt-hero-card dt-${id}${active ? " selected" : ""}`);
      node.dataset.hero = id;
      const trigger = button("", "dt-hero-trigger", () => {
        selected = active ? null : {kind: "hero", id};
        renderHeroPicker();
        root.querySelector(".dt-hero-card.selected .dt-inline-confirm button:not(:disabled)")?.focus({preventScroll: true});
      });
      const heading = el("div", "dt-hero-choice-heading");
      heading.append(el("span", "dt-avatar", hero.icon), heroNameButton(id));
      heading.inert = active;
      trigger.setAttribute("aria-label", `Select hero · ${hero.name_zh || hero.name}`);
      trigger.append(el("small", "", `${hero.name} · ${hero.subtitle || ""}`));
      const faces = el("div", "dt-requirement");
      hero.faces.forEach(key => faces.append(token(key)));
      trigger.append(faces);
      describe(trigger, heroName(id), `Choose ${heroName(id)}. Its symbols are ${hero.faces.map(named).join(", ")}. Start with Health (❤️) 50 and Combat Points (⚡) 2.`);
      trigger.disabled = !legal("choose_hero") || view.players.some(player => player.player_id !== view.you && player.hero === id);
      trigger.setAttribute("aria-expanded", String(active));
      trigger.inert = active;
      node.classList.toggle("selected", active || ownPlayer()?.hero === id);
      node.append(heading, trigger);
      if (active) {
        const confirm = el("div", "dt-inline-confirm");
        confirm.append(button("Choose hero", "dt-primary", () => send({type: "choose_hero", hero: id})), button("Cancel", "dt-secondary", cancelSelection));
        node.append(confirm);
      }
      list.append(node);
    });
  }

  function renderPlayers() {
    const list = $("Players");
    list.replaceChildren();
    const players = [...view.players].sort((a, b) => Number(b.player_id === view.you) - Number(a.player_id === view.you));
    players.forEach(player => {
      const hero = heroes[player.hero];
      const card = el("article", `dt-player dt-${player.hero}${player.player_id === view.you ? " dt-you" : ""}${player.player_id === view.current_player ? " dt-turn" : ""}`);
      const head = el("div", "dt-player-head");
      const identity = el("div", "dt-player-identity");
      const avatar = describe(el("span", "dt-avatar", hero?.icon || "🎲"), heroName(player.hero), hero ? `${hero.name_zh || hero.name} · ${hero.name}` : "Choose a hero", true);
      const heroHeading = el("h3", "dt-hero-name");
      heroHeading.append(hero ? heroNameButton(player.hero) : document.createTextNode("Choose a hero"));
      identity.append(heroHeading);
      const caption = el("div", "dt-player-caption");
      const playerName = describe(el("div", "dt-player-name", player.name), "Player", player.name, true);
      head.append(avatar, identity);
      const badges = el("div", "dt-badges");
      if (player.player_id === view.you) badges.append(el("span", "dt-badge", "You"));
      if (player.is_bot) badges.append(el("span", "dt-badge", "Bot"));
      if (player.player_id === view.current_player) badges.append(el("span", "dt-badge dt-acting-badge", "Acting"));
      caption.append(playerName, badges);
      identity.append(caption);
      describe(head, heroName(player.hero), `${player.name}${player.player_id === view.you ? " · You" : ""}${player.player_id === view.current_player ? " · Acting" : ""}`, true);
      const health = describe(el("div", "dt-health"), named("health"), terms.health[2], true);
      const number = el("div", "dt-health-value");
      number.append(el("span", "", "❤️"), el("strong", "", player.health), el("small", "", `/ ${player.max_health || 50}`));
      const bar = el("div", "dt-health-bar");
      const fill = el("span");
      fill.style.width = `${Math.max(0, Math.min(100, player.health / (player.max_health || 50) * 100))}%`;
      bar.append(fill);
      health.append(number, bar);
      const meta = el("div", "dt-player-meta");
      meta.append(token("cp", `⚡ ${player.combat_points}`), token("card", `🃏 ${player.hand_count ?? 0}`));
      if (player.upgrades?.length) meta.append(token("upgrade", `⬆️ ${player.upgrades.length}`));
      const statuses = el("div", "dt-statuses");
      (player.statuses || []).forEach(status => {
        if (terms[status.id]) {
          const chip = token(status.id);
          chip.setAttribute("aria-label", `${named(status.id)} ×${status.stacks}`);
          chip.replaceChildren(el("span", "", terms[status.id][1]), el("span", "dt-status-name", terms[status.id][0]), el("span", "", `×${status.stacks}`));
          statuses.append(chip);
        }
      });
      const stats = el("div", "dt-player-stats");
      stats.append(health, meta);
      card.append(head, stats, statuses);
      list.append(card);
    });
  }
  function renderDice() {
    const area = $("Dice");
    area.replaceChildren();
    const result = view.defense_result?.dice?.length ? view.defense_result : null;
    $("RollTitle").textContent = result ? "Defense result" : "Attack dice";
    area.classList.toggle("dt-defense-dice", Boolean(result));
    area.setAttribute("aria-label", result ? `${labelPlayer(result.defender)} · Defense dice` : "Five attack dice");
    const summary = $("DefenseResult");
    summary.replaceChildren();
    summary.classList.toggle("hidden", !result);
    if (result) {
      area.style.setProperty("--dt-result-count", result.dice.length);
      result.dice.forEach((die, index) => {
        const term = termFor(die.face);
        const node = el("div", `dt-result-die dt-face-${die.face}`);
        node.append(el("span", "dt-die-value", die.value), el("span", "dt-die-symbol", term[1]), el("span", "dt-die-label", term[0]));
        describe(node, `Defense die ${index + 1} · ${named(die.face)}`, `Rolled ${die.value}. ${labelPlayer(result.defender)} · ${result.defense_name}. This is the settled result.`, true);
        area.append(node);
      });
      const resultName = `${labelPlayer(result.defender)} · ${result.defense_name}`;
      summary.append(describe(el("div", "dt-defense-name", resultName), "Defense (🛡️)", resultName, true));
      const effects = el("div", "dt-defense-effects");
      function effect(key, label, amount, explanation) {
        effects.append(describe(el("span", `dt-token dt-tone-${key}`, `${termFor(key)[1]} ${label} ${amount}`), `${label} · ${named(key)}`, explanation, true));
      }
      effect("damage", "Taken", result.damage_taken, `Final incoming Damage (🗡️): ${result.damage_taken}, after Defense (🛡️), cards and statuses. The original attack was ${result.attack_damage}.`);
      effect("defense", "Roll block", result.prevented, `Damage (🗡️) blocked directly by this Defense (🛡️) roll: ${result.prevented}. Other prevention and Healing (💚) are separate.`);
      if (result.healing) effect("heal", "Healed", result.healing, `Actual Healing (💚) from the defense roll: ${result.healing}, capped at maximum Health (❤️), before incoming damage.`);
      if (result.cp_gained) effect("cp", "Gained", result.cp_gained, `Actual Combat Points (⚡) gained from the defense roll: ${result.cp_gained}, capped at 15.`);
      if (result.returned_damage) effect("damage", "Total return", result.returned_damage, `Total return Damage (🗡️) dealt to the attacker: ${result.returned_damage}. Includes defense, status and card returns after prevention.`);
      Object.entries(result.status_gains || {}).forEach(([key, count]) => effects.append(describe(el("span", `dt-token dt-tone-${key}`, `${termFor(key)[1]} ${termFor(key)[0]} +${count}`), named(key), `Gained ${count} ${named(key)} from this defense roll. Tokens may already have been consumed by damage resolution.`, true)));
      summary.append(effects);
    }
    for (let index = 0; !result && index < 5; index++) {
      const die = view.dice[index];
      const key = die?.face;
      const term = terms[key];
      const node = button("", `dt-die dt-face-${key || "empty"}${die?.kept ? " kept" : ""}${!die ? " empty" : ""}`, () => send({type: "toggle_keep", index}));
      node.dataset.index = index;
      node.setAttribute("aria-pressed", String(Boolean(die?.kept)));
      node.setAttribute("aria-label", `Die ${index + 1}: ${die?.value ? `${die.value} · ` : ""}${term ? named(key) : "not rolled"}${die?.kept ? ", Kept (🔒)" : ""}`);
      node.append(el("span", "dt-die-value", die?.value || ""), el("span", "dt-die-symbol", term?.[1] || "🎲"), el("span", "dt-die-label", term?.[0] || "—"), el("span", "dt-keep", die?.kept ? "🔒 Kept" : ""));
      describe(node, `Die ${index + 1}${term ? ` · ${named(key)}` : " (🎲)"}`, `${term ? named(key) + ". " : ""}Click to keep or release this die before rolling again. Kept (🔒) dice stay unchanged. This turn allows up to ${view.roll_limit || 3} rolls.`);
      node.disabled = !die || !legal("toggle_keep");
      area.append(node);
    }
    $("RollCount").textContent = result ? `${result.dice.length} Dice (🎲)` : `${view.roll_count} / ${view.roll_limit || 3} rolls`;
    const actor = view.pending_attack?.attacker || view.current_player;
    $("DiceHint").textContent = view.phase === "offensive_roll" ? actor === view.you ? "Tap dice to keep them between rolls." : `${labelPlayer(actor)} is rolling…` : "";
    $("DiceHint").classList.toggle("hidden", !$("DiceHint").textContent);
    $("RollBtn").disabled = !legal("roll");
    $("RollBtn").textContent = view.roll_count ? "🎲 Roll again" : "🎲 Roll dice";
    $("ConfirmBtn").disabled = !legal("confirm_roll") || !view.dice.length;
    $("EndBtn").disabled = !legal("end_phase");
    $("EndBtn").textContent = view.phase === "main_2" ? "Finish turn →" : "Start rolling →";
    const main = ["main_1", "main_2"].includes(view.phase);
    $("RollZone").classList.toggle("dt-unrolled", !result && !view.dice.length && main);
    $("RollZone").querySelector(".dt-roll-actions").classList.toggle("hidden", !main && !["offensive_roll", "targeting"].includes(view.phase));
    $("EndBtn").classList.toggle("hidden", !main);
    $("RollBtn").classList.toggle("hidden", view.phase !== "offensive_roll");
    $("ConfirmBtn").classList.toggle("hidden", view.phase !== "offensive_roll");
    $("PassBtn").classList.toggle("hidden", view.phase !== "targeting");
    $("PassBtn").disabled = !legal("pass");
  }
  function chooseSelection(value, node) {
    selected = value;
    const top = node?.getBoundingClientRect().top;
    renderAbilities();
    renderHand();
    if (top != null) {
      const replacement = root.querySelector(`[data-dt-selection="${value.kind}-${value.index}"]`);
      if (replacement) window.scrollBy(0, replacement.getBoundingClientRect().top - top);
    }
    root.querySelector(".dt-detail-confirm select:not(:disabled), .dt-detail-confirm button:not(:disabled), .selected .dt-inline-confirm button:not(:disabled)")?.focus({preventScroll: true});
  }
  function cancelSelection(restoreFocus = true) {
    hideTip();
    const previous = selected;
    selected = null;
    renderHeroPicker();
    renderAbilities();
    renderHand();
    if (restoreFocus && previous) {
      const selector = previous.kind === "hero" ? `.dt-hero-card[data-hero="${previous.id}"] .dt-hero-trigger` : `[data-dt-selection="${previous.kind}-${previous.index}"] > button`;
      root.querySelector(selector)?.focus({preventScroll: true});
    }
    hideTip();
  }
  function targets(kind, id, target) {
    const box = el("div", "dt-target-choice");
    const players = view.players.filter(player => target === "self" || target === "none" ? player.player_id === view.you : player.player_id !== view.you);
    players.forEach(player => {
      const action = {type: kind, target: player.player_id};
      action[kind === "use_ability" ? "ability_id" : "card_id"] = id;
      box.append(button("Use ability", "dt-primary", () => send(action), `Confirm this ability on ${player.name}.`));
    });
    return box;
  }
  function setDecisionTab(tab, focus = false) {
    if (!["abilities", "hand"].includes(tab)) return;
    hideTip();
    const currentList = activeTab === "hand" ? $("Hand") : $("AbilityList");
    listScroll[activeTab] = currentList.scrollTop;
    if (tab !== activeTab && selected) cancelSelection(false);
    activeTab = tab;
    $("Decisions").dataset.activeTab = tab;
    root.querySelectorAll("[data-dt-tab]").forEach(node => {
      const active = node.dataset.dtTab === tab;
      node.setAttribute("aria-selected", String(active));
      node.tabIndex = active ? 0 : -1;
      if (active && focus) node.focus({preventScroll: true});
    });
    const nextList = tab === "hand" ? $("Hand") : $("AbilityList");
    nextList.scrollTop = listScroll[tab];
    scheduleMobileLayout();
  }
  function renderAbilities() {
    const list = $("AbilityList");
    const oldScroll = activeTab === "abilities" ? list.scrollTop : listScroll.abilities;
    list.replaceChildren();

    const usable = view.abilities.filter(ability => ability.available && legal("use_ability")).length;
    const hint = view.phase === "targeting" ? usable ? `${usable} ready · ${view.abilities.length} abilities` : "No ready ability · you can skip" : "Confirm your roll to choose";
    $("AbilityHint").textContent = view.phase === "targeting" ? `${usable} ready` : view.abilities.length;
    $("AbilitiesTab").setAttribute("aria-label", `Abilities · ${hint}`);
    describe($("AbilitiesTab"), "Abilities (⚔️)", `${hint}. View your hero's dice patterns and effects; select a ready ability to confirm its target.`);
    view.abilities.forEach((ability, index) => {
      const active = selected?.kind === "ability" && selected.index === index;
      const canUse = ability.available && legal("use_ability");
      const card = el("article", `dt-ability${canUse ? " available" : ""}${active ? " selected" : ""}${abilityCatalog[ability.id]?.damage_type === "ultimate" ? " dt-ultimate" : ""}`);
      card.dataset.dtSelection = `ability-${index}`;
      const trigger = button("", "dt-ability-trigger", () => active ? cancelSelection() : chooseSelection({kind: "ability", id: ability.id, index}, card));
      trigger.disabled = !canUse;
      trigger.setAttribute("aria-expanded", String(active));
      trigger.inert = active;
      const head = el("div", "dt-ability-head");
      head.append(el("strong", "", ability.name));
      if (ability.level > 1) head.append(el("span", "dt-cost", `⬆️ ${ability.level}`));
      const description = ability.description.replace(/^[^:]+:\s*/, "");
      trigger.append(head, requirement(ability.id), el("div", "dt-effect", namedText(description)), el("span", "dt-availability", canUse ? "Ready · select" : view.phase === "offensive_roll" ? "Preview" : "Unavailable"));
      describe(trigger, `${ability.name}${abilityCatalog[ability.id]?.damage_type === "ultimate" ? " · Ultimate (👑)" : ""}`, `Pattern: ${conditionText(ability.id)}. Cost: ${ability.cost || 0} ${named("cp")}. Effect: ${namedText(ability.description)} ${canUse ? "Select, then confirm the target." : "Unavailable until it is your ability phase and the dice pattern is met."}`);
      card.append(trigger);
      if (active) {
        const confirm = el("div", "dt-inline-confirm");
        confirm.setAttribute("aria-label", `Confirm ${ability.name}`);
        confirm.append(targets("use_ability", ability.id, ability.target), button("Cancel", "dt-secondary", cancelSelection, "Cancel this local selection without taking an action."));
        card.append(confirm);
      }
      list.append(card);
    });
    list.scrollTop = oldScroll;
    listScroll.abilities = oldScroll;
    if (!view.abilities.length) list.append(el("p", "dt-empty", "Choose a hero to view abilities."));
  }
  function cardAction(card, inputs) {
    const action = {type: "play_card", card_id: card.id || card.cardid};
    if (card.target === "self") action.target = view.you;
    else if (card.target === "opponent") action.target = view.players.find(player => player.player_id !== view.you)?.player_id;
    else if (inputs.target) action.target = inputs.target;
    ["index", "value", "source_index", "status"].forEach(key => { if (inputs[key] != null && inputs[key] !== "") action[key] = inputs[key]; });
    return action;
  }
  function cardUnavailableReason(card) {
    if (pending) return "上一项操作正在提交，请稍候。";
    if (view.game_over) return "对局已经结束。";
    const reason = card.unavailable_reason || "";
    if (reason === "CP 不足" || (!reason && (ownPlayer()?.combat_points || 0) < card.cost)) {
      return `需要 ${card.cost} Combat Points (⚡)，当前只有 ${ownPlayer()?.combat_points || 0}。`;
    }
    if (["仅可在掷骰或防御时使用", "仅可在主要阶段或防御时使用", "当前不能使用这张牌"].includes(reason)) {
      const timing = {main: "Main I / Main II（主要阶段）", roll: "Offensive roll / Choose an ability（掷骰或选技能）", defense: "Defense（防御阶段）"};
      return `这张牌只能在 ${timing[card.timing] || named(card.timing)} 使用；当前是 ${phases[view.phase] || "等待阶段"}。`;
    }
    if (reason) return reason;
    if (!legal("play_card") || card.can_play === false) {
      return view.current_player !== view.you ? "等待自己的行动机会。" : "当前阶段不能使用这张牌。";
    }
    return "";
  }
  function setUnavailableTip(node, reason) {
    if (reason) {
      node.dataset.dtUnavailable = reason;
      node.dataset.dtTip = `Cannot play — ${reason}`;
    } else {
      delete node.dataset.dtUnavailable;
      delete node.dataset.dtTip;
    }
  }
  function cardConfirm(card, expanded) {
    const confirm = el("div", expanded ? "dt-detail-confirm" : "dt-inline-confirm");
    confirm.setAttribute("aria-label", `Confirm ${card.name}`);
    if (expanded) confirm.append(el("strong", "dt-confirm-title", card.name), el("p", "dt-confirm-description", namedText(card.description)));
    const inputs = selected.inputs || (selected.inputs = {});
    const required = [];
    const selectors = {};
    let refresh = () => {};
    const controls = el("div", "dt-input-grid");
    const actionButtons = el("div", "dt-confirm-actions");
    function unavailableReason() {
      const reason = cardUnavailableReason(card);
      if (reason) return reason;
      if (["clean_one", "clean_all"].includes(card.effect) && inputs.target) {
        const target = view.players.find(player => player.player_id === inputs.target);
        if (!(target?.statuses || []).some(status => !view.status_catalog?.[status.id]?.companion && status.id !== "blessing")) {
          return "所选玩家没有可以移除的状态；伙伴和神佑不能移除。";
        }
      }
      const missing = required.find(key => inputs[key] == null || inputs[key] === "");
      return {target: "请先选择目标玩家。", index: "请先选择要修改的骰子。", source_index: "请先选择另一枚作为点数来源的骰子。", value: "请先选择新的骰子点数。", status: "请先选择要移除的状态。"}[missing] || "";
    }
    const play = button(`Play · ${card.cost} ⚡`, "dt-primary", () => {
      // aria-disabled keeps the unavailable control reachable for its reason.
      // Never submit until both the server rules and local choices permit it.
      if (unavailableReason()) { showTip(play, true); return; }
      send(cardAction(card, inputs));
    });
    function updatePlay() {
      hideTip();
      const reason = unavailableReason();
      play.setAttribute("aria-disabled", String(Boolean(reason)));
      play.setAttribute("aria-description", reason || `Play ${card.name}.`);
      describe(play, `Play · ${card.name}`, reason || `Play ${card.name} for ${card.cost} Combat Points (⚡).`);
      setUnavailableTip(play, reason);
    }
    function choice(key, label, options, number = false) {
      required.push(key);
      const row = el("label", "dt-input-field");
      const select = el("select");
      select.setAttribute("aria-label", label);
      select.append(new Option("Choose…", ""));
      options.forEach(([value, text]) => select.append(new Option(text, value)));
      select.value = inputs[key] == null ? "" : String(inputs[key]);
      select.addEventListener("change", () => {
        inputs[key] = select.value === "" ? "" : number ? Number(select.value) : select.value;
        refresh();
        updatePlay();
      });
      selectors[key] = select;
      row.append(el("span", "", label), select);
      controls.append(row);
    }
    if (card.target === "any_player" || (card.inputs || []).includes("target")) {
      choice("target", "Target", view.players.map(player => [player.player_id, player.player_id === view.you ? "You" : player.name]));
    }
    const diceOptions = view.dice.map((die, index) => [index, `${index + 1} · ${die.value || "?"} ${named(die.face)}`]);
    const valueOptions = Array.from({length: 6}, (_, index) => [index + 1, String(index + 1)]);
    const fields = card.inputs || [];
    if (fields.includes("die")) choice("index", "Die", diceOptions, true);
    if (fields.includes("source_die")) choice("source_index", "Copy from die", diceOptions, true);
    if (fields.includes("value")) choice("value", "New value", valueOptions, true);
    if (fields.includes("status")) choice("status", "Status", []);
    refresh = () => {
      if (selectors.status) {
        const target = view.players.find(player => player.player_id === inputs.target);
        const statuses = (target?.statuses || []).filter(status => !view.status_catalog?.[status.id]?.companion && status.id !== "blessing");
        selectors.status.replaceChildren(new Option("Choose…", ""), ...statuses.map(status => new Option(named(status.id), status.id)));
        selectors.status.value = statuses.some(status => status.id === inputs.status) ? inputs.status : "";
        inputs.status = selectors.status.value;
        selectors.status.disabled = !target || !statuses.length;
      }
      for (const key of ["value", "source_index"]) {
        if (!selectors[key]) continue;
        for (const option of selectors[key].options) {
          if (!option.value) continue;
          option.disabled = key === "source_index" ? Number(option.value) === inputs.index : card.effect === "tip_die" && Math.abs(Number(option.value) - (view.dice[inputs.index]?.value || 0)) !== 1;
        }
        const chosen = selectors[key].selectedOptions[0];
        if (chosen?.disabled) { selectors[key].value = ""; inputs[key] = ""; }
      }
    };
    refresh();
    if (controls.children.length) confirm.append(controls);
    updatePlay();
    const sell = button("Sell · +1 ⚡", "dt-secondary", () => send({type: "sell_card", card_id: card.id || card.cardid}), "Discard this Card (🃏) for 1 Combat Point (⚡). Available in a main phase.");
    sell.disabled = !legal("sell_card") || card.can_sell === false;
    actionButtons.append(play, sell, button("Cancel", "dt-secondary", cancelSelection, "Cancel this local selection without taking an action."));
    confirm.append(actionButtons);
    return confirm;
  }
  function renderHand() {
    const hand = $("Hand");
    const oldScroll = activeTab === "hand" ? hand.scrollTop : listScroll.hand;
    $("Decisions").querySelector(".dt-detail-confirm")?.remove();
    $("Decisions").querySelectorAll(".dt-decision-tabs, .dt-abilities, .dt-hand-area").forEach(node => { node.inert = false; });
    hand.replaceChildren();
    const cards = view.your_hand || [];
    $("HandTabCount").textContent = `${cards.length}/6`;
    $("HandTab").setAttribute("aria-label", `Your hand · ${cards.length} of 6 Cards (🃏) · private`);
    cards.forEach((card, index) => {
      const id = card.id || card.cardid;
      const active = selected?.kind === "card" && selected.index === index;
      const reason = cardUnavailableReason(card);
      const canPlay = !reason;
      const node = el("article", `dt-card${canPlay ? " playable" : ""}${active ? " selected" : ""}`);
      node.dataset.dtSelection = `card-${index}`;
      const trigger = button("", "dt-card-trigger", () => {
        if (active) { cancelSelection(); return; }
        chooseSelection({kind: "card", id, index, inputs: {}}, node);
        if (reason) showTip(root.querySelector(".dt-detail-confirm [data-dt-unavailable], .dt-card.selected .dt-inline-confirm [data-dt-unavailable]"), true);
      });
      trigger.setAttribute("aria-expanded", String(active));
      trigger.inert = active;
      const head = el("div", "dt-card-head");
      head.append(el("strong", "", card.name), el("span", "dt-cost", `⚡ ${card.cost}`));
      const foot = el("div", "dt-card-foot");
      foot.append(token(card.timing in terms ? card.timing : "main"), el("span", "dt-target", card.target === "self" ? "You" : card.target === "opponent" ? "Opponent" : "Choose target"));
      trigger.append(head, el("p", "dt-card-effect", namedText(card.description)), foot);
      describe(trigger, `Card (🃏) · ${card.name}`, `Cost: ${card.cost} ${named("cp")}. Timing: ${named(card.timing in terms ? card.timing : "main")}. Effect: ${namedText(card.description)} ${reason || "Select for Play or Sell."} Sell gains 1 Combat Point (⚡).`);
      setUnavailableTip(trigger, reason);
      node.append(trigger);
      if (active) {
        const expanded = Boolean(card.inputs?.length || card.target === "any_player");
        const confirm = cardConfirm(card, expanded);
        if (expanded) $("Decisions").append(confirm);
        else node.append(confirm);
      }
      hand.append(node);
    });
    if (!cards.length) hand.append(el("p", "dt-empty", "No cards in hand"));
    hand.scrollTop = oldScroll;
    listScroll.hand = oldScroll;
    if ($("Decisions").querySelector(".dt-detail-confirm")) {
      $("Decisions").querySelectorAll(".dt-decision-tabs, .dt-abilities, .dt-hand-area").forEach(node => { node.inert = true; });
    }
  }
  function renderResponse() {
    const attack = view.pending_attack;
    $("Response").classList.toggle("hidden", !attack || view.phase !== "defensive_roll");
    if (!attack) return;
    $("ResponseTitle").textContent = attack.defender === view.you ? "🛡️ Your defense" : `🛡️ ${labelPlayer(attack.defender)} is defending`;
    $("ResponseText").replaceChildren();
    richText($("ResponseText"), `${abilityCatalog[attack.ability_id]?.name || "Attack"} · ${attack.damage} ${attack.damage_type} damage`);
    const actions = $("ResponseActions");
    actions.replaceChildren();
    if (attack.defender !== view.you) return;
    const defense = heroes[ownPlayer()?.hero]?.defense;
    const defend = button("🛡️ Defend", "dt-primary", () => send({type: "defend"}), `${named("defense")}: ${defense?.name || ""}. ${namedText(defense?.description || "Resolve your hero's defensive dice.")}`);
    defend.disabled = !legal("defend");
    const pass = button("Pass", "dt-secondary", () => send({type: "pass"}), "Skip Defense (🛡️) and take the pending Damage (🗡️).");
    pass.disabled = !legal("pass");
    actions.append(defend, pass);
  }
  function renderReview() {
    $("Review").classList.toggle("hidden", view.phase !== "round_review");
    const rows = $("ReviewRows");
    rows.replaceChildren();
    (view.round_review || []).forEach(entry => rows.append(el("div", `dt-review-row${entry.player_id === view.you ? " self" : ""}`, `${labelPlayer(entry.player_id)} · ${entry.text}`)));
    activity.slice(-3).forEach(text => rows.append(describe(el("div", "dt-review-row", text), "Battle activity", activityLegend, true)));
    $("Ready").textContent = `${view.next_round_ready.length} / ${view.players.length} ready`;
    $("NextBtn").disabled = !legal("next_round");
    $("NextBtn").textContent = view.next_round_ready.includes(view.you) ? "Ready · waiting" : "Next Round →";
    $("GameOver").classList.toggle("hidden", !view.game_over);
    if (view.game_over) {
      $("Winner").replaceChildren(describe(el("h3", "", `🏆 ${view.winner.length ? view.winner.map(labelPlayer).join(" & ") : "Draw"}`), "Winner (🏆)", "The duel has ended. Final Health (❤️) and Combat Points (⚡) remain visible.", true));
      $("FinalRows").replaceChildren(...view.players.map(player => {
        const row = el("div", "dt-final-row", `${player.name} · `);
        row.append(token("health", `❤️ ${player.health}`), token("cp", `⚡ ${player.combat_points}`));
        return row;
      }));
    }
  }
  function render() {
    if (!view) return;
    hideTip();
    renderHeroPicker();
    $("Arena").classList.toggle("hidden", view.phase === "choose_hero");
    $("Round").textContent = `Round ${view.round}`;
    $("Phase").textContent = phases[view.phase] || "Waiting";
    const prompts = {choose_hero: "Choose your hero to enter the duel.", main_1: "Play cards or start rolling.", offensive_roll: "Roll, keep your best dice, then confirm.", targeting: "Choose a ready ability or skip the attack.", defensive_roll: "An attack is incoming. Choose your response.", main_2: "Play cards or finish your turn.", round_review: "Review the turn, then ready up.", game_over: "The duel is complete."};
    const hasAction = !view.game_over && Boolean(view.legal_actions?.length);
    $("Status").textContent = pending ? "Sending your action…" : hasAction ? prompts[view.phase] : view.phase === "round_review" ? "Ready · waiting for the other player." : view.game_over ? prompts.game_over : `Waiting for ${labelPlayer(view.current_player)}…`;
    describe($("Status"), phases[view.phase] || "Waiting", $("Status").textContent, true);
    root.classList.toggle("dt-has-action", hasAction);
    document.body.classList.toggle("dt-needs-action", hasAction);
    root.querySelectorAll("[data-dt-phase]").forEach(node => {
      const active = node.dataset.dtPhase === view.phase;
      node.classList.toggle("active", active);
      if (active) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });
    const combatPhase = Boolean(root.querySelector("[data-dt-phase].active"));
    root.querySelector(".dt-phase-steps").classList.toggle("hidden", !combatPhase);
    $("Phase").classList.toggle("hidden", combatPhase);
    const publicLog = (view.log || []).map(entry => `${labelPlayer(entry.player_id)} · ${entry.text}`);
    renderPlayers();
    renderDice();
    renderAbilities();
    renderHand();
    renderResponse();
    renderReview();
    $("Log").replaceChildren(...(publicLog.length ? publicLog : activity).slice(-40).map(text => describe(el("li", "", text), "Battle activity", activityLegend, true)));
    scheduleMobileLayout();
  }
  function recordChanges(previous, next) {
    const who = id => next.players.find(player => player.player_id === id)?.name || "Player";
    if (!previous || next.revision < previous.revision) activity.length = 0;
    if (!previous || next.revision === previous.revision) return;
    if (next.roll_count !== previous.roll_count && next.roll_count > 0) {
      activity.push(`${who(next.current_player)} rolled ${next.dice.map(die => terms[die.face]?.[1] || "🎲").join(" ")} · ${next.roll_count}/${next.roll_limit || 3}`);
    }
    if (next.pending_attack && !previous.pending_attack) {
      activity.push(`${who(next.pending_attack.attacker)} used ${abilityCatalog[next.pending_attack.ability_id]?.name || "an ability"} · 🗡️ ${next.pending_attack.damage}`);
    }
    next.players.forEach(player => {
      const old = previous.players.find(item => item.player_id === player.player_id);
      if (old && old.health !== player.health) activity.push(`${player.name} · ❤️ ${old.health} → ${player.health}`);
      if (old && old.hand_count !== player.hand_count) activity.push(`${player.name} · 🃏 ${old.hand_count} → ${player.hand_count} cards`);
      if (old && old.combat_points !== player.combat_points) activity.push(`${player.name} · ⚡ ${old.combat_points} → ${player.combat_points} CP`);
    });
    if (next.phase !== previous.phase) activity.push(`${next.current_player ? who(next.current_player) + " · " : ""}${phases[next.phase]}`);
    if (activity.length > 40) activity.splice(0, activity.length - 40);
  }
  function explainTarget(event) {
    const direct = event.target.closest?.("[data-dt-explain]");
    if (direct && root.contains(direct)) return direct;
    return [...root.querySelectorAll("[data-dt-explain]")].reverse().find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  }
  function exempt(target) {
    return target.closest?.("#diceThroneHelpBtn,#diceThroneExplainBtn,#diceThroneDialog");
  }
  function showExplanation(node) {
    setExplain(false);
    openDialog(node.dataset.dtExplain, node.dataset.dtDescription);
  }
  // Capture the whole document, including controls moved into the shared header.
  document.addEventListener("pointerdown", event => {
    // A fresh deliberate press must not be suppressed by the previous gesture.
    suppressUntil = 0;
    if (!explainMode || exempt(event.target)) return;
    blockedPointer = true;
    event.preventDefault();
    event.stopImmediatePropagation();
    const node = explainTarget(event);
    if (node) showExplanation(node);
  }, true);
  document.addEventListener("pointerup", event => {
    if (!blockedPointer) return;
    blockedPointer = false;
    suppressUntil = performance.now() + 500;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointercancel", () => { blockedPointer = false; });
  document.addEventListener("click", event => {
    if (performance.now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explainMode || exempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const node = explainTarget(event);
    if (node) showExplanation(node);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setExplain(false);
      hideTip();
      if ($("Dialog").open) $("Dialog").close();
      else if (selected) cancelSelection();
    } else if (explainMode && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const node = explainTarget(event);
      if (node) showExplanation(node);
    }
  }, true);
  root.addEventListener("pointerdown", event => {
    pointerStart = {x: event.clientX, y: event.clientY, moved: false, scrolled: false};
  });
  document.addEventListener("pointermove", event => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) pointerStart.moved = true;
  }, {passive: true});
  root.addEventListener("click", event => {
    const deliberate = !pointerStart || (!pointerStart.moved && !pointerStart.scrolled);
    const staticIcon = event.target.closest("[data-dt-tip]");
    if (deliberate && staticIcon && !staticIcon.closest("button") && (event.pointerType === "touch" || matchMedia("(hover: none)").matches)) showTip(staticIcon, true);
    if (deliberate && selected && !event.target.closest("button,[data-dt-tip],details,summary,select,label,.dt-inline-confirm,.dt-detail-confirm")) cancelSelection();
    pointerStart = null;
  });
  root.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") showTip(event.target.closest("[data-dt-unavailable]") || event.target.closest("[data-dt-tip]"));
  });
  root.addEventListener("focusin", event => {
    const node = event.target.closest("[data-dt-unavailable]");
    if (node) showTip(node, true);
  });
  root.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  document.addEventListener("scroll", () => {
    hideTip();
    if (pointerStart) pointerStart.scrolled = true;
  }, {capture: true, passive: true});
  window.addEventListener("resize", () => { hideTip(); scheduleMobileLayout(); });
  window.visualViewport?.addEventListener("resize", scheduleMobileLayout);
  const layoutObserver = new ResizeObserver(scheduleMobileLayout);
  [root, document.getElementById("roomControlsPanel")].filter(Boolean).forEach(node => layoutObserver.observe(node));
  document.fonts?.ready?.then(scheduleMobileLayout);
  $("Tooltip").setAttribute("aria-live", "polite");
  $("Tooltip").setAttribute("aria-atomic", "true");
  const actionHelp = {
    RollBtn: ["Roll Dice (🎲)", "Roll again up to the limit shown on the tray; statuses and cards can change it. Kept (🔒) dice remain unchanged."],
    ConfirmBtn: ["Confirm roll", "Keep the current Dice (🎲) result and move to ability selection. Roll at least once first."],
    EndBtn: ["Continue the turn", "Main I continues to rolling Dice (🎲). Main II ends the turn and opens the shared review."],
    PassBtn: ["Skip attack", "Continue to Main II without using an ability or spending Combat Points (⚡)."],
    NextBtn: ["Next Round", "Confirm the round review. Both players must be ready; Bots confirm automatically. No second confirmation is needed."],
  };
  Object.entries(actionHelp).forEach(([id, text]) => describe($(id), ...text));
  [["RollBtn", "roll"], ["ConfirmBtn", "confirm_roll"], ["EndBtn", "end_phase"], ["PassBtn", "pass"], ["NextBtn", "next_round"]].forEach(([id, type]) => $(id).addEventListener("click", () => send({type})));
  root.querySelectorAll("[data-dt-tab]").forEach(node => {
    node.addEventListener("click", () => setDecisionTab(node.dataset.dtTab, true));
    node.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        setDecisionTab(event.key === "Home" ? "abilities" : event.key === "End" ? "hand" : activeTab === "hand" ? "abilities" : "hand", true);
      }
    });
  });
  $("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog("Dice Throne · Help", helpContent()); });
  $("ExplainBtn").addEventListener("click", () => setExplain(!explainMode));
  $("DialogClose").addEventListener("click", () => $("Dialog").close());
  $("Dialog").addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus({preventScroll: true}); });
  window.renderDiceThroneGameState = data => {
    if (!data?.view || (data.view.game_id && data.view.game_id !== "dice_throne")) return;
    if (view?.revision !== data.view.revision) selected = null;
    syncCatalog(data.view);
    const phaseChanged = view?.phase !== data.view.phase;
    recordChanges(view, data.view);
    view = data.view;
    pending = false;
    render();
    if (phaseChanged) {
      const main = ["main_1", "main_2"].includes(view.phase);
      setDecisionTab(main ? "hand" : ["offensive_roll", "targeting"].includes(view.phase) ? "abilities" : activeTab);
    }
  };
  window.showDiceThroneHeaderActions = show => {
    $("HeaderActions").style.display = show ? "flex" : "none";
    if (gamePanel && gameHeading) {
      if (show && !gamePanel.classList.contains("dt-game-panel")) {
        previousGameTitle = gameHeading.textContent;
        gameHeading.textContent = "Dice Throne";
      } else if (!show && gamePanel.classList.contains("dt-game-panel")) {
        gameHeading.textContent = previousGameTitle;
        previousGameTitle = null;
      }
      gamePanel.classList.toggle("dt-game-panel", show);
    }
    if (!show) {
      view = null;
      selected = null;
      pending = false;
      activity.length = 0;
      setExplain(false);
      document.body.classList.remove("dt-needs-action");
      if ($("Dialog").open) $("Dialog").close();
    } else if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "dice_throne") window.renderDiceThroneGameState(lastGameStatePayload);
  };
  function sync() {
    if (typeof socket !== "undefined") {
      socket.on("system:error", () => { pending = false; render(); });
      socket.on("disconnect", () => { pending = false; render(); });
    }
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "dice_throne") window.renderDiceThroneGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
