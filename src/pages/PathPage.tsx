import { Html } from '../components/Html';
import { WeekGoal } from '../components/WeekGoal';
import { allCardIds, course } from '../content/course';
import { dueCards, waitingCount } from '../learning/srs';
import { useProgress } from '../learning/store';
import { moduleProgress, moduleStatus, nextLesson, type ModuleStatus } from '../learning/unlock';
import { linkHandler } from '../router';

const STATUS_LABEL: Record<ModuleStatus, string> = {
  locked: 'gesperrt',
  open: 'offen',
  started: 'begonnen',
  mastered: 'gemeistert',
};
const DEPTH_LABEL = { voll: 'im Browser', spiel: 'Spielversion', konzept: 'Konzepte' } as const;

export function PathPage() {
  const progress = useProgress();
  const next = nextLesson(progress, course);
  const due = dueCards(progress, Date.now(), allCardIds).length;
  const waiting = waitingCount(progress);
  return (
    <div class="page stack">
      <div>
        <h1>RoboPy</h1>
        <div class="muted">Von Python bis zum Roboterarm mit World Model.</div>
      </div>
      {next && (
        <a
          class="card"
          href={`/l/${next.lesson.id}`}
          onClick={linkHandler(`/l/${next.lesson.id}`)}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div class="small muted">Weiter lernen · Modul {next.module.number}</div>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', margin: '2px 0 10px' }}>
            {next.lesson.title}
          </div>
          <span class="btn primary">▶ Lektion starten · {next.lesson.minutes} min</span>
        </a>
      )}
      {(due > 0 || waiting > 0) && (
        <a
          class="banner warn"
          href="/review"
          onClick={linkHandler('/review')}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <strong>
            {due > 0 ? `${due} Wiederholung${due === 1 ? '' : 'en'} fällig` : 'Neue Karten warten'}
          </strong>
          <div class="small">
            Kurz abrufen festigt das Gelernte –{' '}
            {due > 0 ? 'dauert meist 2–5 Minuten.' : 'sie werden nach und nach freigegeben.'}
          </div>
        </a>
      )}
      <WeekGoal progress={progress} />
      <h2 class="section">Lernpfad</h2>
      <div class="stack">
        {course.modules.map((mod, i) => {
          const status = moduleStatus(progress, course, i);
          const share = moduleProgress(progress, mod);
          return (
            <a
              key={mod.id}
              class={`card module-card ${status}`}
              href={`/m/${mod.id}`}
              onClick={linkHandler(`/m/${mod.id}`)}
            >
              <div class="module-num">{status === 'mastered' ? '✓' : mod.number}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div class="row">
                  <strong>{mod.title}</strong>
                  <span class="spacer" />
                  <span
                    class={`pill ${status === 'mastered' ? 'good' : status === 'locked' ? '' : 'accent'}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <Html html={mod.summary} class="prose small muted" />
                <div class="row small muted" style={{ marginTop: '6px' }}>
                  <span>{mod.lessons.length} Lektionen</span>
                  <span>·</span>
                  <span>{DEPTH_LABEL[mod.depth]}</span>
                </div>
                {share > 0 && (
                  <div
                    class={`bar ${status === 'mastered' ? 'good' : ''}`}
                    style={{ marginTop: '8px' }}
                  >
                    <span style={{ width: `${share * 100}%` }} />
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
