import type { ComponentChildren } from 'preact';
import { useRunner, useRuntime } from '../python/useRunner';
import { VisualList } from '../viz/VisualList';
import { ErrorBox } from './ErrorBox';
import { Terminal } from './Terminal';

export type Runner = ReturnType<typeof useRunner>;

export interface RunPanelProps {
  runner: Runner;
  onRun?: () => void;
  runLabel?: string;
  actions?: ComponentChildren;
  heavy?: boolean;
  showTests?: boolean;
  placeholder?: string;
}

export function RuntimeStatus() {
  const runtime = useRuntime();
  if (runtime.state === 'ready' || runtime.state === 'running') return null;
  return <span class={`status ${runtime.state === 'failed' ? 'bad' : ''}`}>{runtime.status}</span>;
}

export function RunPanel({
  runner,
  onRun,
  runLabel = 'Ausführen',
  actions,
  heavy,
  showTests = true,
  placeholder,
}: RunPanelProps) {
  const result = runner.result;
  const tests = showTests ? result?.tests : undefined;
  const passed = tests?.filter((t) => t.passed).length ?? 0;
  return (
    <div class="stack">
      <div class="runbar">
        {onRun &&
          (runner.running ? (
            <button class="btn danger" onClick={runner.stop}>
              ■ Stopp
            </button>
          ) : (
            <button class="btn primary" onClick={onRun}>
              ▶ {runLabel}
            </button>
          ))}
        {actions}
        <span class="spacer" />
        <RuntimeStatus />
      </div>
      {heavy && runner.running && (
        <div class="small muted">
          Rechenintensiv – auf dem Handy kann das 10–20 Sekunden dauern.
        </div>
      )}
      {runner.progress && (
        <div>
          <div class="small muted">{runner.progress.text}</div>
          <div class="progressbar">
            <span style={{ width: `${Math.round(runner.progress.fraction * 100)}%` }} />
          </div>
        </div>
      )}
      {result && result.scenes.length > 0 && <VisualList visuals={result.scenes} />}
      <Terminal
        chunks={runner.chunks}
        waitingForInput={runner.waitingForInput}
        onInput={runner.submitInput}
        placeholder={placeholder}
      />
      {result?.error && <ErrorBox error={result.error} />}
      {tests && tests.length > 0 && (
        <div class={`banner ${passed === tests.length ? 'good' : 'bad'}`}>
          <div style={{ marginBottom: '6px' }}>
            <strong>
              {passed === tests.length
                ? 'Alle Tests bestanden'
                : `${passed} von ${tests.length} Tests bestanden`}
            </strong>
          </div>
          <div class="tests">
            {tests.map((t) => (
              <div class={`test ${t.passed ? 'passed' : ''}`} key={t.name}>
                <span class="mark">{t.passed ? '✓' : '✗'}</span>
                <span>
                  <strong>{t.name}</strong>
                  {t.message && <div class="small">{t.message}</div>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
