import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PlotSpec } from '../python/protocol';
import { prepareContext, useCanvasSize } from './canvas';
import { readPalette, resolveColor, seriesColor } from './colors';

function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (lo === hi) return [lo];
  const span = hi - lo;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step)
    ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return ticks;
}

function formatTick(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e5 || abs < 1e-3) return v.toExponential(0);
  return Number(v.toPrecision(4)).toString();
}

export function PlotView({ plot }: { plot: PlotSpec }) {
  const { ref, width, height } = useCanvasSize(1.6, 200, 360);
  const [cursor, setCursor] = useState<number | null>(null);
  const transformY = (y: number) => (plot.logy ? Math.log10(Math.max(y, 1e-12)) : y);

  const range = useMemo(() => {
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const s of plot.series) {
      for (let i = 0; i < s.x.length; i++) {
        x0 = Math.min(x0, s.x[i]!);
        x1 = Math.max(x1, s.x[i]!);
        y0 = Math.min(y0, transformY(s.y[i]!));
        y1 = Math.max(y1, transformY(s.y[i]!));
      }
    }
    for (const h of plot.hlines) {
      y0 = Math.min(y0, transformY(h.y));
      y1 = Math.max(y1, transformY(h.y));
    }
    if (!Number.isFinite(x0)) return [0, 1, 0, 1];
    if (x0 === x1) [x0, x1] = [x0 - 1, x1 + 1];
    if (y0 === y1) [y0, y1] = [y0 - 1, y1 + 1];
    const pad = (y1 - y0) * 0.06;
    return [x0, x1, y0 - pad, y1 + pad];
  }, [plot]);

  const margin = { left: 52, right: 12, top: 12, bottom: plot.xlabel ? 40 : 28 };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = prepareContext(canvas, width, height);
    const palette = readPalette(canvas);
    const [x0, x1, y0, y1] = range as [number, number, number, number];
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const px = (x: number) => margin.left + ((x - x0) / (x1 - x0)) * w;
    const py = (y: number) => margin.top + h - ((transformY(y) - y0) / (y1 - y0)) * h;
    const font = getComputedStyle(document.body).fontFamily;

    ctx.font = `11px ${font}`;
    ctx.fillStyle = palette.muted!;
    ctx.strokeStyle = palette.muted!;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    const yTicks = niceTicks(y0, y1);
    for (const t of yTicks) {
      const y = margin.top + h - ((t - y0) / (y1 - y0)) * h;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of yTicks) {
      const y = margin.top + h - ((t - y0) / (y1 - y0)) * h;
      ctx.fillText(plot.logy ? `1e${formatTick(t)}` : formatTick(t), margin.left - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of niceTicks(x0, x1, Math.max(3, Math.floor(w / 70))))
      ctx.fillText(formatTick(t), px(t), margin.top + h + 6);
    if (plot.xlabel) ctx.fillText(plot.xlabel, margin.left + w / 2, margin.top + h + 22);
    if (plot.ylabel) {
      ctx.save();
      ctx.translate(12, margin.top + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'middle';
      ctx.fillText(plot.ylabel, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = palette.muted!;
    ctx.strokeRect(margin.left, margin.top, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, w, h);
    ctx.clip();
    for (const line of plot.hlines) {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = palette.warn!;
      ctx.beginPath();
      ctx.moveTo(margin.left, py(line.y));
      ctx.lineTo(margin.left + w, py(line.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    plot.series.forEach((s, i) => {
      const color = s.c ? resolveColor(s.c, palette) : seriesColor(i, palette);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      if (s.mode === 'bar') {
        const step = s.x.length > 1 ? Math.abs(px(s.x[1]!) - px(s.x[0]!)) : w / 10;
        const base = py(plot.logy ? Math.max(1e-12, 10 ** y0) : Math.max(y0, 0));
        ctx.globalAlpha = 0.75;
        for (let k = 0; k < s.x.length; k++) {
          const top = py(s.y[k]!);
          ctx.fillRect(
            px(s.x[k]!) - step * 0.42,
            Math.min(top, base),
            step * 0.84,
            Math.abs(base - top),
          );
        }
        ctx.globalAlpha = 1;
      } else if (s.mode === 'scatter') {
        for (let k = 0; k < s.x.length; k++) {
          ctx.beginPath();
          ctx.arc(px(s.x[k]!), py(s.y[k]!), 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        for (let k = 0; k < s.x.length; k++)
          (k ? ctx.lineTo : ctx.moveTo).call(ctx, px(s.x[k]!), py(s.y[k]!));
        ctx.stroke();
      }
    });
    if (cursor !== null) {
      ctx.strokeStyle = palette.fg!;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(px(cursor), margin.top);
      ctx.lineTo(px(cursor), margin.top + h);
      ctx.stroke();
    }
    ctx.restore();
  }, [plot, width, height, range, cursor]);

  const readout = useMemo(() => {
    if (cursor === null) return null;
    return plot.series
      .map((s, i) => {
        if (!s.x.length) return null;
        let best = 0;
        for (let k = 1; k < s.x.length; k++)
          if (Math.abs(s.x[k]! - cursor) < Math.abs(s.x[best]! - cursor)) best = k;
        return `${s.label ?? `Reihe ${i + 1}`}: x=${formatTick(s.x[best]!)}, y=${formatTick(s.y[best]!)}`;
      })
      .filter(Boolean)
      .join(' · ');
  }, [cursor, plot]);

  const onPointer = (event: PointerEvent) => {
    const canvas = ref.current!;
    const rect = canvas.getBoundingClientRect();
    const [x0, x1] = range as [number, number];
    const w = rect.width - margin.left - margin.right;
    const x = x0 + ((event.clientX - rect.left - margin.left) / w) * (x1 - x0);
    setCursor(Math.max(x0, Math.min(x1, x)));
  };

  return (
    <div class="visual">
      {plot.title && <div class="title">{plot.title}</div>}
      <canvas
        ref={ref}
        role="img"
        aria-label={plot.title ?? 'Diagramm'}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setCursor(null)}
      />
      <div class="caption">
        {readout ??
          plot.series.map((s, i) =>
            s.label ? (
              <span key={i} style={{ marginRight: '12px' }}>
                <span style={{ color: `var(--c${(i % 6) + 1})` }}>━</span> {s.label}
              </span>
            ) : null,
          )}
      </div>
    </div>
  );
}
