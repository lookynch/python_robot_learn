import type { Visual } from '../python/protocol';
import { PlotView } from './PlotView';
import { SceneView } from './SceneView';

export function VisualList({ visuals }: { visuals: Visual[] }) {
  return (
    <div class="stack">
      {visuals.map((v, i) =>
        v.kind === 'scene' ? <SceneView key={i} scene={v} /> : <PlotView key={i} plot={v} />,
      )}
    </div>
  );
}
