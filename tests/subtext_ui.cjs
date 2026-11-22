const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class SubtextTestElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.style = {};
    this.scrollTop = 0;
    this.disabled = false;
    this.open = false;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
    };
  }
  set innerHTML(value) { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  appendChild(child) { child.parentElement = this; this.children.push(child); }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  dispatch(name, event = {}) {
    const payload = {target: this, preventDefault() {}, ...event};
    for (const listener of this.listeners[name] || []) listener(payload);
  }
  matches(selector) {
    return selector === '[data-slot-id]' ? !!this.dataset.slotId
      : selector.startsWith('.') && this.className?.split(' ').includes(selector.slice(1));
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  getBoundingClientRect() { return {left: 0, top: 0, width: 640, height: 480}; }
  getContext() { return new Proxy({}, {get: () => () => {}}); }
  focus() { document.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

const markup = fs.readFileSync('static/games/subtext.html', 'utf8');
const ids = [...markup.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
ids.push('subtextPanel', 'subtextHeaderActions', 'subtextHelpBtn', 'subtextExplainBtn', 'subtextConfigBox', 'subtextWordColumnSelect');
const elements = Object.fromEntries(ids.map(id => [id, new SubtextTestElement()]));
const document = new SubtextTestElement();
document.body = new SubtextTestElement('body');
document.readyState = 'complete';
document.getElementById = id => elements[id] || null;
document.createElement = tag => new SubtextTestElement(tag);
document.querySelector = () => null;
const actions = [];
const help = {open: false, config: null};
let explainConfig = null;
const sandbox = {
  document, console, Set, Array, Number, String, Math,
  sendAction: action => actions.push(action),
  currentRoomState: {status: 'in_game'},
  currentGameType: 'subtext',
  setTimeout: () => 1,
  clearTimeout() {},
  obgCreateHelp: config => {
    help.config = config;
    return {open: () => { help.open = true; }, close: () => { help.open = false; }, isOpen: () => help.open};
  },
  obgCreateExplain: config => {
    explainConfig = config;
    let active = false;
    const setActive = next => { active = next; config.onChange(active); };
    return {exit: () => setActive(false), toggle: () => setActive(!active)};
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('static/games/subtext.js', 'utf8'), sandbox);
const players = ['self', 'dealer', 'partner', 'other'].map(player_id => ({player_id, name: player_id, score: 0}));
const drawingView = {
  game_index: 1, round: 1, total_rounds: 8, phase: 'drawing', you: 'self', dealer_id: 'dealer',
  your_word: '自行车', players, legal_actions: ['submit_drawing'],
  drawing_progress: {done: 0, total: 4}, guess_progress: {done: 0, total: 4}, next_round_progress: {done: 0, total: 4},
};
const render = view => sandbox.renderSubtextGameState(view);
const click = id => elements[id].dispatch('click');
const pointer = (name, overrides = {}) => elements.subtextCanvas.dispatch(name, {
  clientX: 100, clientY: 100, pointerId: 1, button: 0, isPrimary: true, ...overrides,
});
const sketch = () => {
  pointer('pointerdown');
  pointer('pointermove', {clientX: 200});
  pointer('pointerup');
};

render(drawingView);
assert.equal(elements.subtextSubmitDrawingBtn.disabled, true);
sketch();
assert.equal(elements.subtextSubmitDrawingBtn.disabled, false);
render({...drawingView, drawing_progress: {done: 2, total: 4}});
assert.equal(elements.subtextSubmitDrawingBtn.disabled, false, 'updates preserve the local draft');
click('subtextSubmitDrawingBtn');
assert.equal(actions.length, 0, 'opening confirmation never submits');
assert.equal(elements.subtextDrawingConfirm.classList.contains('hidden'), false);
click('subtextCancelDrawingBtn');
assert.equal(elements.subtextDrawingConfirm.classList.contains('hidden'), true);
click('subtextSubmitDrawingBtn');
document.dispatch('keydown', {key: 'Escape'});
assert.equal(elements.subtextDrawingConfirm.classList.contains('hidden'), true);
click('subtextUndoBtn');
assert.equal(elements.subtextSubmitDrawingBtn.disabled, true);
pointer('pointerdown', {button: 2});
assert.equal(elements.subtextSubmitDrawingBtn.disabled, true, 'right-click cannot draw');
sketch();
click('subtextSubmitDrawingBtn');
click('subtextConfirmDrawingBtn');
assert.equal(actions.length, 1);
assert.equal(actions[0].type, 'submit_drawing');
assert.equal(actions[0].drawing[0].length, 2);
render({...drawingView, legal_actions: [], your_drawing: actions[0].drawing});
assert.equal(elements.subtextDrawingArea.classList.contains('submitted'), true);
assert.equal(elements.subtextDrawingSubmitted.classList.contains('hidden'), false);

const guessView = {
  ...drawingView, phase: 'guessing', legal_actions: ['submit_guess'],
  candidates: ['A', 'B', 'C'].map(slot_id => ({slot_id, drawing: [], is_yours: slot_id === 'C'})),
};
render(guessView);
const candidateGrid = elements.subtextCandidateGrid;
candidateGrid.scrollTop = 190;
const choice = candidateGrid.children[2].querySelector('.subtext-choice');
choice.dispatch('click');
assert.equal(candidateGrid.children[2].querySelector('.subtext-choice'), choice, 'selection preserves DOM nodes');
assert.equal(candidateGrid.scrollTop, 190);
assert.equal(choice.getAttribute('aria-pressed'), 'true');
assert.match(explainConfig.explanations.candidateC, /your own drawing/);
candidateGrid.children[2].querySelector('.subtext-zoom-btn').dispatch('click');
assert.equal(elements.subtextPreviewDialog.open, true);
document.dispatch('keydown', {key: 'Escape'});
assert.equal(elements.subtextSelectedGuess.textContent, 'Selected: C', 'closing preview must not deselect');
elements.subtextPreviewDialog.close();
click('subtextHelpBtn');
document.dispatch('keydown', {key: 'Escape'});
assert.equal(elements.subtextSelectedGuess.textContent, 'Selected: C', 'closing Help must not deselect');
help.open = false;
document.dispatch('keydown', {key: 'Escape'});
assert.equal(elements.subtextSubmitGuessBtn.disabled, true);
choice.dispatch('click');
render({...guessView, guess_progress: {done: 3, total: 4}});
assert.equal(candidateGrid.scrollTop, 190, 'server updates preserve list scroll');
assert.equal(elements.subtextSelectedGuess.textContent, 'Selected: C');
click('subtextExplainBtn');
document.dispatch('keydown', {key: 'Escape'});
assert.equal(elements.subtextSelectedGuess.textContent, 'Selected: C', 'leaving Explain must not deselect');
document.dispatch('keydown', {key: 'Escape', defaultPrevented: true});
assert.equal(elements.subtextSelectedGuess.textContent, 'Selected: C', 'shared capture-phase Escape must not deselect');
click('subtextSubmitGuessBtn');
assert.equal(actions.at(-1).slot_id, 'C');
render({...guessView, legal_actions: [], your_guess: 'C'});
assert.equal(elements.subtextSelectedGuess.textContent, 'Locked: C');
assert.equal(candidateGrid.children[2].querySelector('.subtext-choice').disabled, true);

render({...drawingView, round: 2});
assert.equal(elements.subtextSubmitDrawingBtn.disabled, true, 'new round clears the draft');
pointer('pointerdown');
pointer('pointercancel');
pointer('pointermove', {clientX: 300});
click('subtextSubmitDrawingBtn');
click('subtextConfirmDrawingBtn');
assert.equal(actions.at(-1).drawing[0].length, 1, 'cancel ends a stroke');
render({...drawingView, round: 3});
click('subtextExplainBtn');
sketch();
assert.equal(elements.subtextSubmitDrawingBtn.disabled, true, 'Explain blocks canvas edits');
click('subtextExplainBtn');
sketch();
assert.equal(elements.subtextSubmitDrawingBtn.disabled, false);
assert.equal(help.config.sections.length, 3);
assert.ok(help.config.basic.win.zh && help.config.basic.win.en);
const summary = {
  target_word: '自行车', dealer_id: 'dealer', partner_id: 'partner', wrong_count: 2,
  slots: [{slot_id: 'A', player_id: 'partner', drawing: []}],
  guesses: {self: {slot_id: 'A', correct: true}},
  round_points: {self: 3}, scores_after_round: {self: 3},
};
render({...drawingView, phase: 'round_result', legal_actions: ['next_round'], last_round_summary: summary});
assert.equal(elements.subtextNextRoundRow.classList.contains('hidden'), false);
click('subtextNextRoundBtn');
assert.equal(actions.at(-1).type, 'next_round', 'ready has no extra confirmation');
render({...drawingView, phase: 'game_over', legal_actions: ['play_again'], winner_ids: ['self', 'partner'], last_round_summary: summary});
assert.equal(elements.subtextNextRoundRow.classList.contains('hidden'), true);
assert.equal(elements.subtextGameOverActions.classList.contains('hidden'), false);
assert.match(elements.subtextWinnerText.textContent, /Shared winners/);
assert.equal(elements.subtextPlayAgainBtn.textContent, 'Ready');
assert.equal(elements.subtextPlayAgainStatus.textContent, 'Ready 0/4');
assert.equal(document.body.classList.contains('subtext-needs-action'), true);
click('subtextPlayAgainBtn');
assert.equal(actions.at(-1).type, 'play_again');
render({...drawingView, phase: 'game_over', legal_actions: [],
  players: players.map(player => ({...player, next_round_ready: player.player_id === 'self'})),
  next_round_progress: {done: 1, total: 4}, winner_ids: ['self', 'partner'], last_round_summary: summary});
assert.equal(elements.subtextPlayAgainBtn.textContent, 'Ready ✓');
assert.equal(elements.subtextPlayAgainBtn.disabled, true);
assert.equal(elements.subtextPlayAgainStatus.textContent, 'Ready 1/4');
assert.match(elements.subtextStatusBody.textContent, /after everyone is ready/);
assert.match(elements.subtextWinnerText.textContent, /Shared winners/);
assert.equal(elements.subtextResultArea.classList.contains('hidden'), false);
assert.equal(document.body.classList.contains('subtext-needs-action'), false);
const actionCount = actions.length;
click('subtextPlayAgainBtn');
assert.equal(actions.length, actionCount, 'already-ready players cannot submit again');
console.log('Subtext UI: confirmation, draft, pointer cancellation, selection, scroll, preview, Help and Explain regressions passed.');
