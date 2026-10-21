import type { JSX } from 'preact';

const KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(
    ' ',
  ),
);
const TOKEN =
  /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfu]{0,2}"(?:\\.|[^"\\])*"|[rbfu]{0,2}'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|([A-Za-z_][A-Za-z0-9_]*)/gm;

export function highlightLine(line: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(<span>{line.slice(last, index)}</span>);
    const [text, comment, string, number, fn, word] = match;
    let cls = '';
    if (comment) cls = 'tok-com';
    else if (string) cls = 'tok-str';
    else if (number) cls = 'tok-num';
    else if (fn) cls = KEYWORDS.has(fn) ? 'tok-kw' : 'tok-fn';
    else if (word && KEYWORDS.has(word)) cls = 'tok-kw';
    out.push(cls ? <span class={cls}>{text}</span> : <span>{text}</span>);
    last = index + text.length;
  }
  if (last < line.length) out.push(<span>{line.slice(last)}</span>);
  return out;
}

export interface Subgoal {
  lines: number | [number, number];
  label: string;
}

export interface CodeViewProps {
  code: string;
  highlight?: number | null;
  errorLine?: number | null;
  subgoals?: Subgoal[];
  renderLine?: (line: string, index: number) => JSX.Element | JSX.Element[];
}

export function CodeView({
  code,
  highlight = null,
  errorLine = null,
  subgoals,
  renderLine,
}: CodeViewProps) {
  const lines = code.replace(/\n$/, '').split('\n');
  const startOf = new Map<number, Subgoal>();
  const inGoal = new Set<number>();
  for (const goal of subgoals ?? []) {
    const [from, to] = typeof goal.lines === 'number' ? [goal.lines, goal.lines] : goal.lines;
    startOf.set(from, goal);
    for (let i = from; i <= to; i++) inGoal.add(i);
  }
  const rows: JSX.Element[] = [];
  lines.forEach((line, i) => {
    const n = i + 1;
    const goal = startOf.get(n);
    if (goal)
      rows.push(<div class="subgoal-label" dangerouslySetInnerHTML={{ __html: goal.label }} />);
    const cls = [
      'ln',
      n === highlight ? 'hl' : '',
      n === errorLine ? 'err' : '',
      inGoal.has(n) ? 'subgoal-block' : '',
    ].join(' ');
    rows.push(
      <div class={cls} data-line={n}>
        <span class="num">{n}</span>
        <span class="src">{renderLine ? renderLine(line, i) : highlightLine(line)}</span>
      </div>,
    );
  });
  return <div class="codeview">{rows}</div>;
}
