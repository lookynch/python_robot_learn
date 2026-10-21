import { describe, expect, test } from 'vitest';
import {
  emptyProgress,
  mergeProgress,
  normalizeProgress,
  type Progress,
} from '../../src/learning/progress';

function progress(patch: Partial<Progress>): Progress {
  return { ...emptyProgress(), ...patch };
}

const step = { done: true, at: 10, attempts: 1, hintsUsed: 0, solutionShown: false };

describe('mergeProgress', () => {
  test('vereinigt Lektionen und Schritte beider Geräte', () => {
    const a = progress({ lessons: { l1: { epoch: 0, steps: { 0: step }, completedAt: 100 } } });
    const b = progress({
      lessons: { l1: { epoch: 0, steps: { 1: { ...step, at: 20 } } }, l2: { epoch: 0, steps: {} } },
    });
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.lessons).sort()).toEqual(['l1', 'l2']);
    expect(Object.keys(merged.lessons.l1!.steps).sort()).toEqual(['0', '1']);
    expect(merged.lessons.l1!.completedAt).toBe(100);
  });

  test('erster Versuch zählt vom früheren Gerät', () => {
    const early = { ...step, at: 5, firstTryCorrect: false };
    const late = { ...step, at: 50, firstTryCorrect: true };
    const a = progress({ lessons: { l: { epoch: 0, steps: { 0: late } } } });
    const b = progress({ lessons: { l: { epoch: 0, steps: { 0: early } } } });
    expect(mergeProgress(a, b).lessons.l!.steps[0]!.firstTryCorrect).toBe(false);
  });

  test('Reset-Epoche verwirft alten Fortschritt auch vom anderen Gerät', () => {
    const resetDevice = progress({ resetEpoch: 1 });
    const oldDevice = progress({
      resetEpoch: 0,
      lessons: { l: { epoch: 0, steps: {}, completedAt: 1 } },
      cards: { c: { epoch: 0, queuedAt: 1, introducedAt: 1 } },
      reviews: [{ id: 'r1', cardId: 'c', rating: 3, at: 2, epoch: 0, variant: 0 }],
    });
    const merged = mergeProgress(oldDevice, resetDevice);
    expect(merged.resetEpoch).toBe(1);
    expect(merged.lessons).toEqual({});
    expect(merged.cards).toEqual({});
    expect(merged.reviews).toEqual([]);
  });

  test('Wiederholungen werden per id vereinigt statt überschrieben', () => {
    const r = (id: string, at: number) => ({
      id,
      cardId: 'c',
      rating: 3 as const,
      at,
      epoch: 0,
      variant: 0,
    });
    const merged = mergeProgress(
      progress({ reviews: [r('a', 1), r('b', 3)] }),
      progress({ reviews: [r('b', 3), r('c', 2)] }),
    );
    expect(merged.reviews.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  test('Entwürfe: neuerer gewinnt, bei Gleichstand entscheidet deviceId', () => {
    const a = progress({
      drafts: {
        k: { code: 'alt', updatedAt: 1, deviceId: 'a' },
        t: { code: 'A', updatedAt: 5, deviceId: 'a' },
      },
    });
    const b = progress({
      drafts: {
        k: { code: 'neu', updatedAt: 2, deviceId: 'b' },
        t: { code: 'B', updatedAt: 5, deviceId: 'b' },
      },
    });
    const merged = mergeProgress(a, b);
    expect(merged.drafts.k!.code).toBe('neu');
    expect(merged.drafts.t!.code).toBe('B');
    expect(mergeProgress(b, a).drafts.t!.code).toBe('B');
  });

  test('unbekannte Felder einer neueren Version bleiben erhalten', () => {
    const newer = { ...progress({ schemaVersion: 2 }), futureField: { x: 1 } } as Progress;
    const merged = mergeProgress(progress({}), newer);
    expect(merged.futureField).toEqual({ x: 1 });
    expect(merged.schemaVersion).toBe(2);
  });

  test('Merge ist kommutativ für die Inhalte', () => {
    const a = progress({
      lessons: { l: { epoch: 0, steps: { 0: step } } },
      activity: ['2026-10-01'],
    });
    const b = progress({ lessons: { m: { epoch: 0, steps: {} } }, activity: ['2026-10-02'] });
    expect(mergeProgress(a, b).lessons).toEqual(mergeProgress(b, a).lessons);
    expect(mergeProgress(a, b).activity).toEqual(mergeProgress(b, a).activity);
  });

  test('normalizeProgress repariert kaputte Daten', () => {
    const n = normalizeProgress({ lessons: 'kaputt', reviews: null });
    expect(n.lessons).toEqual({});
    expect(n.reviews).toEqual([]);
  });
});
