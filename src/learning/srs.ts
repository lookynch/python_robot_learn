import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import type { Confidence, Progress, Rating, ReviewEntry } from './progress';

export const NEW_CARDS_PER_DAY = 10;

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 180,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ['10m', '1d'],
    relearning_steps: ['10m'],
  }),
);

export interface ScheduledCard {
  cardId: string;
  due: number;
  reps: number;
  lapses: number;
  nextVariant: number;
}

export function rateAnswer(
  correct: boolean,
  confidence: Confidence | undefined,
  usedHelp: boolean,
): Rating {
  if (!correct) return 1;
  if (usedHelp || confidence === 0) return 2;
  if (confidence === 2) return 4;
  return 3;
}

export function scheduleCard(
  cardId: string,
  introducedAt: number,
  logs: ReviewEntry[],
): ScheduledCard {
  let card: FsrsCard = createEmptyCard(new Date(introducedAt));
  for (const log of logs) card = scheduler.next(card, new Date(log.at), log.rating as Grade).card;
  return {
    cardId,
    due: card.due.getTime(),
    reps: card.reps,
    lapses: card.lapses,
    nextVariant: logs.length,
  };
}

export function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function introduceNewCards(progress: Progress, now: number): string[] {
  const today = dayKey(now);
  const introducedToday = Object.values(progress.cards).filter(
    (c) => c.introducedAt !== undefined && dayKey(c.introducedAt) === today,
  ).length;
  const waiting = Object.entries(progress.cards)
    .filter(([, c]) => c.introducedAt === undefined)
    .sort(([, a], [, b]) => a.queuedAt - b.queuedAt)
    .map(([id]) => id);
  return waiting.slice(0, Math.max(0, NEW_CARDS_PER_DAY - introducedToday));
}

export function schedule(progress: Progress): ScheduledCard[] {
  const logsByCard = new Map<string, ReviewEntry[]>();
  for (const log of progress.reviews) {
    const list = logsByCard.get(log.cardId) ?? [];
    list.push(log);
    logsByCard.set(log.cardId, list);
  }
  const result: ScheduledCard[] = [];
  for (const [cardId, state] of Object.entries(progress.cards)) {
    if (state.introducedAt === undefined) continue;
    const logs = (logsByCard.get(cardId) ?? []).sort((a, b) => a.at - b.at);
    result.push(scheduleCard(cardId, state.introducedAt, logs));
  }
  return result.sort((a, b) => a.due - b.due);
}

export function dueCards(
  progress: Progress,
  now: number,
  knownCardIds: Set<string>,
): ScheduledCard[] {
  return schedule(progress).filter((c) => c.due <= now && knownCardIds.has(c.cardId));
}

export function waitingCount(progress: Progress): number {
  return Object.values(progress.cards).filter((c) => c.introducedAt === undefined).length;
}
