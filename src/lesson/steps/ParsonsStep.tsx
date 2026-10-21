import { useMemo, useState } from 'preact/hooks';
import { highlightLine } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { RunPanel } from '../../components/RunPanel';
import { assembleParsons, splitIndent, type PlacedLine } from '../../content/checks';
import type { ParsonsStep as ParsonsStepType } from '../../content/schema';
import { useCheck } from '../useCheck';
import type { StepProps } from '../types';
import { SkipFading } from './SkipFading';

interface Block {
  id: number;
  text: string;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  const unchanged = out.every((x, i) => x === items[i]);
  return unchanged && out.length > 1 ? [...out.slice(1), out[0]!] : out;
}

export function ParsonsStep({
  step,
  index,
  state,
  onUpdate,
  onContext,
  onSkipToExercise,
}: StepProps<ParsonsStepType>) {
  const solution = useMemo(() => step.lines.map(splitIndent), [step]);
  const blocks = useMemo<Block[]>(
    () =>
      shuffle(
        [...step.lines, ...(step.distractors ?? [])].map((l, i) => ({ id: i, text: l.trim() })),
        index * 7919 + 17,
      ),
    [step],
  );
  const [placed, setPlaced] = useState<{ id: number; indent: number }[]>(() =>
    state?.done ? solution.map((s, i) => ({ id: i, indent: s.indent })) : [],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(state?.attempts ?? 0);
  const { runner, verdict, check, reset } = useCheck(step.expect_output, step.tests, step.stdin);
  const solved = Boolean(state?.done) || verdict?.passed === true;
  const maxIndent = Math.max(...solution.map((s) => s.indent)) + 1;

  const pool = blocks.filter((b) => !placed.some((p) => p.id === b.id));
  const textOf = (id: number) => blocks.find((b) => b.id === id)!.text;
  const lines: PlacedLine[] = placed.map((p) => ({ text: textOf(p.id), indent: p.indent }));

  const mutate = (next: { id: number; indent: number }[]) => {
    setPlaced(next);
    reset();
  };
  const add = (id: number) => {
    const indent = placed.length
      ? placed[placed.length - 1]!.indent +
        (textOf(placed[placed.length - 1]!.id).endsWith(':') ? 1 : 0)
      : 0;
    mutate([...placed, { id, indent: Math.min(indent, maxIndent) }]);
    setSelected(placed.length);
  };
  const move = (delta: number) => {
    if (selected === null) return;
    const target = selected + delta;
    if (target < 0 || target >= placed.length) return;
    const next = [...placed];
    [next[selected], next[target]] = [next[target]!, next[selected]!];
    mutate(next);
    setSelected(target);
  };
  const indent = (delta: number) => {
    if (selected === null) return;
    const next = placed.map((p, i) =>
      i === selected ? { ...p, indent: Math.max(0, Math.min(maxIndent, p.indent + delta)) } : p,
    );
    mutate(next);
  };
  const remove = () => {
    if (selected === null) return;
    mutate(placed.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const correctPrefix = (() => {
    let n = 0;
    while (
      n < lines.length &&
      n < solution.length &&
      lines[n]!.text === solution[n]!.text &&
      lines[n]!.indent === solution[n]!.indent
    )
      n++;
    return n;
  })();

  const submit = async () => {
    const code = assembleParsons(lines);
    const passed = await check(code);
    const tries = attempts + 1;
    setAttempts(tries);
    onContext({ code, result: runner.result });
    if (passed)
      onUpdate({ done: true, passed: true, attempts: tries, firstTryCorrect: tries === 1 });
    else onUpdate({ attempts: tries });
  };

  const showSolution = () => {
    setPlaced(solution.map((s, i) => ({ id: i, indent: s.indent })));
    setSelected(null);
    onUpdate({ done: true, attempts, solutionShown: true, firstTryCorrect: false });
  };

  return (
    <div class="step-grid">
      <div class="stack">
        <div class="step-kind">Zeilen ordnen</div>
        <Html html={step.prompt} />
        <p class="small muted" style={{ margin: 0 }}>
          Tippe Zeilen unten an, um sie anzuhängen. Tippe eine platzierte Zeile an, um sie zu
          verschieben oder einzurücken.
          {step.distractors?.length ? ' Achtung: Nicht alle Zeilen werden gebraucht.' : ''}
        </p>
        {step.fading && !solved && onSkipToExercise && <SkipFading onSkip={onSkipToExercise} />}
      </div>
      <div class="stack step-side">
        <div class="parsons-area" aria-label="Dein Programm">
          {placed.length === 0 && <span class="small muted">Noch leer.</span>}
          {placed.map((p, i) => (
            <div key={p.id} class={`placed ${selected === i ? 'selected' : ''}`}>
              <span class="indent-guide" style={{ width: `${p.indent * 22}px` }} />
              <button
                class="parsons-line"
                disabled={solved}
                onClick={() => setSelected(selected === i ? null : i)}
              >
                {highlightLine(textOf(p.id))}
              </button>
            </div>
          ))}
        </div>
        {selected !== null && !solved && (
          <div class="placed-tools">
            <button class="btn small" onClick={() => indent(-1)} aria-label="Ausrücken">
              ⇤
            </button>
            <button class="btn small" onClick={() => indent(1)} aria-label="Einrücken">
              ⇥
            </button>
            <button class="btn small" onClick={() => move(-1)} aria-label="Nach oben">
              ↑
            </button>
            <button class="btn small" onClick={() => move(1)} aria-label="Nach unten">
              ↓
            </button>
            <button class="btn small danger" onClick={remove} aria-label="Entfernen">
              ✕
            </button>
          </div>
        )}
        {!solved && (
          <div class="parsons-pool">
            {pool.map((b) => (
              <button key={b.id} class="parsons-line" onClick={() => add(b.id)}>
                {highlightLine(b.text)}
              </button>
            ))}
          </div>
        )}
        {!solved && (
          <div class="row">
            <button
              class="btn primary"
              disabled={placed.length === 0 || runner.running}
              onClick={submit}
            >
              Prüfen
            </button>
            {attempts >= 2 && (
              <button class="btn ghost" onClick={showSolution}>
                Lösung zeigen
              </button>
            )}
          </div>
        )}
        {verdict && !verdict.passed && (
          <div class="banner bad">
            {verdict.message ?? 'Noch nicht richtig.'}
            {attempts >= 2 && (
              <div class="small">
                Tipp: Die ersten {correctPrefix} Zeilen stimmen (Reihenfolge und Einrückung).
              </div>
            )}
          </div>
        )}
        {solved && (
          <div class="banner good">
            <strong>Richtig angeordnet.</strong>
          </div>
        )}
        {solved && step.explanation && <Html html={step.explanation} />}
        {(runner.result || runner.running) && <RunPanel runner={runner} showTests={false} />}
      </div>
    </div>
  );
}
