import type { RunResult, TraceStep, Visual } from '../python/protocol';

export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

export function sameOutput(a: string, b: string): boolean {
  return normalizeOutput(a) === normalizeOutput(b);
}

export interface PlacedLine {
  text: string;
  indent: number;
}

export function assembleParsons(lines: PlacedLine[]): string {
  return lines.map((l) => '    '.repeat(l.indent) + l.text.trim()).join('\n') + '\n';
}

export function splitIndent(line: string): PlacedLine {
  const spaces = line.length - line.trimStart().length;
  return { text: line.trim(), indent: Math.floor(spaces / 4) };
}

export function fillCode(code: string, values: string[]): string {
  let i = 0;
  return code.replace(/___/g, () => values[i++] ?? '___');
}

export function passedCheck(
  result: RunResult,
  expectOutput: string | undefined,
): { passed: boolean; message: string | null } {
  if (result.status !== 'ok') return { passed: false, message: null };
  if (result.tests) {
    const failed = result.tests.find((t) => !t.passed);
    if (failed) return { passed: false, message: failed.message };
  }
  if (expectOutput !== undefined && !sameOutput(result.stdout, expectOutput))
    return { passed: false, message: 'Die Ausgabe stimmt noch nicht mit der erwarteten überein.' };
  return { passed: true, message: null };
}

export function lookupVar(step: TraceStep | undefined, name: string): string | undefined {
  if (!step) return undefined;
  for (let i = step.stack.length - 1; i >= 0; i--) {
    const value = step.stack[i]!.vars[name];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function traceStateAfter(trace: TraceStep[], line: number, hit: number): number | null {
  let seen = 0;
  for (let i = 0; i < trace.length; i++) {
    const step = trace[i]!;
    if (step.event !== 'line' || step.line !== line || ++seen !== hit) continue;
    const depth = step.stack.length;
    for (let j = i + 1; j < trace.length; j++) if (trace[j]!.stack.length <= depth) return j;
    return trace.length - 1;
  }
  return null;
}

export const SCENE_LIMITS = { frames: 600, bytes: 1_000_000 };

export function sceneProblems(visual: Visual): string[] {
  const problems: string[] = [];
  const bytes = JSON.stringify(visual).length;
  if (bytes > SCENE_LIMITS.bytes) problems.push(`Visualisierung zu groß (${bytes} Bytes)`);
  if (visual.kind === 'scene' && visual.frames.length > SCENE_LIMITS.frames)
    problems.push(`zu viele Frames (${visual.frames.length})`);
  if (visual.kind !== 'scene' && visual.kind !== 'plot') problems.push(`unbekannte Visualisierung ${(visual as Visual).kind}`);
  return problems;
}
