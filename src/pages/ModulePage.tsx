import { BackIcon } from '../components/icons';
import { Html } from '../components/Html';
import { course, findModule } from '../content/course';
import { useProgress } from '../learning/store';
import {
  checkpointOf,
  lessonStatus,
  moduleProgress,
  moduleStatus,
  type LessonStatus,
} from '../learning/unlock';
import { linkHandler } from '../router';

const ICON: Record<LessonStatus, string> = { locked: '🔒', open: '', started: '…', done: '✓' };

export function ModulePage({ moduleId }: { moduleId: string }) {
  const progress = useProgress();
  const found = findModule(moduleId);
  if (!found) return <div class="page empty">Modul nicht gefunden.</div>;
  const { module: mod, index } = found;
  const status = moduleStatus(progress, course, index);
  const checkpoint = checkpointOf(mod);
  const checkpointDone = checkpoint && progress.lessons[checkpoint.id]?.completedAt !== undefined;
  return (
    <div class="page stack">
      <a
        class="btn ghost small"
        style={{ alignSelf: 'flex-start' }}
        href="/"
        onClick={linkHandler('/')}
      >
        <BackIcon /> Lernpfad
      </a>
      <div>
        <div class="small muted">Modul {mod.number}</div>
        <h1>{mod.title}</h1>
        <Html html={mod.summary} />
      </div>
      <div class="bar good">
        <span style={{ width: `${moduleProgress(progress, mod) * 100}%` }} />
      </div>
      {status === 'locked' && (
        <div class="banner warn">
          Dieses Modul ist noch gesperrt. Kennst du den Stoff schon? Mach den Checkpoint als{' '}
          <strong>Einstufungstest</strong> – ab 80 % gilt das Modul als gemeistert.
        </div>
      )}
      {checkpoint && status !== 'mastered' && !checkpointDone && (
        <a class="btn" href={`/l/${checkpoint.id}`} onClick={linkHandler(`/l/${checkpoint.id}`)}>
          Kann ich schon → Checkpoint direkt machen
        </a>
      )}
      <div class="card" style={{ padding: '4px 14px' }}>
        {mod.lessons.map((lesson, i) => {
          const ls = lessonStatus(progress, course, index, i);
          const skipped = progress.lessons[lesson.id]?.skipped;
          const content = (
            <>
              <span class="lesson-dot">{ICON[ls] || i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{lesson.title}</div>
                <div class="small muted">
                  {lesson.kind === 'checkpoint'
                    ? 'Checkpoint'
                    : `${lesson.minutes} min · ${lesson.stepCount} Schritte`}
                  {skipped ? ' · per Einstufung' : ''}
                  {lesson.kind === 'checkpoint' && progress.lessons[lesson.id]?.score !== undefined
                    ? ` · bestes Ergebnis ${Math.round((progress.lessons[lesson.id]!.score ?? 0) * 100)} %`
                    : ''}
                </div>
              </span>
            </>
          );
          return ls === 'locked' ? (
            <div key={lesson.id} class="lesson-item locked">
              {content}
            </div>
          ) : (
            <a
              key={lesson.id}
              class={`lesson-item ${ls}`}
              href={`/l/${lesson.id}`}
              onClick={linkHandler(`/l/${lesson.id}`)}
            >
              {content}
            </a>
          );
        })}
      </div>
      {mod.concepts.length > 0 && (
        <details class="card">
          <summary>Konzepte in diesem Modul</summary>
          <ul class="small">
            {mod.concepts.map((c) => (
              <li key={c.id}>
                <strong>{c.name}:</strong> {c.description}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
