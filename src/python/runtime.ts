import { HEAP_RESTART_BYTES } from './config';
import type { ProgressInfo, RunRequest, RunResult, WorkerEvent } from './protocol';

export type RuntimeState = 'loading' | 'ready' | 'running' | 'failed';

export interface RunHandlers {
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
  onProgress?: (info: ProgressInfo) => void;
}

interface Job {
  request: RunRequest;
  handlers: RunHandlers;
  resolve: (result: RunResult) => void;
}

interface PendingRun extends Job {
  id: number;
}

export interface RuntimeSnapshot {
  state: RuntimeState;
  status: string;
}

const STOPPED: RunResult = {
  status: 'stopped',
  error: null,
  seconds: 0,
  inputsUsed: 0,
  stdout: '',
  stderr: '',
  scenes: [],
};

class PythonRuntime {
  private worker: Worker | null = null;
  private pending: PendingRun | null = null;
  private queue: Job[] = [];
  private nextId = 1;
  private snapshot: RuntimeSnapshot = { state: 'loading', status: 'Python wird geladen …' };
  private listeners = new Set<(s: RuntimeSnapshot) => void>();
  private restartAfterRun = false;

  start() {
    if (this.worker) return;
    this.setState({ state: 'loading', status: 'Python wird geladen …' });
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => this.handle(event.data);
    this.worker.onerror = (event) => {
      this.setState({ state: 'failed', status: `Python-Worker abgestürzt: ${event.message}` });
    };
  }

  get current(): RuntimeSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (s: RuntimeSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  run(request: RunRequest, handlers: RunHandlers = {}): Promise<RunResult> {
    this.start();
    return new Promise((resolve) => {
      const job = { request, handlers, resolve };
      if (this.pending) this.queue.push(job);
      else this.dispatch(job);
    });
  }

  private dispatch(job: Job) {
    const id = this.nextId++;
    this.pending = { ...job, id };
    if (this.snapshot.state === 'ready') this.setState({ state: 'running', status: 'Läuft …' });
    this.worker!.postMessage({ type: 'run', id, request: job.request });
  }

  stop() {
    this.restart('Python startet neu …');
  }

  retry() {
    this.restart('Python wird geladen …');
  }

  private restart(status: string) {
    this.worker?.terminate();
    this.worker = null;
    const pending = this.pending;
    this.pending = null;
    pending?.resolve({ ...STOPPED });
    for (const job of this.queue.splice(0)) job.resolve({ ...STOPPED });
    this.start();
    this.setState({ state: 'loading', status });
  }

  private handle(event: WorkerEvent) {
    const pending = this.pending;
    switch (event.type) {
      case 'status':
        this.setState({
          state: this.snapshot.state === 'running' ? 'running' : 'loading',
          status: event.text,
        });
        return;
      case 'ready':
        this.setState({
          state: pending ? 'running' : 'ready',
          status: pending ? 'Läuft …' : 'Bereit',
        });
        return;
      case 'load-failed':
        this.setState({
          state: 'failed',
          status: 'Python konnte nicht geladen werden. Beim ersten Start braucht die App Internet.',
        });
        pending?.resolve({
          ...STOPPED,
          status: 'error',
          error: {
            type: 'LoadError',
            message: event.message,
            line: null,
            traceback: event.message,
          },
        });
        this.pending = null;
        return;
      case 'stdout':
        if (pending?.id === event.id) pending.handlers.onStdout?.(event.text);
        return;
      case 'stderr':
        if (pending?.id === event.id) pending.handlers.onStderr?.(event.text);
        return;
      case 'progress':
        if (pending?.id === event.id) pending.handlers.onProgress?.(event.info);
        return;
      case 'result':
        if (pending?.id !== event.id) return;
        this.pending = null;
        if (event.heapBytes > HEAP_RESTART_BYTES) this.restartAfterRun = true;
        pending.resolve(event.result);
        this.afterRun();
        return;
    }
  }

  private afterRun() {
    const next = this.queue.shift();
    if (next) {
      this.dispatch(next);
      return;
    }
    if (this.restartAfterRun) {
      this.restartAfterRun = false;
      this.restart('Speicher wird freigegeben …');
      return;
    }
    this.setState({ state: 'ready', status: 'Bereit' });
  }

  private setState(snapshot: RuntimeSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const python = new PythonRuntime();
