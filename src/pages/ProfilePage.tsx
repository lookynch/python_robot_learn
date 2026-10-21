import { useEffect, useState } from 'preact/hooks';
import { toast } from '../components/Toast';
import { course } from '../content/course';
import { mergeProgress, normalizeProgress } from '../learning/progress';
import {
  getProgress,
  replaceProgress,
  resetLearningProgress,
  setSetting,
  useProgress,
} from '../learning/store';
import { loginUrl, syncNow, useSync, type SyncStatus } from '../learning/sync';
import { isModuleMastered } from '../learning/unlock';
import { DEFAULT_WEEKLY_GOAL } from '../learning/weekly';

const SYNC_TEXT: Record<SyncStatus, string> = {
  idle: 'Noch nicht synchronisiert',
  syncing: 'Synchronisiere …',
  ok: 'Synchronisiert',
  offline: 'Offline',
  login: 'Anmeldung nötig',
  unconfigured: 'Server-Sync nicht eingerichtet',
  outdated: 'App-Update nötig',
  error: 'Fehler',
};

function usePersistence(): boolean | null {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);
  return persisted;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProfilePage() {
  const progress = useProgress();
  const sync = useSync();
  const persisted = usePersistence();
  const goal = progress.settings.weeklyGoal?.value ?? DEFAULT_WEEKLY_GOAL;
  const theme = progress.settings.theme?.value ?? 'auto';
  const lessonsDone = Object.values(progress.lessons).filter(
    (l) => l.completedAt !== undefined,
  ).length;
  const totalLessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const mastered = course.modules.filter((m) => isModuleMastered(progress, m)).length;
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;

  const importFile = async (file: File) => {
    try {
      const imported = normalizeProgress(JSON.parse(await file.text()));
      replaceProgress(mergeProgress(getProgress(), imported), true);
      toast('Fortschritt importiert und zusammengeführt.');
    } catch {
      toast('Datei konnte nicht gelesen werden.');
    }
  };

  return (
    <div class="page stack">
      <h1>Profil</h1>
      <div class="card stack">
        <div class="row">
          <strong>Fortschritt</strong>
        </div>
        <div>
          {lessonsDone} von {totalLessons} Lektionen · {mastered} von {course.modules.length}{' '}
          Modulen gemeistert · {progress.reviews.length} Wiederholungen
        </div>
      </div>

      <div class="card stack">
        <div class="row">
          <strong>Synchronisation</strong>
          <span class="spacer" />
          <span
            class={`pill ${sync.status === 'ok' ? 'good' : sync.status === 'syncing' ? 'accent' : 'warn'}`}
          >
            {SYNC_TEXT[sync.status]}
          </span>
        </div>
        {sync.email && (
          <div class="small">
            Angemeldet als <strong>{sync.email}</strong>
          </div>
        )}
        <div class="small muted">
          {sync.lastSyncAt
            ? `Zuletzt: ${new Date(sync.lastSyncAt).toLocaleString('de-DE')}`
            : 'Noch nie mit dem Server abgeglichen.'}
          {sync.message ? ` – ${sync.message}` : ''}
        </div>
        <div class="row">
          <button
            class="btn small"
            onClick={() => void syncNow()}
            disabled={sync.status === 'syncing'}
          >
            Jetzt synchronisieren
          </button>
          {sync.status === 'login' && (
            <a class="btn small primary" href={loginUrl()}>
              Neu anmelden
            </a>
          )}
        </div>
        <div class="small muted">
          Der Fortschritt liegt lokal auf dem Gerät und wird über deinen Cloudflare-Access-Login
          zwischen Handy, iPad und Desktop abgeglichen.
          {persisted === false &&
            ' Der Browser darf lokale Daten bei Speichermangel löschen – der Server-Sync ist deine Sicherung.'}
        </div>
      </div>

      {!standalone && (
        <div class="banner">
          <strong>Tipp fürs iPhone/iPad:</strong> In Safari auf „Teilen“ → „Zum Home-Bildschirm“.
          Als App gestartet bleiben Daten zuverlässiger erhalten, und der Bildschirm hat mehr Platz.
        </div>
      )}

      <div class="card stack">
        <strong>Einstellungen</strong>
        <label class="row">
          <span style={{ flex: 1 }}>Wochenziel (Lerntage)</span>
          <select
            class="plain"
            style={{ width: 'auto' }}
            value={goal}
            onChange={(e) =>
              setSetting('weeklyGoal', Number((e.target as HTMLSelectElement).value))
            }
          >
            {[2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label class="row">
          <span style={{ flex: 1 }}>Darstellung</span>
          <select
            class="plain"
            style={{ width: 'auto' }}
            value={theme}
            onChange={(e) =>
              setSetting(
                'theme',
                (e.target as HTMLSelectElement).value as 'auto' | 'light' | 'dark',
              )
            }
          >
            <option value="auto">automatisch</option>
            <option value="light">hell</option>
            <option value="dark">dunkel</option>
          </select>
        </label>
      </div>

      <div class="card stack">
        <strong>Daten</strong>
        <div class="row">
          <button
            class="btn small"
            onClick={() =>
              download(
                `robopy-fortschritt-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(getProgress(), null, 2),
              )
            }
          >
            Exportieren
          </button>
          <label class="btn small">
            Importieren
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void importFile(file);
              }}
            />
          </label>
          <button
            class="btn small danger"
            onClick={() => {
              if (
                confirm(
                  'Lernfortschritt (Lektionen, Karten, Wiederholungen) auf allen Geräten zurücksetzen? Code-Entwürfe bleiben erhalten.',
                )
              ) {
                resetLearningProgress();
                void syncNow();
              }
            }}
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      <details class="card">
        <summary>
          <strong>Wie diese App lernt</strong>
        </summary>
        <div class="prose small">
          <ul>
            <li>
              <strong>Abrufen statt Lesen</strong> (Testing-Effekt): Jede Lektion endet mit
              Abruf-Fragen.
            </li>
            <li>
              <strong>Verteilte Wiederholung</strong> mit dem FSRS-Algorithmus (Ziel: 90 %
              Behaltensquote, max. 10 neue Karten/Tag).
            </li>
            <li>
              <strong>Vorhersagen vor dem Ausführen</strong> mit Sicherheitsangabe (PRIMM,
              Hyperkorrektur-Effekt).
            </li>
            <li>
              <strong>Ausgearbeitete Beispiele mit Teilzielen</strong>, dann schrittweises
              Ausblenden (Fading) über Lückentexte und Parsons-Aufgaben bis zur freien Aufgabe.
            </li>
            <li>
              <strong>Selbsterklärung</strong> per Warum-Fragen nach Beispielen.
            </li>
            <li>
              <strong>Interaktive Programmverfolgung</strong> Zeile für Zeile.
            </li>
            <li>
              <strong>Gestufte Hinweise</strong>, Checkpoints ab 80 % als Mastery- und
              Einstufungstest.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}
