import type { Progress } from '../learning/progress';
import { activeDaysThisWeek, currentWeek, DEFAULT_WEEKLY_GOAL } from '../learning/weekly';

export function WeekGoal({ progress }: { progress: Progress }) {
  const goal = progress.settings.weeklyGoal?.value ?? DEFAULT_WEEKLY_GOAL;
  const days = currentWeek();
  const active = new Set(progress.activity);
  const count = activeDaysThisWeek(progress.activity);
  return (
    <div class="card">
      <div class="row">
        <strong>Wochenziel</strong>
        <span class="spacer" />
        <span class={`pill ${count >= goal ? 'good' : ''}`}>
          {count}/{goal} Tage
        </span>
      </div>
      <div class="weekdots" style={{ marginTop: '10px' }}>
        {days.map((d) => (
          <span key={d.key} class={`${active.has(d.key) ? 'on' : ''} ${d.isToday ? 'today' : ''}`}>
            {d.label}
          </span>
        ))}
      </div>
      <div class="small muted" style={{ marginTop: '8px' }}>
        {count >= goal
          ? 'Ziel erreicht – alles Weitere ist Bonus.'
          : 'Ein Lerntag zählt, sobald du etwas bearbeitest. Kein Streak, der reißt.'}
      </div>
    </div>
  );
}
