import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Primitive, SceneSpec } from '../python/protocol';
import { prepareContext, useCanvasSize } from './canvas';
import { readPalette, resolveColor, type Palette } from './colors';

type Bounds = [number, number, number, number];

function primitiveExtent(p: Primitive): [number, number][] {
  switch (p.t) {
    case 'line':
    case 'poly':
      return p.p;
    case 'circle':
      return [
        [p.x - p.r, p.y - p.r],
        [p.x + p.r, p.y + p.r],
      ];
    case 'rect':
      return [
        [p.x, p.y],
        [p.x + p.w, p.y + p.h],
      ];
    case 'arrow':
      return [
        [p.x, p.y],
        [p.x + p.dx, p.y + p.dy],
      ];
    case 'text':
      return [[p.x, p.y]];
  }
}

function autoBounds(scene: SceneSpec): Bounds {
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of [...scene.static, ...scene.frames.flat()]) {
    for (const [x, y] of primitiveExtent(p)) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0)) return [-1, 1, -1, 1];
  const padX = (x1 - x0 || 1) * 0.08;
  const padY = (y1 - y0 || 1) * 0.08;
  return [x0 - padX, x1 + padX, y0 - padY, y1 + padY];
}

function draw(
  ctx: CanvasRenderingContext2D,
  prims: Primitive[],
  toPx: (x: number, y: number) => [number, number],
  scale: number,
  palette: Palette,
) {
  for (const p of prims) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const stroke = resolveColor(p.c, palette);
    ctx.strokeStyle = stroke;
    if ('lw' in p) ctx.lineWidth = p.lw;
    switch (p.t) {
      case 'line': {
        if (p.d) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        p.p.forEach(([x, y], i) => (i ? ctx.lineTo(...toPx(x, y)) : ctx.moveTo(...toPx(x, y))));
        ctx.stroke();
        break;
      }
      case 'poly': {
        ctx.beginPath();
        p.p.forEach(([x, y], i) => (i ? ctx.lineTo(...toPx(x, y)) : ctx.moveTo(...toPx(x, y))));
        ctx.closePath();
        if (p.f) {
          ctx.fillStyle = resolveColor(p.f, palette);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }
      case 'circle': {
        ctx.beginPath();
        ctx.arc(...toPx(p.x, p.y), Math.max(1, p.r * scale), 0, Math.PI * 2);
        if (p.f) {
          ctx.fillStyle = resolveColor(p.f, palette);
          ctx.fill();
        }
        ctx.stroke();
        break;
      }
      case 'rect': {
        const [x, y] = toPx(p.x, p.y + p.h);
        if (p.f) {
          ctx.fillStyle = resolveColor(p.f, palette);
          ctx.fillRect(x, y, p.w * scale, p.h * scale);
        }
        ctx.strokeRect(x, y, p.w * scale, p.h * scale);
        break;
      }
      case 'arrow': {
        const [ax, ay] = toPx(p.x, p.y);
        const [bx, by] = toPx(p.x + p.dx, p.y + p.dy);
        const angle = Math.atan2(by - ay, bx - ax);
        const head = Math.min(14, Math.hypot(bx - ax, by - ay) * 0.4) + p.lw;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - head * Math.cos(angle - 0.4), by - head * Math.sin(angle - 0.4));
        ctx.lineTo(bx - head * Math.cos(angle + 0.4), by - head * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = stroke;
        ctx.fill();
        break;
      }
      case 'text': {
        ctx.fillStyle = stroke;
        ctx.font = `${p.size}px ${getComputedStyle(document.body).fontFamily}`;
        ctx.textAlign = p.a === 'l' ? 'left' : p.a === 'r' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.s, ...toPx(p.x, p.y));
        break;
      }
    }
    ctx.restore();
  }
}

export function SceneView({ scene }: { scene: SceneSpec }) {
  const bounds = useMemo<Bounds>(() => scene.bounds ?? autoBounds(scene), [scene]);
  const aspect = (bounds[1] - bounds[0]) / (bounds[3] - bounds[2] || 1);
  const { ref, width, height } = useCanvasSize(Math.max(0.6, Math.min(2.4, aspect)), 200, 420);
  const frames = scene.frames.length;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(frames > 1);
  const [speed, setSpeed] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    setFrame(0);
    setPlaying(scene.frames.length > 1);
  }, [scene]);

  useEffect(() => {
    if (!playing || frames < 2) return;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += ((now - last) / 1000) * scene.fps * speed;
      last = now;
      if (acc >= 1) {
        const steps = Math.floor(acc);
        acc -= steps;
        setFrame((f) => {
          const next = f + steps;
          if (next >= frames - 1) {
            setPlaying(false);
            return frames - 1;
          }
          return next;
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, frames, scene.fps, speed]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = prepareContext(canvas, width, height);
    const palette = readPalette(canvas);
    const [x0, x1, y0, y1] = bounds;
    const scale = Math.min(width / (x1 - x0 || 1), height / (y1 - y0 || 1));
    const offX = (width - (x1 - x0) * scale) / 2;
    const offY = (height - (y1 - y0) * scale) / 2;
    const toPx = (x: number, y: number): [number, number] => [
      offX + (x - x0) * scale,
      height - offY - (y - y0) * scale,
    ];
    draw(ctx, scene.static, toPx, scale, palette);
    draw(ctx, scene.frames[Math.min(frame, frames - 1)] ?? [], toPx, scale, palette);
  }, [scene, frame, width, height, bounds]);

  const caption = scene.captions?.[frame] ?? null;
  const restart = () => {
    if (frame >= frames - 1) setFrame(0);
    setPlaying(!playing);
  };

  return (
    <div class="visual">
      {scene.title && <div class="title">{scene.title}</div>}
      <canvas ref={ref} role="img" aria-label={scene.title ?? 'Animation'} />
      {scene.captions && <div class="caption">{caption ?? ''}</div>}
      {frames > 1 && (
        <div class="anim-controls">
          <button class="icon-btn" onClick={restart} aria-label={playing ? 'Pause' : 'Abspielen'}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={frames - 1}
            value={frame}
            aria-label="Zeitpunkt"
            onInput={(e) => {
              setPlaying(false);
              setFrame(Number((e.target as HTMLInputElement).value));
            }}
          />
          <button
            class="btn small ghost"
            onClick={() => setSpeed(speed >= 4 ? 0.25 : speed * 2)}
            aria-label="Geschwindigkeit"
          >
            {speed}×
          </button>
        </div>
      )}
    </div>
  );
}
