import { useEffect, useState } from 'preact/hooks';
import { mergeProgress, normalizeProgress, sameProgress } from './progress';
import { getProgress, onLocalChange, replaceProgress } from './store';

export type SyncStatus =
  'idle' | 'syncing' | 'ok' | 'offline' | 'login' | 'unconfigured' | 'outdated' | 'error';

export interface SyncState {
  status: SyncStatus;
  message: string | null;
  lastSyncAt: number | null;
  email: string | null;
}

const LAST_SYNC_KEY = 'robopy.lastSync';
const ENDPOINT = '/api/progress';
const DEBOUNCE_MS = 8000;
const KEEPALIVE_LIMIT = 60_000;

function readLastSync(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

let state: SyncState = { status: 'idle', message: null, lastSyncAt: readLastSync(), email: null };
const listeners = new Set<(s: SyncState) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let dirtyWhileRunning = false;

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function useSync(): SyncState {
  const [value, setValue] = useState(state);
  useEffect(() => {
    setValue(state);
    listeners.add(setValue);
    return () => void listeners.delete(setValue);
  }, []);
  return value;
}

function statusFromResponse(response: Response): { status: SyncStatus; message: string } | null {
  if (response.type === 'opaqueredirect' || response.status === 401)
    return { status: 'login', message: 'Anmeldung abgelaufen – bitte neu anmelden.' };
  if (response.status === 503 || response.status === 404)
    return { status: 'unconfigured', message: 'Sync ist auf dem Server noch nicht eingerichtet.' };
  if (response.status === 409)
    return {
      status: 'outdated',
      message: 'Eine neuere App-Version hat gespeichert – bitte aktualisieren.',
    };
  if (!response.ok) return { status: 'error', message: `Serverfehler ${response.status}` };
  return null;
}

async function performSync() {
  setState({ status: 'syncing', message: null });
  const sent = getProgress();
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      redirect: 'manual',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: sent }),
    });
  } catch {
    setState({
      status: navigator.onLine ? 'error' : 'offline',
      message: navigator.onLine
        ? 'Server nicht erreichbar.'
        : 'Offline – wird später synchronisiert.',
    });
    return;
  }
  const problem = statusFromResponse(response);
  if (problem) {
    setState(problem);
    return;
  }
  const body = (await response.json()) as { progress: unknown; email: string | null };
  const merged = mergeProgress(getProgress(), normalizeProgress(body.progress));
  if (!sameProgress(merged, getProgress())) replaceProgress(merged);
  const now = Date.now();
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(now));
  } catch {
    /* ignorieren */
  }
  setState({ status: 'ok', message: null, lastSyncAt: now, email: body.email });
}

export function syncNow(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (running) {
    dirtyWhileRunning = true;
    return running;
  }
  running = performSync().finally(() => {
    running = null;
    if (dirtyWhileRunning) {
      dirtyWhileRunning = false;
      scheduleSync();
    }
  });
  return running;
}

export function scheduleSync() {
  if (state.status === 'unconfigured' || state.status === 'login') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

function flushOnHide() {
  if (document.visibilityState !== 'hidden' || !timer) return;
  clearTimeout(timer);
  timer = null;
  const body = JSON.stringify({ progress: getProgress() });
  if (body.length > KEEPALIVE_LIMIT) return;
  void fetch(ENDPOINT, {
    method: 'POST',
    keepalive: true,
    redirect: 'manual',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});
}

export function startSync() {
  onLocalChange(scheduleSync);
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('online', () => void syncNow());
  void syncNow();
}

export function loginUrl(): string {
  return `/api/login?back=${encodeURIComponent(location.pathname + location.search)}`;
}
