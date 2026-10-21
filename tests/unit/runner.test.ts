import { beforeAll, describe, expect, test } from 'vitest';
import { createNodePython, type NodePython } from '../content/pyodide-node';

let py: NodePython;
beforeAll(async () => {
  py = await createNodePython();
});

describe('Python-Runner', () => {
  test('input() fordert Eingaben an und spielt sie wieder ab', () => {
    const code = 'n = input("Zahl? ")\nprint(int(n) * 2)';
    expect(py.run({ code }).status).toBe('needs_input');
    const done = py.run({ code, stdin: ['21'] });
    expect(done.stdout).toBe('Zahl? 21\n42\n');
    expect(done.inputsUsed).toBe(1);
  });

  test('gleicher Seed liefert gleichen Zufall', () => {
    const code = 'import random\nprint(random.random())';
    expect(py.run({ code, seed: 7 }).stdout).toBe(py.run({ code, seed: 7 }).stdout);
    expect(py.run({ code, seed: 7 }).stdout).not.toBe(py.run({ code, seed: 8 }).stdout);
  });

  test('frischer Namensraum pro Lauf', () => {
    py.run({ code: 'geheim = 1' });
    expect(py.run({ code: 'print(geheim)' }).error?.type).toBe('NameError');
  });

  test('Fehler zeigen auf die Zeile im Lernercode', () => {
    const result = py.run({ code: 'x = 1\ny = x / 0' });
    expect(result.error).toMatchObject({ type: 'ZeroDivisionError', line: 2 });
    expect(result.error?.traceback).not.toContain('runner.py');
  });

  test('Tests laufen einzeln mit Helfern', () => {
    const result = py.run({
      code: 'print("a")\nimport lab\nlab.plot([1, 2])',
      tests: [
        { name: 'Ausgabe', code: 'assert lines() == ["a"]' },
        { name: 'Plot', code: 'assert scenes()[0]["kind"] == "plot"' },
        { name: 'falsch', code: 'assert 1 == 2, "eins ist nicht zwei"' },
      ],
    });
    expect(result.tests?.map((t) => t.passed)).toEqual([true, true, false]);
    expect(result.tests?.[2]?.message).toBe('eins ist nicht zwei');
  });

  test('Zeitlimit stoppt Endlosschleifen in Code und Tests', () => {
    expect(py.run({ code: 'while True:\n    pass', deadline: 0.3 }).status).toBe('timeout');
    const looping = py.run({
      code: 'def f():\n    while True:\n        pass',
      tests: [{ name: 't', code: 'f()' }],
      deadline: 0.3,
    });
    expect(looping.tests?.[0]?.passed).toBe(false);
  });

  test('Ausgabelimit greift', () => {
    expect(py.run({ code: 'print("x" * 300000)' }).status).toBe('output_limit');
  });

  test('Trace zeichnet Variablen pro Zeile auf', () => {
    const result = py.run({ code: 'a = 1\na = a + 1\nprint(a)', trace: 100 });
    const steps = result.trace!;
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3, null]);
    expect(steps[2]!.stack[0]!.vars.a).toBe('2');
  });

  test('Visualisierung lehnt NaN ab', () => {
    const result = py.run({ code: 'import lab\nlab.plot([1, float("nan")])' });
    expect(result.error?.type).toBe('ValueError');
  });
});
