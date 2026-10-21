import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';
import { CodeView } from '../components/CodeView';
import type { CodeEditorProps } from './CodeEditorImpl';

export type { CodeEditorProps };

let loaded: ComponentType<CodeEditorProps> | null = null;
const loading = () => import('./CodeEditorImpl').then((m) => (loaded = m.CodeEditor));

export function CodeEditor(props: CodeEditorProps) {
  const [Editor, setEditor] = useState(() => loaded);
  useEffect(() => {
    if (!Editor) void loading().then((c) => setEditor(() => c));
  }, []);
  if (!Editor) return <CodeView code={props.value || ' '} />;
  return <Editor {...props} />;
}
