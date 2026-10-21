import { useEffect, useRef, useState } from 'preact/hooks';
import { CodeView } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { RunPanel } from '../../components/RunPanel';
import type { ExerciseStep as ExerciseStepType } from '../../content/schema';
import { CodeEditor } from '../../editor/CodeEditor';
import { saveDraft, useProgress } from '../../learning/store';
import { useRunner } from '../../python/useRunner';
import type { StepProps } from '../types';

export function draftKey(lessonId: string, index: number) {
  return `${lessonId}#${index}`;
}

export function ExerciseStep({
  step,
  lesson,
  index,
  state,
  checkpoint,
  onUpdate,
  onContext,
}: StepProps<ExerciseStepType>) {
  const progress = useProgress();
  const key = draftKey(lesson.id, index);
  const [code, setCode] = useState(() => progress.drafts[key]?.code ?? step.starter);
  const runner = useRunner();
  const [resetKey, setResetKey] = useState(0);
  const [hints, setHints] = useState(state?.hintsUsed ?? 0);
  const [attempts, setAttempts] = useState(state?.attempts ?? 0);
  const [showSolution, setShowSolution] = useState(Boolean(state?.solutionShown));
  const [passed, setPassed] = useState(Boolean(state?.done && !state?.solutionShown));
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(key, code), 800);
    return () => clearTimeout(saveTimer.current);
  }, [code]);

  useEffect(
    () => onContext({ code, result: runner.result, hintsShown: hints }),
    [code, runner.result, hints],
  );

  const check = async () => {
    const result = await runner.run(code, { stdin: step.stdin, tests: step.tests });
    if (result.status === 'stopped') return;
    const tries = attempts + 1;
    setAttempts(tries);
    const ok = result.status === 'ok' && (result.tests ?? []).every((t) => t.passed);
    if (ok) {
      setPassed(true);
      onUpdate({
        done: true,
        passed: true,
        attempts: tries,
        hintsUsed: hints,
        firstTryCorrect: hints === 0 && !showSolution,
      });
    } else onUpdate({ attempts: tries, hintsUsed: hints });
  };

  const nextHint = () => {
    const n = Math.min(step.hints.length, hints + 1);
    setHints(n);
    onUpdate({ hintsUsed: n });
  };

  const revealSolution = () => {
    setShowSolution(true);
    onUpdate({
      done: true,
      solutionShown: true,
      attempts,
      hintsUsed: hints,
      firstTryCorrect: false,
    });
  };

  const canHint = attempts > 0 && hints < step.hints.length && !passed;

  return (
    <div class="step-grid">
      <div class="stack">
        <div class="step-kind">{step.mode === 'modify' ? 'Verändern' : 'Selbst schreiben'}</div>
        <Html html={step.prompt} />
        {hints > 0 && (
          <div class="stack">
            {step.hints.slice(0, hints).map((h, i) => (
              <div class="hint" key={i}>
                <div class="small muted">Hinweis {i + 1}</div>
                <Html html={h} />
              </div>
            ))}
          </div>
        )}
        {passed && (
          <div class="banner good">
            <strong>Geschafft!</strong>{' '}
            {checkpoint
              ? ''
              : 'Vergleiche ruhig mit der Musterlösung – es gibt oft mehrere gute Wege.'}
          </div>
        )}
        {(passed || showSolution) && (
          <details open={showSolution && !passed}>
            <summary>Musterlösung</summary>
            <CodeView code={step.solution} />
            {step.explanation && <Html html={step.explanation} />}
          </details>
        )}
        {showSolution && !passed && (
          <div class="banner warn small">
            Die Aufgabe bleibt unter „Wiederholen“ als offene Aufgabe stehen, bis du sie selbst
            löst. Probiere es ruhig gleich noch einmal.
          </div>
        )}
      </div>
      <div class="stack step-side">
        <CodeEditor
          value={code}
          resetKey={resetKey}
          onChange={setCode}
          errorLine={runner.result?.error?.line}
        />
        <RunPanel
          runner={runner}
          onRun={() => void runner.run(code, { interactive: true })}
          heavy={step.heavy}
          actions={
            !runner.running && (
              <button class="btn good" onClick={check}>
                ✓ Prüfen
              </button>
            )
          }
        />
        <div class="row">
          {canHint && (
            <button class="btn small" onClick={nextHint}>
              💡 Hinweis {hints + 1}/{step.hints.length}
            </button>
          )}
          {attempts === 0 && !passed && (
            <span class="small muted">Hinweise gibt es nach dem ersten Prüfen.</span>
          )}
          {attempts > 0 && !passed && !showSolution && (
            <button class="btn small ghost" onClick={revealSolution}>
              Lösung zeigen
            </button>
          )}
          <span class="spacer" />
          <button
            class="btn small ghost"
            onClick={() => {
              setCode(step.starter);
              setResetKey((k) => k + 1);
              runner.clear();
            }}
          >
            ↺ Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
