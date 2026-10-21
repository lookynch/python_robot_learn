import path from 'node:path';
import { loadPyodide } from 'pyodide';
import { PYODIDE_INDEX_URL } from '../../src/python/config';
import { pythonFiles } from '../../src/python/files';
import { installPython } from '../../src/python/install';
import type { RunRequest, RunResult } from '../../src/python/protocol';

export interface NodePython {
  run(request: RunRequest): RunResult;
}

export async function createNodePython(): Promise<NodePython> {
  const py = await loadPyodide({
    packageBaseUrl: PYODIDE_INDEX_URL,
    packageCacheDir: path.resolve(__dirname, '../../node_modules/.cache/pyodide'),
  });
  await py.loadPackage('numpy', { messageCallback: () => {} });
  const runner = installPython(py, pythonFiles);
  return {
    run(request) {
      return JSON.parse(runner.run(JSON.stringify(request))) as RunResult;
    },
  };
}
