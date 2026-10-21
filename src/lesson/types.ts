import type { Lesson, Step } from '../content/schema';
import type { StepState } from '../learning/progress';
import type { RunResult } from '../python/protocol';

export interface StepContext {
  code?: string;
  result?: RunResult | null;
  hintsShown?: number;
}

export interface StepProps<T extends Step = Step> {
  step: T;
  lesson: Lesson;
  index: number;
  state: StepState | undefined;
  checkpoint: boolean;
  onUpdate: (patch: Partial<StepState>) => void;
  onContext: (context: StepContext) => void;
  onSkipToExercise?: () => void;
}
