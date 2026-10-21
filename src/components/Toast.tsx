import { useEffect, useState } from 'preact/hooks';

let show: ((text: string) => void) | null = null;

export function toast(text: string) {
  show?.(text);
}

export function ToastHost() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    show = (t) => {
      setText(t);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 2600);
    };
    return () => {
      show = null;
    };
  }, []);
  return text ? (
    <div class="toast" role="status">
      {text}
    </div>
  ) : null;
}
