import { lazyComponent } from '../components/Lazy';
import type { Robot3DSpec, Visual } from '../python/protocol';
import { PlotView } from './PlotView';
import { SceneView } from './SceneView';

const Robot3DVisual = lazyComponent<{ spec: Robot3DSpec }>(
  () => import('../robot/Robot3DVisual').then((m) => m.Robot3DVisual),
  ({ spec }) => (
    <div class="visual">
      {spec.title && <div class="title">{spec.title}</div>}
      <div class="empty small">3D-Ansicht wird geladen …</div>
    </div>
  ),
);

export function VisualList({ visuals }: { visuals: Visual[] }) {
  return (
    <div class="stack">
      {visuals.map((v, i) =>
        v.kind === 'scene' ? (
          <SceneView key={i} scene={v} />
        ) : v.kind === 'plot' ? (
          <PlotView key={i} plot={v} />
        ) : (
          <Robot3DVisual key={i} spec={v} />
        ),
      )}
    </div>
  );
}
