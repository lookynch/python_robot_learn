import { useEffect, useState } from 'preact/hooks';
import { CodeView } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { RunPanel } from '../../components/RunPanel';
import type { ExampleStep as ExampleStepType } from '../../content/schema';
import { CodeEditor } from '../../editor/CodeEditor';
import { useRunner } from '../../python/useRunner';
import type { StepProps } from '../types';

export function ExampleStep({ step, state, onUpdate, onContext }: StepProps<ExampleStepType>) {
  const runner = useRunner();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(step.code);

  const run = () => {
    void runner.run(code, { stdin: editing ? undefined : step.stdin, interactive: true });
  };

  useEffect(() => {
    if (runner.result && !state?.done) onUpdate({ done: true, firstTryCorrect: true });
    onContext({ code, result: runner.result });
  }, [runner.result]);

  return (
    <div class="step-grid">
      <div class="stack">
        <div class="step-kind">Beispiel</div>
        {step.intro && <Html html={step.intro} />}
        {!step.intro && (
          <p class="muted small" style={{ margin: 0 }}>
            Lies den Code, dann führe ihn aus.
          </p>
        )}
        {runner.result && step.after && (
          <div class="card">
            <Html html={step.after} />
          </div>
        )}
      </div>
      <div class="stack step-side">
        {editing ? (
          <CodeEditor value={code} onChange={setCode} errorLine={runner.result?.error?.line} />
        ) : (
          <CodeView
            code={step.code}
            subgoals={step.subgoals}
            errorLine={runner.result?.error?.line}
          />
        )}
        <RunPanel
          runner={runner}
          onRun={run}
          heavy={step.heavy}
          actions={
            !editing ? (
              <button class="btn small" onClick={() => setEditing(true)}>
                ✎ Ändern
              </button>
            ) : (
              <button
                class="btn small ghost"
                onClick={() => {
                  setCode(step.code);
                  setEditing(false);
                }}
              >
                Original
              </button>
            )
          }
        />
      </div>
    </div>
  );
}
