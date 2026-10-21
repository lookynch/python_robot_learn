import { describe, expect, test } from 'vitest';
import type { CourseIndex, LessonSummary } from '../../src/content/schema';
import { emptyProgress } from '../../src/learning/progress';
import {
  isModuleMastered,
  lessonStatus,
  moduleStatus,
  nextLesson,
} from '../../src/learning/unlock';

const lesson = (id: string, kind: 'lesson' | 'checkpoint' = 'lesson'): LessonSummary => ({
  id,
  title: id,
  kind,
  minutes: 5,
  stepCount: 3,
  concepts: [],
  cardIds: [],
});
const course: CourseIndex = {
  modules: [
    {
      id: 'm00',
      number: 0,
      title: 'A',
      summary: '',
      depth: 'voll',
      concepts: [],
      lessons: [lesson('a1'), lesson('a2'), lesson('acp', 'checkpoint')],
    },
    {
      id: 'm01',
      number: 1,
      title: 'B',
      summary: '',
      depth: 'voll',
      concepts: [],
      lessons: [lesson('b1'), lesson('bcp', 'checkpoint')],
    },
  ],
};

describe('Freischaltung', () => {
  test('am Anfang ist nur die erste Lektion offen, Checkpoints immer', () => {
    const p = emptyProgress();
    expect(lessonStatus(p, course, 0, 0)).toBe('open');
    expect(lessonStatus(p, course, 0, 1)).toBe('locked');
    expect(lessonStatus(p, course, 0, 2)).toBe('open');
    expect(moduleStatus(p, course, 1)).toBe('locked');
    expect(lessonStatus(p, course, 1, 0)).toBe('locked');
    expect(lessonStatus(p, course, 1, 1)).toBe('open');
  });

  test('abgeschlossene Lektion schaltet die nächste frei', () => {
    const p = emptyProgress();
    p.lessons.a1 = { epoch: 0, steps: {}, completedAt: 1 };
    expect(lessonStatus(p, course, 0, 1)).toBe('open');
    expect(nextLesson(p, course)?.lesson.id).toBe('a2');
  });

  test('eingeschobene Lektion sperrt bereits erledigte nicht', () => {
    const p = emptyProgress();
    p.lessons.a2 = { epoch: 0, steps: {}, completedAt: 1 };
    expect(lessonStatus(p, course, 0, 1)).toBe('done');
  });

  test('Checkpoint ab 80 % meistert das Modul und öffnet das nächste', () => {
    const p = emptyProgress();
    p.lessons.acp = { epoch: 0, steps: {}, completedAt: 1, score: 0.79 };
    expect(isModuleMastered(p, course.modules[0]!)).toBe(false);
    p.lessons.acp.score = 0.8;
    expect(isModuleMastered(p, course.modules[0]!)).toBe(true);
    expect(moduleStatus(p, course, 1)).toBe('open');
    expect(lessonStatus(p, course, 1, 0)).toBe('open');
  });
});
