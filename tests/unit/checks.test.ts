import { describe, expect, test } from 'vitest';
import {
  assembleParsons,
  fillCode,
  lookupVar,
  normalizeOutput,
  sameOutput,
  splitIndent,
  traceStateAfter,
} from '../../src/content/checks';
import type { TraceStep } from '../../src/python/protocol';

describe('Prüfhelfer', () => {
  test('Ausgaben werden tolerant gegenüber Leerzeichen am Zeilenende verglichen', () => {
    expect(normalizeOutput('a  \nb\n\n')).toBe('a\nb');
    expect(sameOutput('1 2\n', '1 2')).toBe(true);
    expect(sameOutput('1  2', '1 2')).toBe(false);
  });

  test('Parsons-Zeilen behalten die Einrückung', () => {
    const lines = ['for i in range(2):', '    print(i)'].map(splitIndent);
    expect(lines[1]).toEqual({ text: 'print(i)', indent: 1 });
    expect(assembleParsons(lines)).toBe('for i in range(2):\n    print(i)\n');
  });

  test('Lücken werden der Reihe nach gefüllt', () => {
    expect(fillCode('x = ___\nprint(x ___ 2)', ['3', '*'])).toBe('x = 3\nprint(x * 2)');
  });

  test('Zustand „nach Zeile“ überspringt Funktionsaufrufe', () => {
    const frame = (vars: Record<string, string>, extra = 0) => [
      { name: 'global', vars },
      ...Array.from({ length: extra }, () => ({ name: 'f', vars: {} })),
    ];
    const trace: TraceStep[] = [
      { line: 1, event: 'line', stack: frame({}), out: 0 },
      { line: 2, event: 'line', stack: frame({}, 1), out: 0 },
      { line: 2, event: 'return', stack: frame({}, 1), out: 0 },
      { line: 3, event: 'line', stack: frame({ a: '6' }), out: 0 },
    ];
    const index = traceStateAfter(trace, 1, 1)!;
    expect(index).toBe(3);
    expect(lookupVar(trace[index], 'a')).toBe('6');
    expect(traceStateAfter(trace, 9, 1)).toBeNull();
  });
});
