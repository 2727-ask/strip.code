// Runs the learner's Python (via Pyodide) off the main thread, so an infinite
// loop can never freeze the page. A classic worker (not a module) so it can use
// importScripts, the officially supported way to load Pyodide in a worker.
//
// Messages in:   { type: 'init', url }                         load Pyodide
//                { type: 'run', id, code, fn, mode, tests }    run tests
// Messages out:  { type: 'ready' } | { type: 'init-error', error }
//                { type: 'error' | 'progress' | 'done', id, ... }

let pyodide = null;
const stdout = [];

// Python helpers, run once. User code lives in its own namespace and cannot
// touch these. Tests are Python expressions evaluated here, so a large input
// can be generated (e.g. "[0] * 100000") instead of being written out.
const HARNESS = `
import json, sys, time, traceback

sys.setrecursionlimit(10000)

def _norm(x):
    if isinstance(x, (list, tuple)):
        return [_norm(i) for i in x]
    return x

def _same(actual, expected, mode):
    actual, expected = _norm(actual), _norm(expected)
    if mode == 'unordered' and isinstance(actual, list) and isinstance(expected, list):
        try:
            return sorted(actual) == sorted(expected)
        except TypeError:
            return False
    return type(actual) is type(expected) and actual == expected

def _show(x, limit=300):
    try:
        text = repr(x)
    except BaseException:
        text = '<unprintable value>'
    return text if len(text) <= limit else text[:limit] + '...'

def _run_one(fn, args_src, expected_src, mode):
    args = eval(args_src, {})
    expected = eval(expected_src, {})
    start = time.perf_counter()
    try:
        actual = fn(*args)
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == '<your code>']
        where = f' (line {frames[-1].lineno}, in {frames[-1].name})' if frames else ''
        return json.dumps({
            'ok': False,
            'error': f'{type(e).__name__}: {e}{where}',
            'errorType': type(e).__name__,
            'ms': round((time.perf_counter() - start) * 1000),
        })
    return json.dumps({
        'ok': bool(_same(actual, expected, mode)),
        'actual': _show(actual),
        'ms': round((time.perf_counter() - start) * 1000),
    })
`;

async function init(url) {
  try {
    importScripts(`${url}pyodide.js`);
    pyodide = await loadPyodide({ indexURL: url });
    pyodide.setStdout({ batched: (line) => stdout.push(line) });
    pyodide.setStderr({ batched: (line) => stdout.push(line) });
    pyodide.setStdin({ stdin: () => undefined }); // input() reads end-of-file
    pyodide.runPython(HARNESS, { filename: '<harness>' });
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'init-error', error: String(err && err.message ? err.message : err) });
  }
}

// Keep only the learner's own stack frames; drop Pyodide's internal ones
function friendlyError(err) {
  const lines = String((err && err.message) || err).trim().split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('  File ')) {
      out.push(line);
      continue;
    }
    const mine = line.includes('<your code>');
    if (mine) out.push(line);
    while (lines[i + 1] && lines[i + 1].startsWith('    ')) {
      i++;
      if (mine) out.push(lines[i]);
    }
  }
  return out.join('\n');
}

function takeOutput(limit = 2000) {
  const text = stdout.join('\n');
  stdout.length = 0;
  return text.length <= limit ? text : `${text.slice(0, limit)}\n... (output cut)`;
}

async function runJob({ id, code, fn, mode, tests }) {
  const post = (message) => self.postMessage({ id, ...message });
  const namespace = pyodide.globals.get('dict')();
  let userFn = null;
  let runOne = null;

  try {
    stdout.length = 0;
    try {
      pyodide.runPython(code, { globals: namespace, filename: '<your code>' });
    } catch (err) {
      post({ type: 'error', error: friendlyError(err) });
      return;
    }

    if (!namespace.has(fn)) {
      post({ type: 'error', error: `Your code must define a function named ${fn}.` });
      return;
    }
    userFn = namespace.get(fn);
    if (typeof userFn !== 'function') {
      post({ type: 'error', error: `${fn} must be a function.` });
      return;
    }

    runOne = pyodide.globals.get('_run_one');
    let topLevelOutput = takeOutput(); // anything printed while defining the function
    let restart = false;
    for (let index = 0; index < tests.length; index++) {
      const test = tests[index];
      let result;
      try {
        result = JSON.parse(runOne(userFn, test.args, test.expected, mode));
      } catch (err) {
        // _run_one catches every Python exception itself, so what reaches here is
        // normally the runtime failing: almost always the browser's call stack
        // overflowing on deep recursion through C code (e.g. @lru_cache).
        const message = String((err && err.message) || err);
        const isPython = err && typeof err.type === 'string';
        if (/call stack|too much recursion/i.test(message)) {
          result = {
            ok: false,
            errorType: 'RecursionError',
            error: 'RecursionError: the call stack overflowed. Recursion through @lru_cache or generators only reaches a few hundred levels in the browser.',
          };
          restart = true;
        } else if (isPython) {
          result = { ok: false, errorType: 'Error', error: friendlyError(err) };
        } else {
          result = { ok: false, errorType: 'Error', error: `Internal error: ${message}` };
          restart = true;
        }
      }
      result.stdout = [topLevelOutput, takeOutput()].filter(Boolean).join('\n');
      topLevelOutput = '';
      post({ type: 'progress', index, result });
      if (restart) break; // the runtime is in an unknown state: stop and get a fresh one
    }
    post({ type: 'done', restart });
  } finally {
    if (userFn && userFn.destroy) userFn.destroy();
    if (runOne) runOne.destroy();
    namespace.destroy();
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'init') init(message.url);
  else if (message.type === 'run') runJob(message);
};
