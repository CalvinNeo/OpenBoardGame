let currentScoutView = null
let scoutRangeAnchor = null
let scoutRangeFocus = null
let scoutTakeSide = null
let scoutInsertIndex = null
let scoutInsertFace = "a"
let scoutExplainMode = false
let scoutHelpWidget = null
let scoutExplainWidget = null
let scoutTooltipTimer = null
let scoutGesture = null
let scoutOpeningFlip = null
let scoutOpeningRound = null
let scoutSummaryKey = ""
let scoutHintOverride = ""
let scoutHintCycleKey = ""
let scoutHintCycleIndex = -1

const scoutGamePanel = document.getElementById("scoutPanel")
const scoutHeaderActions = document.getElementById("scoutHeaderActions")
const scoutHelpBtn = document.getElementById("scoutHelpBtn")
const scoutExplainBtn = document.getElementById("scoutExplainBtn")

const scoutPhaseLabel = document.getElementById("scoutPhase")
const scoutRoundLabel = document.getElementById("scoutRound")
const scoutTurnLabel = document.getElementById("scoutTurn")
const scoutStartPlayerLabel = document.getElementById("scoutStartPlayer")
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

const scoutHintBtn = document.getElementById("scoutHintBtn")
const scoutShowBtn = document.getElementById("scoutShowBtn")
const scoutScoutBtn = document.getElementById("scoutScoutBtn")
const scoutScoutShowBtn = document.getElementById("scoutScoutShowBtn")

const SCOUT_HELP_CONFIG = {
  gameId: "scout",
  title: { zh: "马戏星探 · Scout", en: "Scout" },
  basic: {
    win: { zh: "所有轮次结束后累计总分最高的玩家获胜，每轮通过收走被压过的牌和获得挖角分来得分。", en: "Finish with the highest total score by capturing beaten cards and earning Scout points across all rounds." },
    turn: { zh: "轮到你时，可以打出相邻的一组手牌压过台面，或者从台面的一端拿一张牌插入手牌，多人局每轮还可用一次挖角加演出。", en: "On your turn, Show adjacent hand cards to beat the stage or Scout one edge card into your hand, with a once-per-round Scout + Show in multiplayer." },
    key: { zh: "手牌不能随意排序，要利用挖角的插入位置和朝向连接出更强的相邻牌组。", en: "You cannot reorder your hand, so use Scout insertion positions and card orientations to build stronger adjacent combinations." }
  },
  sections: [
    {
      id: "show", label: { zh: "开局与演出", en: "Opening & Show" },
      html: {
        zh: "<p>每轮开局可以保留整手牌，或者把整手牌反转顺序并翻转每张牌的朝向。选定后不能重排。第二轮起，先查看上一轮结果并选好朝向，再按 Next Round，所有玩家确认朝向后才开始行动。</p><p>手牌（🎴）左上大数字是当前数值，右下小数字是另一朝向的值。出牌必须是连续相邻的单张、同数字牌组或递增或递减顺子。</p><p>张数多的压过张数少的。同张数时，同数字牌组压过顺子。同牌型、同张数时比较数值，顺子比较最大值。台面（🎭）为空时可打出任意合法组合。</p>",
        en: "<p>At the opening, keep your hand or reverse its order and flip every card together. You cannot reorder it afterwards. From round two, review the score, choose an orientation, then press Next Round. Play waits for everyone to confirm an orientation.</p><p>On hand cards (🎴), the large upper number is active and the small lower number is the opposite face. Show a continuous block forming a single, equal-number set, or ascending or descending run.</p><p>More cards beat fewer cards. At equal length, sets beat runs. For matching types and lengths, the higher value wins, using the highest value of a run. An empty stage (🎭) accepts any legal combination.</p>"
      }
    },
    {
      id: "scout", label: { zh: "挖角与加演", en: "Scout & special" },
      html: {
        zh: "<p>点击台面最左或最右卡牌的上半部或下半部，选择要拿的那张牌和数值。点击手牌下方的 Before 或 After last card 选择插入位置，再在手牌旁确认 Scout。</p><p>三至五人局中，被挖角的台面拥有者获得一点挖角分（⭐）。每人每轮有一次挖角加演标记（🎪），使用 Scout + Show 后先完成挖角，然后可从更新后的手牌演出，也可按 Finish Turn 结束。</p><p>两人局没有挖角加演。每人每轮有三枚挖角标记（🎟️），每次挖角花一枚并继续自己的回合，直到演出或者无标记且无法演出。</p>",
        en: "<p>Click the upper or lower half of the leftmost or rightmost stage card to choose a card and value. Use Before below a hand card, or After last card, to choose its insertion position, then confirm Scout beside your hand.</p><p>With three to five players, the stage owner earns one Scout point (⭐) when scouted. Each player has one Scout + Show token (🎪) per round. Resolve the Scout first, then Show from the updated hand or choose Finish Turn.</p><p>In a two-player duel there is no Scout + Show. Each player starts with three Scout tokens (🎟️). Scouting spends one token and keeps your turn until you Show or have no tokens and no legal Show.</p>"
      }
    },
    {
      id: "score", label: { zh: "计分与界面", en: "Scoring & interface" },
      html: {
        zh: "<p>有人出完手牌，或自己的台面牌组无人压过并轮回自己时，本轮结束。俘获牌（🎭）每张加一分，挖角分（⭐）每点加一分，两人局则按剩余挖角标记（🎟️）加分，其他玩家每张剩余手牌（✋）扣一分。本轮获胜者免除手牌扣分。总分（Σ）最高者获胜。</p><p>点击手牌选择连续范围，点击相邻牌可扩大范围，点击不相邻的牌重新开始选择。点击牌区空白可取消。Hint 依次选择合法演出，不会代替你出牌。</p><p>玩家上的 You、Turn、Start 分别标记自己、当前行动者和起始玩家。Explain 可解释卡牌、禁用按钮和区域，点击一次解释后退出，Escape 也可退出。非交互图标可悬停或轻触查看提示。</p>",
        en: "<p>A round ends when someone empties their hand or their unbeaten stage returns to them. Each captured card (🎭) and Scout point (⭐) scores one. In a duel, remaining Scout tokens (🎟️) replace Scout points. Remaining hand cards (✋) cost one point each, except for the round winner. The highest total score (Σ) wins.</p><p>Click a hand card to start a range, adjacent cards to extend it, or a non-adjacent card to restart. Click blank space to cancel. Hint cycles through legal Shows without playing them.</p><p>You, Turn and Start mark your seat, the current player and the starting player. Explain works on cards, regions and disabled buttons. It exits after one explanation or Escape. Hover or tap non-interactive symbols for a short tooltip.</p>"
      }
    }
  ]
}

const SCOUT_EXPLANATIONS = {
  status: "The round counter shows progress through the game. The turn label identifies who acts next. Duel uses the two-player Scout-token rules.",
  activeSet: "Stage (🎭): beat this combination with adjacent hand cards, or Scout an edge card. The large upper number is active and the small lower number is the opposite face.",
  yourHand: "Your hand (🎴) stays in this order. Select adjacent cards for a Show. During Scout, Before inserts before that card and After last card inserts at the end.",
  previewHand: "This optional preview shows your hand after the planned Scout. The dashed card is new. Nothing is committed until you confirm Scout or Scout + Show.",
  players: "Total score (Σ) counts completed rounds. Hand (✋) is cards remaining. Captures (🎭) and Scout points (⭐) score this round. Scout tokens (🎟️) are the duel resource. Special token (🎪) means Scout + Show is available. Turn and Start label the current and starting players.",
  readyKeepBtn: "Keep the dealt order and all current face-up values. From round two, press Next Round after choosing your orientation.",
  readyFlipBtn: "Reverse the entire hand and flip every card to its other value. From round two, press Next Round to confirm this orientation.",
  hintBtn: "Cycle through legal Shows without playing anything. Hint does not suggest Scout moves. It is disabled when it is not your turn or no Show can beat the stage.",
  showBtn: "Show the selected adjacent cards. The selection must form a single, equal-number set, or run and beat the stage. More cards win first, then sets over runs, then higher values.",
  scoutBtn: "Confirm taking the chosen stage edge card, with the chosen face, at the selected hand position. Choose both a card face and an insertion position first.",
  scoutShowBtn: "Spend your once-per-round special token (🎪) to Scout and keep the turn. Then Show from your updated hand or use Finish Turn. This special is not available in a duel.",
  nextRound: "Review the last round, choose Keep Order or Flip Whole Hand, then press Next Round. All players must lock their orientation before the next round can begin.",
  scoring: "Captured cards (🎭) plus Scout points (⭐), or remaining duel tokens (🎟️), minus remaining hand cards (✋) give the round change (Δ). The round winner has no hand penalty. Total score is Σ.",
  card: "The upper number is the current value. The lower number is the opposite face. Only stage edge cards may be scouted and only adjacent hand cards may be shown.",
  gap: "Insert the chosen Scout card at this position without changing the order of your existing hand. Confirm Scout beside your hand when ready."
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
  if (scoutHeaderActions) scoutHeaderActions.style.display = show ? "flex" : "none"
  if (!show) {
    scoutExplainWidget?.exit()
    scoutHelpWidget?.close()
    scoutHideTooltip()
  }
}

function initScoutHelpExplain() {
  if (scoutHelpWidget || typeof window.obgCreateHelp !== "function") return
  scoutHelpWidget = window.obgCreateHelp(SCOUT_HELP_CONFIG)
  scoutExplainWidget = window.obgCreateExplain({
    gameId: "scout",
    attribute: "data-scout-explain",
    explanations: SCOUT_EXPLANATIONS,
    button: scoutExplainBtn,
    root: () => scoutGamePanel,
    bypass: ["#scoutHelpBtn", "#scoutExplainBtn"],
    onChange: (active) => { scoutExplainMode = active; scoutHideTooltip() }
  })
  scoutHelpBtn?.addEventListener("click", () => { scoutExplainWidget.exit(); scoutHelpWidget.open() })
  scoutExplainBtn?.addEventListener("click", () => scoutExplainWidget.toggle())
}

function scoutHideTooltip() {
  clearTimeout(scoutTooltipTimer)
  document.getElementById("scoutTooltip")?.classList.add("hidden")
}

function scoutShowTooltip(node) {
  const tooltip = document.getElementById("scoutTooltip")
  if (!tooltip || !node || scoutExplainMode) return
  clearTimeout(scoutTooltipTimer)
  tooltip.textContent = node.dataset.scoutTip
  tooltip.classList.remove("hidden")
  const box = node.getBoundingClientRect()
  const tip = tooltip.getBoundingClientRect()
  tooltip.style.left = Math.max(12, Math.min(box.left, window.innerWidth - tip.width - 12)) + "px"
  tooltip.style.top = Math.max(12, Math.min(box.bottom + 7, window.innerHeight - tip.height - 12)) + "px"
  scoutTooltipTimer = setTimeout(scoutHideTooltip, 3000)
}

function scoutAddTip(node, text) {
  node.dataset.scoutTip = text
  node.setAttribute("aria-label", text)
  node.tabIndex = 0
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initScoutHelpExplain)
else initScoutHelpExplain()

function resetScoutHintState() {
  scoutHintOverride = ""
  scoutHintCycleKey = ""
  scoutHintCycleIndex = -1
}

function clearScoutSelection() {
  scoutRangeAnchor = null
  scoutRangeFocus = null
  scoutTakeSide = null
  scoutInsertIndex = null
  resetScoutHintState()
}

function clearScoutRangeSelection() {
  scoutRangeAnchor = null
  scoutRangeFocus = null
  resetScoutHintState()
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

function scoutSelectHandIndex(index) {
  if (!Number.isInteger(index)) {
    return
  }
  resetScoutHintState()
  const range = scoutSelectedRange()
  if (!range) {
    scoutRangeAnchor = index
    scoutRangeFocus = index
    return
  }
  if (index === range.start - 1) {
    scoutRangeAnchor = index
    scoutRangeFocus = range.end
    return
  }
  if (index === range.end + 1) {
    scoutRangeAnchor = range.start
    scoutRangeFocus = index
    return
  }
  scoutRangeAnchor = index
  scoutRangeFocus = index
}

function scoutComboSortKey(combo) {
  if (!combo) {
    return [0, 0, 0]
  }
  let typeOrder = 0
  if (combo.combo_type === "run") {
    typeOrder = 1
  } else if (combo.combo_type === "set") {
    typeOrder = 2
  }
  return [combo.length || 0, typeOrder, combo.rank_value || 0]
}

function scoutCompareSortKey(left, right) {
  const maxLength = Math.max(left.length, right.length)
  for (let index = 0; index < maxLength; index += 1) {
    const a = left[index] || 0
    const b = right[index] || 0
    if (a !== b) {
      return a - b
    }
  }
  return 0
}

function scoutEnumerateShowMoves(cards, activeSet) {
  if (!Array.isArray(cards) || !cards.length) {
    return []
  }
  const moves = []
  for (let start = 0; start < cards.length; start += 1) {
    for (let end = start; end < cards.length; end += 1) {
      const chosen = cards.slice(start, end + 1)
      const combo = scoutClassifyCards(chosen)
      if (!combo || !scoutBeats(combo, activeSet)) {
        continue
      }
      moves.push({
        start,
        end,
        combo,
        remainingCount: cards.length - chosen.length,
      })
    }
  }
  return moves
}

function scoutShowMoveKey(move) {
  return [
    move && move.remainingCount === 0 ? 1 : 0,
    ...scoutComboSortKey(move ? move.combo : null),
    -(move ? move.start : 0),
  ]
}

function scoutSortedShowMoves(cards, activeSet) {
  const moves = scoutEnumerateShowMoves(cards, activeSet)
  moves.sort((left, right) => scoutCompareSortKey(scoutShowMoveKey(right), scoutShowMoveKey(left)))
  return moves
}

function scoutBestShowMove(cards, activeSet) {
  return scoutSortedShowMoves(cards, activeSet)[0] || null
}

function scoutHintKeyForView(view) {
  if (!view) {
    return ""
  }
  const handKey = Array.isArray(view.your_hand)
    ? view.your_hand.map((card) => `${card.id}:${card.face_up}:${card.current}`).join("|")
    : ""
  const activeKey = view.active_set
    ? `${view.active_set.owner_player_id}:${view.active_set.combo_type}:${view.active_set.length}:${view.active_set.rank_value}:${(view.active_set.cards || []).map((card) => `${card.id}:${card.face_up}:${card.current}`).join("|")}`
    : "none"
  return `${view.round}|${view.phase}|${view.you}|${view.current_turn}|${(view.legal_actions || []).join(",")}|${handKey}|${activeKey}`
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
    context = "hand",
  } = options
  const interactive = clickable && (typeof onClick === "function" || typeof onRegionClick === "function")
  const element = document.createElement(interactive ? "button" : "div")
  element.className = "scout-card"
  const currentValue = scoutCurrentValue(card)
  const backValue = card && Number.isInteger(card.back) ? card.back : scoutValue(card, scoutOppositeFace(card ? card.face_up : "a"))
  const explanationKey = `card_${context}_${card.id}_${card.face_up}_${edge || "hand"}`
  const contextText = context === "stage"
    ? edge ? " Choose the upper half for the current value or the lower half for the opposite value, then choose an insertion position in your hand." : " This is a stage card. Only the two edge cards may be scouted, and only on your turn."
    : context === "opening" ? " This is an opening preview. Choose Keep Order or Flip Whole Hand to lock all card values together."
      : context === "preview" ? " This is the planned hand after Scout. The dashed card is new. Confirm beside your hand to commit."
        : " Hand cards must stay in order. Show a single or adjacent equal-number cards or a run."
  const description = `Current value ${currentValue}. Opposite face ${backValue}.${contextText}`
  SCOUT_EXPLANATIONS[explanationKey] = description
  element.setAttribute("data-scout-explain", explanationKey)
  element.dataset.scoutFocus = explanationKey
  element.setAttribute("aria-label", description)
  if (!interactive) scoutAddTip(element, description)
  if (selected) {
    element.classList.add("selected")
  }
  if (ghost) {
    element.classList.add("ghost")
  }
  if (interactive) {
    element.type = "button"
    element.classList.add("clickable")
    element.setAttribute("aria-pressed", String(selected))
  }
  if (interactive && typeof onRegionClick === "function") {
    element.classList.add("split-pickable")
  }
  if (faceSelection === "top" || faceSelection === "bottom") {
    const overlay = document.createElement("span")
    overlay.className = `scout-card-face-selection ${faceSelection}`
    element.appendChild(overlay)
  }
  if (interactive && typeof onRegionClick === "function") {
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
  if (interactive && typeof onRegionClick === "function") {
    element.addEventListener("click", (event) => {
      event.stopPropagation()
      const rect = element.getBoundingClientRect()
      const region = event.detail === 0 || event.clientY - rect.top < rect.height / 2 ? "top" : "bottom"
      onRegionClick(region)
    })
    element.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
      event.preventDefault()
      onRegionClick(event.key === "ArrowUp" ? "top" : "bottom")
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
      row.appendChild(renderScoutCard(entry, { context: "opening" }))
    })
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = option.title
    button.setAttribute("data-scout-explain", option.flip ? "readyFlipBtn" : "readyKeepBtn")
    button.dataset.scoutFocus = option.key
    button.setAttribute("aria-pressed", String(scoutOpeningFlip === option.flip))
    button.disabled = !scoutHasLegalAction("ready_hand")
    button.addEventListener("click", () => {
      if (!scoutHasLegalAction("ready_hand")) return
      if (view.last_round_summary) {
        scoutOpeningFlip = option.flip
        renderScoutGameState({ view, events: [] })
      } else {
        sendAction({ type: "ready_hand", flip: option.flip })
      }
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
  const winners = Array.isArray(view.winner) ? view.winner.map((playerId) => scoutPlayerName(view, playerId)).join(", ") : ""
  scoutRoundNoticeBody.textContent = view.game_over
    ? `Winner: ${winners}. Round ${summary.round}: ${summary.winner_name || scoutPlayerName(view, summary.winner)} · ${summary.reason_label || summary.reason}`
    : `Round ${summary.round}: ${summary.winner_name || scoutPlayerName(view, summary.winner)} · ${summary.reason_label || summary.reason}`
  const nextButton = document.getElementById("scoutNextRoundBtn")
  nextButton.classList.toggle("hidden", view.phase !== "choose_orientation" || !view.last_round_summary)
  nextButton.disabled = !scoutHasLegalAction("ready_hand") || scoutOpeningFlip === null
  nextButton.textContent = scoutHasLegalAction("ready_hand") ? "Next Round" : "Waiting for players"
  const summaryKey = `${summary.round}:${summary.winner}:${view.game_over}`
  if (summaryKey !== scoutSummaryKey) {
    scoutSummaryKey = summaryKey
    document.getElementById("scoutRoundDetails").open = view.phase === "choose_orientation" || view.game_over
  }
  scoutRoundNoticeList.innerHTML = ""
  ;(summary.players || []).forEach((player) => {
    const item = document.createElement("div")
    item.className = "scout-summary-item"
    if (player.winner) {
      item.classList.add("winner")
    }
    if (player.player_id === view.you) item.classList.add("self")
    const bonus = summary.variant === "duel"
      ? `🎟️ ${player.scout_tokens_left}`
      : `⭐ ${player.scout_points}`
    item.textContent = `${player.name}: 🎭 ${player.captured_count} · ${bonus} · ✋ ${player.hand_count} · Δ ${player.round_points >= 0 ? "+" : ""}${player.round_points} · Σ ${player.total_score}`
    scoutAddTip(item, `Captures ${player.captured_count}, Scout bonus ${summary.variant === "duel" ? player.scout_tokens_left : player.scout_points}, remaining hand ${player.hand_count}. Round change ${player.round_points}, total ${player.total_score}.`)
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
        edge = "←"
        clickable = true
      } else if (index === view.active_set.cards.length - 1) {
        edge = "→"
        clickable = true
      }
    }
    const element = renderScoutCard(card, {
      context: "stage",
      clickable,
      selected: (edge === "←" && scoutTakeSide === "left") || (edge === "→" && scoutTakeSide === "right"),
      faceSelection: (
        (edge === "←" && scoutTakeSide === "left") ||
        (edge === "→" && scoutTakeSide === "right")
      ) ? scoutRegionForFace(card, scoutInsertFace) : null,
      edge,
      onRegionClick: (region) => {
        const nextSide = edge === "←" ? "left" : "right"
        const nextFace = scoutFaceForRegion(card, region)
        if (scoutTakeSide === nextSide && scoutCanonicalFace(scoutInsertFace) === nextFace) {
          scoutTakeSide = null
          scoutInsertIndex = null
          clearScoutRangeSelection()
        } else {
          resetScoutHintState()
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
  shell.addEventListener("click", (event) => {
    if (event.target !== shell && event.target !== row) return
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
      const slot = document.createElement("div")
      slot.className = "scout-hand-slot"
      const gapBtn = document.createElement("button")
      gapBtn.type = "button"
      gapBtn.className = "scout-gap-btn"
      if (scoutInsertIndex === index) {
        gapBtn.classList.add("selected")
      }
      gapBtn.textContent = index === hand.length ? "After last card +" : "Before +"
      gapBtn.setAttribute("aria-label", `Insert at position ${index + 1}`)
      gapBtn.setAttribute("aria-pressed", String(scoutInsertIndex === index))
      gapBtn.setAttribute("data-scout-explain", "gap")
      gapBtn.dataset.scoutFocus = `gap_${index}`
      gapBtn.addEventListener("click", (event) => {
        event.stopPropagation()
        resetScoutHintState()
        scoutInsertIndex = scoutInsertIndex === index ? null : index
        clearScoutRangeSelection()
        renderScoutGameState({ view, events: [] })
      })
      if (index === hand.length) {
        gapBtn.classList.add("scout-after-gap")
        shell.appendChild(gapBtn)
        continue
      }
      slot.append(renderScoutCard(hand[index]), gapBtn)
      row.appendChild(slot)
    }
  } else {
    hand.forEach((card, index) => {
      row.appendChild(
        renderScoutCard(card, {
          clickable: !scoutTakeSide && scoutHasLegalAction("show"),
          selected: !!selected && index >= selected.start && index <= selected.end,
          onClick: () => {
            scoutSelectHandIndex(index)
            renderScoutGameState({ view, events: [] })
          },
        }),
      )
    })
  }

  shell.prepend(row)
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
        context: "preview",
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
    card.className = "scout-player-card"
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
    name.className = "scout-player-name"
    const playerName = document.createElement("span")
    playerName.textContent = player.name || player.player_id
    const score = document.createElement("span")
    score.className = "scout-score"
    score.textContent = String(player.score)
    scoutAddTip(score, `Total score (Σ): ${player.score} across completed rounds.`)
    name.append(playerName, score)
    const stats = document.createElement("div")
    stats.className = "scout-player-stats"
    const statRows = [
      [`✋ ${player.hand_count}`, `Hand (✋): ${player.hand_count} cards remaining.`],
      [`🎭 ${player.captured_count}`, `Captures (🎭): ${player.captured_count} cards captured this round, worth one point each.`],
      view.variant === "duel"
        ? [`🎟️ ${player.scout_tokens_left}`, `Scout tokens (🎟️): ${player.scout_tokens_left} left. Each Scout spends one and each unspent token scores one.`]
        : [`⭐ ${player.scout_points}`, `Scout points (⭐): ${player.scout_points} earned this round when other players take your stage cards.`]
    ]
    if (view.variant !== "duel" && player.scout_and_show_available) statRows.push(["🎪", "Special token (🎪): Scout + Show is still available this round."])
    statRows.forEach(([label, description]) => {
      const stat = document.createElement("span")
      stat.textContent = label
      scoutAddTip(stat, description)
      stats.appendChild(stat)
    })
    const badges = document.createElement("div")
    badges.className = "scout-player-badges"
    badges.textContent = [
      player.player_id === view.you ? "You" : "",
      player.player_id === view.current_turn ? "Turn" : "",
      player.player_id === view.start_player ? "Start" : "",
      view.phase === "choose_orientation" && player.hand_ready ? "Ready" : ""
    ].filter(Boolean).join(" · ")
    card.append(name, stats, badges)
    scoutPlayers.appendChild(card)
  })
}

function updateScoutButtons(view) {
  const planningScout = !!scoutTakeSide
  if (scoutHintBtn) {
    scoutHintBtn.disabled = !(view && scoutHasLegalAction("show") && scoutBestShowMove(view.your_hand || [], view.active_set))
  }
  if (scoutShowBtn) {
    scoutShowBtn.classList.toggle("hidden", planningScout)
    scoutShowBtn.disabled = !scoutCanShow(view)
  }
  if (scoutScoutBtn) {
    scoutScoutBtn.classList.toggle("hidden", !planningScout)
    scoutScoutBtn.disabled = !scoutCanScout(view)
  }
  if (scoutScoutShowBtn) {
    scoutScoutShowBtn.classList.toggle("hidden", !scoutCanFinishScoutShow(view) && (!planningScout || !scoutHasLegalAction("scout_and_show")))
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
  if (scoutPhaseLabel) scoutPhaseLabel.textContent = view.game_over ? "FINAL SCORES" : view.phase === "choose_orientation" ? "OPENING" : view.current_turn === view.you ? "YOUR TURN" : "CURRENT TURN"
  if (scoutRoundLabel) {
    scoutRoundLabel.textContent = `${view.round || "-"} / ${view.total_rounds || "-"}`
  }
  if (scoutTurnLabel) {
    scoutTurnLabel.textContent = view.game_over ? "Game over" : view.phase === "choose_orientation" ? "Choose your orientation" : scoutPlayerName(view, view.current_turn)
  }
  if (scoutStartPlayerLabel) {
    scoutStartPlayerLabel.textContent = view.start_player ? scoutPlayerName(view, view.start_player) : "-"
  }
  if (scoutVariantLabel) {
    scoutVariantLabel.textContent = view.variant === "duel" ? "2P duel" : "3-5P base"
  }
  if (scoutCenterTokensLabel) {
    scoutCenterTokensLabel.textContent = view.variant === "duel" ? String(view.center_scout_tokens || 0) : "-"
  }
  if (scoutSelectionLabel) {
    scoutSelectionLabel.textContent = scoutSelectionSummary(view) === "-" ? "Select adjacent cards" : scoutSelectionSummary(view)
  }
  if (scoutHint) {
    const inserted = scoutPreviewInsertedCard(view)
    if (scoutHintOverride) {
      scoutHint.textContent = scoutHintOverride
    } else if (view.game_over) {
      scoutHint.textContent = "Final scores are ready. Review the score breakdown above."
    } else if (view.phase === "choose_orientation") {
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
    } else if (view.current_turn !== view.you) {
      scoutHint.textContent = `Waiting for ${scoutPlayerName(view, view.current_turn)}.`
    } else {
      const range = scoutSelectedRange()
      const combo = scoutClassifyCards(scoutRangeCards(view.your_hand || [], range))
      scoutHint.textContent = range && !combo
        ? "Choose a single, equal numbers, or a run of adjacent cards."
        : range && !scoutBeats(combo, view.active_set)
          ? "This selection does not beat the stage. Try another range or Scout."
          : "Select adjacent hand cards to Show, or an edge card on stage to Scout."
    }
  }
}

function renderScoutGameState(data) {
  const focusKey = document.activeElement?.dataset?.scoutFocus
  const view = data.view || data
  if (currentScoutView && scoutHintKeyForView(currentScoutView) !== scoutHintKeyForView(view)) clearScoutSelection()
  const openingRound = `${currentRoomState?.room_id || ""}:${view.round}`
  if (scoutOpeningRound !== openingRound) {
    scoutOpeningRound = openingRound
    scoutOpeningFlip = null
  }
  document.getElementById("scoutNextRoundBtn").classList.toggle("hidden", view.phase !== "choose_orientation" || !view.last_round_summary)
  if (data && Array.isArray(data.events) && data.events.length) {
    resetScoutHintState()
  }
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
  document.getElementById("scoutOpeningSection").classList.toggle("hidden", view.phase !== "choose_orientation")
  document.getElementById("scoutStageSection").classList.toggle("hidden", view.phase === "choose_orientation" || view.game_over)
  document.getElementById("scoutHandSection").classList.toggle("hidden", view.phase === "choose_orientation" || view.game_over || !view.you || !(view.your_hand || []).length)
  document.getElementById("scoutHandCount").textContent = String((view.your_hand || []).length)
  document.getElementById("scoutPreviewSection").classList.toggle("hidden", !scoutTakeSide || !Number.isInteger(scoutInsertIndex))
  scoutExplainWidget?.refresh()
  if (focusKey) {
    const focusTarget = Array.from(scoutGamePanel.querySelectorAll("[data-scout-focus]")).find((node) => node.dataset.scoutFocus === focusKey)
    focusTarget?.focus({ preventScroll: true })
  }
  if (data && data.events) {
    logGameEvents(data)
  }
}

if (scoutGamePanel) {
  scoutGamePanel.addEventListener("pointerdown", (event) => {
    scoutGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
  }, true)
  document.addEventListener("pointermove", (event) => {
    if (scoutGesture?.id === event.pointerId && Math.hypot(event.clientX - scoutGesture.x, event.clientY - scoutGesture.y) > 10) scoutGesture.moved = true
  }, true)
  document.addEventListener("pointercancel", () => { if (scoutGesture) scoutGesture.moved = true }, true)
  scoutGamePanel.addEventListener("click", (event) => {
    if (event.detail && scoutGesture?.moved) { event.preventDefault(); event.stopImmediatePropagation(); return }
    const tip = event.target.closest("[data-scout-tip]")
    if (tip && !tip.closest("button, summary")) scoutShowTooltip(tip)
    else scoutHideTooltip()
    if (event.target === scoutHand && currentScoutView) {
      clearScoutSelection()
      renderScoutGameState({ view: currentScoutView, events: [] })
    }
  }, true)
  scoutGamePanel.addEventListener("pointerover", (event) => {
    if (event.pointerType === "mouse") scoutShowTooltip(event.target.closest("[data-scout-tip]"))
  })
  scoutGamePanel.addEventListener("pointerout", (event) => {
    if (event.target.closest("[data-scout-tip]") !== event.relatedTarget?.closest?.("[data-scout-tip]")) scoutHideTooltip()
  })
  scoutGamePanel.addEventListener("focusin", (event) => scoutShowTooltip(event.target.closest("[data-scout-tip]")))
  scoutGamePanel.addEventListener("focusout", scoutHideTooltip)
}
window.addEventListener("scroll", scoutHideTooltip, true)
window.addEventListener("resize", scoutHideTooltip)
document.addEventListener("keydown", (event) => { if (event.key === "Escape") scoutHideTooltip() })
document.getElementById("scoutNextRoundBtn")?.addEventListener("click", () => {
  if (scoutOpeningFlip !== null && scoutHasLegalAction("ready_hand")) sendAction({ type: "ready_hand", flip: scoutOpeningFlip })
})

if (scoutShowBtn) {
  scoutShowBtn.addEventListener("click", () => {
    if (!currentScoutView || !scoutCanShow(currentScoutView)) {
      return
    }
    const range = scoutSelectedRange()
    sendAction({ type: "show", start_index: range.start, end_index: range.end })
  })
}

if (scoutHintBtn) {
  scoutHintBtn.addEventListener("click", () => {
    if (!currentScoutView || !scoutHasLegalAction("show")) {
      return
    }
    const moves = scoutSortedShowMoves(currentScoutView.your_hand || [], currentScoutView.active_set)
    if (!moves.length) {
      return
    }
    const hintKey = scoutHintKeyForView(currentScoutView)
    if (hintKey !== scoutHintCycleKey) {
      scoutHintCycleKey = hintKey
      scoutHintCycleIndex = 0
    } else {
      scoutHintCycleIndex = (scoutHintCycleIndex + 1 + moves.length) % moves.length
    }
    const move = moves[scoutHintCycleIndex]
    scoutTakeSide = null
    scoutInsertIndex = null
    scoutRangeAnchor = move.start
    scoutRangeFocus = move.end
    scoutHintOverride = `Hint ${scoutHintCycleIndex + 1}/${moves.length}: try ${scoutComboLabel(move.combo)} from cards ${move.start + 1}-${move.end + 1}.`
    renderScoutGameState({ view: currentScoutView, events: [] })
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
