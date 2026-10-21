/// <reference lib="webworker" />
import { loadPyodide, type PyodideAPI } from 'pyodide';
import { PYODIDE_INDEX_URL, needsNumpy } from './config';
import { pythonFiles } from './files';
import { installPython, type Runner } from './install';
import type { RunRequest, WorkerEvent, WorkerRequest } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const FLUSH_MS = 40;
const FLUSH_CHARS = 8192;

function post(event: WorkerEvent) {
  scope.postMessage(event);
}

async function boot(): Promise<{ py: PyodideAPI; runner: Runner }> {
  post({ type: 'status', text: 'Python wird geladen …' });
  const py = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  const runner = installPython(py, pythonFiles);
  post({ type: 'ready' });
  return { py, runner };
}

const booting = boot().catch((error: unknown) => {
  post({ type: 'load-failed', message: String(error) });
  throw error;
});

function streamer(id: number, type: 'stdout' | 'stderr') {
  let buffer = '';
  let lastFlush = performance.now();
  const flush = () => {
    if (buffer) post({ type, id, text: buffer });
    buffer = '';
    lastFlush = performance.now();
  };
  const write = (s: string) => {
    buffer += s;
    if (buffer.length > FLUSH_CHARS || performance.now() - lastFlush > FLUSH_MS) flush();
  };
  return { write, flush };
}

function progressEmitter(id: number) {
  let last = 0;
  return (json: string) => {
    const now = performance.now();
    if (now - last < 100) return;
    last = now;
    post({ type: 'progress', id, info: JSON.parse(json) });
  };
}

async function run(id: number, request: RunRequest) {
  const { py, runner } = await booting;
  const allCode = [request.code, ...(request.tests ?? []).map((t) => t.code)].join('\n');
  if (needsNumpy(allCode) && !py.loadedPackages['numpy']) {
    post({ type: 'status', text: 'NumPy wird geladen …' });
    await py.loadPackage('numpy', { messageCallback: () => {} });
    post({ type: 'ready' });
  }
  const out = streamer(id, 'stdout');
  const err = streamer(id, 'stderr');
  const json = runner.run(JSON.stringify(request), out.write, err.write, progressEmitter(id));
  out.flush();
  err.flush();
  const heapBytes =
    (py as unknown as { _module?: { HEAP8?: Int8Array } })._module?.HEAP8?.byteLength ?? 0;
  post({ type: 'result', id, result: JSON.parse(json), heapBytes });
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'run') void run(message.id, message.request);
};
