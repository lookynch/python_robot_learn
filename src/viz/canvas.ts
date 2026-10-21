import { useEffect, useRef, useState } from 'preact/hooks';

export function useCanvasSize(aspect: number, minHeight = 180, maxHeight = 440) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 320, height: 240 });
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const width = canvas.parentElement?.clientWidth ?? 320;
      const height = Math.max(minHeight, Math.min(maxHeight, width / aspect));
      setSize({ width, height });
    });
    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, [aspect, minHeight, maxHeight]);
  return { ref, ...size };
}

export function prepareContext(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}
