# Repository Guidelines

## Before Editing
- Read `DEV_GUIDE.md` before development; `FRONTEND.md` delegates to it. Follow its full requirements, not just the summary here.
- Read the affected game's existing design document under `designs/`. For UI work, also read `designs/room_control.md` and `designs/task40.md` for Room Control, Help, and Explain behavior.
- Check `git status` and preserve unrelated local changes. Keep patches focused on the requested game or shared feature.

## Project Structure & Module Organization
- `app.py` is the FastAPI + Socket.IO entry point, including room/session handlers, game actions, bot coordination, and persistence.
- `game/` contains game rules, game-specific AI/data modules, and assets. `game/registry.py` defines `GameDefinition`; `game/definitions.py` registers games; `game/__init__.py` exposes games and loads registrations.
- `game/ai_metadata.py` maintains the strategic-AI catalog; `game/dev_order.json` stores generated development-order metadata.
- `static/index.html`, `static/app.js`, `static/room.js`, and `static/style.css` provide the shared browser shell and Room Control. Game-specific JS, HTML templates, and CSS live under `static/games/`.
- `static/game_assets.js` registers versioned, lazy-loaded game resources in `GAME_ASSETS`; `static/assets/`, `assets/`, and `game/assets/` hold game resources.
- `tests/` contains Python game, AI, room/session, integration, and frontend-contract tests, plus Node/browser checks.
- `scripts/` contains asset generators, AI benchmarks, metadata utilities, and frontend smoke checks.
- `designs/` stores game rules and development notes, usually in the game's existing `task<number>.md`.

## Build, Test, and Development Commands
- Python 3.11 is recommended. Run commands from the repository root, preferably in an activated virtual environment. Use `python3` if `python` is unavailable.
- `python -m pip install -r requirements.txt` installs runtime dependencies.
- `python -m uvicorn app:app --reload` runs the server with hot reload; `/` serves the client and `/static` serves its resources.
- `python -m unittest tests.test_room_session` runs a focused test module; select the relevant `tests.test_*` modules for the change.
- `python -m unittest` runs the full Python suite when shared/global logic changes warrant it.
- `python scripts/gen_dev_order.py` refreshes development-order metadata after adding a game registration.
- `python -m unittest tests.test_game_dev_order tests.test_ai_metadata` checks game-order and strategic-AI metadata when those areas change.
- `python -m unittest tests.test_frontend_style_assets tests.test_help_contract` checks relevant frontend asset and Help contracts without running game-logic tests.
- `node --check static/games/<script>.js` checks JavaScript syntax; `node scripts/smoke_load.cjs <script_basename>` checks game-script initialization with browser stubs, not real layout or gameplay.
- `node tests/game_assets.browser.cjs` checks lazy loading in a real browser. It requires Node.js, Playwright, Chrome, and a running server; its default URL is `http://127.0.0.1:8766`. Set `ROOM_TEST_URL` to match the server and, if needed, `PLAYWRIGHT_MODULE` to an existing Playwright installation.

## Coding Style & Naming Conventions
- Use 4-space indentation in Python and follow the surrounding style in frontend files. Keep functions small and readable.
- Keep type hints on public Python helpers and data containers (see `@dataclass` usage in `app.py`).
- Python naming: `PascalCase` for classes, `snake_case` for functions/variables, `UPPER_SNAKE_CASE` for constants.
- Socket.IO handlers should stay in the `on_*` pattern (e.g., `on_room_join`) for discoverability.
- Game-specific browser globals must have a unique game prefix, such as `isCaboActionAvailable`; names private to a module or IIFE are exempt. Keep IDs/classes descriptive and game-scoped.
- Put game-specific frontend logic in `static/games/`, not `static/app.js`; change shared code only for shared behavior or necessary integration.

## Adding or Extending a Game
- Follow neighboring game lifecycle contracts: initialization, legal actions, action application, viewer-specific public state, serialization/deserialization, and bot moves where supported. Validate actions server-side and preserve hidden information in public views.
- Register new games in `game/definitions.py` and keep imports/exports in `game/__init__.py` consistent. Keep action/config schemas aligned with the implementation and client payloads.
- Register frontend scripts, styles, and markup in `GAME_ASSETS`; retain an empty game-panel container in `static/index.html` instead of eagerly loading game resources.
- Regenerate `game/dev_order.json` and keep `tests/test_game_dev_order.py` green. Update BGG weight metadata using the procedure below.
- When adding or changing a purpose-built AI strategy, review `STRATEGIC_AI_GAME_IDS` in `game/ai_metadata.py` so Select Game shows the correct 🤖 marker. Generic random/first-legal bots do not qualify automatically.
- Update the game's existing design document and focused tests, including affected room integration, privacy, or save/load behavior.

## Frontend Requirements
- Follow all layout, interaction, and acceptance requirements in `DEV_GUIDE.md`. Keep the game board prominent, avoid redundant nested panels, and prevent overlap, overflow, and page-wide horizontal scrolling on mobile.
- Provide Help and Explain rather than long rule text on the main board. Keep Help/Reconnect on one line, support Escape for dialogs, use English for non-game UI, and do not use commercial UI assets.
- Keep game markup and dialogs in `static/games/<game_id>.html` template fragments. List script dependencies before the main script in `GAME_ASSETS`; the loader inserts markup and styles before executing scripts.
- Lazy-loaded scripts may run after `DOMContentLoaded`: check `document.readyState`, synchronize `currentRoomState` after registering Socket.IO listeners, and guard shared code against game-specific globals that are not loaded yet.
- Keep shared CSS in `static/style.css`. Existing extracted game CSS uses matching `@media all, obg-game-… {}` groups and `styleFragments`; preserve group names and corresponding empty placeholders in the shared stylesheet. New games may register standalone CSS through `styles`.
- Use `/static/…` resource URLs in CSS fragments. Update changed resource versions in `GAME_ASSETS`; update the corresponding homepage script versions when the manifest/loader changes, including CSS URL version changes. Bump the homepage CSS version when shared CSS changes.
- Preserve deliberate touch/click distinctions, scrolling, drag termination outside the board, and required round-end pauses. See `DEV_GUIDE.md` for the full interaction rules.

## Testing & Validation
- Use `unittest`, with `IsolatedAsyncioTestCase` for async flows. Name files `tests/test_*.py` and methods `test_*`; prefer deterministic tests and mocked Socket.IO behavior as in `tests/test_room_session.py`.
- Match validation scope to the change: game/module logic changes run focused tests; only shared/global logic changes require the full suite. UI-only changes do not require game-logic tests; run relevant frontend contracts and browser checks instead.
- For UI changes, check desktop and mobile layouts, prioritizing widths of 320px, 390px, 1024px, and 1440px, plus affected interactions. Syntax checks and stub-based smoke checks do not replace visual acceptance.
- UI handoffs must list changed files, checked widths/interactions, checks/tests run, compliance with `DEV_GUIDE.md`, and any unchecked items or exceptions. Do not claim full compliance while required checks are missing or failing.
- Documentation-only changes need reference and diff checks, not game-logic tests. Run `git diff --check` before handing off changes and report any checks that could not run.

## Documentation & Local Data
- Do not edit the root `README.md`. For an existing game, update its current `designs/task<number>.md` rather than creating a new document per change; use an existing specialized AI/review document when appropriate.
- For a new game, use the next available task number. Keep simple AI designs (under 200 design lines) in the game's task document rather than a separate file.
- Keep runtime data, models, caches, and temporary outputs out of patches. Ignored locations include `.data/`, `.quickdraw_cache/`, `.decrypto/`, `.aidixit/`, `.ai/`, `.cyber_pictures/`, and `tmp/`; preserve existing local data.
- If translation or model-dependent features change, document required model setup and dependencies in the relevant design notes and handoff.

## BGG Weight Lookup
- If you only have a BGG image link (e.g. `https://boardgamegeek.com/image/2417382/istanbul`), first locate the game page URL for that image by opening the image page and copying the linked boardgame URL (format: `https://boardgamegeek.com/boardgame/<id>/<slug>`).
- Add the boardgame URL to `GAME_URLS` in `scripts/bgg_weight_scrape.py`.
- Run `python scripts/bgg_weight_scrape.py` to fetch the `averageweight`.
- Update `static/room.js` `GAME_WEIGHT` with the value (use 2 decimal places unless specified).

## Commit & Pull Request Guidelines
- Do not create commits or branches unless requested. Commit messages are short and imperative (examples in history: “add prefetch”, “fix cabo”).
- PRs should include a brief summary, test/check results, and screenshots for UI changes, along with the UI acceptance record required by `DEV_GUIDE.md`.
- Link related issues if available and call out new/changed game rules, assets, model requirements, and remaining validation gaps.
