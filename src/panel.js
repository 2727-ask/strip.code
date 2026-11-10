// The right-hand panel: four DSA problems, a Python code editor, and test results.
// Solving problem N (Submit passes all 10 tests) unlocks problem N+1 and calls
// onSolved(N).

import './panel.css';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

import { PROBLEMS } from './problems.js';
import { PYTHON, UI } from './config.js';
import { PythonRunner } from './runner.js';
import { creep, setTask, skipTask } from './loading.js';
import { playSound } from './sounds.js';

// =====================================================
// SMALL HELPERS
// =====================================================

// Which sound effect goes with a finished run (names from SOUNDS.files in config.js):
// all sample tests passed, the whole problem solved, or anything else
function resultSound(kind, outcome, testCount) {
  const allPassed = outcome.stage === 'done' && outcome.results.filter((r) => r && r.ok).length === testCount;
  if (!allPassed) return 'error';
  return kind === 'submit' ? 'solved' : 'testsPassed';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Remember the learner's code per problem (best effort: storage can be blocked)
const draftKey = (problem) => `catalina.code.${problem.id}`;

function loadDraft(problem) {
  try {
    return localStorage.getItem(draftKey(problem)) ?? problem.starter;
  } catch {
    return problem.starter;
  }
}

function saveDraft(problem, code) {
  try {
    localStorage.setItem(draftKey(problem), code);
  } catch {
    /* ignore */
  }
}

const seconds = (ms) => `${(ms / 1000).toString().replace(/\.0+$/, '')} s`;

// =====================================================
// PANEL
// =====================================================
export function initPanel({ onSolved = () => {} } = {}) {
  const root = document.getElementById(UI.panelId);
  if (!root) return;

  const state = {
    current: 0,
    solved: PROBLEMS.map(() => false),
    busy: false,
    runtime: 'loading', // loading | ready | error
  };
  const unlocked = (index) => index === 0 || state.solved[index - 1];

  // ---------- skeleton ----------
  root.innerHTML = '';
  const tabsBar = el('nav', 'tabs');
  tabsBar.setAttribute('role', 'tablist');
  const scroll = el('div', 'scroll');

  const problemBox = el('section', 'problem');
  const codingBox = el('section', 'coding');
  const resultsBox = el('section', 'results');
  scroll.append(problemBox, codingBox, resultsBox);
  root.append(tabsBar, scroll);

  // tabs
  const tabs = PROBLEMS.map((problem, index) => {
    const tab = el('button', 'tab');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => select(index));
    tabsBar.append(tab);
    return tab;
  });

  // coding area
  const toolbar = el('div', 'toolbar');
  const language = el('span', 'language', 'Python 3');
  const runtimeLabel = el('span', 'runtime');
  const resetButton = el('button', 'link-button', 'Reset code');
  resetButton.type = 'button';
  toolbar.append(language, runtimeLabel, resetButton);

  const editorMount = el('div', 'editor');
  const actions = el('div', 'actions');
  const runButton = el('button', 'btn secondary run', 'Run visible tests'); // the play arrow is drawn in CSS
  const submitButton = el('button', 'btn primary', 'Submit');
  runButton.type = 'button';
  submitButton.type = 'button';
  runButton.title = 'Run the 2 visible test cases (Ctrl/Cmd + Enter)';
  submitButton.title = 'Run all 10 test cases, including the 8 hidden ones';
  const note = el('span', 'note', `Each test must finish within ${seconds(PYTHON.testTimeoutMs)}.`);
  actions.append(runButton, submitButton, note);
  codingBox.append(toolbar, editorMount, actions);

  // ---------- Python runtime ----------
  const runner = new PythonRunner({
    url: PYTHON.pyodideUrl,
    testTimeoutMs: PYTHON.testTimeoutMs,
    onStatus: (status, detail) => {
      state.runtime = status;
      runtimeLabel.dataset.status = status;
      runtimeLabel.textContent = {
        loading: 'Loading Python…',
        ready: 'Python ready',
        error: 'Python failed to load. Check your connection; Run will retry.',
      }[status];
      if (status === 'error' && detail) runtimeLabel.title = detail;

      // Python is part of what the age gate waits for. If it cannot be downloaded the
      // site still opens (Run will retry), it is not worth blocking everything on.
      if (status === 'loading') creep('python', 0.92, 6);
      else if (status === 'ready') setTask('python', 1);
      else if (status === 'error') skipTask('python', detail);

      updateControls();
    },
  });

  // ---------- editor ----------
  const view = new EditorView({
    parent: editorMount,
    doc: loadDraft(PROBLEMS[0]),
    extensions: [
      basicSetup,
      python(),
      oneDark,
      indentUnit.of('    '),
      Prec.highest(
        keymap.of([
          indentWithTab,
          { key: 'Mod-Enter', run: () => (execute('run'), true) },
        ])
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) scheduleSave();
      }),
      // plum background and pink accents on top of the One Dark syntax colours
      Prec.high(
        EditorView.theme(
          {
            '&': { height: '100%', fontSize: '14px', backgroundColor: '#140a1b' },
            '.cm-scroller': { fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
            '.cm-gutters': { backgroundColor: '#140a1b', color: '#8f6aa0', borderRight: '1px solid #3a2150' },
            '.cm-activeLine': { backgroundColor: 'rgba(255, 45, 149, 0.08)' },
            '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 45, 149, 0.14)', color: '#ffb3dc' },
            '.cm-content': { caretColor: '#ff2d95' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#ff2d95' },
            '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
              { backgroundColor: 'rgba(255, 45, 149, 0.3)' },
          },
          { dark: true }
        )
      ),
    ],
  });

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    const problem = PROBLEMS[state.current];
    saveTimer = setTimeout(() => saveDraft(problem, view.state.doc.toString()), 400);
  }

  function setCode(code) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
  }

  resetButton.addEventListener('click', () => {
    if (state.busy) return;
    setCode(PROBLEMS[state.current].starter);
  });
  runButton.addEventListener('click', () => execute('run'));
  submitButton.addEventListener('click', () => execute('submit'));

  // ---------- rendering: tabs and problem ----------
  function refreshTabs() {
    tabs.forEach((tab, index) => {
      const problem = PROBLEMS[index];
      const locked = !unlocked(index);
      const mark = state.solved[index] ? '✓' : locked ? '🔒' : '';
      tab.textContent = '';
      tab.append(el('span', 'tab-number', String(index + 1)), el('span', 'tab-title', problem.title));
      if (mark) tab.append(el('span', 'tab-mark', mark));
      tab.disabled = locked || state.busy;
      tab.title = locked ? 'Solve the previous problem to unlock this one' : problem.title;
      tab.classList.toggle('active', index === state.current);
      tab.classList.toggle('solved', state.solved[index]);
      tab.setAttribute('aria-selected', index === state.current ? 'true' : 'false');
    });
  }

  function renderProblem() {
    const problem = PROBLEMS[state.current];
    problemBox.innerHTML = '';

    const heading = el('div', 'problem-head');
    heading.append(
      el('h2', 'problem-title', `${state.current + 1}. ${problem.title}`),
      el('span', `pill ${problem.difficulty.toLowerCase()}`, problem.difficulty)
    );
    const statement = el('div', 'statement');
    statement.innerHTML = problem.statement; // trusted, written in problems.js

    problemBox.append(heading, statement);

    problem.examples.forEach((example, index) => {
      const box = el('div', 'example');
      box.append(el('div', 'example-title', `Example ${index + 1}`));
      const lines = [
        ['Input', example.input],
        ['Output', example.output],
      ];
      if (example.note) lines.push(['Why', example.note]);
      lines.forEach(([label, value]) => {
        const row = el('div', 'kv');
        row.append(el('span', 'k', label), el('code', 'v', value));
        box.append(row);
      });
      problemBox.append(box);
    });

    const constraints = el('div', 'constraints');
    constraints.append(el('div', 'example-title', 'Constraints'));
    const list = el('ul');
    problem.constraints.forEach((html) => {
      const item = el('li');
      item.innerHTML = html;
      list.append(item);
    });
    constraints.append(list);
    problemBox.append(constraints);

    if (problem.hint) problemBox.append(el('p', 'hint', `Hint: ${problem.hint}`));
  }

  function select(index) {
    if (state.busy || !unlocked(index)) return;
    clearTimeout(saveTimer);
    saveDraft(PROBLEMS[state.current], view.state.doc.toString());
    state.current = index;
    renderProblem();
    setCode(loadDraft(PROBLEMS[index]));
    resultsBox.innerHTML = '';
    if (state.solved[index]) showBanner('success', 'You already solved this problem.');
    refreshTabs();
    scroll.scrollTop = 0;
  }

  function updateControls() {
    const disabled = state.busy || state.runtime === 'loading';
    runButton.disabled = disabled;
    submitButton.disabled = disabled;
    resetButton.disabled = state.busy;
    refreshTabs();
  }

  // ---------- rendering: results ----------
  function showBanner(kind, text, extra) {
    resultsBox.querySelector('.banner')?.remove();
    const banner = el('div', `banner ${kind}`);
    banner.append(el('span', 'banner-text', text));
    if (extra) banner.append(extra);
    resultsBox.prepend(banner);
  }

  function describeFailure(result) {
    if (result.error) return result.errorType ? `Runtime error (${result.errorType})` : 'Runtime error';
    return 'Wrong answer';
  }

  function renderTestRow(test, index, result, hidden, timedOut) {
    const status = !result ? (timedOut ? 'tle' : 'skipped') : result.ok ? 'pass' : 'fail';
    const mark = { pass: '✓', fail: '✗', tle: '⏱', skipped: '–' }[status];

    if (hidden) {
      const row = el('div', `test hidden-test ${status}`);
      row.append(el('span', 'mark', mark), el('span', 'test-name', `Hidden test ${index}`));
      const verdict = !result
        ? timedOut ? 'Time limit exceeded' : 'Not run'
        : result.ok ? 'Passed' : describeFailure(result);
      row.append(el('span', 'verdict', verdict));
      if (result && typeof result.ms === 'number') row.append(el('span', 'ms', `${result.ms} ms`));
      return row;
    }

    const row = el('details', `test ${status}`);
    if (status === 'fail' || status === 'tle') row.open = true;
    const summary = el('summary');
    summary.append(el('span', 'mark', mark), el('span', 'test-name', `Test ${index}`));
    summary.append(
      el('span', 'verdict', !result ? (timedOut ? 'Time limit exceeded' : 'Not run') : result.ok ? 'Passed' : describeFailure(result))
    );
    if (result && typeof result.ms === 'number') summary.append(el('span', 'ms', `${result.ms} ms`));
    row.append(summary);

    const body = el('div', 'test-body');
    const addLine = (label, value) => {
      const line = el('div', 'kv');
      line.append(el('span', 'k', label), el('code', 'v', value));
      body.append(line);
    };
    addLine('Input', test.label);
    addLine('Expected', test.expected);
    if (result) {
      if (result.error) addLine('Error', result.error);
      else addLine('Your output', result.actual);
      if (result.stdout) {
        body.append(el('div', 'k', 'Printed'));
        body.append(el('pre', 'printed', result.stdout));
      }
    }
    row.append(body);
    return row;
  }

  function renderOutcome(kind, problem, tests, outcome) {
    resultsBox.innerHTML = '';
    const visibleCount = problem.visibleTests.length;

    if (outcome.stage === 'error' || outcome.stage === 'crash') {
      showBanner('error', outcome.stage === 'crash' ? 'The Python runtime crashed. Try again.' : 'Your code could not run.');
      resultsBox.append(el('pre', 'error-box', outcome.error));
      return false;
    }

    const results = outcome.results;
    const passed = results.filter((r) => r && r.ok).length;
    const timedOut = outcome.stage === 'timeout';
    const accepted = outcome.stage === 'done' && passed === tests.length;

    const list = el('div', 'test-list');
    tests.forEach((test, index) => {
      const hidden = index >= visibleCount;
      const result = results[index];
      const isTimedOut = timedOut && index === outcome.timedOutIndex;
      list.append(renderTestRow(test, hidden ? index - visibleCount + 1 : index + 1, result, hidden, isTimedOut));
    });

    if (timedOut) {
      const at = outcome.timedOutIndex;
      const which = at >= visibleCount ? `Hidden test ${at - visibleCount + 1}` : `Test ${at + 1}`;
      showBanner('error', `Time limit exceeded: ${which} took longer than ${seconds(PYTHON.testTimeoutMs)}. Try a faster approach.`);
    } else if (accepted && kind === 'submit') {
      showBanner('success', `Accepted. All ${tests.length} tests passed.`);
    } else if (kind === 'run') {
      showBanner(
        passed === tests.length ? 'info' : 'error',
        passed === tests.length
          ? `${passed}/${tests.length} visible tests passed. Submit to run the hidden tests too.`
          : `${passed}/${tests.length} visible tests passed.`
      );
    } else {
      showBanner('error', `Wrong answer. ${passed}/${tests.length} tests passed.`);
    }
    if (results.some((r) => r && r.errorType === 'RecursionError')) {
      resultsBox.append(
        el(
          'p',
          'tip',
          'Tip: Python runs inside your browser, which has a small call stack. Deep recursion (a few hundred levels with @lru_cache or generators) fails here. A loop or bottom-up approach avoids it.'
        )
      );
    }
    resultsBox.append(list);
    return accepted && kind === 'submit';
  }

  // ---------- running ----------
  async function execute(kind) {
    if (state.busy || state.runtime === 'loading' || !unlocked(state.current)) return;

    const index = state.current;
    const problem = PROBLEMS[index];
    const tests = kind === 'run' ? problem.visibleTests : [...problem.visibleTests, ...problem.hiddenTests];

    state.busy = true;
    updateControls();
    resultsBox.innerHTML = '';
    showBanner('info', kind === 'run' ? 'Running visible tests…' : `Running all ${tests.length} tests…`);

    let outcome;
    try {
      outcome = await runner.run({
        code: view.state.doc.toString(),
        fn: problem.fn,
        mode: problem.compare,
        tests: tests.map(({ args, expected }) => ({ args, expected })),
      });
    } catch (error) {
      state.busy = false;
      updateControls();
      resultsBox.innerHTML = '';
      showBanner('error', 'Python could not be loaded, so your code was not run. Check your internet connection and try again.');
      playSound('error');
      return;
    }

    state.busy = false;
    const accepted = renderOutcome(kind, problem, tests, outcome);
    updateControls();
    playSound(resultSound(kind, outcome, tests.length));
    if (accepted) markSolved(index);
  }

  function markSolved(index) {
    const firstTime = !state.solved[index];
    state.solved[index] = true;
    refreshTabs();
    if (!firstTime) return;

    const last = index === PROBLEMS.length - 1;
    let next = null;
    if (!last) {
      next = el('button', 'btn primary small', 'Next problem →');
      next.type = 'button';
      next.addEventListener('click', () => select(index + 1));
    }
    showBanner(
      'success',
      last
        ? 'Accepted. All problems solved. Nice work!'
        : `Accepted. Problem ${index + 1} solved! Problem ${index + 2} is unlocked.`,
      next
    );
    onSolved(index);
  }

  // ---------- go ----------
  renderProblem();
  refreshTabs();
  updateControls();
}
