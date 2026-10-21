export const SCHEMA_VERSION = 1;

export type Confidence = 0 | 1 | 2;
export type Rating = 1 | 2 | 3 | 4;

export interface StepState {
  done: boolean;
  at: number;
  attempts: number;
  hintsUsed: number;
  solutionShown: boolean;
  firstTryCorrect?: boolean;
  confidence?: Confidence;
  skipped?: boolean;
  passed?: boolean;
}

export interface LessonState {
  epoch: number;
  steps: Record<string, StepState>;
  completedAt?: number;
  skipped?: boolean;
  score?: number;
}

export interface CardState {
  epoch: number;
  queuedAt: number;
  introducedAt?: number;
}

export interface ReviewEntry {
  id: string;
  cardId: string;
  rating: Rating;
  at: number;
  epoch: number;
  variant: number;
}

export interface Draft {
  code: string;
  updatedAt: number;
  deviceId: string;
}

export interface Setting<T> {
  value: T;
  updatedAt: number;
}

export interface Settings {
  weeklyGoal?: Setting<number>;
  theme?: Setting<'auto' | 'light' | 'dark'>;
}

export interface Progress {
  schemaVersion: number;
  resetEpoch: number;
  lessons: Record<string, LessonState>;
  cards: Record<string, CardState>;
  reviews: ReviewEntry[];
  drafts: Record<string, Draft>;
  activity: string[];
  settings: Settings;
  [extra: string]: unknown;
}

const KNOWN_KEYS = new Set([
  'schemaVersion',
  'resetEpoch',
  'lessons',
  'cards',
  'reviews',
  'drafts',
  'activity',
  'settings',
]);
const MAX_ACTIVITY_DAYS = 400;

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    resetEpoch: 0,
    lessons: {},
    cards: {},
    reviews: [],
    drafts: {},
    activity: [],
    settings: {},
  };
}

export function normalizeProgress(raw: unknown): Progress {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<Progress>;
  return {
    ...data,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : SCHEMA_VERSION,
    resetEpoch: typeof data.resetEpoch === 'number' ? data.resetEpoch : 0,
    lessons: data.lessons && typeof data.lessons === 'object' ? data.lessons : {},
    cards: data.cards && typeof data.cards === 'object' ? data.cards : {},
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    drafts: data.drafts && typeof data.drafts === 'object' ? data.drafts : {},
    activity: Array.isArray(data.activity) ? data.activity : [],
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
  };
}

function minDefined(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

function mergeStep(a: StepState, b: StepState): StepState {
  const first = a.at <= b.at ? a : b;
  return {
    done: a.done || b.done,
    at: Math.min(a.at, b.at),
    attempts: Math.max(a.attempts, b.attempts),
    hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
    solutionShown: a.solutionShown || b.solutionShown,
    firstTryCorrect: first.firstTryCorrect ?? (a === first ? b : a).firstTryCorrect,
    confidence: first.confidence ?? (a === first ? b : a).confidence,
    skipped: a.done && b.done ? Boolean(a.skipped && b.skipped) : a.done ? a.skipped : b.skipped,
    passed: a.passed || b.passed || undefined,
  };
}

function mergeLesson(a: LessonState, b: LessonState): LessonState {
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;
  const steps: Record<string, StepState> = { ...a.steps };
  for (const [key, step] of Object.entries(b.steps))
    steps[key] = steps[key] ? mergeStep(steps[key]!, step) : step;
  const completed = a.completedAt !== undefined && b.completedAt !== undefined;
  return {
    epoch: a.epoch,
    steps,
    completedAt: minDefined(a.completedAt, b.completedAt),
    skipped: completed
      ? Boolean(a.skipped && b.skipped)
      : a.completedAt !== undefined
        ? a.skipped
        : b.skipped,
    score:
      a.score === undefined
        ? b.score
        : b.score === undefined
          ? a.score
          : Math.max(a.score, b.score),
  };
}

function mergeCard(a: CardState, b: CardState): CardState {
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;
  return {
    epoch: a.epoch,
    queuedAt: Math.min(a.queuedAt, b.queuedAt),
    introducedAt: minDefined(a.introducedAt, b.introducedAt),
  };
}

function newerDraft(a: Draft, b: Draft): Draft {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.deviceId >= b.deviceId ? a : b;
}

function newerSetting<T>(a?: Setting<T>, b?: Setting<T>): Setting<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

function mergeRecords<T>(
  a: Record<string, T>,
  b: Record<string, T>,
  combine: (x: T, y: T) => T,
  keep: (x: T) => boolean,
) {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(a)) if (keep(value)) out[key] = value;
  for (const [key, value] of Object.entries(b)) {
    if (!keep(value)) continue;
    out[key] = out[key] === undefined ? value : combine(out[key]!, value);
  }
  return out;
}

export function mergeProgress(local: Progress, remote: Progress): Progress {
  const resetEpoch = Math.max(local.resetEpoch, remote.resetEpoch);
  const current = <T extends { epoch: number }>(x: T) => x.epoch >= resetEpoch;
  const extras: Record<string, unknown> = {};
  for (const source of [local, remote]) {
    for (const [key, value] of Object.entries(source))
      if (!KNOWN_KEYS.has(key)) extras[key] = value;
  }
  const reviews = new Map<string, ReviewEntry>();
  for (const entry of [...local.reviews, ...remote.reviews])
    if (entry.epoch >= resetEpoch) reviews.set(entry.id, entry);
  return {
    ...extras,
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    resetEpoch,
    lessons: mergeRecords(local.lessons, remote.lessons, mergeLesson, current),
    cards: mergeRecords(local.cards, remote.cards, mergeCard, current),
    reviews: [...reviews.values()].sort((x, y) => x.at - y.at || x.id.localeCompare(y.id)),
    drafts: mergeRecords(local.drafts, remote.drafts, newerDraft, () => true),
    activity: [...new Set([...local.activity, ...remote.activity])]
      .sort()
      .slice(-MAX_ACTIVITY_DAYS),
    settings: {
      weeklyGoal: newerSetting(local.settings.weeklyGoal, remote.settings.weeklyGoal),
      theme: newerSetting(local.settings.theme, remote.settings.theme),
    },
  };
}

export function sameProgress(a: Progress, b: Progress): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
