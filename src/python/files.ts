import type { PythonFile } from './install';

const sources = import.meta.glob('./py/**/*.py', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const pythonFiles: PythonFile[] = Object.entries(sources).map(([path, source]) => ({
  path: path.replace('./py/', ''),
  source,
}));
