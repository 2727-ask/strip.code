// Loading progress shared between the age gate (which shows it) and the app
// (which reports it). Tiny and dependency-free, so the gate can load it without
// pulling in the rest of the site.
//
// Each task reports a fraction from 0 to 1. The overall figure is a weighted
// average, so the big downloads move the bar the most. `ready` resolves once
// every task is complete; a fatal failure rejects it.

const TASKS = {
  code:       { weight: 10, label: 'Setting up the stage' },
  fonts:      { weight: 4,  label: 'Loading the fonts' },
  model:      { weight: 28, label: 'Loading the dancer' },
  animations: { weight: 10, label: 'Learning the moves' },
  python:     { weight: 38, label: 'Warming up Python' },
  scene:      { weight: 10, label: 'Turning on the lights' },
};

const fractions = Object.fromEntries(Object.keys(TASKS).map((name) => [name, 0]));
const warnings = []; // non-fatal problems, e.g. Python could not be downloaded
const listeners = new Set();
const creeps = new Map();

let settle;
export const ready = new Promise((resolve, reject) => (settle = { resolve, reject }));
ready.catch(() => {}); // the gate handles it; avoid an "unhandled rejection" if nobody is listening yet

function total() {
  let sum = 0;
  let weights = 0;
  for (const [name, task] of Object.entries(TASKS)) {
    sum += task.weight * fractions[name];
    weights += task.weight;
  }
  return sum / weights;
}

// the first unfinished task, for the line of text under the bar
function currentLabel() {
  const pending = Object.entries(TASKS)
    .filter(([name]) => fractions[name] < 1)
    .sort((a, b) => b[1].weight * (1 - fractions[b[0]]) - a[1].weight * (1 - fractions[a[0]]));
  return pending.length ? pending[0][1].label : 'Ready';
}

function notify() {
  const snapshot = { progress: total(), label: currentLabel(), warnings: [...warnings] };
  listeners.forEach((listener) => listener(snapshot));
  if (snapshot.progress >= 0.9999) settle.resolve(snapshot);
}

/** Report progress for a task (0 to 1). Progress never goes backwards. */
export function setTask(name, fraction) {
  if (!(name in fractions)) return;
  fractions[name] = Math.max(fractions[name], Math.min(Math.max(fraction, 0), 1));
  if (fractions[name] >= 1) stopCreep(name);
  notify();
}

/**
 * For a task with no real progress to report (e.g. downloading the Python
 * runtime), ease towards `ceiling` over roughly `seconds` so the bar keeps
 * moving. It stops when the task is completed for real.
 */
export function creep(name, ceiling = 0.9, seconds = 5) {
  if (!(name in fractions) || creeps.has(name) || fractions[name] >= 1) return;
  const start = performance.now();
  creeps.set(
    name,
    setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      setTask(name, ceiling * (1 - Math.exp(-elapsed / (seconds / 3))));
    }, 150)
  );
}

function stopCreep(name) {
  clearInterval(creeps.get(name));
  creeps.delete(name);
}

/** A task that could not finish but should not block the site. */
export function skipTask(name, reason) {
  warnings.push({ task: name, reason: String(reason) });
  setTask(name, 1);
}

/** Something essential failed: the site cannot start. */
export function fail(error) {
  creeps.forEach((_, name) => stopCreep(name));
  settle.reject(error instanceof Error ? error : new Error(String(error)));
}

// The age gate has lifted and the visitor can see the stage. The site loads and sets
// itself up behind the gate, then waits for this before the show begins (the dancer's
// entrance, for one), so the visitor sees it from the start.
let openUp;
export const revealed = new Promise((resolve) => (openUp = resolve));

/** Called by the age gate the moment it lifts. */
export function reveal() {
  openUp();
}

/** Listen for progress. Returns a function that stops listening. */
export function onProgress(listener) {
  listeners.add(listener);
  listener({ progress: total(), label: currentLabel(), warnings: [...warnings] });
  return () => listeners.delete(listener);
}
