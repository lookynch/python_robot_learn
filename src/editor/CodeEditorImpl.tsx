import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef, useState } from 'preact/hooks';
import { SymbolBar } from './SymbolBar';

const SMART_CHARS: Record<string, string> = {
  '“': '"',
  '”': '"',
  '„': '"',
  '‘': "'",
  '’': "'",
  '‚': "'",
  '–': '-',
  '—': '--',
  '…': '...',
};
const SMART_PATTERN = /[“”„‘’‚–—…]/;

const straightQuotes = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  let needsFix = false;
  tr.changes.iterChanges((_a, _b, _c, _d, inserted) => {
    if (SMART_PATTERN.test(inserted.toString())) needsFix = true;
  });
  if (!needsFix) return tr;
  const changes: { from: number; to: number; insert: string }[] = [];
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changes.push({
      from: fromA,
      to: toA,
      insert: inserted.toString().replace(/[“”„‘’‚–—…]/g, (c) => SMART_CHARS[c] ?? c),
    });
  });
  return [{ changes, selection: tr.selection, scrollIntoView: tr.scrollIntoView }];
});

const highlight = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword],
    color: '#ff7b72',
  },
  { tag: [tags.string, tags.special(tags.string)], color: '#a5d6ff' },
  { tag: [tags.number, tags.bool, tags.null], color: '#79c0ff' },
  { tag: tags.comment, color: '#8b949e', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#d2a8ff' },
  { tag: tags.definition(tags.variableName), color: '#ffa657' },
  { tag: tags.className, color: '#ffa657' },
]);

// Der Editor ist immer dunkel; ohne dark: true setzt CodeMirror einen schwarzen Cursor.
const darkTheme = EditorView.theme(
  {
    '.cm-content': { caretColor: '#4fb3ff' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#4fb3ff', borderLeftWidth: '2px' },
  },
  { dark: true },
);

const setErrorLine = StateEffect.define<number | null>();
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue;
      const line = effect.value;
      if (line === null || line < 1 || line > tr.state.doc.lines) return Decoration.none;
      const from = tr.state.doc.line(line).from;
      return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(from)]);
    }
    return tr.docChanged ? Decoration.none : deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function baseExtensions(
  onChange: (code: string) => void,
  onFocus: (focused: boolean) => void,
  readOnly: boolean,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    darkTheme,
    indentOnInput(),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    bracketMatching(),
    closeBrackets(),
    python(),
    syntaxHighlighting(highlight),
    straightQuotes,
    errorLineField,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorState.readOnly.of(readOnly),
    EditorView.contentAttributes.of({ 'aria-label': 'Python-Code' }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
      if (update.focusChanged) onFocus(update.view.hasFocus);
    }),
  ];
}

export interface CodeEditorProps {
  value: string;
  resetKey?: number;
  onChange: (code: string) => void;
  errorLine?: number | null;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  resetKey = 0,
  onChange,
  errorLine = null,
  readOnly = false,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const [focused, setFocused] = useState(false);
  changeRef.current = onChange;

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: baseExtensions((code) => changeRef.current(code), setFocused, readOnly),
      }),
    });
    return () => view.current?.destroy();
  }, [readOnly]);

  useEffect(() => {
    const v = view.current;
    if (v && resetKey > 0 && v.state.doc.toString() !== value)
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [resetKey]);

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  const insert = (text: string) => {
    const v = view.current;
    if (!v) return;
    v.dispatch(v.state.replaceSelection(text));
    v.focus();
  };

  const command = (name: 'indent' | 'dedent' | 'left' | 'right' | 'undo' | 'redo' | 'newline') => {
    const v = view.current;
    if (!v) return;
    if (name === 'indent') indentMore(v);
    else if (name === 'dedent') indentLess(v);
    else if (name === 'undo') undo(v);
    else if (name === 'redo') redo(v);
    else if (name === 'newline') insert('\n');
    else {
      const head = v.state.selection.main.head;
      const target = Math.max(0, Math.min(v.state.doc.length, head + (name === 'left' ? -1 : 1)));
      v.dispatch({ selection: { anchor: target } });
    }
    v.focus();
  };

  return (
    <div class="editor">
      <div ref={host} />
      {focused && !readOnly && <SymbolBar onInsert={insert} onCommand={command} />}
    </div>
  );
}
