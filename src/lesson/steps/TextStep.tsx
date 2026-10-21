import { useEffect } from 'preact/hooks';
import { Html } from '../../components/Html';
import type { TextStep as TextStepType } from '../../content/schema';
import type { StepProps } from '../types';

export function TextStep({ step, state, onUpdate }: StepProps<TextStepType>) {
  useEffect(() => {
    if (!state?.done) onUpdate({ done: true, firstTryCorrect: true });
  }, []);
  return (
    <div class="card">
      <Html html={step.body} />
    </div>
  );
}
