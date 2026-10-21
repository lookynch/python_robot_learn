import { GRIPPER_CLOSED, GRIPPER_OPEN, type Sim, type Vec3 } from './sim';

/** Bewegungswunsch, jede Komponente zwischen −1 und 1. */
export interface TeleopInput {
  /** x = vor, y = links, z = hoch (Weltkoordinaten). */
  move: Vec3;
  roll: number;
  /** +1 öffnen, −1 schließen. */
  grip: number;
}

export const SPEED = 0.12; // m/s bei vollem Ausschlag
const ROLL_SPEED = 1.5; // rad/s
const GRIP_SPEED = 3; // rad/s
const WORKSPACE = { rMin: 0.1, rMax: 0.34, zMin: 0.004, zMax: 0.25 };

export const KEY_HELP = [
  ['W / S', 'vor / zurück'],
  ['A / D', 'links / rechts'],
  ['R / F', 'hoch / runter'],
  ['Q / E', 'Handgelenk drehen'],
  ['Leertaste', 'Greifer auf / zu'],
];

const idle = (): TeleopInput => ({ move: [0, 0, 0], roll: 0, grip: 0 });

export function isIdle(input: TeleopInput): boolean {
  return (
    input.move.every((v) => Math.abs(v) < 0.05) &&
    Math.abs(input.roll) < 0.05 &&
    Math.abs(input.grip) < 0.05
  );
}

/** Sammelt Tastatur, Gamepad und Touch-Pad zu einem Bewegungswunsch. */
export class Teleop {
  private keys = new Set<string>();
  /** Vom Touch-Pad gesetzt. */
  pad: TeleopInput = idle();
  /** Wird bei Leertaste / Gamepad-A ausgelöst. */
  onToggleGrip: () => void = () => {};
  private padButtonDown = false;

  private onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, .cm-editor, select')) return;
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'r', 'f', 'q', 'e', ' '].includes(key)) return;
    event.preventDefault();
    if (event.type === 'keydown') {
      if (key === ' ' && !event.repeat) this.onToggleGrip();
      this.keys.add(key);
    } else this.keys.delete(key);
  };

  private onBlur = () => this.keys.clear();

  attach(): () => void {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    return () => {
      window.removeEventListener('keydown', this.onKey);
      window.removeEventListener('keyup', this.onKey);
      window.removeEventListener('blur', this.onBlur);
    };
  }

  read(): TeleopInput {
    const k = (a: string, b: string) => (this.keys.has(a) ? 1 : 0) - (this.keys.has(b) ? 1 : 0);
    const input: TeleopInput = {
      move: [k('w', 's'), k('a', 'd'), k('r', 'f')],
      roll: k('q', 'e'),
      grip: 0,
    };
    const gamepad = navigator.getGamepads?.().find((g) => g?.connected);
    if (gamepad) {
      const dead = (v: number | undefined) => (Math.abs(v ?? 0) < 0.15 ? 0 : (v ?? 0));
      input.move[0] += -dead(gamepad.axes[1]);
      input.move[1] += -dead(gamepad.axes[0]);
      input.move[2] += -dead(gamepad.axes[3]);
      input.roll += (gamepad.buttons[4]?.value ?? 0) - (gamepad.buttons[5]?.value ?? 0);
      input.grip += (gamepad.buttons[6]?.value ?? 0) - (gamepad.buttons[7]?.value ?? 0);
      const pressed = Boolean(gamepad.buttons[0]?.pressed);
      if (pressed && !this.padButtonDown) this.onToggleGrip();
      this.padButtonDown = pressed;
    }
    for (let i = 0; i < 3; i++) input.move[i] = clamp(input.move[i]! + this.pad.move[i]!, -1, 1);
    input.roll = clamp(input.roll + this.pad.roll, -1, 1);
    input.grip = clamp(input.grip + this.pad.grip, -1, 1);
    return input;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hält das Greiferziel im sinnvoll erreichbaren Bereich. */
export function clampGoal(goal: Vec3): Vec3 {
  let [x, y] = goal;
  const r = Math.hypot(x, y);
  const target = clamp(r, WORKSPACE.rMin, WORKSPACE.rMax);
  if (r > 1e-9 && target !== r) [x, y] = [(x / r) * target, (y / r) * target];
  return [x, y, clamp(goal[2], WORKSPACE.zMin, WORKSPACE.zMax)];
}

/**
 * Kartesische Steuerung wie mit einem Joystick: das Greiferziel wandert mit der Eingabe,
 * die IK rechnet daraus Sollwinkel (Greifer zeigt möglichst nach unten). Unerreichbare Ziele werden verworfen.
 */
export function cartesianStep(
  sim: Sim,
  targets: number[],
  goal: Vec3,
  input: TeleopInput,
  dt: number,
): { targets: number[]; goal: Vec3 } {
  const next = [...targets];
  next[4] = clamp(next[4]! + input.roll * ROLL_SPEED * dt, ...sim.jointRange(4));
  next[5] = clamp(next[5]! + input.grip * GRIP_SPEED * dt, GRIPPER_CLOSED, GRIPPER_OPEN);
  if (input.move.every((v) => v === 0)) return { targets: next, goal };
  const wanted = clampGoal([
    goal[0] + input.move[0] * SPEED * dt,
    goal[1] + input.move[1] * SPEED * dt,
    goal[2] + input.move[2] * SPEED * dt,
  ]);
  let { q, error } = sim.ik(wanted, next, true, 12);
  if (error > 0.004) {
    // Senkrecht nach unten geht hier nicht (z. B. zu hoch) – dann darf der Greifer kippen.
    ({ q, error } = sim.ik(wanted, next, false, 12));
  }
  if (error > 0.01) return { targets: next, goal };
  return { targets: [...q.slice(0, 4), next[4]!, next[5]!], goal: wanted };
}
