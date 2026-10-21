import { useState } from 'preact/hooks';
import { ConfidencePicker, Hypercorrection, OptionList } from '../../components/Choice';
import { CodeView } from '../../components/CodeView';
import { Html } from '../../components/Html';
import type { ExplainStep, QuizStep as QuizStepType } from '../../content/schema';
import type { Confidence } from '../../learning/progress';
import type { StepProps } from '../types';

export interface QuizOutcome {
  correct: boolean;
  confidence: Confidence | undefined;
}

export function QuizView({
  step,
  revealed,
  askConfidence,
  onAnswer,
}: {
  step: QuizStepType | ExplainStep;
  revealed: boolean;
  askConfidence: boolean;
  onAnswer: (o: QuizOutcome) => void;
}) {
  const multi = step.type === 'quiz' && Boolean(step.multi);
  const [selected, setSelected] = useState<number[]>(
    revealed ? step.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0) : [],
  );
  const [confidence, setConfidence] = useState<Confidence | undefined>();
  const [outcome, setOutcome] = useState<QuizOutcome | null>(
    revealed ? { correct: true, confidence: 1 } : null,
  );

  const toggle = (i: number) =>
    setSelected(
      multi ? (selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]) : [i],
    );
  const check = () => {
    const correct = step.options.every((o, i) => o.correct === selected.includes(i));
    const result = { correct, confidence };
    setOutcome(result);
    onAnswer(result);
  };
  const ready = selected.length > 0 && (!askConfidence || confidence !== undefined);

  return (
    <div class="stack">
      <Html html={step.question} />
      {step.code && <CodeView code={step.code} />}
      {multi && !outcome && <div class="small muted">Mehrere Antworten können richtig sein.</div>}
      <OptionList
        options={step.options.map((o) => ({ html: o.text, correct: o.correct, why: o.why }))}
        selected={selected}
        revealed={outcome !== null}
        multi={multi}
        onToggle={toggle}
      />
      {!outcome && askConfidence && (
        <ConfidencePicker value={confidence} onChange={setConfidence} />
      )}
      {!outcome && (
        <button class="btn primary block" disabled={!ready} onClick={check}>
          Antwort prüfen
        </button>
      )}
      {outcome && !revealed && (
        <div class={`banner ${outcome.correct ? 'good' : 'bad'}`}>
          <strong>{outcome.correct ? 'Richtig.' : 'Nicht ganz – lies die Begründungen.'}</strong>
        </div>
      )}
      {outcome && !outcome.correct && outcome.confidence === 2 && <Hypercorrection />}
    </div>
  );
}

export function QuizStep({ step, state, onUpdate }: StepProps<QuizStepType | ExplainStep>) {
  return (
    <div class="stack">
      <div class="step-kind">{step.type === 'explain' ? 'Warum?' : 'Abruf'}</div>
      <QuizView
        step={step}
        revealed={Boolean(state?.done)}
        askConfidence={step.type === 'quiz'}
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
