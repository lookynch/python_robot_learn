import {
  SCORED_STEP_TYPES,
  type CourseIndex,
  type Lesson,
  type LessonSummary,
  type ModuleSummary,
} from '../content/schema';
import type { Progress } from './progress';

export const CHECKPOINT_PASS = 0.8;

export type LessonStatus = 'locked' | 'open' | 'started' | 'done';
export type ModuleStatus = 'locked' | 'open' | 'started' | 'mastered';

export function isLessonDone(progress: Progress, lessonId: string): boolean {
  return progress.lessons[lessonId]?.completedAt !== undefined;
}

export function checkpointOf(mod: ModuleSummary): LessonSummary | undefined {
  return mod.lessons.find((l) => l.kind === 'checkpoint');
}

export function isModuleMastered(progress: Progress, mod: ModuleSummary): boolean {
  const checkpoint = checkpointOf(mod);
  if (!checkpoint) return mod.lessons.every((l) => isLessonDone(progress, l.id));
  return (progress.lessons[checkpoint.id]?.score ?? 0) >= CHECKPOINT_PASS;
}

export function moduleStatus(progress: Progress, course: CourseIndex, index: number): ModuleStatus {
  const mod = course.modules[index]!;
  if (isModuleMastered(progress, mod)) return 'mastered';
  const started = mod.lessons.some((l) => progress.lessons[l.id] !== undefined);
  const previous = course.modules[index - 1];
  if (index === 0 || started || (previous && isModuleMastered(progress, previous)))
    return started ? 'started' : 'open';
  return 'locked';
}

export function lessonStatus(
  progress: Progress,
  course: CourseIndex,
  moduleIndex: number,
  lessonIndex: number,
): LessonStatus {
  const mod = course.modules[moduleIndex]!;
  const lesson = mod.lessons[lessonIndex]!;
  if (isLessonDone(progress, lesson.id)) return 'done';
  if (progress.lessons[lesson.id]) return 'started';
  if (lesson.kind === 'checkpoint') return 'open';
  if (moduleStatus(progress, course, moduleIndex) === 'locked') return 'locked';
  const previous = mod.lessons[lessonIndex - 1];
  if (!previous || isLessonDone(progress, previous.id)) return 'open';
  return 'locked';
}

export function nextLesson(
  progress: Progress,
  course: CourseIndex,
): { module: ModuleSummary; lesson: LessonSummary } | null {
  for (let m = 0; m < course.modules.length; m++) {
    const mod = course.modules[m]!;
    if (isModuleMastered(progress, mod)) continue;
    for (let l = 0; l < mod.lessons.length; l++) {
      const status = lessonStatus(progress, course, m, l);
      if (status === 'open' || status === 'started')
        return { module: mod, lesson: mod.lessons[l]! };
    }
  }
  return null;
}

export function requiredSteps(lesson: Lesson): number[] {
  return lesson.steps.map((s, i) => (s.optional ? -1 : i)).filter((i) => i >= 0);
}

export function scoredSteps(lesson: Lesson): number[] {
  return lesson.steps.map((s, i) => (SCORED_STEP_TYPES.has(s.type) ? i : -1)).filter((i) => i >= 0);
}

export function checkpointScore(progress: Progress, lesson: Lesson): number {
  const scored = scoredSteps(lesson);
  if (!scored.length) return 0;
  const state = progress.lessons[lesson.id];
  const correct = scored.filter((i) => state?.steps[i]?.firstTryCorrect).length;
  return correct / scored.length;
}

export function moduleProgress(progress: Progress, mod: ModuleSummary): number {
  const done = mod.lessons.filter((l) => isLessonDone(progress, l.id)).length;
  return mod.lessons.length ? done / mod.lessons.length : 0;
}
