// Talks to the Python worker. Python cannot be interrupted from outside, so a
// test that runs past its time limit is handled by throwing the worker away and
// starting a fresh one (Pyodide reloads from the browser cache).

export class PythonRunner {
  /**
   * @param {object}   options
   * @param {string}   options.url            Pyodide base URL (ends with "/")
   * @param {number}   options.testTimeoutMs  time limit per test
   * @param {function} options.onStatus       (status, detail) with status
   *                                          'loading' | 'ready' | 'error'
   */
  constructor({ url, testTimeoutMs, onStatus = () => {} }) {
    this.url = url;
    this.testTimeoutMs = testTimeoutMs;
    this.onStatus = onStatus;
    this.worker = null;
    this.ready = null;
    this.job = null;
    this.failed = false; // Pyodide could not be loaded (e.g. offline): retry on next run
    this.nextId = 1;
    this.start();
  }

  start() {
    this.stop();
    this.failed = false;
    this.onStatus('loading');

    const worker = new Worker(new URL('./pyodide.worker.js', import.meta.url));
    this.worker = worker;

    this.ready = new Promise((resolve, reject) => {
      worker.onmessage = (event) => {
        const message = event.data;
        if (message.type === 'ready') {
          this.onStatus('ready');
          resolve();
        } else if (message.type === 'init-error') {
          this.failed = true;
          this.onStatus('error', message.error);
          reject(new Error(message.error));
        } else if (this.job && message.id === this.job.id) {
          this.job.handle(message);
        }
      };
      worker.onerror = (event) => {
        const error = event.message || 'The Python worker crashed.';
        if (this.job) this.job.crash(error);
        else {
          this.failed = true;
          this.onStatus('error', error);
          reject(new Error(error));
        }
      };
    });
    this.ready.catch(() => {}); // run() reports this; avoid an unhandled rejection

    worker.postMessage({ type: 'init', url: this.url });
    return this.ready;
  }

  stop() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.job = null;
  }

  /**
   * Run tests against the learner's code.
   * Resolves (never rejects once Python is loaded) with
   *   { stage: 'done' | 'error' | 'timeout' | 'crash', error?, timedOutIndex?, results }
   * where results[i] = { ok, actual?, error?, errorType?, ms, stdout }.
   */
  async run({ code, fn, mode, tests, onProgress = () => {} }) {
    if (!this.worker || this.failed) this.start();
    await this.ready; // rejects if Python could not be loaded

    const worker = this.worker;
    const id = this.nextId++;

    return new Promise((resolve) => {
      const results = [];
      let timer = null;

      const finish = (outcome) => {
        clearTimeout(timer);
        this.job = null;
        resolve({ ...outcome, results });
      };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const timedOutIndex = results.length;
          this.start(); // replaces the stuck worker
          finish({ stage: 'timeout', timedOutIndex });
        }, this.testTimeoutMs);
      };

      this.job = {
        id,
        handle: (message) => {
          if (message.type === 'error') finish({ stage: 'error', error: message.error });
          else if (message.type === 'done') {
            finish({ stage: 'done' });
            if (message.restart) this.start(); // runtime is in an unknown state after a stack overflow
          }
          else if (message.type === 'progress') {
            results[message.index] = message.result;
            onProgress(message.index, message.result);
            arm();
          }
        },
        crash: (error) => {
          this.start();
          finish({ stage: 'crash', error });
        },
      };

      arm();
      worker.postMessage({ type: 'run', id, code, fn, mode, tests });
    });
  }
}
