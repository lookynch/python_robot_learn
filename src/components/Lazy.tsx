import type { ComponentType, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Lädt eine Komponente erst bei Bedarf (eigener Chunk) und zeigt bis dahin `fallback`. */
export function lazyComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: (props: P) => JSX.Element,
): ComponentType<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  return function Lazy(props: P) {
    const [Component, setComponent] = useState(() => loaded);
    const [failed, setFailed] = useState<string | null>(null);
    useEffect(() => {
      if (Component) return;
      pending ??= load().then((c) => (loaded = c));
      pending.then(
        (c) => setComponent(() => c),
        (error: unknown) => {
          pending = null;
          setFailed(String(error));
        },
      );
    }, []);
    if (failed)
      return <div class="banner bad small">Laden fehlgeschlagen – bist du offline? ({failed})</div>;
    return Component ? <Component {...props} /> : fallback(props);
  };
}
