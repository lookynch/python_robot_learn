import { useEffect, useRef, useState } from 'preact/hooks';
import { JointSliders } from './JointSliders';
import { RobotCanvas } from './RobotCanvas';
import { HOME, REST, Sim } from './sim';

const POSES: { name: string; q: number[] }[] = [
  { name: 'Bereit', q: HOME },
  { name: 'Ruhestellung', q: REST },
  { name: 'Gestreckt (alle 0)', q: [0, 0, 0, 0, 0, 0.4] },
];

export function useSim(): { sim: Sim | null; error: string | null } {
  const [sim, setSim] = useState<Sim | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let created: Sim | null = null;
    let cancelled = false;
    Sim.create().then(
      (s) => {
        if (cancelled) s.dispose();
        else setSim((created = s));
      },
      (e: unknown) => setError(String(e)),
    );
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, []);
  return { sim, error };
}

export function RobotLab() {
  const { sim, error } = useSim();
  const [targets, setTargets] = useState<number[]>(HOME);
  const [actual, setActual] = useState<number[]>(HOME);
  const [tool, setTool] = useState<[number, number, number]>([0, 0, 0]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const readoutAt = useRef(0);

  if (error) return <div class="banner bad">Simulation konnte nicht geladen werden: {error}</div>;
  if (!sim)
    return (
      <div class="card empty">Physik und Robotermodell werden geladen … (einmalig ca. 4 MB)</div>
    );

  const onFrame = (dt: number) => {
    sim.setTargets(targetsRef.current);
    sim.step(dt);
    const now = performance.now();
    if (now - readoutAt.current > 100) {
      readoutAt.current = now;
      setActual(sim.joints());
      setTool(sim.toolPosition());
    }
  };

  return (
    <div class="robot-lab">
      <RobotCanvas sim={sim} label="SO-101 Roboterarm in 3D" onFrame={onFrame} />
      <div class="stack">
        <div class="row">
          {POSES.map((pose) => (
            <button key={pose.name} class="btn small" onClick={() => setTargets(pose.q)}>
              {pose.name}
            </button>
          ))}
          <button
            class="btn small ghost"
            onClick={() => {
              sim.reset();
              setTargets(HOME);
            }}
          >
            Zurücksetzen
          </button>
        </div>
        <div class="small muted" aria-live="polite">
          Greiferspitze: x {(tool[0] * 100).toFixed(1)} cm · y {(tool[1] * 100).toFixed(1)} cm · z{' '}
          {(tool[2] * 100).toFixed(1)} cm
        </div>
        <JointSliders
          sim={sim}
          targets={targets}
          actual={actual}
          onChange={(index, value) =>
            setTargets((current) => current.map((v, i) => (i === index ? value : v)))
          }
        />
        <p class="small muted" style={{ margin: 0 }}>
          Wie beim echten SO-101 gibst du jedem Servo einen <strong>Sollwinkel</strong> vor. Der
          Servo regelt selbst dorthin – mit begrenzter Kraft. Deshalb hinkt „Ist“ kurz hinterher.
        </p>
      </div>
    </div>
  );
}
