export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const HEAP_RESTART_BYTES = 200 * 1024 * 1024;
export const TRACE_MAX_STEPS = 2000;

export function needsNumpy(code: string): boolean {
  return /\bnumpy\b|\benvs\b|\bso101\b/.test(code);
}
