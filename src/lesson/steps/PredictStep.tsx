import { useEffect, useState } from 'preact/hooks';
import { ConfidencePicker, Hypercorrection, OptionList } from '../../components/Choice';
import { CodeView } from '../../components/CodeView';
import { Html } from '../../components/Html';
import { RunPanel } from '../../components/RunPanel';
import { normalizeOutput, sameOutput } from '../../content/checks';
import type { PredictStep as PredictStepType } from '../../content/schema';
import type { Confidence } from '../../learning/progress';
import { useRunner } from '../../python/useRunner';
import type { StepProps } from '../types';

export interface PredictOutcome {
  correct: boolean;
  confidence: Confidence;
}

export interface PredictViewProps {
  step: PredictStepType;
  revealed: boolean;
  initialCorrect?: boolean;
  onAnswer: (outcome: PredictOutcome) => void;
}

export function PredictView({ step, revealed, initialCorrect, onAnswer }: PredictViewProps) {
  const runner = useRunner();
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [confidence, setConfidence] = useState<Confidence | undefined>();
  const [outcome, setOutcome] = useState<PredictOutcome | null>(
    revealed ? { correct: Boolean(initialCorrect), confidence: 1 } : null,
  );
  const answered = outcome !== null;

  useEffect(() => {
    if (answered) void runner.run(step.code, { stdin: step.stdin });
  }, [answered]);

  const check = () => {
    if (confidence === undefined) return;
    const guess = step.options ? (step.options[choice ?? -1] ?? '') : typed;
    const result = { correct: sameOutput(guess, step.answer), confidence };
    setOutcome(result);
    onAnswer(result);
  };

  const ready = confidence !== undefined && (step.options ? choice !== null : typed.trim() !== '');

  return (
    <div class="stack">
      {step.intro && <Html html={step.intro} />}
      <CodeView code={step.code} />
      <Html html={step.question} />
      {step.stdin && step.stdin.length > 0 && (
        <div class="small muted">Eingaben: {step.stdin.map((s) => `„${s}“`).join(', ')}</div>
      )}
      {step.options ? (
        <OptionList
          options={step.options.map((o) => ({
            html: normalizeOutput(o) || '(keine Ausgabe)',
            mono: true,
            correct: o === step.answer,
          }))}
          selected={choice === null ? [] : [choice]}
          revealed={answered}
          onToggle={(i) => setChoice(i)}
        />
      ) : (
        <textarea
          class="plain mono"
          rows={Math.max(2, step.answer.split('\n').length)}
          value={typed}
          disabled={answered}
          placeholder="Erwartete Ausgabe eintippen …"
          autocapitalize="off"
          spellcheck={false}
          onInput={(e) => setTyped((e.target as HTMLTextAreaElement).value)}
        />
      )}
      {!answered && <ConfidencePicker value={confidence} onChange={setConfidence} />}
      {!answered && (
        <button class="btn primary block" disabled={!ready} onClick={check}>
          Vorhersage prüfen
        </button>
      )}
      {answered && (
        <>
          <div class={`banner ${outcome.correct ? 'good' : 'bad'}`}>
            <strong>{outcome.correct ? 'Richtig vorhergesagt.' : 'Nicht ganz.'}</strong>
            {!outcome.correct && !step.options && (
              <pre class="block" style={{ margin: '8px 0 0' }}>
                {normalizeOutput(step.answer)}
              </pre>
            )}
          </div>
          {!outcome.correct && outcome.confidence === 2 && <Hypercorrection />}
          <div class="card">
            <Html html={step.explanation} />
          </div>
          <div class="small muted">Echte Ausgabe:</div>
          <RunPanel runner={runner} />
        </>
      )}
    </div>
  );
}

export function PredictStep({ step, state, onUpdate }: StepProps<PredictStepType>) {
  return (
    <div class="stack">
      <div class="step-kind">Vorhersagen</div>
      <PredictView
        step={step}
        revealed={Boolean(state?.done)}
        initialCorrect={state?.firstTryCorrect}
        onAnswer={(o) =>
          onUpdate({
            done: true,
            attempts: 1,
            firstTryCorrect: o.correct,
            confidence: o.confidence,
          })
        }
      />
    </div>
  );
}
