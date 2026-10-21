import { describe, expect, test } from 'vitest';
import { emptyProgress } from '../../src/learning/progress';
import {
  dueCards,
  introduceNewCards,
  NEW_CARDS_PER_DAY,
  rateAnswer,
  scheduleCard,
} from '../../src/learning/srs';

const DAY = 24 * 3600 * 1000;

describe('FSRS-Anbindung', () => {
  test('Bewertung aus Richtigkeit, Sicherheit und Hilfe', () => {
    expect(rateAnswer(false, 2, false)).toBe(1);
    expect(rateAnswer(true, 0, false)).toBe(2);
    expect(rateAnswer(true, 1, true)).toBe(2);
    expect(rateAnswer(true, 1, false)).toBe(3);
    expect(rateAnswer(true, 2, false)).toBe(4);
  });

  test('Replay ist deterministisch und gute Antworten verlängern das Intervall', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const logs = [
      { id: '1', cardId: 'c', rating: 3 as const, at: t0, epoch: 0, variant: 0 },
      { id: '2', cardId: 'c', rating: 3 as const, at: t0 + DAY, epoch: 0, variant: 1 },
    ];
    const first = scheduleCard('c', t0, logs);
    expect(scheduleCard('c', t0, logs)).toEqual(first);
    expect(first.due).toBeGreaterThan(t0 + DAY);
    const failed = scheduleCard('c', t0, [
      ...logs,
      { id: '3', cardId: 'c', rating: 1 as const, at: t0 + 5 * DAY, epoch: 0, variant: 0 },
    ]);
    expect(failed.due - (t0 + 5 * DAY)).toBeLessThan(DAY);
    expect(failed.nextVariant).toBe(3);
  });

  test('neue Karten werden auf 10 pro Tag gedrosselt', () => {
    const p = emptyProgress();
    for (let i = 0; i < 25; i++) p.cards[`c${i}`] = { epoch: 0, queuedAt: i };
    const now = Date.UTC(2026, 5, 1, 12);
    expect(introduceNewCards(p, now)).toHaveLength(NEW_CARDS_PER_DAY);
    for (const id of introduceNewCards(p, now).slice(0, 4)) p.cards[id]!.introducedAt = now;
    expect(introduceNewCards(p, now)).toHaveLength(NEW_CARDS_PER_DAY - 4);
  });

  test('fällig sind nur eingeführte, bekannte Karten', () => {
    const p = emptyProgress();
    const now = Date.UTC(2026, 5, 1);
    p.cards.a = { epoch: 0, queuedAt: 0, introducedAt: now - DAY };
    p.cards.b = { epoch: 0, queuedAt: 0 };
    p.cards.weg = { epoch: 0, queuedAt: 0, introducedAt: now - DAY };
    expect(dueCards(p, now, new Set(['a', 'b'])).map((c) => c.cardId)).toEqual(['a']);
  });
});
