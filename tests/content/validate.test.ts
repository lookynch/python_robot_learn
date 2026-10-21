import path from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { compileModule, ContentError, loadCourseLenient } from '../../build/content';
import {
  assembleParsons,
  fillCode,
  lookupVar,
  passedCheck,
  sameOutput,
  sceneProblems,
  splitIndent,
  traceStateAfter,
} from '../../src/content/checks';
import type { Step } from '../../src/content/schema';
import { TRACE_MAX_STEPS } from '../../src/python/config';
import type { RunRequest, RunResult } from '../../src/python/protocol';
import { CALIBRATION_CODE, REFERENCE_SECONDS } from './calibration';
import { createNodePython, type NodePython } from './pyodide-node';

const CONTENT_DIR = path.resolve(__dirname, '../../content');
const ONLY_MODULE = process.env.MODULE;
const BUDGET_SECONDS = 0.5;
const HEAVY_BUDGET_SECONDS = 3;
const DEADLINE_SECONDS = 4;

const { modules, problems: structureProblems } = loadCourseLenient(CONTENT_DIR);
const moduleFilter = (dir: string) => !ONLY_MODULE || dir.startsWith(ONLY_MODULE.padStart(2, '0'));

let python: NodePython;
let speedFactor = 1;
beforeAll(async () => {
  python = await createNodePython();
  const timings = [0, 1, 2].map(() => python.run({ code: CALIBRATION_CODE }).seconds);
  speedFactor = Math.min(4, Math.max(1, Math.min(...timings) / REFERENCE_SECONDS));
  console.log(`Laufzeitbudgets ×${speedFactor.toFixed(2)} (Referenzlauf ${Math.min(...timings)} s)`);
});

test('Inhalte laden und Struktur prüfen', () => {
  const relevant = structureProblems.filter(
    (p) => !ONLY_MODULE || p.includes(`/${ONLY_MODULE.padStart(2, '0')}-`) || p.includes('doppelt'),
  );
  if (relevant.length) throw new Error(`\n- ${relevant.join('\n- ')}`);
  expect(modules.length).toBeGreaterThan(0);
});

function describeRun(result: RunResult): string {
  if (result.error) return `${result.error.type}: ${result.error.message} (Zeile ${result.error.line})`;
  if (result.tests) return result.tests.map((t) => `${t.name}: ${t.passed ? 'ok' : t.message}`).join('; ');
  return result.status;
}

class StepChecker {
  problems: string[] = [];

  constructor(private where: string) {}

  fail(message: string) {
    this.problems.push(`${this.where}: ${message}`);
  }

  run(request: RunRequest, heavy = false): RunResult {
    const result = python.run({ seed: 1, ...request });
    const budget = (heavy ? HEAVY_BUDGET_SECONDS : BUDGET_SECONDS) * speedFactor;
    if (result.seconds > budget)
      this.fail(`Laufzeit ${result.seconds}s > ${budget.toFixed(2)}s (auf dem Handy etwa 3–5× langsamer)`);
    for (const scene of result.scenes) for (const p of sceneProblems(scene)) this.fail(p);
    return result;
  }

  deterministic(request: RunRequest): RunResult {
    const first = this.run({ ...request, seed: 1 });
    const second = python.run({ ...request, seed: 2, deadline: DEADLINE_SECONDS });
    if (!sameOutput(first.stdout, second.stdout))
      this.fail('Ausgabe hängt vom Zufall ab – setze einen festen Seed (random.seed / np.random.default_rng(0))');
    return first;
  }

  ok(result: RunResult, what: string) {
    if (result.status !== 'ok') this.fail(`${what} läuft nicht fehlerfrei: ${describeRun(result)}`);
  }

  check(step: Step) {
    switch (step.type) {
      case 'example': {
        this.ok(this.run({ code: step.code, stdin: step.stdin }, step.heavy), 'Beispielcode');
        break;
      }
      case 'predict': {
        const result = this.deterministic({ code: step.code, stdin: step.stdin });
        this.ok(result, 'Predict-Code');
        if (!sameOutput(result.stdout, step.answer))
          this.fail(`answer passt nicht zur echten Ausgabe.\nErwartet (answer): ${JSON.stringify(step.answer)}\nEcht: ${JSON.stringify(result.stdout)}`);
        break;
      }
      case 'trace': {
        const result = this.deterministic({ code: step.code, stdin: step.stdin, trace: TRACE_MAX_STEPS });
        this.ok(result, 'Trace-Code');
        const trace = result.trace ?? [];
        for (const q of step.questions ?? []) {
          const index = traceStateAfter(trace, q.line, q.hit);
          if (index === null) {
            this.fail(`Frage zu Zeile ${q.line} (${q.hit}. Mal): Zeile wird nicht so oft ausgeführt`);
            continue;
          }
          const actual = lookupVar(trace[index], q.var);
          if (actual !== q.answer)
            this.fail(`Frage ${q.var} nach Zeile ${q.line}: answer ${JSON.stringify(q.answer)}, echt ${JSON.stringify(actual)}`);
        }
        break;
      }
      case 'parsons': {
        const solution = assembleParsons(step.lines.map(splitIndent));
        const request = { stdin: step.stdin, tests: step.tests };
        const result = this.deterministic({ ...request, code: solution });
        if (!passedCheck(result, step.expect_output).passed)
          this.fail(`Parsons-Lösung besteht die Prüfung nicht: ${describeRun(result)} / Ausgabe ${JSON.stringify(result.stdout)}`);
        for (const distractor of step.distractors ?? []) {
          step.lines.forEach((_, i) => {
            const lines = step.lines.map(splitIndent);
            lines[i] = { ...splitIndent(distractor), indent: lines[i]!.indent };
            const alt = python.run({ ...request, seed: 1, deadline: DEADLINE_SECONDS, code: assembleParsons(lines) });
            if (passedCheck(alt, step.expect_output).passed)
              this.fail(`Distraktor ${JSON.stringify(distractor)} an Position ${i + 1} besteht ebenfalls – mehrdeutig`);
          });
        }
        break;
      }
      case 'fill': {
        const answers = step.blanks.map((b) => b.answer);
        const request = { stdin: step.stdin, tests: step.tests };
        const result = this.deterministic({ ...request, code: fillCode(step.code, answers) });
        if (!passedCheck(result, step.expect_output).passed)
          this.fail(`Lückentext mit den richtigen Antworten besteht nicht: ${describeRun(result)}`);
        step.blanks.forEach((blank, i) => {
          for (const option of blank.options) {
            if (option === blank.answer) continue;
            const values = [...answers];
            values[i] = option;
            const alt = python.run({ ...request, seed: 1, deadline: DEADLINE_SECONDS, code: fillCode(step.code, values) });
            if (passedCheck(alt, step.expect_output).passed)
              this.fail(`Lücke ${i + 1}: falsche Option ${JSON.stringify(option)} besteht ebenfalls – mehrdeutig`);
          }
        });
        break;
      }
      case 'exercise': {
        const request = { stdin: step.stdin, tests: step.tests };
        const solved = this.run({ ...request, code: step.solution }, step.heavy);
        if (!passedCheck(solved, undefined).passed) this.fail(`Musterlösung besteht nicht: ${describeRun(solved)}`);
        const again = python.run({ ...request, seed: 2, deadline: DEADLINE_SECONDS, code: step.solution });
        if (!passedCheck(again, undefined).passed) this.fail(`Musterlösung besteht mit anderem Seed nicht: ${describeRun(again)}`);
        const mustFail: [string, string][] = [
          ['Startercode', step.starter],
          ['leerer Code', 'pass\n'],
          ...step.mutants.map((m, i): [string, string] => [`Mutant ${i + 1}`, m]),
        ];
        for (const [label, code] of mustFail) {
          const result = python.run({ ...request, seed: 1, deadline: DEADLINE_SECONDS, code });
          if (passedCheck(result, undefined).passed) this.fail(`${label} besteht alle Tests – Tests zu schwach`);
        }
        break;
      }
      default:
        break;
    }
  }
}

const selected = modules.filter((m) => moduleFilter(m.dir));

for (const mod of selected) {
  describe(`${mod.dir}`, () => {
    for (const lesson of mod.lessons) {
      test(lesson.id, () => {
        const problems: string[] = [];
        try {
          compileModule({ ...mod, lessons: [lesson] });
        } catch (error) {
          problems.push(error instanceof ContentError ? error.problems.join('\n') : String(error));
        }
        lesson.steps.forEach((step, i) => {
          const checker = new StepChecker(`${lesson.file} steps[${i}] (${step.type})`);
          checker.check(step);
          problems.push(...checker.problems);
        });
        for (const card of lesson.cards) {
          card.variants.forEach((variant, i) => {
            const checker = new StepChecker(`${lesson.file} cards.${card.id}[${i}]`);
            checker.check(variant);
            problems.push(...checker.problems);
          });
        }
        if (problems.length) throw new Error(`\n${problems.join('\n\n')}`);
      });
    }
  });
}
