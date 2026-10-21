import { useEffect, useState } from 'preact/hooks';
import type { LessonSummary } from '../content/schema';
import {
  emptyProgress,
  normalizeProgress,
  type Progress,
  type Rating,
  type Settings,
  type StepState,
} from './progress';
import { dayKey, introduceNewCards } from './srs';

const STORAGE_KEY = 'robopy.progress.v1';
const DEVICE_KEY = 'robopy.device';

type Listener = (p: Progress) => void;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Speicher voll oder gesperrt – Server-Sync bleibt die Sicherung */
  }
}

function loadProgress(): Progress {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return emptyProgress();
  try {
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}

export function uuid(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const deviceId: string = (() => {
  const existing = readStorage(DEVICE_KEY);
  if (existing) return existing;
  const id = uuid();
  writeStorage(DEVICE_KEY, id);
  return id;
})();

let state: Progress = loadProgress();
const listeners = new Set<Listener>();
const changeHooks = new Set<() => void>();

export function getProgress(): Progress {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onLocalChange(hook: () => void): () => void {
  changeHooks.add(hook);
  return () => changeHooks.delete(hook);
}

export function replaceProgress(next: Progress, fromUser = false) {
  state = next;
  writeStorage(STORAGE_KEY, JSON.stringify(state));
  for (const listener of listeners) listener(state);
  if (fromUser) for (const hook of changeHooks) hook();
}

export function update(mutate: (draft: Progress) => void) {
  const draft = structuredClone(state);
  mutate(draft);
  const today = dayKey(Date.now());
  if (!draft.activity.includes(today)) draft.activity = [...draft.activity, today];
  replaceProgress(draft, true);
}

export function useProgress(): Progress {
  const [value, setValue] = useState(state);
  useEffect(() => {
    setValue(state);
    return subscribe(setValue);
  }, []);
  return value;
}

function lessonState(draft: Progress, lessonId: string) {
  return (draft.lessons[lessonId] ??= { epoch: draft.resetEpoch, steps: {} });
}

export function recordStep(lessonId: string, stepIndex: number, patch: Partial<StepState>) {
  update((draft) => {
    const lesson = lessonState(draft, lessonId);
    const previous: StepState = lesson.steps[stepIndex] ?? {
      done: false,
      at: Date.now(),
      attempts: 0,
      hintsUsed: 0,
      solutionShown: false,
    };
    lesson.steps[stepIndex] = { ...previous, ...patch };
  });
}

export function startLesson(lessonId: string) {
  if (state.lessons[lessonId]) return;
  update((draft) => void lessonState(draft, lessonId));
}

function queueCards(draft: Progress, cardIds: string[], now: number, knownAlready: boolean) {
  for (const cardId of cardIds) {
    if (draft.cards[cardId]) continue;
    draft.cards[cardId] = {
      epoch: draft.resetEpoch,
      queuedAt: now,
      introducedAt: knownAlready ? now : undefined,
    };
    if (knownAlready)
      draft.reviews.push({
        id: uuid(),
        cardId,
        rating: 3,
        at: now,
        epoch: draft.resetEpoch,
        variant: 0,
      });
  }
}

export function completeLesson(
  lesson: LessonSummary,
  options: { score?: number; skipped?: boolean } = {},
) {
  update((draft) => {
    const now = Date.now();
    const target = lessonState(draft, lesson.id);
    target.completedAt ??= now;
    if (options.score !== undefined) target.score = Math.max(target.score ?? 0, options.score);
    if (options.skipped) target.skipped = true;
    queueCards(draft, lesson.cardIds, now, Boolean(options.skipped));
  });
}

export function completeModuleByPlacement(lessons: LessonSummary[]) {
  update((draft) => {
    const now = Date.now();
    for (const lesson of lessons) {
      if (lesson.kind === 'checkpoint') continue;
      const target = lessonState(draft, lesson.id);
      if (target.completedAt !== undefined) continue;
      target.completedAt = now;
      target.skipped = true;
      queueCards(draft, lesson.cardIds, now, true);
    }
  });
}

export function prepareReviewQueue() {
  const fresh = introduceNewCards(state, Date.now());
  if (!fresh.length) return;
  update((draft) => {
    const now = Date.now();
    for (const id of fresh) draft.cards[id]!.introducedAt = now;
  });
}

export function addReview(cardId: string, rating: Rating, variant: number) {
  update((draft) => {
    draft.reviews.push({
      id: uuid(),
      cardId,
      rating,
      at: Date.now(),
      epoch: draft.resetEpoch,
      variant,
    });
  });
}

export function saveDraft(key: string, code: string) {
  if (state.drafts[key]?.code === code) return;
  update((draft) => {
    draft.drafts[key] = { code, updatedAt: Date.now(), deviceId };
  });
}

export function setSetting<K extends keyof Settings>(
  key: K,
  value: NonNullable<Settings[K]>['value'],
) {
  update((draft) => {
    draft.settings[key] = { value, updatedAt: Date.now() } as Settings[K];
  });
}

export function resetLearningProgress() {
  update((draft) => {
    draft.resetEpoch += 1;
    draft.lessons = {};
    draft.cards = {};
    draft.reviews = [];
  });
}
