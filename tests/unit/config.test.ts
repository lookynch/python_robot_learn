import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PYODIDE_VERSION } from '../../src/python/config';

test('CDN-Version von Pyodide passt zum npm-Paket', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  expect(pkg.dependencies.pyodide).toBe(PYODIDE_VERSION);
});
