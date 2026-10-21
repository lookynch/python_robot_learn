import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { ProgressInfo, RunRequest, RunResult } from './protocol';
import { python, type RuntimeSnapshot } from './runtime';

export interface OutputChunk {
  kind: 'out' | 'err' | 'sys';
  text: string;
}

export interface RunnerState {
  chunks: OutputChunk[];
  running: boolean;
  waitingForInput: boolean;
  result: RunResult | null;
  progress: ProgressInfo | null;
}

export interface RunOptions {
  stdin?: string[];
  tests?: RunRequest['tests'];
  trace?: number;
  interactive?: boolean;
}

const initial: RunnerState = {
  chunks: [],
  running: false,
  waitingForInput: false,
  result: null,
  progress: null,
};

export function useRuntime(): RuntimeSnapshot {
  const [snapshot, setSnapshot] = useState(python.current);
  useEffect(() => python.subscribe(setSnapshot), []);
  return snapshot;
}

export function useRunner() {
  const [state, setState] = useState<RunnerState>(initial);
  const pending = useRef<{
    code: string;
    options: RunOptions;
    seed: number;
    inputs: string[];
  } | null>(null);
  const generation = useRef(0);

  const execute = useCallback(
    async (code: string, options: RunOptions, seed: number, inputs: string[]) => {
      const gen = ++generation.current;
      pending.current = { code, options, seed, inputs };
      setState({ ...initial, running: true });
      const append = (kind: OutputChunk['kind']) => (text: string) =>
        gen === generation.current &&
        setState((s) => {
          const last = s.chunks[s.chunks.length - 1];
          const chunks =
            last && last.kind === kind
              ? [...s.chunks.slice(0, -1), { kind, text: last.text + text }]
              : [...s.chunks, { kind, text }];
          return { ...s, chunks };
        });
      const result = await python.run(
        { code, seed, stdin: inputs, tests: options.tests, trace: options.trace },
        {
          onStdout: append('out'),
          onStderr: append('err'),
          onProgress: (progress) =>
            gen === generation.current && setState((s) => ({ ...s, progress })),
        },
      );
      if (gen !== generation.current) return result;
      const waitingForInput = result.status === 'needs_input' && Boolean(options.interactive);
      const notes: OutputChunk[] = [];
      if (result.status === 'stopped')
        notes.push({ kind: 'sys', text: '\n[gestoppt – Python startet neu]' });
      if (result.status === 'output_limit')
        notes.push({ kind: 'sys', text: '\n[Ausgabe abgeschnitten: mehr als 200 000 Zeichen]' });
      if (result.status === 'needs_input' && !options.interactive)
        notes.push({
          kind: 'sys',
          text: '\n[Programm wartet auf eine Eingabe, die die Aufgabe nicht vorsieht]',
        });
      setState((s) => ({
        ...s,
        chunks: [...s.chunks, ...notes],
        running: false,
        waitingForInput,
        result,
        progress: null,
      }));
      return result;
    },
    [],
  );

  const run = useCallback(
    (code: string, options: RunOptions = {}) =>
      execute(code, options, Math.floor(Math.random() * 2 ** 31), options.stdin ?? []),
    [execute],
  );

  const submitInput = useCallback(
    (value: string) => {
      const last = pending.current;
      if (!last) return;
      void execute(last.code, last.options, last.seed, [...last.inputs, value]);
    },
    [execute],
  );

  const stop = useCallback(() => python.stop(), []);
  const clear = useCallback(() => {
    generation.current++;
    setState(initial);
  }, []);

  return { ...state, run, submitInput, stop, clear };
}
