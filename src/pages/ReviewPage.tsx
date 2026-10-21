import { useEffect, useMemo, useState } from 'preact/hooks';
import { allCardIds, course, lessonForCard, loadModule, locateLesson } from '../content/course';
import type { Card } from '../content/schema';
import { dueCards, rateAnswer, schedule, waitingCount } from '../learning/srs';
import { addReview, getProgress, prepareReviewQueue, useProgress } from '../learning/store';
import { syncNow } from '../learning/sync';
import { PredictView } from '../lesson/steps/PredictStep';
import { QuizView } from '../lesson/steps/QuizStep';
import { linkHandler } from '../router';
import type { Progress } from '../learning/progress';

interface WeakItem {
  lessonId: string;
  title: string;
  steps: number;
}

function weakExercises(progress: Progress): WeakItem[] {
  const items: WeakItem[] = [];
  for (const [lessonId, state] of Object.entries(progress.lessons)) {
    const weak = Object.values(state.steps).filter((s) => s.solutionShown && !s.passed).length;
    const location = locateLesson(lessonId);
    if (weak && location) items.push({ lessonId, title: location.summary.title, steps: weak });
  }
  return items;
}

async function loadCard(cardId: string): Promise<Card | null> {
  const location = lessonForCard(cardId);
  if (!location) return null;
  const content = await loadModule(location.module.id);
  return (
    content.lessons.find((l) => l.id === location.summary.id)?.cards.find((c) => c.id === cardId) ??
    null
  );
}

function formatDue(ms: number): string {
  const minutes = Math.round((ms - Date.now()) / 60000);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} Tagen`;
}

export function ReviewPage() {
  const progress = useProgress();
  const [session, setSession] = useState<{ ids: string[]; position: number } | null>(null);
  useEffect(() => prepareReviewQueue(), []);
  const due = useMemo(() => dueCards(progress, Date.now(), allCardIds), [progress]);
  const upcoming = useMemo(
    () => schedule(progress).find((c) => c.due > Date.now() && allCardIds.has(c.cardId)),
    [progress],
  );
  const weak = weakExercises(progress);

  if (session) {
    if (session.position >= session.ids.length) {
      return (
        <div class="page stack">
          <h1>Runde geschafft</h1>
          <div class="banner good">
            {session.ids.length} Karten wiederholt. Die nächsten Termine plant der Algorithmus nach
            deinen Antworten.
          </div>
          <button class="btn primary" onClick={() => setSession(null)}>
            Fertig
          </button>
        </div>
      );
    }
    const cardId = session.ids[session.position]!;
    return (
      <ReviewCard
        key={`${cardId}-${session.position}`}
        cardId={cardId}
        position={session.position}
        total={session.ids.length}
        onNext={() => {
          const nextPosition = session.position + 1;
          if (nextPosition >= session.ids.length) void syncNow();
          setSession({ ...session, position: nextPosition });
        }}
      />
    );
  }

  return (
    <div class="page stack">
      <h1>Wiederholen</h1>
      <p class="muted" style={{ margin: 0 }}>
        Verteiltes Abrufen (Spaced Repetition, FSRS): Jede Karte kommt kurz bevor du sie vergessen
        würdest – gemischt über alle Module.
      </p>
      {due.length > 0 ? (
        <button
          class="btn primary block"
          onClick={() => setSession({ ids: due.slice(0, 30).map((c) => c.cardId), position: 0 })}
        >
          ▶ {Math.min(30, due.length)} fällige Karte{due.length === 1 ? '' : 'n'} wiederholen
        </button>
      ) : (
        <div class="card empty">
          Nichts fällig.
          {upcoming && <div class="small">Nächste Karte {formatDue(upcoming.due)}.</div>}
          {waitingCount(progress) > 0 && (
            <div class="small">
              {waitingCount(progress)} neue Karten werden in den nächsten Tagen freigegeben (max. 10
              pro Tag).
            </div>
          )}
          {Object.keys(progress.cards).length === 0 && (
            <div class="small">Karten entstehen, wenn du Lektionen abschließt.</div>
          )}
        </div>
      )}
      {weak.length > 0 && (
        <>
          <h2 class="section">Offene Aufgaben</h2>
          <div class="card" style={{ padding: '4px 14px' }}>
            {weak.map((w) => (
              <a
                key={w.lessonId}
                class="lesson-item open"
                href={`/l/${w.lessonId}`}
                onClick={linkHandler(`/l/${w.lessonId}`)}
              >
                <span class="lesson-dot">!</span>
                <span>
                  <div style={{ fontWeight: 600 }}>{w.title}</div>
                  <div class="small muted">
                    {w.steps} Aufgabe{w.steps === 1 ? '' : 'n'} mit angesehener Lösung – löse sie
                    selbst.
                  </div>
                </span>
              </a>
            ))}
          </div>
        </>
      )}
      <div class="small muted">
        {course.modules.reduce(
          (n, m) => n + m.lessons.reduce((k, l) => k + l.cardIds.length, 0),
          0,
        )}{' '}
        Karten im Kurs.
      </div>
    </div>
  );
}

function ReviewCard({
  cardId,
  position,
  total,
  onNext,
}: {
  cardId: string;
  position: number;
  total: number;
  onNext: () => void;
}) {
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    void loadCard(cardId).then(setCard);
  }, [cardId]);
  const variantIndex = useMemo(
    () => getProgress().reviews.filter((r) => r.cardId === cardId).length,
    [cardId],
  );
  useEffect(() => {
    if (card === null) onNext();
  }, [card]);
  if (!card) return <div class="page empty">Lade Karte …</div>;
  const variant = card.variants[variantIndex % card.variants.length]!;
  const location = lessonForCard(cardId);
  const record = (correct: boolean, confidence: 0 | 1 | 2 | undefined) => {
    addReview(cardId, rateAnswer(correct, confidence, false), variantIndex % card.variants.length);
    setAnswered(true);
  };
  return (
    <div class="page stack" style={{ paddingBottom: '120px' }}>
      <div class="row">
        <span class="small muted">
          Karte {position + 1}/{total}
        </span>
        <span class="spacer" />
        {location && (
          <span class="pill">
            Modul {location.module.number} · {location.summary.title}
          </span>
        )}
      </div>
      <div class="bar">
        <span style={{ width: `${(position / total) * 100}%` }} />
      </div>
      {variant.type === 'predict' ? (
        <PredictView
          step={variant}
          revealed={false}
          onAnswer={(o) => record(o.correct, o.confidence)}
        />
      ) : (
        <QuizView
          step={variant}
          revealed={false}
          askConfidence
          onAnswer={(o) => record(o.correct, o.confidence)}
        />
      )}
      {answered && (
        <div class="player-foot">
          <button class="btn primary" onClick={onNext}>
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}
