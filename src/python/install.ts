import type { PyodideAPI } from 'pyodide';

export interface PythonFile {
  path: string;
  source: string;
}

export interface Runner {
  run(
    requestJson: string,
    emitOut?: (s: string) => void,
    emitErr?: (s: string) => void,
    emitProgress?: (json: string) => void,
  ): string;
}

const HOME = '/home/pyodide/robopy';

export function installPython(py: PyodideAPI, files: PythonFile[]): Runner {
  for (const file of files) {
    const target = `${HOME}/${file.path}`;
    py.FS.mkdirTree(target.slice(0, target.lastIndexOf('/')));
    py.FS.writeFile(target, file.source);
  }
  py.runPython(
    `import sys\nif ${JSON.stringify(HOME)} not in sys.path: sys.path.insert(0, ${JSON.stringify(HOME)})`,
  );
  return py.pyimport('runner') as unknown as Runner;
}
