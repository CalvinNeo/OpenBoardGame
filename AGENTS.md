# Repository Guidelines

## Project Structure & Module Organization
- `app.py` is the FastAPI + Socket.IO entry point and hosts room/session handlers (e.g., `on_room_create`).
- `game/` contains game modules and shared registry/definitions (cabo, skull, splendor, draw/guess, etc.).
- `static/` holds the browser client (`index.html`, `app.js`, `style.css`).
- `tests/` contains Python unit tests (currently `tests/test_room_session.py`).
- `designs/` stores game design notes and rules documents.

## Build, Test, and Development Commands
- `python -m pip install -r requirements.txt` installs runtime dependencies.
- `uvicorn app:app --reload` runs the server locally with hot reload (serves `static/` at `/`).
- `python -m unittest` runs the full test suite.
- `python -m unittest tests.test_room_session` runs a single test file.

## Coding Style & Naming Conventions
- Use 4-space indentation and keep functions small and readable.
- Keep type hints on public helpers and data containers (see `@dataclass` usage in `app.py`).
- Naming: `PascalCase` for classes, `snake_case` for functions/variables, `UPPER_SNAKE_CASE` for constants.
- Socket.IO handlers should stay in the `on_*` pattern (e.g., `on_room_join`) for discoverability.
- Frontend changes live in `static/` and should keep simple, descriptive IDs/classes.

## Testing Guidelines
- Framework: `unittest` with `IsolatedAsyncioTestCase` for async flows.
- File naming: `tests/test_*.py`; method naming: `test_*`.
- Prefer deterministic tests; mock Socket.IO behaviors as seen in `tests/test_room_session.py`.

## Commit & Pull Request Guidelines
- Commit messages are short and imperative (examples in history: “add prefetch”, “fix cabo”).
- PRs should include: a brief summary, test command results, and screenshots when UI changes.
- Link related issues if available and call out new/changed game rules or assets.

## Configuration Tips
- QuickDraw assets cache under `.quickdraw_cache/` (ignored in git).
- If translation features are touched, note any required model setup in the PR.
