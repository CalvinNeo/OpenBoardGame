let currentForestShuffleView = null;
let forestShuffleSelectedCardId = null;
let forestShuffleSelectedHalfIndex = null;
let forestShuffleSelectedTreeId = null;
let forestShuffleDeckDrawCount = 0;
let forestShuffleSelectedClearingIds = new Set();
let forestShuffleSelectedPaymentIds = new Set();
let forestShuffleSelectedRaccoonIds = new Set();
let forestShuffleExplainMode = false;

const forestShufflePanel = document.getElementById("forestShufflePanel");
const forestShuffleHeaderActions = document.getElementById("forestShuffleHeaderActions");
const forestShuffleHelpBtn = document.getElementById("forestShuffleHelpBtn");
const forestShuffleExplainBtn = document.getElementById("forestShuffleExplainBtn");
const forestShuffleHelpModal = document.getElementById("forestShuffleHelpModal");
const forestShuffleHelpModalCloseBtn = document.getElementById("forestShuffleHelpModalCloseBtn");
const forestShuffleExplainModal = document.getElementById("forestShuffleExplainModal");
const forestShuffleExplainModalCloseBtn = document.getElementById("forestShuffleExplainModalCloseBtn");
const forestShuffleHelpContent = document.getElementById("forestShuffleHelpContent");
const forestShuffleExplainContent = document.getElementById("forestShuffleExplainContent");
const forestShuffleTurnLabel = document.getElementById("forestShuffleTurn");
const forestShuffleWinterLabel = document.getElementById("forestShuffleWinter");
const forestShuffleDeckLabel = document.getElementById("forestShuffleDeck");
const forestShuffleWinnerLabel = document.getElementById("forestShuffleWinner");
const forestShuffleStatus = document.getElementById("forestShuffleStatus");
const forestShuffleActionHint = document.getElementById("forestShuffleActionHint");
const forestShuffleSelectionSummary = document.getElementById("forestShuffleSelectionSummary");
const forestShuffleDrawSources = document.getElementById("forestShuffleDrawSources");
const forestShuffleClearing = document.getElementById("forestShuffleClearing");
const forestShuffleHand = document.getElementById("forestShuffleHand");
const forestShufflePlayers = document.getElementById("forestShufflePlayers");
const forestShuffleDrawBtn = document.getElementById("forestShuffleDrawBtn");
const forestShufflePlayBtn = document.getElementById("forestShufflePlayBtn");
const forestShuffleSaplingBtn = document.getElementById("forestShuffleSaplingBtn");
const forestShuffleFinishPendingBtn = document.getElementById("forestShuffleFinishPendingBtn");
const forestShuffleResolveRaccoonBtn = document.getElementById("forestShuffleResolveRaccoonBtn");
const forestShuffleNotes = document.getElementById("forestShuffleNotes");

const FOREST_SHUFFLE_HELP_TEXT = `
  <h3>Scope</h3>
  <p>This room implements the Forest Shuffle base-game core loop: draw, pay, place, resolve, clear the clearing, and score when the 3rd winter arrives.</p>
  <p>This build uses synthetic split-card pairings and approximate tree-symbol distribution. The turn flow and card scoring are implemented, but exact physical deck pairing is not final.</p>

  <h3>Turn</h3>
  <ul>
    <li><strong>Draw Two Cards</strong>: select up to two sources from the deck and/or the clearing.</li>
    <li><strong>Play One Card</strong>: choose a hand card, select payment cards, and if needed click a tree slot to place it.</li>
  </ul>

  <h3>Placement</h3>
  <ul>
    <li>Trees create new 4-sided homes in your forest.</li>
    <li>Split cards need a matching side slot on one of your trees or saplings.</li>
    <li>European Hares can stack with more European Hares. Common Toads can share a bottom slot in pairs.</li>
  </ul>

  <h3>Pending Effects</h3>
  <ul>
    <li><strong>Free Play</strong>: some bonuses let you place a matching card for free. The free card keeps normal placement rules, but its own effect and bonus are skipped.</li>
    <li><strong>Raccoon</strong>: select any remaining hand cards to tuck under your cave, then draw the same amount.</li>
  </ul>

  <h3>Known Limitation</h3>
  <ul>
    <li><strong>Mole</strong>: the card is present and scores correctly, but its complex extra multi-play effect is not fully implemented in this build.</li>
  </ul>
`;

const FOREST_SHUFFLE_EXPLANATIONS = {
  status: {
    name: "Status",
    description: "Shows whose turn it is, how close winter is, and whether the game has ended.",
  },
  action: {
    name: "Action Console",
    description: "Use this area to assemble a draw action, finish a pending effect, or submit the currently selected play.",
  },
  clearing: {
    name: "Clearing",
    description: "Paid cards and revealed tree cards go here. You can also take clearing cards when choosing the draw action.",
  },
  hand: {
    name: "Your Hand",
    description: "Choose a card half to play, toggle payment cards, or mark cards for the Raccoon cave effect.",
  },
  players: {
    name: "Players",
    description: "Each player card shows public forest state, cave count, score preview, and the tree-slot layout. Click one of your tree slots after selecting a split card.",
  },
  forestShuffleDrawBtn: {
    name: "Draw Selected",
    description: "Confirm the selected deck and clearing sources for your draw action.",
  },
  forestShufflePlayBtn: {
    name: "Play Selected",
    description: "Confirm the currently selected card, payment cards, and target tree slot.",
  },
  forestShuffleSaplingBtn: {
    name: "Play As Sapling",
    description: "Play the selected hand card face down as a universal tree sapling.",
  },
  forestShuffleFinishPendingBtn: {
    name: "Finish Pending",
    description: "Skip the rest of the current free-play opportunity and end the turn if nothing else is pending.",
  },
  forestShuffleResolveRaccoonBtn: {
    name: "Confirm Cave",
    description: "Resolve the Raccoon effect by moving the selected hand cards under your cave and drawing replacements.",
  },
};

const FOREST_SYMBOL_STYLES = {
  beech: { label: "Beech", emoji: "🌳", tone: "beech" },
  birch: { label: "Birch", emoji: "🌱", tone: "birch" },
  douglas_fir: { label: "Douglas Fir", emoji: "🌲", tone: "fir" },
  horse_chestnut: { label: "Horse Chestnut", emoji: "🌰", tone: "chestnut" },
  linden_tree: { label: "Linden", emoji: "🍃", tone: "linden" },
  oak: { label: "Oak", emoji: "🌿", tone: "oak" },
  silver_fir: { label: "Silver Fir", emoji: "❄️", tone: "silver" },
  sycamore: { label: "Sycamore", emoji: "🍁", tone: "sycamore" },
};

const FOREST_TAG_ICONS = {
  tree: "🌳",
  bird: "🐦",
  butterfly: "🦋",
  bat: "🦇",
  pawed: "🐾",
  deer: "🦌",
  cloven: "🦌",
  hare: "🐇",
  insect: "🐞",
  plant: "🌿",
  mushroom: "🍄",
  amphibian: "🐸",
};

function forestShufflePlayerName(view, playerId) {
  const player = (view.players || []).find((entry) => entry.player_id === playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function forestShuffleYou(view) {
  return (view.players || []).find((player) => player.player_id === view.you) || null;
}

function forestShufflePending(view) {
  return view && view.pending_action ? view.pending_action : null;
}

function forestShuffleCurrentHand(view) {
  const you = forestShuffleYou(view);
  return you && Array.isArray(you.hand) ? you.hand : [];
}

function forestShuffleSelectedCard(view) {
  return forestShuffleCurrentHand(view).find((card) => card.id === forestShuffleSelectedCardId) || null;
}

function forestShuffleSelectedHalf(view) {
  const card = forestShuffleSelectedCard(view);
  if (!card || card.kind !== "split" || !Array.isArray(card.halves)) {
    return null;
  }
  if (!Number.isInteger(forestShuffleSelectedHalfIndex)) {
    return null;
  }
  return card.halves[forestShuffleSelectedHalfIndex] || null;
}

function forestShuffleRequiredDrawCount(view) {
  const hand = forestShuffleCurrentHand(view);
  return Math.max(0, Math.min(2, 10 - hand.length));
}

function forestShuffleActiveSlot(view) {
  const half = forestShuffleSelectedHalf(view);
  return half ? half.slot : null;
}

function forestShuffleIsYourTurn(view) {
  return !!(view && view.you && view.current_turn === view.you);
}

function forestShuffleSyncSelections(view) {
  const handIds = new Set(forestShuffleCurrentHand(view).map((card) => card.id));
  if (forestShuffleSelectedCardId && !handIds.has(forestShuffleSelectedCardId)) {
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
  }
  forestShuffleSelectedPaymentIds = new Set([...forestShuffleSelectedPaymentIds].filter((cardId) => handIds.has(cardId) && cardId !== forestShuffleSelectedCardId));
  forestShuffleSelectedRaccoonIds = new Set([...forestShuffleSelectedRaccoonIds].filter((cardId) => handIds.has(cardId)));
  const clearingIds = new Set((view.clearing || []).map((card) => card.id));
  forestShuffleSelectedClearingIds = new Set([...forestShuffleSelectedClearingIds].filter((cardId) => clearingIds.has(cardId)));
  const you = forestShuffleYou(view);
  const treeIds = new Set((((you || {}).forest || {}).trees || []).map((tree) => tree.id));
  if (forestShuffleSelectedTreeId && !treeIds.has(forestShuffleSelectedTreeId)) {
    forestShuffleSelectedTreeId = null;
  }
}

function forestShuffleClearSelections() {
  forestShuffleSelectedCardId = null;
  forestShuffleSelectedHalfIndex = null;
  forestShuffleSelectedTreeId = null;
  forestShuffleDeckDrawCount = 0;
  forestShuffleSelectedClearingIds = new Set();
  forestShuffleSelectedPaymentIds = new Set();
  forestShuffleSelectedRaccoonIds = new Set();
}

function clearForestShuffleState() {
  currentForestShuffleView = null;
  forestShuffleClearSelections();
  if (forestShuffleTurnLabel) forestShuffleTurnLabel.textContent = "-";
  if (forestShuffleWinterLabel) forestShuffleWinterLabel.textContent = "-";
  if (forestShuffleDeckLabel) forestShuffleDeckLabel.textContent = "-";
  if (forestShuffleWinnerLabel) forestShuffleWinnerLabel.textContent = "-";
  if (forestShuffleStatus) forestShuffleStatus.textContent = "-";
  if (forestShuffleActionHint) forestShuffleActionHint.textContent = "-";
  if (forestShuffleSelectionSummary) forestShuffleSelectionSummary.textContent = "-";
  if (forestShuffleDrawSources) forestShuffleDrawSources.innerHTML = "";
  if (forestShuffleClearing) forestShuffleClearing.innerHTML = "";
  if (forestShuffleHand) forestShuffleHand.innerHTML = "";
  if (forestShufflePlayers) forestShufflePlayers.innerHTML = "";
  if (forestShuffleNotes) forestShuffleNotes.innerHTML = "";
  updateForestShuffleActionButtons();
}

function forestShuffleSymbolChip(symbol) {
  const meta = FOREST_SYMBOL_STYLES[symbol] || { label: symbol || "?", emoji: "🌲", tone: "oak" };
  const chip = document.createElement("span");
  chip.className = `forest-shuffle-symbol tone-${meta.tone}`;
  chip.textContent = `${meta.emoji} ${meta.label}`;
  chip.title = meta.label;
  return chip;
}

function forestShuffleTagRow(tags) {
  const row = document.createElement("div");
  row.className = "forest-shuffle-tag-row";
  (tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "forest-shuffle-tag-chip";
    chip.textContent = `${FOREST_TAG_ICONS[tag] || "•"} ${tag}`;
    row.appendChild(chip);
  });
  return row;
}

function forestShufflePendingHint(view) {
  const pending = forestShufflePending(view);
  if (!pending) {
    return "Choose one action: draw two cards, or play one card from hand.";
  }
  if (pending.type === "free_play") {
    const labels = Array.isArray(pending.tags) ? pending.tags.map((tag) => `${FOREST_TAG_ICONS[tag] || "•"} ${tag}`).join(" / ") : "-";
    if (pending.allow_multiple) {
      return `Free play active: place any number of matching ${labels} cards, or finish pending.`;
    }
    return `Free play active: place one matching ${labels} card, or finish pending.`;
  }
  if (pending.type === "raccoon") {
    return "Raccoon: mark any remaining hand cards to tuck under your cave, then confirm.";
  }
  return "Resolve the current pending effect.";
}

function forestShuffleSelectionText(view) {
  const card = forestShuffleSelectedCard(view);
  if (!card) {
    return "No card selected.";
  }
  const parts = [`Card: ${card.name}`];
  if (card.kind === "split") {
    const half = forestShuffleSelectedHalf(view);
    parts.push(`Half: ${half ? `${half.slot.toUpperCase()} ${half.name}` : "-"}`);
  }
  parts.push(`Payments: ${forestShuffleSelectedPaymentIds.size}`);
  parts.push(`Tree: ${forestShuffleSelectedTreeId || "-"}`);
  return parts.join(" | ");
}

function forestShufflePendingAllowsCard(view, card, half) {
  const pending = forestShufflePending(view);
  if (!pending || pending.type !== "free_play") {
    return true;
  }
  const required = new Set(pending.tags || []);
  if (card.kind === "tree") {
    return required.has("tree");
  }
  return !!half && (half.tags || []).some((tag) => required.has(tag));
}

function forestShuffleCardButton(text, onClick, selected = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "forest-shuffle-mini-btn";
  if (selected) {
    btn.classList.add("selected");
  }
  btn.textContent = text;
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

function forestShuffleRenderHand(view) {
  if (!forestShuffleHand) {
    return;
  }
  forestShuffleHand.innerHTML = "";
  const pending = forestShufflePending(view);
  const yourTurn = forestShuffleIsYourTurn(view) || !!pending;
  forestShuffleCurrentHand(view).forEach((card) => {
    const node = document.createElement("article");
    node.className = "forest-shuffle-card";
    if (card.id === forestShuffleSelectedCardId) {
      node.classList.add("selected");
    }

    const title = document.createElement("div");
    title.className = "forest-shuffle-card-title";
    title.textContent = card.name;
    node.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "forest-shuffle-card-meta";
    if (card.kind === "tree") {
      meta.textContent = `🌳 Tree | Cost ${card.cost}`;
    } else {
      meta.textContent = `${card.orientation === "top_bottom" ? "↕ Split" : "↔ Split"} | Payment ${card.payment_symbols.join(", ")}`;
    }
    node.appendChild(meta);

    if (card.kind === "tree") {
      const symbolRow = document.createElement("div");
      symbolRow.className = "forest-shuffle-symbol-row";
      symbolRow.appendChild(forestShuffleSymbolChip(card.tree_species));
      node.appendChild(symbolRow);
    } else {
      card.halves.forEach((half, halfIndex) => {
        const halfNode = document.createElement("div");
        halfNode.className = "forest-shuffle-half";
        const line = document.createElement("div");
        line.className = "forest-shuffle-half-title";
        line.textContent = `${half.slot.toUpperCase()} · ${half.name} · Cost ${half.cost}`;
        halfNode.appendChild(line);
        const line2 = document.createElement("div");
        line2.className = "forest-shuffle-symbol-row";
        line2.appendChild(forestShuffleSymbolChip(half.symbol));
        halfNode.appendChild(line2);
        halfNode.appendChild(forestShuffleTagRow(half.tags));
        if (yourTurn && pending?.type !== "raccoon") {
          const canUse = forestShufflePendingAllowsCard(view, card, half);
          const btn = forestShuffleCardButton(
            `Select ${half.slot}`,
            () => {
              if (forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === halfIndex) {
                forestShuffleSelectedCardId = null;
                forestShuffleSelectedHalfIndex = null;
                forestShuffleSelectedTreeId = null;
              } else {
                forestShuffleSelectedCardId = card.id;
                forestShuffleSelectedHalfIndex = halfIndex;
                forestShuffleSelectedTreeId = null;
                forestShuffleSelectedPaymentIds.delete(card.id);
              }
              renderForestShuffleGameState({ view });
            },
            forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === halfIndex
          );
          btn.disabled = !canUse;
          halfNode.appendChild(btn);
        }
        node.appendChild(halfNode);
      });
    }

    if (pending?.type === "raccoon") {
      const toggle = forestShuffleCardButton(
        forestShuffleSelectedRaccoonIds.has(card.id) ? "Remove From Cave" : "Mark For Cave",
        () => {
          if (forestShuffleSelectedRaccoonIds.has(card.id)) {
            forestShuffleSelectedRaccoonIds.delete(card.id);
          } else {
            forestShuffleSelectedRaccoonIds.add(card.id);
          }
          renderForestShuffleGameState({ view });
        },
        forestShuffleSelectedRaccoonIds.has(card.id)
      );
      node.appendChild(toggle);
    } else if (!pending && yourTurn) {
      const footer = document.createElement("div");
      footer.className = "forest-shuffle-card-actions";
      if (card.kind === "tree") {
        footer.appendChild(
          forestShuffleCardButton(
            "Select",
            () => {
              if (forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === null) {
                forestShuffleSelectedCardId = null;
              } else {
                forestShuffleSelectedCardId = card.id;
                forestShuffleSelectedHalfIndex = null;
                forestShuffleSelectedTreeId = null;
                forestShuffleSelectedPaymentIds.delete(card.id);
              }
              renderForestShuffleGameState({ view });
            },
            forestShuffleSelectedCardId === card.id && forestShuffleSelectedHalfIndex === null
          )
        );
        footer.appendChild(
          forestShuffleCardButton("Sapling", () => {
            forestShuffleSelectedCardId = card.id;
            forestShuffleSelectedHalfIndex = null;
            forestShuffleSelectedTreeId = null;
            renderForestShuffleGameState({ view });
          })
        );
      }
      const payButton = forestShuffleCardButton(
        forestShuffleSelectedPaymentIds.has(card.id) ? "Unpay" : "Pay",
        () => {
          if (forestShuffleSelectedPaymentIds.has(card.id)) {
            forestShuffleSelectedPaymentIds.delete(card.id);
          } else {
            forestShuffleSelectedPaymentIds.add(card.id);
          }
          renderForestShuffleGameState({ view });
        },
        forestShuffleSelectedPaymentIds.has(card.id)
      );
      payButton.disabled = card.id === forestShuffleSelectedCardId;
      footer.appendChild(payButton);
      node.appendChild(footer);
    }

    forestShuffleHand.appendChild(node);
  });
}

function forestShuffleRenderDrawSources(view) {
  if (!forestShuffleDrawSources) {
    return;
  }
  forestShuffleDrawSources.innerHTML = "";
  const pending = forestShufflePending(view);
  const yourTurn = forestShuffleIsYourTurn(view);
  const required = forestShuffleRequiredDrawCount(view);
  const deckBox = document.createElement("button");
  deckBox.type = "button";
  deckBox.className = "forest-shuffle-source-card";
  deckBox.textContent = `🂠 Deck x${forestShuffleDeckDrawCount}`;
  deckBox.disabled = !yourTurn || !!pending || required <= 0;
  deckBox.addEventListener("click", () => {
    if (forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size >= required) {
      forestShuffleDeckDrawCount = 0;
    } else {
      forestShuffleDeckDrawCount += 1;
    }
    renderForestShuffleGameState({ view });
  });
  forestShuffleDrawSources.appendChild(deckBox);

  (view.clearing || []).forEach((card) => {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "forest-shuffle-source-card";
    if (forestShuffleSelectedClearingIds.has(card.id)) {
      node.classList.add("selected");
    }
    node.disabled = !yourTurn || !!pending || required <= 0;
    node.textContent = card.name;
    node.addEventListener("click", () => {
      if (forestShuffleSelectedClearingIds.has(card.id)) {
        forestShuffleSelectedClearingIds.delete(card.id);
      } else if (forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size < required) {
        forestShuffleSelectedClearingIds.add(card.id);
      }
      renderForestShuffleGameState({ view });
    });
    forestShuffleDrawSources.appendChild(node);
  });
}

function forestShuffleTreeSlot(view, player, tree, side, interactive) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "forest-shuffle-slot";
  node.dataset.forestShuffleExplain = "players";
  const cards = ((tree.slots || {})[side]) || [];
  const selectedSide = forestShuffleActiveSlot(view);
  const isSelectable = interactive && selectedSide === side;
  const title = document.createElement("div");
  title.className = "forest-shuffle-slot-label";
  title.textContent = `${side.toUpperCase()} ${cards.length ? `(${cards.length})` : ""}`.trim();
  node.appendChild(title);
  const stack = document.createElement("div");
  stack.className = "forest-shuffle-slot-stack";
  if (!cards.length) {
    const empty = document.createElement("span");
    empty.className = "forest-shuffle-slot-empty";
    empty.textContent = "Empty";
    stack.appendChild(empty);
  } else {
    cards.forEach((card) => {
      const chip = document.createElement("span");
      chip.className = "forest-shuffle-slot-card";
      chip.textContent = card.name;
      stack.appendChild(chip);
    });
  }
  node.appendChild(stack);
  if (interactive && selectedSide === side && player.player_id === view.you) {
    node.classList.add("selectable");
    if (forestShuffleSelectedTreeId === tree.id) {
      node.classList.add("selected");
    }
    node.addEventListener("click", () => {
      forestShuffleSelectedTreeId = forestShuffleSelectedTreeId === tree.id ? null : tree.id;
      renderForestShuffleGameState({ view });
    });
  } else {
    node.disabled = true;
  }
  return node;
}

function forestShuffleRenderPlayers(view) {
  if (!forestShufflePlayers) {
    return;
  }
  forestShufflePlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const canTargetSlots = player.player_id === view.you && (
      (forestShuffleIsYourTurn(view) && !forestShufflePending(view)) ||
      forestShufflePending(view)?.type === "free_play"
    );
    const card = document.createElement("section");
    card.className = "forest-shuffle-player";
    if (player.player_id === view.you) {
      card.classList.add("you");
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("active");
    }
    card.dataset.forestShuffleExplain = "players";

    const header = document.createElement("div");
    header.className = "forest-shuffle-player-header";
    const title = document.createElement("div");
    title.className = "forest-shuffle-player-name";
    title.textContent = `${player.name}${player.player_id === view.you ? " (You)" : ""}`;
    header.appendChild(title);
    const stats = document.createElement("div");
    stats.className = "forest-shuffle-player-stats";
    stats.textContent = `🃏 ${player.hand_count} | 🕳️ ${player.forest.cave_count} | ⭐ ${player.score}`;
    header.appendChild(stats);
    card.appendChild(header);

    const treeWrap = document.createElement("div");
    treeWrap.className = "forest-shuffle-tree-list";
    (player.forest.trees || []).forEach((tree) => {
      const treeNode = document.createElement("article");
      treeNode.className = "forest-shuffle-tree";
      const label = document.createElement("div");
      label.className = "forest-shuffle-tree-label";
      label.textContent = tree.kind === "sapling" ? "🌱 Tree Sapling" : `🌳 ${tree.name}`;
      treeNode.appendChild(label);
      if (tree.tree_species) {
        const symbolLine = document.createElement("div");
        symbolLine.className = "forest-shuffle-symbol-row";
        symbolLine.appendChild(forestShuffleSymbolChip(tree.tree_species));
        treeNode.appendChild(symbolLine);
      }
      const grid = document.createElement("div");
      grid.className = "forest-shuffle-tree-grid";
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "top", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "left", canTargetSlots));
      const center = document.createElement("div");
      center.className = "forest-shuffle-tree-center";
      center.textContent = tree.kind === "sapling" ? "🌱" : "🌳";
      grid.appendChild(center);
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "right", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      grid.appendChild(forestShuffleTreeSlot(view, player, tree, "bottom", canTargetSlots));
      grid.appendChild(document.createElement("div"));
      treeNode.appendChild(grid);
      treeWrap.appendChild(treeNode);
    });
    card.appendChild(treeWrap);

    if (view.game_over && Array.isArray(player.score_breakdown) && player.score_breakdown.length) {
      const breakdown = document.createElement("details");
      breakdown.className = "forest-shuffle-breakdown";
      const summary = document.createElement("summary");
      summary.textContent = "Score Breakdown";
      breakdown.appendChild(summary);
      player.score_breakdown.forEach((item) => {
        const row = document.createElement("div");
        row.className = "forest-shuffle-breakdown-row";
        row.textContent = `${item.name}: ${item.points}`;
        breakdown.appendChild(row);
      });
      card.appendChild(breakdown);
    }

    forestShufflePlayers.appendChild(card);
  });
}

function forestShuffleRenderClearing(view) {
  if (!forestShuffleClearing) {
    return;
  }
  forestShuffleClearing.innerHTML = "";
  (view.clearing || []).forEach((card) => {
    const node = document.createElement("article");
    node.className = "forest-shuffle-card compact";
    node.dataset.forestShuffleExplain = "clearing";
    const title = document.createElement("div");
    title.className = "forest-shuffle-card-title";
    title.textContent = card.name;
    node.appendChild(title);
    if (card.kind === "tree") {
      const symbolRow = document.createElement("div");
      symbolRow.className = "forest-shuffle-symbol-row";
      symbolRow.appendChild(forestShuffleSymbolChip(card.tree_species));
      node.appendChild(symbolRow);
    } else if (Array.isArray(card.halves)) {
      card.halves.forEach((half) => {
        const line = document.createElement("div");
        line.className = "forest-shuffle-half-mini";
        line.textContent = `${half.slot.toUpperCase()} ${half.name}`;
        node.appendChild(line);
      });
    }
    forestShuffleClearing.appendChild(node);
  });
}

function updateForestShuffleActionButtons() {
  const view = currentForestShuffleView;
  const pending = forestShufflePending(view || {});
  const yourTurn = forestShuffleIsYourTurn(view || {});
  const requiredDraws = view ? forestShuffleRequiredDrawCount(view) : 0;
  const drawCount = forestShuffleDeckDrawCount + forestShuffleSelectedClearingIds.size;
  const selectedCard = view ? forestShuffleSelectedCard(view) : null;
  const selectedHalf = view ? forestShuffleSelectedHalf(view) : null;
  const canDraw = !!view && yourTurn && !pending && requiredDraws > 0 && drawCount === requiredDraws;
  const canPlayTree = !!view && !pending && yourTurn && selectedCard && selectedCard.kind === "tree";
  const canPlaySplit = !!view && !pending && yourTurn && selectedCard && selectedCard.kind === "split" && selectedHalf && forestShuffleSelectedTreeId;
  const canFreePlaySplit = !!view && pending?.type === "free_play" && selectedCard && selectedCard.kind === "split" && selectedHalf && forestShuffleSelectedTreeId;
  const canFinishPending = !!view && pending?.type === "free_play";
  const canResolveRaccoon = !!view && pending?.type === "raccoon";
  if (forestShuffleDrawBtn) {
    forestShuffleDrawBtn.disabled = !canDraw;
  }
  if (forestShufflePlayBtn) {
    forestShufflePlayBtn.disabled = !(canPlayTree || canPlaySplit || canFreePlaySplit);
  }
  if (forestShuffleSaplingBtn) {
    forestShuffleSaplingBtn.disabled = !(canPlayTree && selectedCard);
  }
  if (forestShuffleFinishPendingBtn) {
    forestShuffleFinishPendingBtn.disabled = !canFinishPending;
  }
  if (forestShuffleResolveRaccoonBtn) {
    forestShuffleResolveRaccoonBtn.disabled = !canResolveRaccoon;
  }
}

function renderForestShuffleGameState(data) {
  const view = data.view;
  currentForestShuffleView = view;
  if (currentGameType !== "forest_shuffle") {
    currentGameType = "forest_shuffle";
    setGamePanelVisibility("forest_shuffle");
  }
  forestShuffleSyncSelections(view);

  if (forestShuffleTurnLabel) {
    forestShuffleTurnLabel.textContent = forestShufflePlayerName(view, view.current_turn);
  }
  if (forestShuffleWinterLabel) {
    forestShuffleWinterLabel.textContent = `${view.winter_count}/3`;
  }
  if (forestShuffleDeckLabel) {
    forestShuffleDeckLabel.textContent = `${view.deck_count}`;
  }
  if (forestShuffleWinnerLabel) {
    forestShuffleWinnerLabel.textContent = Array.isArray(view.winner) && view.winner.length
      ? view.winner.map((playerId) => forestShufflePlayerName(view, playerId)).join(", ")
      : "-";
  }
  if (forestShuffleStatus) {
    forestShuffleStatus.textContent = view.game_over
      ? "Game over. Score previews are final."
      : forestShufflePendingHint(view);
  }
  if (forestShuffleActionHint) {
    forestShuffleActionHint.textContent = forestShufflePendingHint(view);
  }
  if (forestShuffleSelectionSummary) {
    forestShuffleSelectionSummary.textContent = forestShuffleSelectionText(view);
  }
  if (forestShuffleNotes) {
    forestShuffleNotes.innerHTML = "";
    (view.implementation_notes || []).forEach((note) => {
      const item = document.createElement("div");
      item.className = "forest-shuffle-note";
      item.textContent = `Note: ${note}`;
      forestShuffleNotes.appendChild(item);
    });
  }

  forestShuffleRenderDrawSources(view);
  forestShuffleRenderClearing(view);
  forestShuffleRenderHand(view);
  forestShuffleRenderPlayers(view);
  updateForestShuffleActionButtons();
  logGameEvents(data);
  if (forestShuffleExplainMode) {
    updateForestShuffleExplainModeClasses(true);
  }
}

if (forestShuffleDrawBtn) {
  forestShuffleDrawBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const sources = [];
    for (let index = 0; index < forestShuffleDeckDrawCount; index += 1) {
      sources.push({ zone: "deck" });
    }
    forestShuffleSelectedClearingIds.forEach((cardId) => {
      sources.push({ zone: "clearing", card_id: cardId });
    });
    sendAction({ type: "draw_cards", sources });
    forestShuffleDeckDrawCount = 0;
    forestShuffleSelectedClearingIds = new Set();
    updateForestShuffleActionButtons();
  });
}

if (forestShufflePlayBtn) {
  forestShufflePlayBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const pending = forestShufflePending(currentForestShuffleView);
    const card = forestShuffleSelectedCard(currentForestShuffleView);
    if (!card) {
      log("Select a card");
      return;
    }
    const action = {
      type: "play_card",
      card_id: card.id,
    };
    if (!pending) {
      action.pay_card_ids = Array.from(forestShuffleSelectedPaymentIds);
    }
    if (card.kind === "split") {
      if (!Number.isInteger(forestShuffleSelectedHalfIndex) || !forestShuffleSelectedTreeId) {
        log("Select a card half and target tree slot");
        return;
      }
      action.half_index = forestShuffleSelectedHalfIndex;
      action.target_tree_id = forestShuffleSelectedTreeId;
    }
    sendAction(action);
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
    forestShuffleSelectedPaymentIds = new Set();
  });
}

if (forestShuffleSaplingBtn) {
  forestShuffleSaplingBtn.addEventListener("click", () => {
    if (!currentForestShuffleView) {
      return;
    }
    const card = forestShuffleSelectedCard(currentForestShuffleView);
    if (!card) {
      log("Select a card first");
      return;
    }
    sendAction({ type: "play_card", card_id: card.id, play_as: "sapling" });
    forestShuffleSelectedCardId = null;
    forestShuffleSelectedHalfIndex = null;
    forestShuffleSelectedTreeId = null;
    forestShuffleSelectedPaymentIds = new Set();
  });
}

if (forestShuffleFinishPendingBtn) {
  forestShuffleFinishPendingBtn.addEventListener("click", () => {
    sendAction({ type: "finish_pending" });
  });
}

if (forestShuffleResolveRaccoonBtn) {
  forestShuffleResolveRaccoonBtn.addEventListener("click", () => {
    sendAction({ type: "resolve_raccoon", card_ids: Array.from(forestShuffleSelectedRaccoonIds) });
    forestShuffleSelectedRaccoonIds = new Set();
  });
}

function showForestShuffleHeaderActions(show) {
  if (forestShuffleHeaderActions) {
    forestShuffleHeaderActions.style.display = show ? "flex" : "none";
  }
  if (!show) {
    exitForestShuffleExplainMode();
    closeForestShuffleHelpModal();
    closeForestShuffleExplainModal();
  }
}

function showForestShuffleHelpModal() {
  if (!forestShuffleHelpModal) {
    return;
  }
  if (forestShuffleHelpContent) {
    forestShuffleHelpContent.innerHTML = FOREST_SHUFFLE_HELP_TEXT;
  }
  setModalVisible(forestShuffleHelpModal, true);
}

function closeForestShuffleHelpModal() {
  if (forestShuffleHelpModal) {
    setModalVisible(forestShuffleHelpModal, false);
  }
}

function updateForestShuffleExplainModeClasses(enabled) {
  document.querySelectorAll("[data-forest-shuffle-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled);
  });
  [
    forestShuffleDrawBtn,
    forestShufflePlayBtn,
    forestShuffleSaplingBtn,
    forestShuffleFinishPendingBtn,
    forestShuffleResolveRaccoonBtn,
  ].forEach((button) => {
    if (button) {
      button.classList.toggle("has-explanation", enabled);
    }
  });
}

function toggleForestShuffleExplainMode() {
  forestShuffleExplainMode = !forestShuffleExplainMode;
  document.body.classList.toggle("forest-shuffle-explain-mode", forestShuffleExplainMode);
  updateForestShuffleExplainModeClasses(forestShuffleExplainMode);
  if (forestShuffleExplainBtn) {
    forestShuffleExplainBtn.classList.toggle("active", forestShuffleExplainMode);
  }
}

function exitForestShuffleExplainMode() {
  if (!forestShuffleExplainMode) {
    return;
  }
  forestShuffleExplainMode = false;
  document.body.classList.remove("forest-shuffle-explain-mode");
  updateForestShuffleExplainModeClasses(false);
  if (forestShuffleExplainBtn) {
    forestShuffleExplainBtn.classList.remove("active");
  }
}

function showForestShuffleExplanation(key) {
  const explanation = FOREST_SHUFFLE_EXPLANATIONS[key];
  if (!explanation || !forestShuffleExplainContent || !forestShuffleExplainModal) {
    return;
  }
  forestShuffleExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `;
  setModalVisible(forestShuffleExplainModal, true);
}

function closeForestShuffleExplainModal() {
  if (forestShuffleExplainModal) {
    setModalVisible(forestShuffleExplainModal, false);
  }
}

if (forestShuffleHelpBtn) {
  forestShuffleHelpBtn.addEventListener("click", showForestShuffleHelpModal);
}

if (forestShuffleHelpModalCloseBtn) {
  forestShuffleHelpModalCloseBtn.addEventListener("click", closeForestShuffleHelpModal);
}

if (forestShuffleExplainBtn) {
  forestShuffleExplainBtn.addEventListener("click", toggleForestShuffleExplainMode);
}

if (forestShuffleExplainModalCloseBtn) {
  forestShuffleExplainModalCloseBtn.addEventListener("click", closeForestShuffleExplainModal);
}

document.addEventListener("pointerdown", (event) => {
  if (!forestShuffleExplainMode) {
    return;
  }
  const explainTarget = event.target.closest("[data-forest-shuffle-explain]");
  if (explainTarget) {
    const key = explainTarget.dataset.forestShuffleExplain;
    if (key) {
      event.preventDefault();
      event.stopPropagation();
      showForestShuffleExplanation(key);
      exitForestShuffleExplainMode();
      return;
    }
  }
  const button = event.target.closest("button");
  if (
    button === forestShuffleExplainBtn ||
    button === forestShuffleHelpBtn ||
    button === forestShuffleHelpModalCloseBtn ||
    button === forestShuffleExplainModalCloseBtn
  ) {
    return;
  }
  if (button && FOREST_SHUFFLE_EXPLANATIONS[button.id]) {
    event.preventDefault();
    event.stopPropagation();
    showForestShuffleExplanation(button.id);
    exitForestShuffleExplainMode();
  }
}, true);

document.addEventListener("click", (event) => {
  if (!forestShuffleExplainMode) {
    return;
  }
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (
    button === forestShuffleExplainBtn ||
    button === forestShuffleHelpBtn ||
    button === forestShuffleHelpModalCloseBtn ||
    button === forestShuffleExplainModalCloseBtn
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && forestShuffleExplainMode) {
    exitForestShuffleExplainMode();
  }
});

window.clearForestShuffleState = clearForestShuffleState;
window.renderForestShuffleGameState = renderForestShuffleGameState;
window.showForestShuffleHeaderActions = showForestShuffleHeaderActions;
