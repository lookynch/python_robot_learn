import { explainError } from '../python/errors';
import type { PyError } from '../python/protocol';

export function ErrorBox({ error }: { error: PyError }) {
  if (error.type === 'LoadError')
    return (
      <div class="banner bad">
        <strong>Python konnte nicht geladen werden.</strong>
        <div class="small">
          Beim allerersten Start braucht die App eine Internetverbindung (≈ 9 MB). Danach
          funktioniert sie offline.
        </div>
      </div>
    );
  const info = explainError(error);
  return (
    <div class="banner bad" role="alert">
      <div>
        <strong>{info.title}</strong>
        {error.line !== null && <span class="muted"> – Zeile {error.line}</span>}
      </div>
      <div class="small" style={{ marginTop: '4px' }}>
        {info.explanation}
      </div>
      <div class="small" style={{ marginTop: '4px' }}>
        <strong>Tipp:</strong> {info.tip}
      </div>
      <details style={{ marginTop: '6px' }}>
        <summary class="small">Originalmeldung von Python</summary>
        <pre class="block" style={{ marginBottom: 0 }}>
          {error.traceback}
        </pre>
      </details>
    </div>
  );
}
