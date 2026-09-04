# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

A personal site published via GitHub Pages at **aakhil.in** (`CNAME`). Static HTML/CSS/JS — **no build step, no dependencies, no frameworks, no CDNs**. Anything pushed to `master` goes live immediately; keep that in mind before pushing.

## Structure

- `index.html` — homepage; fake terminal with typewriter animations (`runTerminalAnimation`, sections keyed by name)
- `assets/css/style.css` — shared terminal theme (palette variables, `.terminal`, `.prompt`, `.comment`, `.folder-link`, `.cd-link`)
- `games/` — the arcade: `index.html`, `games.css`, `js/games.js` (all game logic lives in this one file)
- `CNAME` — custom domain; don't touch

## Conventions

### Theme
- Terminal aesthetic throughout. Colors come from CSS variables in `style.css`: `--bg`, `--panel`, `--text` (green), `--comment`, `--accent` (blue), `--folder` (gold). macOS traffic-light reds/greens are `#ff5f56`, `#ffbd2e`, `#27c93f`.
- Monospace everywhere ('Fira Mono', Consolas, Menlo).
- Copy speaks shell: `#`-prefixed comments, `./game` to launch, `cd ~` / `cd ..` to navigate.

### Games architecture (`games/js/games.js`)
Follow the existing modules — `Sudoku`, `TicTacToe`, `Snake`. When adding a game:
1. Add a `KEYS` entry (`aakhil.<game>.stats`) and persist via the `Store` helper — never call `localStorage` directly.
2. Add a tile in `Games.renderArcade()` and a `launch<Name>()` method.
3. Game modules are plain objects: `mount(container, onExit)`, their own `backToArcade()`, optional setup/win screens.
4. Standard scaffold: `<span class="prompt">aakhil@universe:~/games$</span> ./<game>` header, a `# comment` status line, a `.sudoku-bar` with `.btn` buttons (always a "New" button), then the board, then `← back to games`.
5. Update stats exactly once per completed game; celebrate wins with the shared `throwConfetti()`.
6. **Teardown**: stop timers/animation loops and remove any `document`-level listeners when the player exits. Element-bound listeners die with `root.innerHTML = ''` and don't need explicit cleanup.
7. Render user-entered text (e.g. the stored player name) through `escapeHtml()`.

### CSS
- Per-game rules live in `games.css` under a `/* ---- Game name ---- */` banner; shared widgets (`.btn`, `.game-tile`, `.sudoku-bar`, `.num-pad`) are already defined — reuse them.
- Prefer classes over inline styles (see the `.sudoku-bar .timer` pattern). Keep mobile working: the site is read at ~360px.
- Boards max out at ~338px to match `.sudoku-board`.

## Testing

There is no test suite. Before proposing changes:
- `node --check games/js/games.js` (syntax)
- `python3 -m http.server 8000` from the repo root (absolute paths like `/assets/...` require serving from root, not the `games/` dir) and play the game you touched.
- For engine logic, a stubbed-DOM smoke test that loads `games.js` via `eval` and drives the module directly works well.

## Commits & PRs

- One-line imperative commit messages, e.g. `Add Tic Tac Toe game with unbeatable minimax computer`. Multi-line bodies for anything non-obvious.
- PRs target `master`.
