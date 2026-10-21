const TOKENS = [
  'fg',
  'muted',
  'accent',
  'good',
  'bad',
  'warn',
  'bg',
  'c1',
  'c2',
  'c3',
  'c4',
  'c5',
  'c6',
];

export type Palette = Record<string, string>;

export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const palette: Palette = {};
  for (const token of TOKENS) {
    const name = token === 'bg' ? '--surface' : `--${token}`;
    palette[token] = style.getPropertyValue(name).trim() || '#888';
  }
  return palette;
}

function heat(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const stops = [
    [33, 102, 172],
    [103, 169, 207],
    [247, 247, 247],
    [239, 138, 98],
    [178, 24, 43],
  ];
  const pos = x * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const [a, b] = [stops[i]!, stops[i + 1]!];
  const mix = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * f);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

export function resolveColor(
  color: string | null | undefined,
  palette: Palette,
  fallback = 'fg',
): string {
  if (!color) return palette[fallback] ?? '#888';
  if (color.startsWith('heat:')) return heat(Number(color.slice(5)));
  return palette[color] ?? color;
}

export function seriesColor(index: number, palette: Palette): string {
  return palette[`c${(index % 6) + 1}`] ?? '#888';
}
