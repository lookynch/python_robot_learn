import { useEffect, useState } from 'preact/hooks';

type Command = 'indent' | 'dedent' | 'left' | 'right' | 'undo' | 'redo' | 'newline';

const SYMBOLS = [
  ':',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '=',
  '"',
  "'",
  ',',
  '.',
  '+',
  '-',
  '*',
  '/',
  '<',
  '>',
  '_',
  '#',
  '%',
  '!',
];

function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return offset;
}

export function SymbolBar({
  onInsert,
  onCommand,
}: {
  onInsert: (text: string) => void;
  onCommand: (c: Command) => void;
}) {
  const offset = useKeyboardOffset();
  const keep = (event: Event) => event.preventDefault();
  const tool = (label: string, title: string, action: () => void, wide = false) => (
    <button
      type="button"
      class={wide ? 'wide' : ''}
      title={title}
      aria-label={title}
      onPointerDown={keep}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <div class="symbolbar" style={{ bottom: `${offset}px` }} onPointerDown={keep}>
      {tool('⇥', 'Einrücken', () => onCommand('indent'), true)}
      {tool('⇤', 'Ausrücken', () => onCommand('dedent'), true)}
      {SYMBOLS.map((s) => tool(s, s, () => onInsert(s)))}
      {tool('←', 'Cursor links', () => onCommand('left'))}
      {tool('→', 'Cursor rechts', () => onCommand('right'))}
      {tool('↶', 'Rückgängig', () => onCommand('undo'))}
      {tool('↷', 'Wiederholen', () => onCommand('redo'))}
    </div>
  );
}
