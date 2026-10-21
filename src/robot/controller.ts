import { HOME, Sim, type Vec3 } from './sim';
import { graspScript, placeScript, type ScriptPhase, type Task } from './tasks';
import { cartesianStep, isIdle, Teleop } from './teleop';

/** Regeltakt wie bei LeRobot am echten SO-101. */
export const CONTROL_HZ = 30;
export const CONTROL_DT = 1 / CONTROL_HZ;

/** Wer gerade steuert. */
export type Driver = 'joints' | 'cartesian' | 'script' | 'policy';

/** Alles, was eine Steuerung (Mensch oder KI) pro Regelschritt sehen darf. */
export interface Observation {
  /** Ist-Winkel der sechs Servos. */
  joints: number[];
  /** Aktuelle Sollwinkel. */
  targets: number[];
}

/** Eine Policy bekommt die Beobachtung und liefert neue Sollwinkel (6 Werte). */
export type Policy = (observation: Observation, sim: Sim) => number[];

export interface ControlStep {
  time: number;
  observation: Observation;
  action: number[];
}

/** Führt eine Sim im festen Regeltakt: Eingaben → Sollwinkel → Physik. */
export class LabController {
  driver: Driver = 'cartesian';
  targets: number[] = [...HOME];
  goal: Vec3;
  readonly teleop = new Teleop();
  policy: Policy | null = null;
  /** Wird nach jedem Regelschritt aufgerufen (z. B. für Aufnahmen). */
  onControl: ((step: ControlStep) => void) | null = null;
  successTime: number | null = null;
  private script: { phases: ScriptPhase[]; index: number; left: number } | null = null;
  private pending = 0;

  constructor(
    readonly sim: Sim,
    readonly task: Task,
  ) {
    this.goal = sim.toolPosition();
    this.teleop.onToggleGrip = () => {
      this.targets[5] = this.targets[5]! > 0.4 ? -0.1 : 1.2;
    };
  }

  reset() {
    this.sim.reset();
    this.targets = [...HOME];
    this.goal = this.sim.toolPosition();
    this.successTime = null;
    this.script = null;
    this.pending = 0;
    if (this.driver === 'script' || this.driver === 'policy') this.driver = 'cartesian';
  }

  setJointTarget(index: number, value: number) {
    this.driver = 'joints';
    this.targets[index] = value;
  }

  setPose(q: number[]) {
    this.driver = 'joints';
    this.targets = [...q];
  }

  /** Der eingebaute „Experte“ löst die Aufgabe vor – zum Zuschauen oder als Demo-Daten. */
  demonstrate() {
    const cube = this.sim.cubePosition(0);
    const phases = graspScript(this.sim, cube);
    if (this.task.id === 'ablegen') phases.push(...placeScript(this.sim));
    this.script = { phases, index: -1, left: 0 };
    this.driver = 'script';
  }

  get scriptPhase(): string | null {
    return this.script ? (this.script.phases[this.script.index]?.name ?? null) : null;
  }

  usePolicy(policy: Policy | null) {
    this.policy = policy;
    this.driver = policy ? 'policy' : 'cartesian';
  }

  observe(): Observation {
    return { joints: this.sim.joints(), targets: [...this.targets] };
  }

  private controlStep() {
    const observation = this.observe();
    switch (this.driver) {
      case 'cartesian': {
        const input = this.teleop.read();
        if (!isIdle(input) || input.grip !== 0) {
          const next = cartesianStep(this.sim, this.targets, this.goal, input, CONTROL_DT);
          this.targets = next.targets;
          this.goal = next.goal;
        }
        break;
      }
      case 'joints': {
        const input = this.teleop.read();
        if (!isIdle(input)) {
          // Joystick/Tasten übernehmen sofort wieder die kartesische Steuerung.
          this.driver = 'cartesian';
          this.goal = this.sim.toolPosition();
        }
        break;
      }
      case 'script': {
        const s = this.script!;
        s.left -= CONTROL_DT;
        if (s.left <= 0) {
          s.index++;
          const phase = s.phases[s.index];
          if (!phase) {
            this.script = null;
            this.driver = 'cartesian';
            this.goal = this.sim.toolPosition();
            break;
          }
          this.targets = phase.targets(this.targets);
          s.left = phase.seconds;
        }
        break;
      }
      case 'policy':
        if (this.policy) this.targets = this.policy(observation, this.sim).slice(0, 6);
        break;
    }
    this.sim.setTargets(this.targets);
    this.targets = this.sim.targets();
    this.sim.step(CONTROL_DT);
    this.onControl?.({ time: this.sim.time, observation, action: [...this.targets] });
    if (this.successTime === null && this.task.success(this.sim)) this.successTime = this.sim.time;
  }

  /** Echtzeit vorrücken: so viele Regelschritte wie in `dt` Sekunden passen. */
  tick(dt: number) {
    this.pending += dt;
    while (this.pending >= CONTROL_DT) {
      this.pending -= CONTROL_DT;
      this.controlStep();
    }
  }

  /** Ohne Echtzeit: n Regelschritte am Stück (für Tests, Auswertung, Datenerzeugung). */
  run(steps: number) {
    for (let i = 0; i < steps; i++) this.controlStep();
  }
}
