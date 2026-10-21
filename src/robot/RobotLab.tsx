import { useEffect, useRef, useState } from 'preact/hooks';
import { CameraRig, type CameraName, type Frame } from './camera';
import { CameraPanel, captureSafely } from './CameraPanel';
import { LabController } from './controller';
import { JointSliders } from './JointSliders';
import { RobotCanvas } from './RobotCanvas';
import { HOME, REST, Sim, type Vec3 } from './sim';
import { taskById, TASKS, type TaskId } from './tasks';
import { TeleopPad } from './TeleopPad';

const POSES: { name: string; q: number[] }[] = [
  { name: 'Bereit', q: HOME },
  { name: 'Ruhestellung', q: REST },
  { name: 'Gestreckt (alle 0)', q: [0, 0, 0, 0, 0, 0.4] },
];

/** Lädt eine Sim für Aufgabe + Startlage und baut den Regel-Controller darum. */
export function useLab(taskId: TaskId, seed: number) {
  const [lab, setLab] = useState<LabController | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let created: Sim | null = null;
    let cancelled = false;
    const task = taskById(taskId);
    Sim.create(task.scene(seed)).then(
      (sim) => {
        if (cancelled) return sim.dispose();
        created = sim;
        setLab(new LabController(sim, task));
      },
      (e: unknown) => setError(String(e)),
    );
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [taskId, seed]);
  return { lab, error };
}

interface Readout {
  joints: number[];
  targets: number[];
  tool: Vec3;
  progress: number;
  success: number | null;
  phase: string | null;
  time: number;
}

export function readoutOf(lab: LabController): Readout {
  return {
    joints: lab.sim.joints(),
    targets: [...lab.targets],
    tool: lab.sim.toolPosition(),
    progress: lab.task.progress(lab.sim),
    success: lab.successTime,
    phase: lab.scriptPhase,
    time: lab.sim.time,
  };
}

export function RobotLab() {
  const [taskId, setTaskId] = useState<TaskId>('heben');
  const [seed, setSeed] = useState(1);
  const { lab, error } = useLab(taskId, seed);
  const [mode, setMode] = useState<'cartesian' | 'joints'>('cartesian');
  const [camera, setCamera] = useState<CameraName>('wrist_cam');
  const [frame, setFrame] = useState<Frame | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);
  const rig = useRef<CameraRig | null>(null);
  const lastReadout = useRef(0);
  const lastFrame = useRef(0);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  useEffect(() => lab?.teleop.attach(), [lab]);

  if (error) return <div class="banner bad">Simulation konnte nicht geladen werden: {error}</div>;
  if (!lab)
    return (
      <div class="card empty">Physik und Robotermodell werden geladen … (einmalig ca. 4 MB)</div>
    );

  const onFrame = (dt: number) => {
    lab.tick(dt);
    const now = performance.now();
    if (now - lastReadout.current > 100) {
      lastReadout.current = now;
      setReadout(readoutOf(lab));
    }
    if (now - lastFrame.current > 200) {
      lastFrame.current = now;
      setFrame(captureSafely(rig.current, cameraRef.current));
    }
  };

  const task = lab.task;
  const r = readout;
  const done = r?.success != null;
  const cm = (v: number) => (v * 100).toFixed(1);
  return (
    <div class="robot-lab">
      <div class="stack">
        <div class="task-bar">
          <div class="row" role="group" aria-label="Aufgabe">
            {TASKS.map((t) => (
              <button
                key={t.id}
                class={`btn small ${t.id === taskId ? 'primary' : ''}`}
                aria-pressed={t.id === taskId}
                onClick={() => setTaskId(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <p class="small" style={{ margin: '6px 0 0' }}>
            {task.goal}
          </p>
          {task.id !== 'frei' && (
            <div class="row" style={{ marginTop: '6px' }}>
              <div class={`bar ${done ? 'good' : ''}`} style={{ flex: 1 }}>
                <span style={{ width: `${Math.round((r?.progress ?? 0) * 100)}%` }} />
              </div>
              {done ? (
                <span class="pill good">Geschafft nach {r!.success!.toFixed(1)} s</span>
              ) : (
                <span class="small muted">{r ? `${r.time.toFixed(1)} s` : ''}</span>
              )}
            </div>
          )}
        </div>
        <RobotCanvas
          sim={lab.sim}
          label="SO-101 Roboterarm in 3D"
          onFrame={onFrame}
          onReady={(renderer) => {
            rig.current?.dispose();
            rig.current = renderer ? new CameraRig(lab.sim, renderer) : null;
          }}
        />
        <div class="row">
          <button class="btn small" onClick={() => lab.reset()}>
            Zurücksetzen
          </button>
          <button class="btn small" onClick={() => setSeed(seed + 1)}>
            Neue Startlage
          </button>
          {task.id !== 'frei' && (
            <button class="btn small" onClick={() => lab.demonstrate()}>
              Vorführen
            </button>
          )}
          {r?.phase && <span class="pill accent">Vorführung: {r.phase}</span>}
        </div>
      </div>
      <div class="stack">
        <div class="tabs" role="tablist">
          <button
            role="tab"
            class={mode === 'cartesian' ? 'active' : ''}
            aria-selected={mode === 'cartesian'}
            onClick={() => setMode('cartesian')}
          >
            Greifer bewegen
          </button>
          <button
            role="tab"
            class={mode === 'joints' ? 'active' : ''}
            aria-selected={mode === 'joints'}
            onClick={() => setMode('joints')}
          >
            Einzelne Gelenke
          </button>
        </div>
        {mode === 'cartesian' ? (
          <TeleopPad
            teleop={lab.teleop}
            gripperOpen={(r?.targets[5] ?? HOME[5]!) > 0.4}
            onToggleGrip={() => lab.teleop.onToggleGrip()}
          />
        ) : (
          <>
            <div class="row">
              {POSES.map((pose) => (
                <button key={pose.name} class="btn small" onClick={() => lab.setPose(pose.q)}>
                  {pose.name}
                </button>
              ))}
            </div>
            <JointSliders
              sim={lab.sim}
              targets={r?.targets ?? HOME}
              actual={r?.joints ?? HOME}
              onChange={(index, value) => lab.setJointTarget(index, value)}
            />
          </>
        )}
        <div class="small muted" aria-live="polite">
          Greiferspitze: x {cm(r?.tool[0] ?? 0)} cm · y {cm(r?.tool[1] ?? 0)} cm · z{' '}
          {cm(r?.tool[2] ?? 0)} cm
        </div>
        <CameraPanel frame={frame} camera={camera} onCamera={setCamera} />
        <p class="small muted" style={{ margin: 0 }}>
          Wie beim echten SO-101 bekommt jeder Servo einen <strong>Sollwinkel</strong> und regelt
          selbst dorthin – mit begrenzter Kraft. Beim „Greifer bewegen“ rechnet die inverse
          Kinematik die Sollwinkel aus deiner Wunschposition aus.
        </p>
      </div>
    </div>
  );
}
