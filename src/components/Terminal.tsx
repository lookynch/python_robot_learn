import { useEffect, useRef, useState } from 'preact/hooks';
import type { OutputChunk } from '../python/useRunner';

export interface TerminalProps {
  chunks: OutputChunk[];
  waitingForInput: boolean;
  onInput: (value: string) => void;
  placeholder?: string;
}

export function Terminal({
  chunks,
  waitingForInput,
  onInput,
  placeholder = 'Ausgabe erscheint hier.',
}: TerminalProps) {
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chunks]);

  useEffect(() => {
    if (waitingForInput) field.current?.focus({ preventScroll: true });
  }, [waitingForInput]);

  const submit = (event: Event) => {
    event.preventDefault();
    onInput(value);
    setValue('');
  };

  return (
    <div>
      <div class="terminal" ref={box} role="log" aria-live="polite" aria-label="Terminal">
        {chunks.length === 0 && !waitingForInput ? (
          <span class="sys">{placeholder}</span>
        ) : (
          chunks.map((c, i) => (
            <span key={i} class={c.kind === 'out' ? '' : c.kind === 'err' ? 'stderr' : 'sys'}>
              {c.text}
            </span>
          ))
        )}
      </div>
      {waitingForInput && (
        <form class="terminal-input" onSubmit={submit}>
          <input
            ref={field}
            value={value}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
            placeholder="Eingabe tippen …"
            autocapitalize="off"
            autocomplete="off"
            spellcheck={false}
            enterkeyhint="send"
            aria-label="Eingabe für input()"
          />
          <button class="btn primary small" type="submit">
            Enter
          </button>
        </form>
      )}
    </div>
  );
}
