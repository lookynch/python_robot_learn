import { useEffect, useMemo, useState } from 'preact/hooks';
import { CodeView } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { ErrorBox } from '../../components/ErrorBox';
import { RuntimeStatus } from '../../components/RunPanel';
import { lookupVar, traceStateAfter } from '../../content/checks';
import type { TraceStep as TraceStepType } from '../../content/schema';
import { TRACE_MAX_STEPS } from '../../python/config';
import type { TraceStep as TraceRecord } from '../../python/protocol';
import { useRunner } from '../../python/useRunner';
import type { StepProps } from '../types';

function frameVars(step: TraceRecord | undefined) {
  return step?.stack ?? [];
}

export function TraceStep({ step, state, onUpdate }: StepProps<TraceStepType>) {
  const runner = useRunner();
  const [position, setPosition] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    void runner.run(step.code, { stdin: step.stdin, trace: TRACE_MAX_STEPS });
  }, []);

  const trace = runner.result?.trace ?? [];
  const stdout = runner.result?.stdout ?? '';
  const current = trace[position];
  const previous = trace[position - 1];

  const questionAt = useMemo(() => {
    const map = new Map<number, number>();
    (step.questions ?? []).forEach((q, qi) => {
      const index = traceStateAfter(trace, q.line, q.hit);
      if (index !== null) map.set(index, qi);
    });
    return map;
  }, [trace]);

  const pendingQuestion = questionAt.get(position);
  const blocked =
    pendingQuestion !== undefined && checked[pendingQuestion] === undefined && !state?.done;
  const atEnd = trace.length > 0 && position >= trace.length - 1;
  const allAnswered = (step.questions ?? []).every((_, qi) => checked[qi] !== undefined);

  useEffect(() => {
    if (!state?.done && atEnd && allAnswered && trace.length) {
      const correct = Object.values(checked).every(Boolean);
      onUpdate({ done: true, attempts: 1, firstTryCorrect: correct });
    }
  }, [atEnd, allAnswered, trace.length]);

  const go = (target: number) => {
    const next = Math.max(0, Math.min(trace.length - 1, target));
    if (next > position) {
      for (const [index, qi] of questionAt) {
        if (index > position && index < next && checked[qi] === undefined && !state?.done) {
          setPosition(index);
          return;
        }
      }
    }
    setPosition(next);
  };

  const check = (qi: number) => {
    const q = step.questions![qi]!;
    const actual = lookupVar(trace[position], q.var);
    const loose = (v: string | undefined) => (v ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
    setChecked({ ...checked, [qi]: loose(answers[qi]) === loose(actual) });
  };

  const changed = (name: string, frameIndex: number) => {
    const before = previous?.stack[frameIndex]?.vars[name];
    return previous !== undefined && before !== current?.stack[frameIndex]?.vars[name];
  };

  const line = current?.line ?? null;
  return (
    <div class="step-grid">
      <div class="stack">
        <div class="step-kind">Schritt für Schritt</div>
        {step.intro && <Html html={step.intro} />}
        <p class="small muted" style={{ margin: 0 }}>
          Die markierte Zeile wird <strong>als Nächstes</strong> ausgeführt. Die Tabelle zeigt die
          Variablen <em>vor</em> dieser Zeile.
        </p>
        {atEnd && step.after && (
          <div class="card">
            <Html html={step.after} />
          </div>
        )}
      </div>
      <div class="stack step-side">
        <CodeView code={step.code} highlight={line} errorLine={runner.result?.error?.line} />
        {!trace.length && (
          <div class="runbar">
            <span class="small muted">{runner.running ? 'Programm wird aufgezeichnet …' : ''}</span>
            <span class="spacer" />
            <RuntimeStatus />
          </div>
        )}
        {trace.length > 0 && (
          <>
            <div class="anim-controls">
              <button class="btn small" onClick={() => go(0)} aria-label="Zum Anfang">
                ⏮
              </button>
              <button
                class="btn small"
                onClick={() => go(position - 1)}
                disabled={position === 0}
                aria-label="Schritt zurück"
              >
                ◀
              </button>
              <span class="small muted" style={{ flex: 1, textAlign: 'center' }}>
                Schritt {position + 1} / {trace.length}
                {current?.event === 'end'
                  ? ' · Ende'
                  : current?.event === 'return'
                    ? ' · Rückkehr'
                    : ''}
              </span>
              <button
                class="btn small primary"
                onClick={() => go(position + 1)}
                disabled={atEnd || blocked}
                aria-label="Nächster Schritt"
              >
                ▶
              </button>
              <button
                class="btn small"
                onClick={() => go(trace.length - 1)}
                disabled={blocked}
                aria-label="Zum Ende"
              >
                ⏭
              </button>
            </div>
            {pendingQuestion !== undefined && (
              <div class="banner warn">
                {step.questions![pendingQuestion]!.prompt ? (
                  <Html html={step.questions![pendingQuestion]!.prompt!} />
                ) : (
                  <div>
                    Welchen Wert hat <code>{step.questions![pendingQuestion]!.var}</code> jetzt?
                  </div>
                )}
                {checked[pendingQuestion] === undefined ? (
                  <form
                    class="terminal-input"
                    onSubmit={(e) => {
                      e.preventDefault();
                      check(pendingQuestion);
                    }}
                  >
                    <input
                      class="plain mono"
                      value={answers[pendingQuestion] ?? ''}
                      onInput={(e) =>
                        setAnswers({
                          ...answers,
                          [pendingQuestion]: (e.target as HTMLInputElement).value,
                        })
                      }
                      autocapitalize="off"
                      spellcheck={false}
                      placeholder="Wert"
                    />
                    <button class="btn primary small" type="submit">
                      Prüfen
                    </button>
                  </form>
                ) : (
                  <div style={{ marginTop: '6px' }}>
                    {checked[pendingQuestion] ? (
                      '✓ Richtig.'
                    ) : (
                      <>
                        ✗ Tatsächlich:{' '}
                        <code>{lookupVar(current, step.questions![pendingQuestion]!.var)}</code>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <div class="card" style={{ padding: '8px 12px' }}>
              {frameVars(current).map((frame, fi) => (
                <div key={fi}>
                  <div class="trace-frame">
                    {frame.name === 'global' ? 'Variablen' : `in ${frame.name}()`}
                  </div>
                  {Object.keys(frame.vars).length === 0 ? (
                    <div class="small muted">noch keine</div>
                  ) : (
                    <table class="trace-vars">
                      <tbody>
                        {Object.entries(frame.vars).map(([name, value]) => (
                          <tr key={name} class={changed(name, fi) ? 'changed' : ''}>
                            <td>{name}</td>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
            <div class="terminal">
              {stdout.slice(0, current?.out ?? 0) || <span class="sys">noch keine Ausgabe</span>}
            </div>
          </>
        )}
        {runner.result?.error && <ErrorBox error={runner.result.error} />}
        {runner.result?.status === 'trace_limit' && (
          <div class="banner warn small">Nach {TRACE_MAX_STEPS} Schritten abgeschnitten.</div>
        )}
      </div>
    </div>
  );
}
