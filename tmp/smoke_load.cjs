// Loads a game script under a permissive DOM stub so that module-init errors
// (TDZ / undefined identifiers) surface instead of being masked by DOM access.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const target = process.argv[2];
const file = path.resolve("static/games", target + ".js");
const src = fs.readFileSync(file, "utf8");

const noop = () => {};
let makeEl;
makeEl = (tag = "div") => {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: new Proxy({}, { get: (t, p) => (["setProperty", "removeProperty", "getPropertyValue"].includes(p) ? noop : (p in t ? t[p] : "")), set: () => true, has: () => true }),
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [],
    childNodes: [],
    childElementCount: 0,
    parentElement: null,
    parentNode: null,
    nextSibling: null,
    firstChild: null,
    firstElementChild: null,
    innerHTML: "",
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    open: false,
    tabIndex: 0,
    append: noop, appendChild: noop, prepend: noop, remove: noop, removeChild: noop,
    replaceChildren: noop, insertBefore: noop,
    setAttribute: noop, removeAttribute: noop, getAttribute: () => null,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
    querySelector: () => makeEl(), querySelectorAll: () => [], getElementsByClassName: () => [],
    closest: () => null, contains: () => false, matches: () => false,
    focus: noop, blur: noop, click: noop, showModal: noop, close: noop, showPopover: noop, hidePopover: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    getClientRects: () => [],
    scrollIntoView: noop,
    getContext: () => new Proxy({}, { get: () => noop, set: () => true }),
    setProperty: noop,
    animate: () => ({ cancel: noop, finished: Promise.resolve() }),
    get parentElement() { return makeEl(); },
    get parentNode() { return makeEl(); },
    get offsetWidth() { return 0; },
    get offsetHeight() { return 0; },
  };
  return new Proxy(el, {
    get: (obj, prop) => (prop in obj ? obj[prop] : undefined),
    set: (obj, prop, value) => { obj[prop] = value; return true; },
  });
};

const doc = {
  readyState: "complete",
  body: makeEl("body"),
  documentElement: makeEl("html"),
  activeElement: null,
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: (tag) => makeEl(tag),
  createTextNode: () => makeEl("text"),
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => true,
  elementFromPoint: () => null,
  elementsFromPoint: () => [],
  ownerDocument: null,
};
doc.ownerDocument = doc;

const win = {
  document: doc,
  innerWidth: 1280,
  innerHeight: 900,
  addEventListener: noop,
  removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  scrollTo: noop,
  setTimeout: (fn) => 0,
  clearTimeout: noop,
  setInterval: () => 0,
  clearInterval: noop,
  requestAnimationFrame: () => 0,
  location: { href: "http://localhost/" },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  CSS: { escape: (s) => String(s) },
  performance: { now: () => 0 },
  MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  Event: class { constructor(type) { this.type = type; } },
  obgCreateHelp: null,
  obgCreateExplain: null,
};
win.window = win;
win.self = win;
win.globalThis = win;

const sandbox = Object.assign(Object.create(null), win, {
  console,
  Math, JSON, Date, RegExp, Error, TypeError, ReferenceError, SyntaxError,
  Map, Set, WeakMap, WeakSet, Promise, Symbol, Proxy, Reflect,
  Array, Object, String, Number, Boolean, BigInt, Function,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  setTimeout: (fn) => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  document: doc,
  localStorage: win.localStorage,
  performance: win.performance,
  MutationObserver: win.MutationObserver,
  ResizeObserver: win.ResizeObserver,
  IntersectionObserver: win.IntersectionObserver,
  CustomEvent: win.CustomEvent,
  CSS: win.CSS,
  matchMedia: win.matchMedia,
  socket: { connected: true, on: noop, off: noop, emit: noop },
  currentGameType: target,
  currentRoomState: { room_id: "r1", game_type: target, status: "playing", game_config: {} },
  lastGameStatePayload: null,
  sendAction: noop,
  logGameEvents: noop,
  setGamePanelVisibility: noop,
  syncRoomControlsExplainButton: noop,
  innerWidth: 1280,
  innerHeight: 900,
});

try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: file });
  console.log("LOAD_OK " + target);
} catch (error) {
  console.log("LOAD_FAIL " + target + " :: " + error.name + ": " + error.message);
  const line = (error.stack || "").split("\n").find((l) => l.includes(target + ".js"));
  if (line) console.log("    " + line.trim());
  process.exitCode = 1;
}
