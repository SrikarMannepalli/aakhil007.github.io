/* =========================================================
   Games arcade — pure client-side, state saved in localStorage
========================================================= */
const Store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) {}
    }
};

const KEYS = {
    user: 'aakhil.games.user',
    pref: 'aakhil.sudoku.difficulty',
    stats: 'aakhil.sudoku.stats',
    save: 'aakhil.sudoku.save',
    ttt: 'aakhil.tictactoe.stats',
    snake: 'aakhil.snake.stats'
};

const DIFFICULTIES = { easy: 45, medium: 36, hard: 30 }; // number of given clues

// On the standalone page, leaving the arcade returns home.
function goHome() {
    window.location.href = '/';
}

const Games = {
    root: null,

    showArcade(container) {
        this.root = container;
        const name = Store.get(KEYS.user, null);
        if (!name) { this.renderNamePrompt(); return; }
        this.renderArcade(name);
    },

    renderNamePrompt() {
        this.root.innerHTML = '';
        const c = document.createElement('div');
        c.className = 'comment';
        c.textContent = "# first time here — what should I call you?";
        const form = document.createElement('form');
        form.className = 'name-form';
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 24;
        input.placeholder = 'your name';
        input.setAttribute('aria-label', 'your name');
        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.className = 'btn primary';
        btn.textContent = 'save';
        form.append(input, btn);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = input.value.trim() || 'Player';
            Store.set(KEYS.user, val);
            this.renderArcade(val);
        });
        this.root.append(c, form);
        input.focus();
    },

    renderArcade(name) {
        this.root.innerHTML = '';
        const greet = document.createElement('div');
        greet.innerHTML = `<span class="comment" style="display:inline"># welcome back, </span><span style="color:var(--folder)">${escapeHtml(name)}</span> ` +
            `<span class="comment" style="display:inline">(</span><span class="cd-link" style="margin:0;font-size:0.85em;">not you?</span><span class="comment" style="display:inline">)</span>`;
        greet.querySelector('.cd-link').onclick = () => {
            Store.remove(KEYS.user);
            this.renderNamePrompt();
        };

        const grid = document.createElement('div');
        grid.className = 'games-grid';

        const stats = Store.get(KEYS.stats, { played: 0, won: 0, best: {} });
        const sudokuTile = document.createElement('div');
        sudokuTile.className = 'game-tile';
        sudokuTile.innerHTML = `<span class="icon">🔢</span><span class="name">Sudoku</span>` +
            `<span class="meta">${stats.won || 0} solved</span>`;
        sudokuTile.onclick = () => this.launchSudoku();

        const tttStats = Store.get(KEYS.ttt, { win: 0, loss: 0, draw: 0 });
        const tttTile = document.createElement('div');
        tttTile.className = 'game-tile';
        tttTile.innerHTML = `<span class="icon">⭕</span><span class="name">Tic Tac Toe</span>` +
            `<span class="meta">${tttStats.win || 0} won</span>`;
        tttTile.onclick = () => this.launchTicTacToe();

        const snakeStats = Store.get(KEYS.snake, { best: 0, played: 0 });
        const snakeTile = document.createElement('div');
        snakeTile.className = 'game-tile';
        snakeTile.innerHTML = `<span class="icon">🐍</span><span class="name">Snake</span>` +
            `<span class="meta">best ${snakeStats.best || 0} · ${snakeStats.played || 0} games</span>`;
        snakeTile.onclick = () => this.launchSnake();

        const soon = document.createElement('div');
        soon.className = 'game-tile soon';
        soon.innerHTML = `<span class="icon">🕹️</span><span class="name">More</span><span class="meta">coming soon</span>`;

        grid.append(sudokuTile, tttTile, snakeTile, soon);

        const statsLine = document.createElement('div');
        statsLine.className = 'stats-line';
        const best = stats.best || {};
        const bestParts = ['easy', 'medium', 'hard']
            .filter((d) => best[d] != null)
            .map((d) => `${d} ${formatTime(best[d])}`);
        statsLine.textContent = '# best times: ' + (bestParts.length ? bestParts.join('  ·  ') : 'none yet');

        const back = document.createElement('div');
        const cd = document.createElement('span');
        cd.className = 'cd-link';
        cd.textContent = 'cd ~';
        cd.onclick = () => goHome();
        back.appendChild(cd);

        this.root.append(greet, grid, statsLine, back);
    },

    launchSudoku() {
        Sudoku.mount(this.root, () => this.showArcade(this.root));
    },

    launchTicTacToe() {
        TicTacToe.mount(this.root, () => this.showArcade(this.root));
    },

    launchSnake() {
        Snake.mount(this.root, () => this.showArcade(this.root));
    }
};

/* ---------------- Sudoku engine ---------------- */
const Sudoku = {
    root: null,
    onExit: null,
    state: null,
    timer: null,

    mount(container, onExit) {
        this.root = container;
        this.onExit = onExit;
        const saved = Store.get(KEYS.save, null);
        if (saved) { this.renderResumePrompt(saved); }
        else { this.renderSetup(); }
    },

    renderResumePrompt(saved) {
        this.stopTimer();
        this.root.innerHTML = '';
        const h = document.createElement('div');
        h.innerHTML = `<span class="prompt">aakhil@universe:~/games$</span> ./sudoku`;
        const note = document.createElement('div');
        note.className = 'comment';
        note.textContent = `# you have a ${saved.difficulty} game in progress (${formatTime(saved.elapsed)})`;
        const row = document.createElement('div');
        row.className = 'difficulty-row';
        const resume = document.createElement('button');
        resume.className = 'btn primary';
        resume.textContent = 'Resume';
        resume.onclick = () => this.startFromSave(saved);
        const fresh = document.createElement('button');
        fresh.className = 'btn';
        fresh.textContent = 'New game';
        fresh.onclick = () => { Store.remove(KEYS.save); this.renderSetup(); };
        row.append(resume, fresh);
        this.root.append(h, note, row, this.backToArcade());
    },

    renderSetup() {
        this.stopTimer();
        this.root.innerHTML = '';
        const h = document.createElement('div');
        h.innerHTML = `<span class="prompt">aakhil@universe:~/games$</span> ./sudoku`;
        const note = document.createElement('div');
        note.className = 'comment';
        note.textContent = '# pick a difficulty';
        const row = document.createElement('div');
        row.className = 'difficulty-row';
        const pref = Store.get(KEYS.pref, 'easy');
        Object.keys(DIFFICULTIES).forEach((diff) => {
            const b = document.createElement('button');
            b.className = 'btn' + (diff === pref ? ' active' : '');
            b.textContent = diff;
            b.onclick = () => { Store.set(KEYS.pref, diff); this.newGame(diff); };
            row.appendChild(b);
        });
        this.root.append(h, note, row, this.backToArcade());
    },

    backToArcade() {
        const wrap = document.createElement('div');
        const link = document.createElement('span');
        link.className = 'cd-link';
        link.textContent = '← back to games';
        link.onclick = () => { this.stopTimer(); this.onExit(); };
        wrap.appendChild(link);
        return wrap;
    },

    newGame(difficulty) {
        const solution = generateSolved();
        const puzzle = makePuzzle(solution, DIFFICULTIES[difficulty]);
        this.state = {
            difficulty,
            solution,
            puzzle,
            current: puzzle.map((r) => r.slice()),
            elapsed: 0,
            startTs: Date.now(),
            solved: false,
            hintsUsed: 0
        };
        this.save();
        this.renderGame();
        this.startTimer();
    },

    startFromSave(saved) {
        this.state = {
            difficulty: saved.difficulty,
            solution: saved.solution,
            puzzle: saved.puzzle,
            current: saved.current,
            elapsed: saved.elapsed,
            startTs: Date.now(),
            solved: false,
            hintsUsed: saved.hintsUsed || 0
        };
        this.renderGame();
        this.startTimer();
    },

    renderGame() {
        this.stopTimer();
        this.root.innerHTML = '';
        const s = this.state;

        const h = document.createElement('div');
        h.innerHTML = `<span class="prompt">aakhil@universe:~/games$</span> ./sudoku`;

        const bar = document.createElement('div');
        bar.className = 'sudoku-bar';
        bar.innerHTML = `<span class="comment">${s.difficulty}</span>` +
            `<span class="timer" id="sudoku-timer">${formatTime(s.elapsed)}</span>`;
        const newBtn = document.createElement('button');
        newBtn.className = 'btn';
        newBtn.textContent = 'New';
        newBtn.onclick = () => this.renderSetup();
        const checkBtn = document.createElement('button');
        checkBtn.className = 'btn';
        checkBtn.textContent = 'Check';
        checkBtn.onclick = () => this.highlightConflicts(true);
        const hintBtn = document.createElement('button');
        hintBtn.className = 'btn';
        hintBtn.textContent = 'Hint';
        hintBtn.onclick = () => this.giveHint();
        bar.append(newBtn, checkBtn, hintBtn);

        const board = document.createElement('div');
        board.className = 'sudoku-board';
        this.cells = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('input');
                cell.type = 'text';
                cell.inputMode = 'numeric';
                cell.maxLength = 1;
                cell.className = 'sudoku-cell';
                if ((c + 1) % 3 === 0 && c !== 8) cell.classList.add('box-edge-right');
                if ((r + 1) % 3 === 0 && r !== 8) cell.classList.add('box-edge-bottom');
                cell.dataset.r = r;
                cell.dataset.c = c;
                const given = s.puzzle[r][c] !== 0;
                if (given) {
                    cell.value = s.puzzle[r][c];
                    cell.readOnly = true;
                    cell.classList.add('given');
                } else if (s.current[r][c] !== 0) {
                    cell.value = s.current[r][c];
                }
                cell.addEventListener('input', (e) => this.onInput(e, r, c));
                cell.addEventListener('keydown', (e) => this.onKey(e, r, c));
                board.appendChild(cell);
                this.cells.push(cell);
            }
        }

        const pad = document.createElement('div');
        pad.className = 'num-pad';
        for (let n = 1; n <= 9; n++) {
            const b = document.createElement('button');
            b.className = 'btn';
            b.textContent = n;
            b.onclick = () => this.padInput(String(n));
            pad.appendChild(b);
        }
        const erase = document.createElement('button');
        erase.className = 'btn';
        erase.textContent = '⌫';
        erase.onclick = () => this.padInput('');
        pad.appendChild(erase);

        const banner = document.createElement('div');
        banner.id = 'sudoku-banner';

        this.root.append(h, bar, board, pad, banner, this.backToArcade());
        this.highlightConflicts(false);
    },

    onInput(e, r, c) {
        const v = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = v;
        this.state.current[r][c] = v === '' ? 0 : parseInt(v, 10);
        this.save();
        this.highlightConflicts(false);
        if (v !== '') this.checkLineComplete(r, c);
        this.checkWin();
    },

    // Splash green across a row/column the moment it's completed correctly.
    checkLineComplete(r, c) {
        const s = this.state;
        let rowDone = true;
        for (let i = 0; i < 9; i++) {
            if (s.current[r][i] !== s.solution[r][i]) { rowDone = false; break; }
        }
        if (rowDone) this.flashLine(Array.from({ length: 9 }, (_, i) => this.cells[r * 9 + i]));

        let colDone = true;
        for (let i = 0; i < 9; i++) {
            if (s.current[i][c] !== s.solution[i][c]) { colDone = false; break; }
        }
        if (colDone) this.flashLine(Array.from({ length: 9 }, (_, i) => this.cells[i * 9 + c]));

        const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
        let boxDone = true;
        for (let i = 0; i < 3 && boxDone; i++) {
            for (let j = 0; j < 3; j++) {
                if (s.current[br + i][bc + j] !== s.solution[br + i][bc + j]) { boxDone = false; break; }
            }
        }
        if (boxDone) {
            const boxCells = [];
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                boxCells.push(this.cells[(br + i) * 9 + (bc + j)]);
            }
            this.flashLine(boxCells);
        }
    },

    flashLine(cells) {
        cells.forEach((cell) => {
            cell.classList.remove('flash-complete');
            void cell.offsetWidth; // force reflow so the animation can replay
            cell.classList.add('flash-complete');
            cell.addEventListener('animationend', function handler() {
                cell.classList.remove('flash-complete');
                cell.removeEventListener('animationend', handler);
            });
        });
    },

    // Reveal one correct cell. Prefers the focused cell if it's blank/wrong,
    // otherwise picks a random unsolved cell.
    giveHint() {
        const s = this.state;
        if (!s || s.solved) return;

        let target = null;
        const active = document.activeElement;
        if (active && active.classList && active.classList.contains('sudoku-cell') && !active.readOnly) {
            const ar = +active.dataset.r, ac = +active.dataset.c;
            if (s.current[ar][ac] !== s.solution[ar][ac]) target = [ar, ac];
        }
        if (!target) {
            const candidates = [];
            for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
                if (s.puzzle[r][c] === 0 && s.current[r][c] !== s.solution[r][c]) candidates.push([r, c]);
            }
            if (!candidates.length) return;
            target = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const [r, c] = target;
        const val = s.solution[r][c];
        s.current[r][c] = val;
        s.hintsUsed = (s.hintsUsed || 0) + 1;

        const cell = this.cells[r * 9 + c];
        cell.value = val;
        cell.readOnly = true;
        cell.classList.remove('conflict');
        cell.classList.add('hint');

        this.save();
        this.highlightConflicts(false);
        this.flashLine([cell]);
        this.checkLineComplete(r, c);
        this.checkWin();
    },

    onKey(e, r, c) {
        const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (moves[e.key]) {
            e.preventDefault();
            const nr = (r + moves[e.key][0] + 9) % 9;
            const nc = (c + moves[e.key][1] + 9) % 9;
            const next = this.cells[nr * 9 + nc];
            if (next) next.focus();
        }
    },

    padInput(val) {
        const active = document.activeElement;
        if (!active || !active.classList.contains('sudoku-cell') || active.readOnly) return;
        active.value = val;
        active.dispatchEvent(new Event('input'));
    },

    highlightConflicts(showWrong) {
        const s = this.state;
        this.cells.forEach((cell) => cell.classList.remove('conflict'));
        const mark = (r, c) => this.cells[r * 9 + c].classList.add('conflict');
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = s.current[r][c];
                if (v === 0) continue;
                // duplicate in row/col/box
                for (let i = 0; i < 9; i++) {
                    if (i !== c && s.current[r][i] === v) { mark(r, c); }
                    if (i !== r && s.current[i][c] === v) { mark(r, c); }
                }
                const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
                for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
                    const rr = br + i, cc = bc + j;
                    if ((rr !== r || cc !== c) && s.current[rr][cc] === v) { mark(r, c); }
                }
                if (showWrong && v !== s.solution[r][c]) { mark(r, c); }
            }
        }
    },

    checkWin() {
        const s = this.state;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (s.current[r][c] !== s.solution[r][c]) return;
            }
        }
        // Won!
        s.solved = true;
        this.stopTimer();
        Store.remove(KEYS.save);
        const stats = Store.get(KEYS.stats, { played: 0, won: 0, best: {} });
        stats.played = (stats.played || 0) + 1;
        stats.won = (stats.won || 0) + 1;
        stats.best = stats.best || {};
        const prevBest = stats.best[s.difficulty];
        const usedHints = (s.hintsUsed || 0) > 0;
        let isRecord = false;
        if (!usedHints && (prevBest == null || s.elapsed < prevBest)) { stats.best[s.difficulty] = s.elapsed; isRecord = true; }
        Store.set(KEYS.stats, stats);

        const hintNote = usedHints
            ? `${s.hintsUsed} hint${s.hintsUsed > 1 ? 's' : ''} used — time not recorded`
            : '';

        const banner = document.getElementById('sudoku-banner');
        const name = Store.get(KEYS.user, 'Player');
        if (banner) {
            banner.className = 'win-banner';
            let tail;
            if (usedHints) tail = `<span class="comment">${hintNote}</span>`;
            else if (isRecord) tail = `<span style="color:var(--accent)">New best for ${s.difficulty}!</span>`;
            else tail = `<span class="comment">best: ${formatTime(stats.best[s.difficulty])}</span>`;
            banner.innerHTML = `✔ Solved in ${formatTime(s.elapsed)}, ${escapeHtml(name)}! ` + tail;
        }
        this.cells.forEach((cell) => { cell.readOnly = true; });

        this.celebrate();
        let recordText;
        if (usedHints) recordText = hintNote;
        else if (isRecord) recordText = `New best for ${s.difficulty}!`;
        else recordText = `Best ${s.difficulty}: ${formatTime(stats.best[s.difficulty])}`;
        this.showWinModal(name, formatTime(s.elapsed), recordText);
    },

    celebrate() {
        throwConfetti();
    },

    showWinModal(name, time, recordText) {
        const overlay = document.createElement('div');
        overlay.className = 'win-modal';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h3>🎉 Solved!</h3>` +
            `<div class="sub">Nice work, ${escapeHtml(name)} — done in ${time}.<br>` +
            `<span class="comment">${recordText}</span></div>`;
        const row = document.createElement('div');
        row.className = 'difficulty-row';
        const again = document.createElement('button');
        again.className = 'btn primary';
        again.textContent = 'New game';
        again.onclick = () => { overlay.remove(); this.renderSetup(); };
        const close = document.createElement('button');
        close.className = 'btn';
        close.textContent = 'Close';
        close.onclick = () => overlay.remove();
        row.append(again, close);
        card.appendChild(row);
        overlay.appendChild(card);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    },

    startTimer() {
        this.stopTimer();
        this.state.startTs = Date.now() - this.state.elapsed * 1000;
        this.timer = setInterval(() => {
            if (!this.state || this.state.solved) return;
            this.state.elapsed = Math.floor((Date.now() - this.state.startTs) / 1000);
            const t = document.getElementById('sudoku-timer');
            if (t) t.textContent = formatTime(this.state.elapsed);
            this.save();
        }, 1000);
    },

    stopTimer() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    save() {
        if (!this.state || this.state.solved) return;
        Store.set(KEYS.save, {
            difficulty: this.state.difficulty,
            solution: this.state.solution,
            puzzle: this.state.puzzle,
            current: this.state.current,
            elapsed: this.state.elapsed,
            hintsUsed: this.state.hintsUsed || 0
        });
    }
};

/* ---------------- Tic Tac Toe (vs unbeatable computer) ---------------- */
const TicTacToe = {
    root: null,
    onExit: null,
    board: null,
    over: false,
    locked: false,
    cells: null,

    HUMAN: 'X',
    CPU: 'O',
    LINES: [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ],

    mount(container, onExit) {
        this.root = container;
        this.onExit = onExit;
        this.newGame();
    },

    newGame() {
        this.board = Array(9).fill('');
        this.over = false;
        this.locked = false;
        this.render();
    },

    render() {
        this.root.innerHTML = '';
        const h = document.createElement('div');
        h.innerHTML = `<span class="prompt">aakhil@universe:~/games$</span> ./tictactoe`;

        const status = document.createElement('div');
        status.className = 'comment';
        status.id = 'ttt-status';
        status.textContent = '# your move — you are X';

        const bar = document.createElement('div');
        bar.className = 'sudoku-bar';
        const stats = Store.get(KEYS.ttt, { win: 0, loss: 0, draw: 0 });
        bar.innerHTML = `<span class="comment">won ${stats.win || 0} · lost ${stats.loss || 0} · drawn ${stats.draw || 0}</span>`;
        const newBtn = document.createElement('button');
        newBtn.className = 'btn';
        newBtn.textContent = 'New';
        newBtn.onclick = () => this.newGame();
        bar.append(newBtn);

        const board = document.createElement('div');
        board.className = 'ttt-board';
        this.cells = [];
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('button');
            cell.className = 'ttt-cell';
            cell.textContent = this.board[i];
            cell.onclick = () => this.playerMove(i);
            board.appendChild(cell);
            this.cells.push(cell);
        }

        this.root.append(h, status, bar, board, this.backToArcade());
    },

    backToArcade() {
        const wrap = document.createElement('div');
        const link = document.createElement('span');
        link.className = 'cd-link';
        link.textContent = '← back to games';
        link.onclick = () => this.onExit();
        wrap.appendChild(link);
        return wrap;
    },

    setStatus(text) {
        const el = document.getElementById('ttt-status');
        if (el) el.textContent = text;
    },

    playerMove(i) {
        if (this.over || this.locked || this.board[i] !== '') return;
        this.place(i, this.HUMAN);
        if (this.finishIfOver()) return;

        // Computer responds after a short beat.
        this.locked = true;
        this.setStatus('# thinking…');
        setTimeout(() => {
            const move = this.bestMove();
            if (move != null) this.place(move, this.CPU);
            this.locked = false;
            if (!this.finishIfOver()) this.setStatus('# your move');
        }, 280);
    },

    place(i, player) {
        this.board[i] = player;
        const cell = this.cells[i];
        cell.textContent = player;
        cell.classList.add(player === this.HUMAN ? 'x' : 'o');
    },

    finishIfOver() {
        const win = this.winner(this.board);
        if (win) {
            this.over = true;
            win.line.forEach((i) => this.cells[i].classList.add('ttt-win'));
            const stats = Store.get(KEYS.ttt, { win: 0, loss: 0, draw: 0 });
            if (win.player === this.HUMAN) {
                stats.win = (stats.win || 0) + 1;
                this.setStatus('# you win! 🎉');
                throwConfetti();
            } else {
                stats.loss = (stats.loss || 0) + 1;
                this.setStatus('# computer wins — try again');
            }
            Store.set(KEYS.ttt, stats);
            return true;
        }
        if (this.board.every((c) => c !== '')) {
            this.over = true;
            const stats = Store.get(KEYS.ttt, { win: 0, loss: 0, draw: 0 });
            stats.draw = (stats.draw || 0) + 1;
            Store.set(KEYS.ttt, stats);
            this.setStatus('# draw — well played');
            return true;
        }
        return false;
    },

    winner(b) {
        for (const line of this.LINES) {
            const [a, c, d] = line;
            if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
        }
        return null;
    },

    // Minimax: computer (O) maximises, human (X) minimises.
    bestMove() {
        let bestScore = -Infinity, move = null;
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = this.CPU;
                const score = this.minimax(this.board, 0, false);
                this.board[i] = '';
                if (score > bestScore) { bestScore = score; move = i; }
            }
        }
        return move;
    },

    minimax(b, depth, isMax) {
        const win = this.winner(b);
        if (win) return win.player === this.CPU ? 10 - depth : depth - 10;
        if (b.every((c) => c !== '')) return 0;

        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (b[i] === '') {
                    b[i] = this.CPU;
                    best = Math.max(best, this.minimax(b, depth + 1, false));
                    b[i] = '';
                }
            }
            return best;
        }
        let best = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = this.HUMAN;
                best = Math.min(best, this.minimax(b, depth + 1, true));
                b[i] = '';
            }
        }
        return best;
    }
};

/* ---------------- Snake ---------------- */
const Snake = {
    root: null,
    onExit: null,
    state: 'idle',          // idle | running | paused | over
    snake: null,
    dir: null,
    queue: null,
    food: null,
    score: 0,
    stepMs: 150,
    acc: 0,
    lastTs: null,
    raf: null,
    keyHandler: null,
    visHandler: null,
    canvas: null,
    ctx: null,
    cell: 0,
    wasRecord: false,

    COLS: 20,
    ROWS: 20,
    START_MS: 150,
    MIN_MS: 70,
    SPEEDUP: 2.5,

    mount(container, onExit) {
        this.root = container;
        this.onExit = onExit;
        // Document-level listeners need explicit teardown on exit.
        this.keyHandler = (e) => this.onKey(e);
        this.visHandler = () => { if (document.hidden) this.pause(); };
        document.addEventListener('keydown', this.keyHandler);
        document.addEventListener('visibilitychange', this.visHandler);
        this.newGame();
    },

    unmount() {
        this.stopLoop();
        if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
        if (this.visHandler) document.removeEventListener('visibilitychange', this.visHandler);
        this.keyHandler = null;
        this.visHandler = null;
    },

    newGame() {
        this.stopLoop();
        this.state = 'idle';
        const mid = Math.floor(this.ROWS / 2);
        this.snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
        this.dir = { x: 1, y: 0 };
        this.queue = [];
        this.score = 0;
        this.stepMs = this.START_MS;
        this.wasRecord = false;
        this.spawnFood();
        this.render();
        this.draw();
    },

    render() {
        this.root.innerHTML = '';
        const h = document.createElement('div');
        h.innerHTML = `<span class="prompt">aakhil@universe:~/games$</span> ./snake`;

        const status = document.createElement('div');
        status.className = 'comment';
        status.id = 'snake-status';
        status.textContent = '# press ↑ ↓ ← → or WASD to start';

        const bar = document.createElement('div');
        bar.className = 'sudoku-bar';
        const stats = Store.get(KEYS.snake, { best: 0, played: 0 });
        bar.innerHTML = `<span class="comment">score <span class="snake-score" id="snake-score">0</span>` +
            ` · best ${stats.best || 0}</span>`;
        const newBtn = document.createElement('button');
        newBtn.className = 'btn';
        newBtn.textContent = 'New';
        newBtn.onclick = () => this.newGame();
        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'btn';
        pauseBtn.id = 'snake-pause-btn';
        pauseBtn.textContent = 'Pause';
        pauseBtn.onclick = () => this.togglePause();
        bar.append(newBtn, pauseBtn);

        const canvas = document.createElement('canvas');
        canvas.className = 'snake-board';
        canvas.setAttribute('aria-label', 'snake game board');
        this.canvas = canvas;
        this.attachTouch(canvas);

        this.root.append(h, status, bar, canvas, this.makePad(), this.backToArcade());

        // Size the backing store now that the canvas is in the DOM (crisp on HiDPI).
        const dpr = window.devicePixelRatio || 1;
        const px = Math.max(1, Math.round(canvas.clientWidth * dpr));
        canvas.width = px;
        canvas.height = px;
        this.cell = px / this.COLS;
        this.ctx = canvas.getContext('2d');
    },

    backToArcade() {
        const wrap = document.createElement('div');
        const link = document.createElement('span');
        link.className = 'cd-link';
        link.textContent = '← back to games';
        link.onclick = () => { this.unmount(); this.onExit(); };
        wrap.appendChild(link);
        return wrap;
    },

    // On-screen d-pad — CSS shows it only on touch devices.
    makePad() {
        const pad = document.createElement('div');
        pad.className = 'snake-pad';
        const mk = (label, d) => {
            const b = document.createElement('button');
            b.className = 'btn';
            b.textContent = label;
            if (d) {
                b.setAttribute('aria-label', `move ${label}`);
                b.onclick = () => {
                    if (this.state === 'idle') this.start(d);
                    else if (this.state === 'running') this.pushDir(d);
                };
            } else {
                b.disabled = true;
                b.style.visibility = 'hidden';
            }
            return b;
        };
        const up = mk('▲', { x: 0, y: -1 });
        const down = mk('▼', { x: 0, y: 1 });
        const left = mk('◀', { x: -1, y: 0 });
        const right = mk('▶', { x: 1, y: 0 });
        [null, up, null, left, mk(''), right, null, down, null].forEach((b) => {
            pad.appendChild(b || mk(''));
        });
        return pad;
    },

    // Swipes on the board steer the snake (canvas has touch-action: none).
    attachTouch(canvas) {
        let sx = 0, sy = 0;
        canvas.addEventListener('touchstart', (e) => {
            const t = e.changedTouches[0];
            sx = t.clientX; sy = t.clientY;
        }, { passive: true });
        canvas.addEventListener('touchend', (e) => {
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // ignore taps
            const d = Math.abs(dx) > Math.abs(dy)
                ? { x: dx > 0 ? 1 : -1, y: 0 }
                : { x: 0, y: dy > 0 ? 1 : -1 };
            if (this.state === 'idle') this.start(d);
            else if (this.state === 'running') this.pushDir(d);
        }, { passive: true });
    },

    start(d) {
        this.pushDir(d);
        this.state = 'running';
        this.setStatus('# go!');
        this.setPauseLabel('Pause');
        this.startLoop();
        this.draw();
    },

    pause() {
        if (this.state !== 'running') return;
        this.state = 'paused';
        this.stopLoop();
        this.setStatus('# paused — press P to resume');
        this.setPauseLabel('Resume');
        this.draw();
    },

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'running';
        this.setStatus('# go!');
        this.setPauseLabel('Pause');
        this.startLoop();
        this.draw();
    },

    togglePause() {
        if (this.state === 'running') this.pause();
        else if (this.state === 'paused') this.resume();
    },

    setStatus(text) {
        const el = document.getElementById('snake-status');
        if (el) el.textContent = text;
    },

    setPauseLabel(text) {
        const b = document.getElementById('snake-pause-btn');
        if (b) b.textContent = text;
    },

    updateScore() {
        const el = document.getElementById('snake-score');
        if (el) el.textContent = this.score;
    },

    onKey(e) {
        if (this.state === 'over' && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            this.newGame();
            return;
        }
        if (e.key === 'p' || e.key === 'P') {
            this.togglePause();
            return;
        }
        const map = {
            ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
            w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
            W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0]
        };
        const m = map[e.key];
        if (!m) return;
        e.preventDefault();
        const d = { x: m[0], y: m[1] };
        if (this.state === 'idle') this.start(d);
        else if (this.state === 'running') this.pushDir(d);
    },

    // Queue up to two turns so quick double-presses within one tick
    // can't be lost or turned into an accidental 180°.
    pushDir(d) {
        const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
        if (d.x === last.x && d.y === last.y) return;    // same direction
        if (d.x === -last.x && d.y === -last.y) return;  // reversal
        if (this.queue.length >= 2) return;
        this.queue.push(d);
    },

    spawnFood() {
        const free = [];
        for (let x = 0; x < this.COLS; x++) {
            for (let y = 0; y < this.ROWS; y++) {
                if (!this.snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
            }
        }
        this.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    },

    step() {
        if (this.queue.length) this.dir = this.queue.shift();
        const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

        // walls are deadly
        if (head.x < 0 || head.x >= this.COLS || head.y < 0 || head.y >= this.ROWS) {
            this.gameOver();
            return;
        }
        const ate = this.food && head.x === this.food.x && head.y === this.food.y;
        // the tail cell vacates this tick unless we grow, so exclude it when not eating
        const body = ate ? this.snake : this.snake.slice(0, -1);
        if (body.some((s) => s.x === head.x && s.y === head.y)) {
            this.gameOver();
            return;
        }

        this.snake.unshift(head);
        if (ate) {
            this.score++;
            this.stepMs = Math.max(this.MIN_MS, this.stepMs - this.SPEEDUP);
            this.spawnFood();
            this.updateScore();
        } else {
            this.snake.pop();
        }
        this.draw();
    },

    startLoop() {
        this.stopLoop();
        this.acc = 0;
        this.lastTs = null;
        const tick = (ts) => {
            if (this.lastTs == null) this.lastTs = ts;
            this.acc += ts - this.lastTs;
            this.lastTs = ts;
            while (this.acc >= this.stepMs && this.state === 'running') {
                this.acc -= this.stepMs;
                this.step();
            }
            if (this.state !== 'running') return;
            this.raf = requestAnimationFrame(tick);
        };
        this.raf = requestAnimationFrame(tick);
    },

    stopLoop() {
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    },

    gameOver() {
        this.stopLoop();
        this.state = 'over';
        const stats = Store.get(KEYS.snake, { best: 0, played: 0 });
        stats.played = (stats.played || 0) + 1;
        this.wasRecord = this.score > (stats.best || 0) && this.score > 0;
        if (this.wasRecord) stats.best = this.score;
        Store.set(KEYS.snake, stats);
        if (this.wasRecord) {
            this.setStatus(`# new best: ${this.score}! 🎉`);
            throwConfetti();
        } else {
            this.setStatus(`# game over — score ${this.score} · best ${stats.best}`);
        }
        this.draw();
    },

    draw() {
        const ctx = this.ctx;
        if (!ctx) return;
        const c = this.cell;

        ctx.fillStyle = '#181c20';
        ctx.fillRect(0, 0, this.COLS * c, this.ROWS * c);

        // faint dot grid for terminal texture
        ctx.fillStyle = 'rgba(195, 232, 141, 0.08)';
        for (let x = 0; x < this.COLS; x++) {
            for (let y = 0; y < this.ROWS; y++) {
                ctx.fillRect(x * c + c / 2 - 1, y * c + c / 2 - 1, 2, 2);
            }
        }

        // food — the red traffic-light dot
        if (this.food) {
            ctx.fillStyle = '#ff5f56';
            ctx.beginPath();
            ctx.arc(this.food.x * c + c / 2, this.food.y * c + c / 2, c * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // snake — green blocks, brighter head
        this.snake.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? '#27c93f' : '#c3e88d';
            const pad = Math.max(1, c * 0.08);
            ctx.fillRect(seg.x * c + pad, seg.y * c + pad, c - pad * 2, c - pad * 2);
        });

        if (this.state !== 'running') this.drawOverlay(ctx, c);
    },

    drawOverlay(ctx, c) {
        const w = this.COLS * c, hgt = this.ROWS * c;
        const cx = w / 2, cy = hgt / 2;
        ctx.fillStyle = 'rgba(24, 28, 32, 0.78)';
        ctx.fillRect(0, 0, w, hgt);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const mono = "'Fira Mono', Consolas, monospace";
        const line = (text, y, color, scale) => {
            ctx.fillStyle = color;
            ctx.font = `bold ${Math.round(c * scale)}px ${mono}`;
            ctx.fillText(text, cx, y);
        };
        if (this.state === 'idle') {
            line('# snake', cy - c * 1.4, '#5c6370', 0.75);
            line('press ↑ ↓ ← →', cy, '#c3e88d', 0.8);
            line('or WASD to start', cy + c * 1.4, '#5c6370', 0.7);
        } else if (this.state === 'paused') {
            line('# paused', cy - c * 0.7, '#c3e88d', 0.9);
            line('press P to resume', cy + c * 1.1, '#5c6370', 0.7);
        } else if (this.state === 'over') {
            const stats = Store.get(KEYS.snake, { best: 0, played: 0 });
            line('# game over', cy - c * 2.2, '#5c6370', 0.75);
            line(`score ${this.score}`, cy - c * 0.6, '#ffd700', 1.3);
            if (this.wasRecord) line('new best!', cy + c * 0.9, '#c3e88d', 0.8);
            else line(`best ${stats.best}`, cy + c * 0.9, '#5c6370', 0.7);
            line('space or New to restart', cy + c * 2.4, '#82aaff', 0.65);
        }
    }
};

/* ---------------- Sudoku helpers ---------------- */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function isSafe(board, r, c, n) {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === n || board[i][c] === n) return false;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (board[br + i][bc + j] === n) return false;
    }
    return true;
}

function fillBoard(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                    if (isSafe(board, r, c, n)) {
                        board[r][c] = n;
                        if (fillBoard(board)) return true;
                        board[r][c] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateSolved() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillBoard(board);
    return board;
}

function countSolutions(board, limit) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                let count = 0;
                for (let n = 1; n <= 9; n++) {
                    if (isSafe(board, r, c, n)) {
                        board[r][c] = n;
                        count += countSolutions(board, limit);
                        board[r][c] = 0;
                        if (count >= limit) return count;
                    }
                }
                return count;
            }
        }
    }
    return 1;
}

function makePuzzle(solution, clues) {
    const puzzle = solution.map((r) => r.slice());
    const cells = shuffle([...Array(81).keys()]);
    let filled = 81;
    for (const idx of cells) {
        if (filled <= clues) break;
        const r = Math.floor(idx / 9), c = idx % 9;
        if (puzzle[r][c] === 0) continue;
        const backup = puzzle[r][c];
        puzzle[r][c] = 0;
        const copy = puzzle.map((row) => row.slice());
        if (countSolutions(copy, 2) !== 1) {
            puzzle[r][c] = backup; // removing broke uniqueness — keep it
        } else {
            filled--;
        }
    }
    return puzzle;
}

function formatTime(totalSeconds) {
    const s = Math.max(0, totalSeconds | 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

// Shared win celebration — rains confetti across the viewport.
function throwConfetti() {
    const colors = ['#82aaff', '#ffd700', '#c3e88d', '#ff5f56', '#27c93f', '#ffbd2e'];
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    for (let i = 0; i < 130; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti';
        piece.style.left = (Math.random() * 100) + 'vw';
        piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = (Math.random() * 0.6) + 's';
        piece.style.animationDuration = (2 + Math.random() * 1.6) + 's';
        layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4500);
}

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('games-root');
    if (mount) Games.showArcade(mount);
});
