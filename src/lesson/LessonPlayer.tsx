import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AiIcon, CloseIcon } from '../components/icons';
import { Html } from '../components/Html';
import { toast } from '../components/Toast';
import { course, locateLesson, useLesson } from '../content/course';
import type { Lesson, LessonSummary, ModuleSummary, Step } from '../content/schema';
import { buildAiContext, copyText } from '../learning/ai-context';
import type { Progress, StepState } from '../learning/progress';
import {
  completeLesson,
  completeModuleByPlacement,
  getProgress,
  recordStep,
  startLesson,
  useProgress,
} from '../learning/store';
import { syncNow } from '../learning/sync';
import {
  CHECKPOINT_PASS,
  checkpointScore,
  lessonStatus,
  nextLesson,
  requiredSteps,
} from '../learning/unlock';
import { linkHandler, navigate } from '../router';
import { ExampleStep } from './steps/ExampleStep';
import { ExerciseStep } from './steps/ExerciseStep';
import { FillStep } from './steps/FillStep';
import { ParsonsStep } from './steps/ParsonsStep';
import { PredictStep } from './steps/PredictStep';
import { QuizStep } from './steps/QuizStep';
import { TextStep } from './steps/TextStep';
import { TraceStep } from './steps/TraceStep';
import type { StepContext, StepProps } from './types';

const SPLIT_TYPES = new Set<Step['type']>(['example', 'trace', 'fill', 'parsons', 'exercise']);

function StepView(props: StepProps) {
  const { step } = props;
  switch (step.type) {
    case 'text':
      return <TextStep {...props} step={step} />;
    case 'example':
      return <ExampleStep {...props} step={step} />;
    case 'predict':
      return <PredictStep {...props} step={step} />;
    case 'trace':
      return <TraceStep {...props} step={step} />;
    case 'fill':
      return <FillStep {...props} step={step} />;
    case 'parsons':
      return <ParsonsStep {...props} step={step} />;
    case 'exercise':
      return <ExerciseStep {...props} step={step} />;
    case 'quiz':
    case 'explain':
      return <QuizStep {...props} step={step} />;
  }
}

function firstOpenStep(lesson: Lesson, progress: Progress): number {
  const requested = Number(new URLSearchParams(location.search).get('step'));
  if (Number.isInteger(requested) && requested >= 1 && requested <= lesson.steps.length)
    return requested - 1;
  const steps = progress.lessons[lesson.id]?.steps ?? {};
  const open = lesson.steps.findIndex((_, i) => !steps[i]?.done);
  return open < 0 ? 0 : open;
}

function isStepDone(state: StepState | undefined, step: Step): boolean {
  return Boolean(state?.done) || Boolean(step.optional);
}

export function LessonPage({ lessonId }: { lessonId: string }) {
  const location = locateLesson(lessonId);
  const { lesson, error } = useLesson(lessonId);
  const progress = useProgress();
  if (!location) return <div class="page empty">Lektion nicht gefunden.</div>;
  const status = lessonStatus(progress, course, location.moduleIndex, location.lessonIndex);
  if (status === 'locked')
    return (
      <div class="page stack">
        <div class="banner warn">
          Diese Lektion ist noch gesperrt. Schließe zuerst die vorherige Lektion ab.
        </div>
        <a
          class="btn"
          href={`/m/${location.module.id}`}
          onClick={linkHandler(`/m/${location.module.id}`)}
        >
          Zum Modul
        </a>
      </div>
    );
  if (error) return <div class="page empty">{error}</div>;
  if (!lesson) return <div class="page empty">Lektion wird geladen …</div>;
  return (
    <LessonPlayer
      key={lesson.id}
      lesson={lesson}
      module={location.module}
      summary={location.summary}
    />
  );
}

function LessonPlayer({
  lesson,
  module,
  summary,
}: {
  lesson: Lesson;
  module: ModuleSummary;
  summary: LessonSummary;
}) {
  const progress = useProgress();
  const lessonState = progress.lessons[lesson.id];
  const [index, setIndex] = useState(() => firstOpenStep(lesson, getProgress()));
  const [finished, setFinished] = useState(false);
  const context = useRef<StepContext>({});
  const checkpoint = lesson.kind === 'checkpoint';
  const step = lesson.steps[index]!;
  const stepState = lessonState?.steps[index];

  useEffect(() => startLesson(lesson.id), [lesson.id]);
  useEffect(() => {
    context.current = {};
    window.scrollTo(0, 0);
  }, [index]);

  const onUpdate = (patch: Partial<StepState>) => recordStep(lesson.id, index, patch);
  const nextExercise = useMemo(() => {
    const i = lesson.steps.findIndex((s, k) => k > index && s.type === 'exercise');
    return i >= 0 ? i : null;
  }, [index]);

  const skipToExercise =
    nextExercise === null
      ? undefined
      : () => {
          for (let k = index; k < nextExercise; k++) {
            if (lesson.steps[k]!.fading && !getProgress().lessons[lesson.id]?.steps[k]?.done)
              recordStep(lesson.id, k, { done: true, skipped: true });
          }
          setIndex(nextExercise);
        };

  const finish = () => {
    if (checkpoint) {
      const score = checkpointScore(getProgress(), lesson);
      completeLesson(summary, { score });
      if (score >= CHECKPOINT_PASS) completeModuleByPlacement(module.lessons);
    } else completeLesson(summary);
    void syncNow();
    setFinished(true);
  };

  const canContinue = isStepDone(stepState, step);
  const allDone = requiredSteps(lesson).every((i) => lessonState?.steps[i]?.done);
  const isLast = index === lesson.steps.length - 1;

  const copyContext = async () => {
    const text = buildAiContext({ module, lesson, stepIndex: index, step, ...context.current });
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: lesson.title, text });
        return;
      } catch {
        /* abgebrochen – auf Zwischenablage ausweichen */
      }
    }
    toast(
      (await copyText(text))
        ? 'Kontext kopiert – füge ihn in deine KI ein.'
        : 'Kopieren nicht möglich.',
    );
  };

  if (finished) return <LessonDone lesson={lesson} module={module} />;

  return (
    <div>
      <div class="player-head">
        <a
          class="icon-btn"
          href={`/m/${module.id}`}
          onClick={linkHandler(`/m/${module.id}`)}
          aria-label="Lektion schließen"
        >
          <CloseIcon />
        </a>
        <div class="bar" aria-label={`Schritt ${index + 1} von ${lesson.steps.length}`}>
          <span
            style={{ width: `${((index + (canContinue ? 1 : 0)) / lesson.steps.length) * 100}%` }}
          />
        </div>
        <span class="small muted" style={{ minWidth: '44px', textAlign: 'right' }}>
          {index + 1}/{lesson.steps.length}
        </span>
        <button
          class="icon-btn"
          onClick={copyContext}
          aria-label="Kontext für KI kopieren"
          title="Kontext für KI kopieren"
        >
          <AiIcon />
        </button>
      </div>
      <div class={`player-body ${SPLIT_TYPES.has(step.type) ? 'split' : ''}`}>
        {index === 0 && (
          <div class="stack" style={{ marginBottom: '14px' }}>
            <div class="small muted">
              Modul {module.number} · {checkpoint ? 'Checkpoint' : `${lesson.minutes} min`}
            </div>
            <h1 style={{ margin: 0 }}>{lesson.title}</h1>
            {checkpoint && (
              <div class="banner">
                Gewertet wird der <strong>erste Versuch</strong> ohne Hinweise. Ab{' '}
                {Math.round(CHECKPOINT_PASS * 100)} % gilt das Modul als gemeistert – auch als
                Einstufung, wenn du die Lektionen überspringen willst.
              </div>
            )}
            <div class="card small">
              <strong>Ziele</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '1.2em' }}>
                {lesson.goals.map((g, i) => (
                  <li key={i}>
                    <Html html={g} class="prose" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <StepView
          key={index}
          step={step}
          lesson={lesson}
          index={index}
          state={stepState}
          checkpoint={checkpoint}
          onUpdate={onUpdate}
          onContext={(c) => (context.current = c)}
          onSkipToExercise={checkpoint ? undefined : skipToExercise}
        />
      </div>
      <div class="player-foot">
        <button class="btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Zurück
        </button>
        {isLast ? (
          <button class="btn primary" disabled={!canContinue || !allDone} onClick={finish}>
            Abschließen
          </button>
        ) : (
          <button class="btn primary" disabled={!canContinue} onClick={() => setIndex(index + 1)}>
            {canContinue
              ? 'Weiter'
              : step.type === 'example'
                ? 'Erst ausführen'
                : 'Erst bearbeiten'}
          </button>
        )}
      </div>
    </div>
  );
}

function LessonDone({ lesson, module }: { lesson: Lesson; module: ModuleSummary }) {
  const progress = useProgress();
  const state = progress.lessons[lesson.id];
  const checkpoint = lesson.kind === 'checkpoint';
  const score = checkpoint ? checkpointScore(progress, lesson) : null;
  const passed = score !== null && score >= CHECKPOINT_PASS;
  const steps = Object.values(state?.steps ?? {});
  const scoredSteps = lesson.steps.filter((s) => s.type !== 'text' && s.type !== 'example');
  const firstTry = lesson.steps.filter(
    (s, i) => s.type !== 'text' && s.type !== 'example' && state?.steps[i]?.firstTryCorrect,
  ).length;
  const next = nextLesson(progress, course);
  return (
    <div class="page stack">
      <h1>
        {checkpoint
          ? passed
            ? 'Checkpoint bestanden!'
            : 'Checkpoint beendet'
          : 'Lektion abgeschlossen'}
      </h1>
      {score !== null && (
        <div class={`banner ${passed ? 'good' : 'warn'}`}>
          Ergebnis: <strong>{Math.round(score * 100)} %</strong> beim ersten Versuch.{' '}
          {passed
            ? `Modul ${module.number} ist gemeistert – übersprungene Lektionen wurden als erledigt markiert und landen in der Wiederholung.`
            : `Für das Meistern brauchst du ${Math.round(CHECKPOINT_PASS * 100)} %. Arbeite die Lektionen durch und versuche es dann noch einmal.`}
        </div>
      )}
      {!checkpoint && (
        <div class="card">
          <div>
            Beim ersten Versuch richtig: <strong>{firstTry}</strong> von {scoredSteps.length}{' '}
            Schritten
          </div>
          <div class="small muted" style={{ marginTop: '4px' }}>
            {lesson.cards.length} Wiederholungskarte{lesson.cards.length === 1 ? '' : 'n'} kommen in
            deine Wiederholung.
            {steps.some((s) => s.solutionShown && !s.passed)
              ? ' Aufgaben, bei denen du die Lösung angesehen hast, findest du unter „Wiederholen“.'
              : ''}
          </div>
        </div>
      )}
      <div class="row">
        {next && (
          <a
            class="btn primary"
            href={`/l/${next.lesson.id}`}
            onClick={linkHandler(`/l/${next.lesson.id}`)}
          >
            Weiter: {next.lesson.title}
          </a>
        )}
        <button class="btn" onClick={() => navigate(`/m/${module.id}`)}>
          Zum Modul
        </button>
      </div>
    </div>
  );
}
