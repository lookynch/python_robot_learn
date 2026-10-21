import { useEffect, useState } from 'preact/hooks';
import { course, loaders } from 'virtual:course';
import type { Lesson, LessonSummary, ModuleContent, ModuleSummary } from './schema';

export { course };

const cache = new Map<string, Promise<ModuleContent>>();

export function loadModule(moduleId: string): Promise<ModuleContent> {
  let pending = cache.get(moduleId);
  if (!pending) {
    const loader = loaders[moduleId];
    if (!loader) return Promise.reject(new Error(`Modul ${moduleId} unbekannt`));
    pending = loader().then((m) => m.default);
    cache.set(moduleId, pending);
  }
  return pending;
}

export interface LessonLocation {
  module: ModuleSummary;
  moduleIndex: number;
  summary: LessonSummary;
  lessonIndex: number;
}

export function locateLesson(lessonId: string): LessonLocation | null {
  for (let m = 0; m < course.modules.length; m++) {
    const mod = course.modules[m]!;
    const l = mod.lessons.findIndex((x) => x.id === lessonId);
    if (l >= 0) return { module: mod, moduleIndex: m, summary: mod.lessons[l]!, lessonIndex: l };
  }
  return null;
}

export function findModule(moduleId: string): { module: ModuleSummary; index: number } | null {
  const index = course.modules.findIndex((m) => m.id === moduleId);
  return index >= 0 ? { module: course.modules[index]!, index } : null;
}

export function lessonForCard(cardId: string): LessonLocation | null {
  for (let m = 0; m < course.modules.length; m++) {
    const mod = course.modules[m]!;
    const l = mod.lessons.findIndex((x) => x.cardIds.includes(cardId));
    if (l >= 0) return { module: mod, moduleIndex: m, summary: mod.lessons[l]!, lessonIndex: l };
  }
  return null;
}

export const allCardIds = new Set(course.modules.flatMap((m) => m.lessons.flatMap((l) => l.cardIds)));

export function useLesson(lessonId: string): { lesson: Lesson | null; error: string | null } {
  const [state, setState] = useState<{ lesson: Lesson | null; error: string | null }>({ lesson: null, error: null });
  useEffect(() => {
    const location = locateLesson(lessonId);
    if (!location) {
      setState({ lesson: null, error: 'Lektion nicht gefunden.' });
      return;
    }
    let alive = true;
    setState({ lesson: null, error: null });
    loadModule(location.module.id)
      .then((content) => {
        if (!alive) return;
        const lesson = content.lessons.find((l) => l.id === lessonId) ?? null;
        setState({ lesson, error: lesson ? null : 'Lektion nicht gefunden.' });
      })
      .catch((error: unknown) => alive && setState({ lesson: null, error: String(error) }));
    return () => {
      alive = false;
    };
  }, [lessonId]);
  return state;
}
