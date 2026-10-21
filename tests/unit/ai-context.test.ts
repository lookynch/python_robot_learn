import { describe, expect, test } from 'vitest';
import type { Lesson, ModuleSummary } from '../../src/content/schema';
import { buildAiContext } from '../../src/learning/ai-context';

const step = {
  type: 'exercise' as const,
  mode: 'make' as const,
  prompt: '<p>Schreibe f</p>',
  starter: 'def f(x):\n    pass\n',
  solution: 'def f(x):\n    return GEHEIM\n',
  tests: [{ name: 'f(2)', code: 'assert f(2) == 4' }],
  mutants: ['x'],
  hints: ['<p>Hinweis eins</p>', '<p>Hinweis zwei</p>'],
};
const lesson = {
  id: 'l',
  title: 'Funktionen',
  kind: 'lesson',
  minutes: 5,
  goals: ['<p>Ziel</p>'],
  concepts: [],
  cards: [],
  steps: [step],
  moduleId: 'm02',
  promptSources: { 0: 'Schreibe `f`' },
} as unknown as Lesson;
const module = { id: 'm02', number: 2, title: 'Funktionen & Daten' } as ModuleSummary;

describe('KI-Kontext', () => {
  test('enthält Aufgabe, Code, Fehler und angezeigte Hinweise, aber nicht die Lösung', () => {
    const text = buildAiContext({
      module,
      lesson,
      stepIndex: 0,
      step,
      code: 'def f(x):\n    return x + x\n',
      hintsShown: 1,
      result: {
        status: 'ok',
        error: null,
        seconds: 0,
        inputsUsed: 0,
        stdout: '',
        stderr: '',
        scenes: [],
        tests: [{ name: 'f(2)', passed: false, message: 'falsch' }],
      },
    });
    expect(text).toContain('Modul 2: Funktionen & Daten');
    expect(text).toContain('Schreibe `f`');
    expect(text).toContain('return x + x');
    expect(text).toContain('Hinweis eins');
    expect(text).not.toContain('Hinweis zwei');
    expect(text).toContain('f(2): falsch');
    expect(text).not.toContain('GEHEIM');
    expect(text).toContain('verrate die Lösung nicht');
  });
});
