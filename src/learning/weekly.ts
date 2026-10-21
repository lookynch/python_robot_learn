import { dayKey } from './srs';

export const DEFAULT_WEEKLY_GOAL = 4;

export function currentWeek(now = new Date()): { key: string; label: string; isToday: boolean }[] {
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const today = dayKey(now.getTime());
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = dayKey(d.getTime());
    return { key, label, isToday: key === today };
  });
}

export function activeDaysThisWeek(activity: string[], now = new Date()): number {
  const set = new Set(activity);
  return currentWeek(now).filter((d) => set.has(d.key)).length;
}
