import { useEffect, useRef } from 'preact/hooks';
import { readPalette } from '../viz/colors';
import { RobotRenderer, type ViewTheme } from './renderer';
import type { Sim } from './sim';

function themeOf(element: Element): ViewTheme {
  const palette = readPalette(element);
  const style = getComputedStyle(element);
  return {
    background: palette.bg!,
    floor: style.getPropertyValue('--surface-2').trim() || '#ccc',
    grid: style.getPropertyValue('--border').trim() || '#999',
    target: palette.bad!,
  };
}

export interface RobotCanvasProps {
  sim: Sim;
  label: string;
  target?: [number, number, number] | null;
  /** Wird vor jedem Bild aufgerufen; dt = vergangene Zeit in Sekunden (höchstens 0,1). */
  onFrame?: (dt: number) => void;
  /** Gibt die three.js-Ansicht heraus, z. B. für Kamerabilder. */
  onReady?: (renderer: RobotRenderer | null) => void;
}

export function RobotCanvas({ sim, label, target = null, onFrame, onReady }: RobotCanvasProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<RobotRenderer | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const renderer = new RobotRenderer(canvas.current!, sim, themeOf(wrap.current!));
    view.current = renderer;
    onReady?.(renderer);
    const observer = new ResizeObserver(() => {
      const width = wrap.current?.clientWidth ?? 320;
      const height = Math.round(Math.max(260, Math.min(480, width * 0.75)));
      canvas.current!.style.height = `${height}px`;
      renderer.resize(width, height);
    });
    observer.observe(wrap.current!);
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    const retheme = () => renderer.setTheme(themeOf(wrap.current!));
    scheme.addEventListener('change', retheme);

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frameRef.current?.(dt);
      renderer.render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      scheme.removeEventListener('change', retheme);
      onReady?.(null);
      renderer.dispose();
      view.current = null;
    };
  }, [sim]);

  useEffect(() => view.current?.setTarget(target), [target, sim]);

  return (
    <div class="robot-canvas" ref={wrap}>
      <canvas ref={canvas} role="img" aria-label={label} />
      <div class="robot-hint small">Ziehen: drehen · Zwei Finger/Mausrad: zoomen</div>
    </div>
  );
}
