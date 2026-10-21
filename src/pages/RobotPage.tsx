import { lazyComponent } from '../components/Lazy';

const RobotLab = lazyComponent(
  () => import('../robot/RobotLab').then((m) => m.RobotLab),
  () => <div class="card empty">Roboterlabor wird geladen …</div>,
);

export function RobotPage() {
  return (
    <div class="page wide stack">
      <h1>Roboter</h1>
      <p class="muted" style={{ margin: 0 }}>
        SO-101: ein echter Open-Source-Roboterarm mit 5 Achsen und Greifer, hier mit Physik
        simuliert (MuJoCo). Bewege die Regler – oder steuere ihn aus Python mit{' '}
        <code>lab.arm3d</code> und <code>lab.so101</code> in der Spielwiese.
      </p>
      <RobotLab />
    </div>
  );
}
