import { useMemo, useState } from 'preact/hooks';
import { CodeView, highlightLine } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { RunPanel } from '../../components/RunPanel';
import { fillCode } from '../../content/checks';
import type { FillStep as FillStepType } from '../../content/schema';
import { useCheck } from '../useCheck';
import type { StepProps } from '../types';
import { SkipFading } from './SkipFading';

function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function FillStep({
  step,
  index,
  state,
  onUpdate,
  onContext,
  onSkipToExercise,
}: StepProps<FillStepType>) {
  const [values, setValues] = useState<(string | null)[]>(() =>
    state?.done ? step.blanks.map((b) => b.answer) : step.blanks.map(() => null),
  );
  const [active, setActive] = useState(0);
  const [attempts, setAttempts] = useState(state?.attempts ?? 0);
  const { runner, verdict, check } = useCheck(step.expect_output, step.tests, step.stdin);
  const solved = Boolean(state?.done) || verdict?.passed === true;
  const options = useMemo(
    () => step.blanks.map((b, i) => seededShuffle(b.options, index * 31 + i + 7)),
    [step],
  );

  const choose = (value: string) => {
    const next = [...values];
    next[active] = value;
    setValues(next);
    const free = next.findIndex((v, i) => v === null && i !== active);
    if (free >= 0) setActive(free);
  };

  const submit = async () => {
    const code = fillCode(
      step.code,
      values.map((v) => v ?? '___'),
    );
    const passed = await check(code);
    const tries = attempts + 1;
    setAttempts(tries);
    onContext({ code, result: runner.result });
    if (passed)
      onUpdate({ done: true, passed: true, attempts: tries, firstTryCorrect: tries === 1 });
    else onUpdate({ attempts: tries });
  };

  const showSolution = () => {
    setValues(step.blanks.map((b) => b.answer));
    onUpdate({ done: true, attempts, solutionShown: true, firstTryCorrect: false });
  };

  let blankCounter = 0;
  const renderLine = (line: string) => {
    const parts = line.split('___');
    return parts.flatMap((part, i) => {
      const out = [<span>{highlightLine(part)}</span>];
      if (i < parts.length - 1) {
        const b = blankCounter++;
        const value = values[b];
        out.push(
          <span
            class={`blank ${b === active && !solved ? 'active' : ''} ${value ? 'filled' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => !solved && setActive(b)}
          >
            {value ?? '?'}
          </span>,
        );
      }
      return out;
    });
  };

  return (
    <div class="step-grid">
      <div class="stack">
        <div class="step-kind">Lücken füllen</div>
        <Html html={step.prompt} />
        {step.fading && !solved && onSkipToExercise && <SkipFading onSkip={onSkipToExercise} />}
      </div>
      <div class="stack step-side">
        <div class="fill-code">
          <CodeView code={step.code} renderLine={renderLine} />
        </div>
        {!solved && (
          <>
            <div class="small muted">
              Lücke {active + 1} von {step.blanks.length} – tippe einen Baustein:
            </div>
            <div class="tokens">
              {options[active]!.map((o) => (
                <button key={o} class="token" onClick={() => choose(o)}>
                  {o}
                </button>
              ))}
            </div>
            <div class="row">
              <button
                class="btn primary"
                disabled={values.some((v) => v === null) || runner.running}
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
          </>
        )}
        {verdict && !verdict.passed && (
          <div class="banner bad">
            {verdict.message ?? 'Noch nicht richtig – probiere andere Bausteine.'}
          </div>
        )}
        {solved && (
          <div class="banner good">
            <strong>Passt.</strong>
          </div>
        )}
        {solved && step.explanation && <Html html={step.explanation} />}
        {(runner.result || runner.running) && <RunPanel runner={runner} showTests={false} />}
        {solved && !runner.result && (
          <CodeView
            code={fillCode(
              step.code,
              step.blanks.map((b) => b.answer),
            )}
          />
        )}
      </div>
    </div>
  );
}
