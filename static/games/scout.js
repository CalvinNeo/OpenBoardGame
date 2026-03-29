let currentScoutView = null
let scoutRangeAnchor = null
let scoutRangeFocus = null
let scoutTakeSide = null
let scoutInsertIndex = null
let scoutInsertFace = "a"
let scoutExplainMode = false

const scoutGamePanel = document.getElementById("scoutPanel")
const scoutHeaderActions = document.getElementById("scoutHeaderActions")
const scoutHelpBtn = document.getElementById("scoutHelpBtn")
const scoutExplainBtn = document.getElementById("scoutExplainBtn")
const scoutHelpModal = document.getElementById("scoutHelpModal")
const scoutHelpModalCloseBtn = document.getElementById("scoutHelpModalCloseBtn")
const scoutExplainModal = document.getElementById("scoutExplainModal")
const scoutExplainModalCloseBtn = document.getElementById("scoutExplainModalCloseBtn")
const scoutHelpContent = document.getElementById("scoutHelpContent")
const scoutExplainContent = document.getElementById("scoutExplainContent")

const scoutPhaseLabel = document.getElementById("scoutPhase")
const scoutRoundLabel = document.getElementById("scoutRound")
const scoutTurnLabel = document.getElementById("scoutTurn")
const scoutStartPlayerLabel = document.getElementById("scoutStartPlayer")
const scoutActiveOwnerLabel = document.getElementById("scoutActiveOwner")
const scoutWinnerLabel = document.getElementById("scoutWinner")
const scoutVariantLabel = document.getElementById("scoutVariant")
const scoutCenterTokensLabel = document.getElementById("scoutCenterTokens")
const scoutSelectionLabel = document.getElementById("scoutSelectionLabel")

const scoutRoundNotice = document.getElementById("scoutRoundNotice")
const scoutRoundNoticeTitle = document.getElementById("scoutRoundNoticeTitle")
const scoutRoundNoticeBody = document.getElementById("scoutRoundNoticeBody")
const scoutRoundNoticeList = document.getElementById("scoutRoundNoticeList")
const scoutOpening = document.getElementById("scoutOpening")
const scoutActiveSet = document.getElementById("scoutActiveSet")
const scoutHand = document.getElementById("scoutHand")
const scoutPreviewArea = document.getElementById("scoutPreviewArea")
const scoutPlayers = document.getElementById("scoutPlayers")
const scoutHint = document.getElementById("scoutHint")

const scoutReadyKeepBtn = document.getElementById("scoutReadyKeepBtn")
const scoutReadyFlipBtn = document.getElementById("scoutReadyFlipBtn")
const scoutShowBtn = document.getElementById("scoutShowBtn")
const scoutScoutBtn = document.getElementById("scoutScoutBtn")
const scoutScoutShowBtn = document.getElementById("scoutScoutShowBtn")

const SCOUT_HELP_TEXT = `
  <h3>Goal</h3>
  <p>Win rounds by clearing your hand or by owning the active set when the turn comes back to you. Your total score across all rounds decides the game.</p>

  <h3>Core Restriction</h3>
  <p>Your hand order matters. You can only <strong>Show</strong> a continuous block from your hand. At the start of each round, you may either keep the dealt order or flip the entire hand once.</p>

  <h3>Show</h3>
  <ul>
    <li>Valid sets are a single card, a set of equal numbers, or a straight in either direction.</li>
    <li>Longer beats shorter.</li>
    <li>At equal length, <strong>set</strong> beats <strong>run</strong>.</li>
    <li>At equal type and length, the higher value wins.</li>
  </ul>

  <h3>Scout</h3>
  <ul>
    <li>Take only the leftmost or rightmost card from the active set.</li>
    <li>Insert it anywhere into your hand and choose which number stays face-up.</li>
    <li>In 3-5 player games, the active-set owner gains 1 Scout point whenever someone scouts from them.</li>
  </ul>

  <h3>Scout + Show</h3>
  <p>In 3-5 player games, each player may use <strong>Scout + Show</strong> once per round: scout a card, keep the turn, then either Show from the updated hand or finish the turn without Showing.</p>

  <h3>2-Player Duel</h3>
  <ul>
    <li>No Scout + Show token.</li>
    <li>Each player has 3 Scout tokens per round.</li>
    <li>If you Scout, your turn continues until you Show or you run out of Scout tokens and still cannot Show.</li>
  </ul>

  <h3>Interface</h3>
  <ul>
    <li>Click cards in your hand to choose a continuous range for Show.</li>
    <li>Click the top or bottom half of an edge card to choose both the Scout side and the number you want.</li>
    <li>Choose an insertion gap, then use <strong>Scout</strong> or <strong>Scout + Show</strong>.</li>
    <li>After <strong>Scout + Show</strong>, select from your real hand to Show, or click <strong>Finish Turn</strong>.</li>
    <li>Click empty space in your hand area to clear the current selection.</li>
  </ul>
`

const SCOUT_EXPLANATIONS = {
  activeSet: {
    name: "Active Set",
    description: "This is the current public set on stage. Everyone must beat it with Show, or click the upper or lower half of an edge card to Scout that number.",
  },
  yourHand: {
    name: "Your Hand",
    description: "Click one card, then another, to select a continuous interval for Show. Hand order is fixed during the round.",
  },
  previewHand: {
    name: "After Scout Preview",
    description: "When you choose a Scout side and insertion gap, this preview shows the post-Scout hand. If you use Scout + Show, the Scout resolves first and you may then Show from Your Hand or finish turn.",
  },
  players: {
    name: "Players",
    description: "Each player card shows current score, hand count, captured cards this round, and round-specific Scout resources.",
  },
  readyKeepBtn: {
    name: "Keep Order",
    description: "Start the round with the dealt order and face-up sides exactly as shown.",
  },
  readyFlipBtn: {
    name: "Flip Whole Hand",
    description: "Reverse the entire hand and flip every card to its opposite face-up side.",
  },
  showBtn: {
    name: "Show Selected",
    description: "Play the currently selected interval from your real hand.",
  },
  scoutBtn: {
    name: "Scout",
    description: "Take one edge card from the active set and insert it into your hand.",
  },
  scoutShowBtn: {
    name: "Scout + Show",
    description: "Available once per round in 3-5 player games. Use it to Scout and keep the turn. Then you may Show from Your Hand or finish turn.",
  },
}

function scoutPlayerName(view, playerId) {
  const player = (view && view.players ? view.players : []).find((entry) => entry.player_id === playerId)
  return player ? player.name || player.player_id : playerId || "-"
}

function scoutHasLegalAction(actionType) {
  return !!(currentScoutView && Array.isArray(currentScoutView.legal_actions) && currentScoutView.legal_actions.includes(actionType))
}

function scoutIsPendingScoutShow(view) {
  return !!(view && view.your_scout_and_show_pending)
}

function showScoutHeaderActions(show) {
  if (scoutHeaderActions) {
    scoutHeaderActions.style.display = show ? "flex" : "none"
  }
  if (!show) {
    exitScoutExplainMode()
    closeScoutHelpModal()
    closeScoutExplainModal()
  }
}

function showScoutHelpModal() {
  if (!scoutHelpModal) {
    return
  }
  if (scoutHelpContent) {
    scoutHelpContent.innerHTML = SCOUT_HELP_TEXT
  }
  setModalVisible(scoutHelpModal, true)
}

function closeScoutHelpModal() {
  if (scoutHelpModal) {
    setModalVisible(scoutHelpModal, false)
  }
}

function showScoutExplanation(explainId) {
  const explanation = SCOUT_EXPLANATIONS[explainId]
  if (!explanation || !scoutExplainContent || !scoutExplainModal) {
    return
  }
  scoutExplainContent.innerHTML = `
    <h4>${explanation.name}</h4>
    <p>${explanation.description}</p>
  `
  setModalVisible(scoutExplainModal, true)
}

function closeScoutExplainModal() {
  if (scoutExplainModal) {
    setModalVisible(scoutExplainModal, false)
  }
}

function updateScoutExplainModeClasses(enabled) {
  document.querySelectorAll("[data-scout-explain]").forEach((node) => {
    node.classList.toggle("has-explanation", enabled)
  })
}

function toggleScoutExplainMode() {
  scoutExplainMode = !scoutExplainMode
  document.body.classList.toggle("scout-explain-mode", scoutExplainMode)
  updateScoutExplainModeClasses(scoutExplainMode)
  if (scoutExplainBtn) {
    scoutExplainBtn.classList.toggle("active", scoutExplainMode)
  }
}

function exitScoutExplainMode() {
  if (!scoutExplainMode) {
    return
  }
  scoutExplainMode = false
  document.body.classList.remove("scout-explain-mode")
  updateScoutExplainModeClasses(false)
  if (scoutExplainBtn) {
    scoutExplainBtn.classList.remove("active")
  }
}

function scoutExplainIdForElement(node) {
  const target = node && node.closest ? node.closest("[data-scout-explain]") : null
  return target ? target.getAttribute("data-scout-explain") : null
}

function clearScoutSelection() {
  scoutRangeAnchor = null
  scoutRangeFocus = null
  scoutTakeSide = null
  scoutInsertIndex = null
}

function clearScoutRangeSelection() {
  scoutRangeAnchor = null
  scoutRangeFocus = null
}

function scoutSelectedRange() {
  if (!Number.isInteger(scoutRangeAnchor) || !Number.isInteger(scoutRangeFocus)) {
    return null
  }
  return {
    start: Math.min(scoutRangeAnchor, scoutRangeFocus),
    end: Math.max(scoutRangeAnchor, scoutRangeFocus),
  }
}

function scoutFaceIndex(face) {
  return face === "b" ? 1 : 0
}

function scoutCanonicalFace(face) {
  return face === "b" ? "b" : "a"
}

function scoutOppositeFace(face) {
  return scoutCanonicalFace(face) === "b" ? "a" : "b"
}

function scoutValue(card, face) {
  if (!card || !Array.isArray(card.values) || card.values.length < 2) {
    return null
  }
  return card.values[scoutFaceIndex(face || card.face_up)]
}

function scoutFaceForRegion(card, region) {
  const faceUp = scoutCanonicalFace(card && card.face_up)
  return region === "bottom" ? scoutOppositeFace(faceUp) : faceUp
}

function scoutRegionForFace(card, face) {
  return scoutCanonicalFace(face) === scoutCanonicalFace(card && card.face_up) ? "top" : "bottom"
}

function scoutCurrentValue(card) {
  return card && Number.isInteger(card.current) ? card.current : scoutValue(card, card ? card.face_up : "a")
}

function scoutClassifyCards(cards) {
  if (!Array.isArray(cards) || !cards.length) {
    return null
  }
  const values = cards.map((card) => scoutCurrentValue(card))
  if (values.some((value) => !Number.isInteger(value))) {
    return null
  }
  if (values.length === 1) {
    return { combo_type: "single", length: 1, rank_value: values[0], values }
  }
  if (values.every((value) => value === values[0])) {
    return { combo_type: "set", length: values.length, rank_value: values[0], values }
  }
  const diffs = []
  for (let index = 0; index < values.length - 1; index += 1) {
    diffs.push(values[index + 1] - values[index])
  }
  if (diffs.every((diff) => diff === 1) || diffs.every((diff) => diff === -1)) {
    return { combo_type: "run", length: values.length, rank_value: Math.max(...values), values }
  }
  return null
}

function scoutBeats(candidate, activeSet) {
  if (!activeSet) {
    return true
  }
  if (candidate.length !== activeSet.length) {
    return candidate.length > activeSet.length
  }
  if (candidate.combo_type !== activeSet.combo_type) {
    if (candidate.combo_type === "set" && activeSet.combo_type === "run") {
      return true
    }
    if (candidate.combo_type === "run" && activeSet.combo_type === "set") {
      return false
    }
  }
  return candidate.rank_value > activeSet.rank_value
}

function scoutComboLabel(combo) {
  if (!combo) {
    return "-"
  }
  if (combo.combo_type === "single") {
    return `${combo.values[0]}`
  }
  const body = Array.isArray(combo.values) ? combo.values.join("-") : combo.rank_value
  return `${combo.combo_type} ${body}`
}

function scoutRangeCards(cards, range) {
  if (!range || !Array.isArray(cards)) {
    return []
  }
  return cards.slice(range.start, range.end + 1)
}

function scoutChosenActiveCard(view) {
  if (!view || !view.active_set || !Array.isArray(view.active_set.cards) || !scoutTakeSide) {
    return null
  }
  const cards = view.active_set.cards
  return scoutTakeSide === "left" ? cards[0] : cards[cards.length - 1]
}

function scoutPreviewInsertedCard(view) {
  const card = scoutChosenActiveCard(view)
  if (!card) {
    return null
  }
  const face = scoutCanonicalFace(scoutInsertFace)
  const current = scoutValue(card, face)
  const back = scoutValue(card, scoutOppositeFace(face))
  return {
    id: `${card.id}:${face}`,
    values: Array.isArray(card.values) ? [...card.values] : [card.current, card.back],
    face_up: face,
    current,
    back,
    ghost: true,
  }
}

function scoutWorkingHand(view) {
  const baseHand = Array.isArray(view && view.your_hand) ? view.your_hand : []
  if (!scoutTakeSide || !Number.isInteger(scoutInsertIndex)) {
    return baseHand
  }
  const ghost = scoutPreviewInsertedCard(view)
  if (!ghost) {
    return baseHand
  }
  const next = baseHand.slice()
  next.splice(scoutInsertIndex, 0, ghost)
  return next
}

function scoutActiveAfterScout(view) {
  if (!view || !view.active_set || !Array.isArray(view.active_set.cards) || !scoutTakeSide) {
    return view ? view.active_set : null
  }
  const remaining = view.active_set.cards.slice()
  if (scoutTakeSide === "left") {
    remaining.shift()
  } else {
    remaining.pop()
  }
  if (!remaining.length) {
    return null
  }
  const combo = scoutClassifyCards(remaining)
  if (!combo) {
    return null
  }
  return {
    owner_player_id: view.active_set.owner_player_id,
    combo_type: combo.combo_type,
    length: combo.length,
    rank_value: combo.rank_value,
    values: combo.values,
    cards: remaining,
  }
}

function scoutSelectionSummary(view) {
  const range = scoutSelectedRange()
  const inserted = scoutPreviewInsertedCard(view)
  if (scoutTakeSide && Number.isInteger(scoutInsertIndex)) {
    const workingHand = scoutWorkingHand(view)
    if (!range) {
      return inserted
        ? `${scoutTakeSide} ${inserted.current} -> gap ${scoutInsertIndex}`
        : `${scoutTakeSide} edge -> gap ${scoutInsertIndex}`
    }
    const combo = scoutClassifyCards(scoutRangeCards(workingHand, range))
    return combo ? `Preview ${scoutComboLabel(combo)}` : `Preview cards ${range.start + 1}-${range.end + 1}`
  }
  if (!range) {
    return scoutTakeSide
      ? (inserted ? `${scoutTakeSide} ${inserted.current} selected` : `${scoutTakeSide} edge selected`)
      : "-"
  }
  const baseHand = Array.isArray(view && view.your_hand) ? view.your_hand : []
  const combo = scoutClassifyCards(scoutRangeCards(baseHand, range))
  return combo ? scoutComboLabel(combo) : `Cards ${range.start + 1}-${range.end + 1}`
}

function scoutCanShow(view) {
  if (!view || !scoutHasLegalAction("show") || scoutTakeSide) {
    return false
  }
  const range = scoutSelectedRange()
  const combo = scoutClassifyCards(scoutRangeCards(view.your_hand || [], range))
  return !!(combo && scoutBeats(combo, view.active_set))
}

function scoutCanScout(view) {
  return !!(view && scoutHasLegalAction("scout") && scoutTakeSide && Number.isInteger(scoutInsertIndex))
}

function scoutCanScoutShow(view) {
  return !!(view && scoutHasLegalAction("scout_and_show") && scoutTakeSide && Number.isInteger(scoutInsertIndex))
}

function scoutCanFinishScoutShow(view) {
  return !!(view && scoutHasLegalAction("finish_scout_and_show"))
}

function scoutSyncSelection(view) {
  if (!view) {
    clearScoutSelection()
    return
  }
  if (view.phase !== "playing") {
    clearScoutSelection()
    return
  }
  const baseHand = Array.isArray(view.your_hand) ? view.your_hand : []
  if (scoutIsPendingScoutShow(view)) {
    scoutTakeSide = null
    scoutInsertIndex = null
  }
  if (!view.active_set || !scoutTakeSide || view.active_set.owner_player_id === view.you) {
    scoutTakeSide = null
    scoutInsertIndex = null
  }
  if (scoutInsertIndex !== null && (scoutInsertIndex < 0 || scoutInsertIndex > baseHand.length)) {
    scoutInsertIndex = null
  }
  const maxIndex = scoutTakeSide && Number.isInteger(scoutInsertIndex) ? scoutWorkingHand(view).length - 1 : baseHand.length - 1
  if (!Number.isInteger(maxIndex) || maxIndex < 0) {
    clearScoutRangeSelection()
  } else if (
    Number.isInteger(scoutRangeAnchor) &&
    (scoutRangeAnchor < 0 || scoutRangeAnchor > maxIndex || scoutRangeFocus < 0 || scoutRangeFocus > maxIndex)
  ) {
    clearScoutRangeSelection()
  }
}

function renderScoutCard(card, options = {}) {
  const {
    clickable = false,
    selected = false,
    ghost = false,
    edge = null,
    faceSelection = null,
    onClick = null,
    onRegionClick = null,
  } = options
  const interactive = clickable || typeof onClick === "function" || typeof onRegionClick === "function"
  const element = document.createElement(interactive ? "button" : "div")
  element.className = "scout-card"
  if (selected) {
    element.classList.add("selected")
  }
  if (ghost) {
    element.classList.add("ghost")
  }
  if (interactive) {
    element.type = "button"
    element.classList.add("clickable")
  }
  if (typeof onRegionClick === "function") {
    element.classList.add("split-pickable")
  }
  if (faceSelection === "top" || faceSelection === "bottom") {
    const overlay = document.createElement("span")
    overlay.className = `scout-card-face-selection ${faceSelection}`
    element.appendChild(overlay)
  }
  if (typeof onRegionClick === "function") {
    const splitLine = document.createElement("span")
    splitLine.className = "scout-card-split-line"
    element.appendChild(splitLine)
  }
  const current = document.createElement("span")
  current.className = "scout-card-current"
  current.textContent = String(scoutCurrentValue(card))
  const back = document.createElement("span")
  back.className = "scout-card-back"
  back.textContent = String(card && Number.isInteger(card.back) ? card.back : scoutValue(card, scoutOppositeFace(card ? card.face_up : "a")))
  element.append(current, back)
  if (edge) {
    const badge = document.createElement("span")
    badge.className = "scout-card-edge"
    badge.textContent = edge
    element.appendChild(badge)
  }
  if (typeof onRegionClick === "function") {
    element.addEventListener("click", (event) => {
      event.stopPropagation()
      const rect = element.getBoundingClientRect()
      const region = event.clientY - rect.top < rect.height / 2 ? "top" : "bottom"
      onRegionClick(region)
    })
  } else if (interactive && typeof onClick === "function") {
    element.addEventListener("click", (event) => {
      event.stopPropagation()
      onClick()
    })
  }
  return element
}

function renderScoutOpening(view) {
  if (!scoutOpening) {
    return
  }
  scoutOpening.innerHTML = ""
  if (view.phase !== "choose_orientation") {
    const note = document.createElement("div")
    note.className = "scout-opening-note"
    note.textContent = "Opening choice is complete for this round."
    scoutOpening.appendChild(note)
    return
  }
  if (!view.initial_hand_options) {
    const readyNote = document.createElement("div")
    readyNote.className = "scout-opening-note"
    readyNote.textContent = "Your hand is locked. Waiting for the other players."
    scoutOpening.appendChild(readyNote)
    return
  }

  const options = [
    { key: "keep", title: "Keep Order", flip: false },
    { key: "flip", title: "Flip Whole Hand", flip: true },
  ]
  options.forEach((option) => {
    const card = document.createElement("div")
    card.className = "scout-opening-card"
    const title = document.createElement("div")
    title.className = "scout-opening-title"
    title.textContent = option.title
    const row = document.createElement("div")
    row.className = "scout-card-row compact"
    ;(view.initial_hand_options[option.key] || []).forEach((entry) => {
      row.appendChild(renderScoutCard(entry))
    })
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = option.title
    button.addEventListener("click", () => {
      sendAction({ type: "ready_hand", flip: option.flip })
    })
    card.append(title, row, button)
    scoutOpening.appendChild(card)
  })
}

function renderScoutRoundNotice(view) {
  if (!scoutRoundNotice || !scoutRoundNoticeBody || !scoutRoundNoticeTitle || !scoutRoundNoticeList) {
    return
  }
  const summary = view && view.last_round_summary ? view.last_round_summary : null
  if (!summary) {
    scoutRoundNotice.classList.add("hidden")
    scoutRoundNotice.setAttribute("aria-hidden", "true")
    scoutRoundNoticeList.innerHTML = ""
    return
  }
  scoutRoundNotice.classList.remove("hidden")
  scoutRoundNotice.setAttribute("aria-hidden", "false")
  scoutRoundNoticeTitle.textContent = view.game_over ? "Game Over" : "Last Round"
  scoutRoundNoticeBody.textContent = `${summary.winner_name || scoutPlayerName(view, summary.winner)} · ${summary.reason_label || summary.reason}`
  scoutRoundNoticeList.innerHTML = ""
  ;(summary.players || []).forEach((player) => {
    const item = document.createElement("div")
    item.className = "scout-summary-item"
    if (player.winner) {
      item.classList.add("winner")
    }
    const bonus = summary.variant === "duel"
      ? `🎟️ ${player.scout_tokens_left}`
      : `⭐ ${player.scout_points}`
    item.textContent = `${player.name}: 🎭 ${player.captured_count} · ${bonus} · ✋ ${player.hand_count} · Δ ${player.round_points >= 0 ? "+" : ""}${player.round_points} · Σ ${player.total_score}`
    scoutRoundNoticeList.appendChild(item)
  })
}

function renderScoutActiveSet(view) {
  if (!scoutActiveSet) {
    return
  }
  scoutActiveSet.innerHTML = ""
  scoutActiveSet.onclick = (event) => {
    if (event.target === scoutActiveSet) {
      clearScoutSelection()
      renderScoutGameState({ view, events: [] })
    }
  }

  if (!view.active_set) {
    const empty = document.createElement("div")
    empty.className = "scout-empty-state"
    empty.textContent = "Stage is empty. The next Show may be any legal set."
    scoutActiveSet.appendChild(empty)
    return
  }

  const meta = document.createElement("div")
  meta.className = "scout-active-meta"
  meta.textContent = `${view.active_set.owner_name} · ${scoutComboLabel(view.active_set)}`
  scoutActiveSet.appendChild(meta)

  const row = document.createElement("div")
  row.className = "scout-card-row active"
  const canScout = scoutHasLegalAction("scout") || scoutHasLegalAction("scout_and_show")
  ;(view.active_set.cards || []).forEach((card, index) => {
    let edge = null
    let clickable = false
    if (canScout && view.active_set.owner_player_id !== view.you) {
      if (index === 0) {
        edge = "L"
        clickable = true
      } else if (index === view.active_set.cards.length - 1) {
        edge = "R"
        clickable = true
      }
    }
    const element = renderScoutCard(card, {
      clickable,
      selected: (edge === "L" && scoutTakeSide === "left") || (edge === "R" && scoutTakeSide === "right"),
      faceSelection: (
        (edge === "L" && scoutTakeSide === "left") ||
        (edge === "R" && scoutTakeSide === "right")
      ) ? scoutRegionForFace(card, scoutInsertFace) : null,
      edge,
      onRegionClick: (region) => {
        const nextSide = edge === "L" ? "left" : "right"
        const nextFace = scoutFaceForRegion(card, region)
        if (scoutTakeSide === nextSide && scoutCanonicalFace(scoutInsertFace) === nextFace) {
          scoutTakeSide = null
          scoutInsertIndex = null
          clearScoutRangeSelection()
        } else {
          scoutTakeSide = nextSide
          scoutInsertFace = nextFace
          scoutInsertIndex = null
          clearScoutRangeSelection()
        }
        renderScoutGameState({ view, events: [] })
      },
    })
    row.appendChild(element)
  })
  scoutActiveSet.appendChild(row)
}

function renderScoutHand(view) {
  if (!scoutHand) {
    return
  }
  scoutHand.innerHTML = ""
  const hand = Array.isArray(view.your_hand) ? view.your_hand : []
  if (!hand.length) {
    const empty = document.createElement("div")
    empty.className = "scout-empty-state"
    empty.textContent = view.phase === "choose_orientation" ? "Choose an opening orientation first." : "No cards in hand."
    scoutHand.appendChild(empty)
    return
  }

  const shell = document.createElement("div")
  shell.className = "scout-hand-board"
  shell.addEventListener("click", () => {
    clearScoutSelection()
    renderScoutGameState({ view, events: [] })
  })

  const row = document.createElement("div")
  row.className = "scout-card-row"
  const canInsert = scoutTakeSide && (scoutHasLegalAction("scout") || scoutHasLegalAction("scout_and_show"))
  if (canInsert) {
    row.classList.add("insert-mode")
  }
  const selected = !scoutTakeSide ? scoutSelectedRange() : null
  if (canInsert) {
    for (let index = 0; index <= hand.length; index += 1) {
      const gapBtn = document.createElement("button")
      gapBtn.type = "button"
      gapBtn.className = "scout-gap-btn"
      if (scoutInsertIndex === index) {
        gapBtn.classList.add("selected")
      }
      gapBtn.textContent = "+"
      gapBtn.setAttribute("aria-label", `Insert at position ${index + 1}`)
      gapBtn.addEventListener("click", (event) => {
        event.stopPropagation()
        scoutInsertIndex = scoutInsertIndex === index ? null : index
        clearScoutRangeSelection()
        renderScoutGameState({ view, events: [] })
      })
      row.appendChild(gapBtn)
      if (index === hand.length) {
        continue
      }
      row.appendChild(
        renderScoutCard(hand[index], {
          clickable: false,
        }),
      )
    }
  } else {
    hand.forEach((card, index) => {
      row.appendChild(
        renderScoutCard(card, {
          clickable: !scoutTakeSide && scoutHasLegalAction("show"),
          selected: !!selected && index >= selected.start && index <= selected.end,
          onClick: () => {
            if (!Number.isInteger(scoutRangeAnchor)) {
              scoutRangeAnchor = index
              scoutRangeFocus = index
            } else {
              scoutRangeFocus = index
            }
            renderScoutGameState({ view, events: [] })
          },
        }),
      )
    })
  }

  shell.appendChild(row)
  scoutHand.appendChild(shell)
}

function renderScoutPreview(view) {
  if (!scoutPreviewArea) {
    return
  }
  scoutPreviewArea.innerHTML = ""
  if (scoutIsPendingScoutShow(view)) {
    const note = document.createElement("div")
    note.className = "scout-empty-state"
    note.textContent = "Scout + Show is active. Choose a Show from Your Hand, or click Finish Turn."
    scoutPreviewArea.appendChild(note)
    return
  }
  if (!scoutTakeSide) {
    const note = document.createElement("div")
    note.className = "scout-empty-state"
    note.textContent = "Click the upper or lower half of an edge card to choose the number you want to Scout."
    scoutPreviewArea.appendChild(note)
    return
  }
  if (!Number.isInteger(scoutInsertIndex)) {
    const note = document.createElement("div")
    note.className = "scout-empty-state"
    note.textContent = "Choose an insertion gap in your hand."
    scoutPreviewArea.appendChild(note)
    return
  }

  const meta = document.createElement("div")
  meta.className = "scout-preview-meta"
  const inserted = scoutPreviewInsertedCard(view)
  const afterScout = scoutActiveAfterScout(view)
  meta.textContent = `Taking ${scoutTakeSide} edge · value ${inserted ? inserted.current : "-"} · insert at gap ${scoutInsertIndex} · remaining stage ${afterScout ? scoutComboLabel(afterScout) : "empty"}`
  scoutPreviewArea.appendChild(meta)

  const shell = document.createElement("div")
  shell.className = "scout-hand-board preview"

  const row = document.createElement("div")
  row.className = "scout-card-row"
  scoutWorkingHand(view).forEach((card) => {
    row.appendChild(
      renderScoutCard(card, {
        ghost: !!card.ghost,
      }),
    )
  })
  shell.appendChild(row)
  scoutPreviewArea.appendChild(shell)
}

function renderScoutPlayers(view) {
  if (!scoutPlayers) {
    return
  }
  scoutPlayers.innerHTML = ""
  ;(view.players || []).forEach((player) => {
    const card = document.createElement("div")
    card.className = "player-card scout-player-card"
    if (player.player_id === view.you) {
      card.classList.add("self")
    }
    if (player.player_id === view.current_turn) {
      card.classList.add("current")
    }
    if (player.player_id === view.start_player) {
      card.classList.add("starter")
    }
    const name = document.createElement("div")
    name.className = "player-name"
    name.textContent = player.name || player.player_id
    const stats = document.createElement("div")
    stats.className = "scout-player-stats"
    const scoutResource = view.variant === "duel"
      ? `🎟️ ${player.scout_tokens_left}`
      : `⭐ ${player.scout_points}${player.scout_and_show_available ? " · 🎪" : ""}`
    stats.textContent = `Σ ${player.score} · ✋ ${player.hand_count} · 🎭 ${player.captured_count} · ${scoutResource}`
    card.append(name, stats)
    scoutPlayers.appendChild(card)
  })
}

function updateScoutButtons(view) {
  const canReady = view.phase === "choose_orientation" && scoutHasLegalAction("ready_hand")
  if (scoutReadyKeepBtn) {
    scoutReadyKeepBtn.disabled = !canReady
  }
  if (scoutReadyFlipBtn) {
    scoutReadyFlipBtn.disabled = !canReady
  }
  if (scoutShowBtn) {
    scoutShowBtn.disabled = !scoutCanShow(view)
  }
  if (scoutScoutBtn) {
    scoutScoutBtn.disabled = !scoutCanScout(view)
  }
  if (scoutScoutShowBtn) {
    if (scoutCanFinishScoutShow(view)) {
      scoutScoutShowBtn.textContent = "Finish Turn"
      scoutScoutShowBtn.disabled = false
    } else {
      scoutScoutShowBtn.textContent = "Scout + Show"
      scoutScoutShowBtn.disabled = !scoutCanScoutShow(view)
    }
  }
}

function renderScoutSummary(view) {
  if (scoutPhaseLabel) {
    scoutPhaseLabel.textContent = view.phase || "-"
  }
  if (scoutRoundLabel) {
    scoutRoundLabel.textContent = `${view.round || "-"} / ${view.total_rounds || "-"}`
  }
  if (scoutTurnLabel) {
    scoutTurnLabel.textContent = view.current_turn ? scoutPlayerName(view, view.current_turn) : "-"
  }
  if (scoutStartPlayerLabel) {
    scoutStartPlayerLabel.textContent = view.start_player ? scoutPlayerName(view, view.start_player) : "-"
  }
  if (scoutActiveOwnerLabel) {
    scoutActiveOwnerLabel.textContent = view.active_set ? view.active_set.owner_name : "-"
  }
  if (scoutWinnerLabel) {
    scoutWinnerLabel.textContent = Array.isArray(view.winner)
      ? view.winner.map((playerId) => scoutPlayerName(view, playerId)).join(", ")
      : (view.winner ? scoutPlayerName(view, view.winner) : "-")
  }
  if (scoutVariantLabel) {
    scoutVariantLabel.textContent = view.variant === "duel" ? "2P duel" : "3-5P base"
  }
  if (scoutCenterTokensLabel) {
    scoutCenterTokensLabel.textContent = view.variant === "duel" ? String(view.center_scout_tokens || 0) : "-"
  }
  if (scoutSelectionLabel) {
    scoutSelectionLabel.textContent = scoutSelectionSummary(view)
  }
  if (scoutHint) {
    const inserted = scoutPreviewInsertedCard(view)
    if (view.phase === "choose_orientation") {
      scoutHint.textContent = view.initial_hand_options
        ? "Choose whether to keep the dealt order or flip the entire hand."
        : "Your hand is locked. Waiting for the rest of the table."
    } else if (scoutIsPendingScoutShow(view)) {
      scoutHint.textContent = "Your special Scout is done. Show from Your Hand, or click Finish Turn."
    } else if (scoutTakeSide && !Number.isInteger(scoutInsertIndex)) {
      scoutHint.textContent = inserted
        ? `Choose an insertion gap for ${inserted.current}.`
        : "Choose an insertion gap in your hand."
    } else if (scoutTakeSide && Number.isInteger(scoutInsertIndex)) {
      scoutHint.textContent = scoutHasLegalAction("scout_and_show")
        ? "Use Scout to finish now, or use Scout + Show to Scout first and keep the turn."
        : "Use Scout to insert the chosen edge card."
    } else {
      scoutHint.textContent = "Click cards in your hand to choose a Show. Click the top or bottom half of an edge card to plan a Scout."
    }
  }
}

function renderScoutGameState(data) {
  const view = data.view || data
  currentScoutView = view
  scoutSyncSelection(view)
  if (currentGameType !== "scout") {
    currentGameType = "scout"
    setGamePanelVisibility("scout")
  }

  renderScoutSummary(view)
  renderScoutRoundNotice(view)
  renderScoutOpening(view)
  renderScoutActiveSet(view)
  renderScoutHand(view)
  renderScoutPreview(view)
  renderScoutPlayers(view)
  updateScoutButtons(view)
  if (data && data.events) {
    logGameEvents(data)
  }
}

if (scoutHelpBtn) {
  scoutHelpBtn.addEventListener("click", showScoutHelpModal)
}

if (scoutExplainBtn) {
  scoutExplainBtn.addEventListener("click", () => {
    toggleScoutExplainMode()
    if (!scoutExplainMode) {
      closeScoutExplainModal()
    }
  })
}

if (scoutHelpModalCloseBtn) {
  scoutHelpModalCloseBtn.addEventListener("click", closeScoutHelpModal)
}

if (scoutExplainModalCloseBtn) {
  scoutExplainModalCloseBtn.addEventListener("click", closeScoutExplainModal)
}

if (scoutGamePanel) {
  scoutGamePanel.addEventListener("click", (event) => {
    if (!scoutExplainMode) {
      return
    }
    const explainId = scoutExplainIdForElement(event.target)
    if (!explainId) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    showScoutExplanation(explainId)
  }, true)
}

if (scoutReadyKeepBtn) {
  scoutReadyKeepBtn.addEventListener("click", () => {
    sendAction({ type: "ready_hand", flip: false })
  })
}

if (scoutReadyFlipBtn) {
  scoutReadyFlipBtn.addEventListener("click", () => {
    sendAction({ type: "ready_hand", flip: true })
  })
}

if (scoutShowBtn) {
  scoutShowBtn.addEventListener("click", () => {
    if (!currentScoutView || !scoutCanShow(currentScoutView)) {
      return
    }
    const range = scoutSelectedRange()
    sendAction({ type: "show", start_index: range.start, end_index: range.end })
  })
}

if (scoutScoutBtn) {
  scoutScoutBtn.addEventListener("click", () => {
    if (!currentScoutView || !scoutCanScout(currentScoutView)) {
      return
    }
    sendAction({
      type: "scout",
      take_side: scoutTakeSide,
      insert_index: scoutInsertIndex,
      insert_face: scoutInsertFace,
    })
  })
}

if (scoutScoutShowBtn) {
  scoutScoutShowBtn.addEventListener("click", () => {
    if (!currentScoutView) {
      return
    }
    if (scoutCanFinishScoutShow(currentScoutView)) {
      sendAction({ type: "finish_scout_and_show" })
      return
    }
    if (!scoutCanScoutShow(currentScoutView)) {
      return
    }
    sendAction({
      type: "scout_and_show",
      take_side: scoutTakeSide,
      insert_index: scoutInsertIndex,
      insert_face: scoutInsertFace,
    })
  })
}

window.renderScoutGameState = renderScoutGameState
window.showScoutHeaderActions = showScoutHeaderActions
