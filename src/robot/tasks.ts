import {
  GRIPPER_CLOSED,
  GRIPPER_OPEN,
  TRAY_WALL,
  type SceneSpec,
  type Sim,
  type Vec3,
} from './sim';

export const CUBE = 0.03;
const CUBE_COLORS: [number, number, number, number][] = [
  [0.91, 0.36, 0.18, 1],
  [0.18, 0.55, 0.95, 1],
  [0.25, 0.75, 0.35, 1],
];
const TRAY_POS: [number, number] = [0.16, -0.2];
const TRAY_SIZE: [number, number] = [0.12, 0.1];

/** Kleiner deterministischer Zufallsgenerator (mulberry32), damit Starts reproduzierbar sind. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubeStart(random: () => number): Vec3 {
  // Bereich, in dem der Arm sicher senkrecht von oben greifen kann.
  return [0.18 + random() * 0.09, -0.06 + random() * 0.18, CUBE / 2];
}

export type TaskId = 'heben' | 'ablegen' | 'frei';

export interface Task {
  id: TaskId;
  title: string;
  goal: string;
  /** Szene für einen Durchlauf; derselbe Seed ergibt dieselbe Startlage. */
  scene(seed: number): SceneSpec;
  success(sim: Sim): boolean;
  /** Wie weit ist der Durchlauf (0–1)? Für Fortschrittsanzeige und Belohnung. */
  progress(sim: Sim): number;
}

function insideTray(p: Vec3): boolean {
  const [tx, ty] = TRAY_POS;
  const [w, d] = [TRAY_SIZE[0] / 2 - CUBE / 2, TRAY_SIZE[1] / 2 - CUBE / 2];
  return Math.abs(p[0] - tx) < w && Math.abs(p[1] - ty) < d && p[2] < TRAY_WALL + CUBE;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const TASKS: Task[] = [
  {
    id: 'heben',
    title: 'Würfel anheben',
    goal: 'Greife den Würfel und hebe ihn mindestens 5 cm hoch.',
    scene: (seed) => ({
      cubes: [{ pos: cubeStart(rng(seed)), size: CUBE, rgba: CUBE_COLORS[0]! }],
    }),
    success: (sim) => sim.cubePosition(0)[2] > 0.05 + CUBE / 2,
    progress: (sim) => {
      const cube = sim.cubePosition(0);
      if (cube[2] > 0.05 + CUBE / 2) return 1;
      const reach = Math.max(0, 1 - dist(sim.toolPosition(), cube) / 0.2);
      const lift = Math.min(1, Math.max(0, (cube[2] - CUBE / 2) / 0.05));
      return Math.min(1, 0.4 * reach + 0.6 * lift);
    },
  },
  {
    id: 'ablegen',
    title: 'Würfel in die Schale',
    goal: 'Lege den Würfel in die graue Schale und lass ihn los.',
    scene: (seed) => ({
      cubes: [{ pos: cubeStart(rng(seed)), size: CUBE, rgba: CUBE_COLORS[1]! }],
      tray: { pos: TRAY_POS, size: TRAY_SIZE, rgba: [0.55, 0.58, 0.62, 1] },
    }),
    success: (sim) => insideTray(sim.cubePosition(0)) && sim.targets()[5]! > 0.4,
    progress: (sim) => {
      const cube = sim.cubePosition(0);
      if (insideTray(cube)) return sim.targets()[5]! > 0.4 ? 1 : 0.9;
      const reach = Math.max(0, 1 - dist(sim.toolPosition(), cube) / 0.2);
      const carry = Math.max(0, 1 - dist(cube, [...TRAY_POS, CUBE] as Vec3) / 0.3);
      return 0.3 * reach + 0.6 * (cube[2] > CUBE ? carry : 0);
    },
  },
  {
    id: 'frei',
    title: 'Freies Spielen',
    goal: 'Drei Würfel und eine Schale – probiere aus, was der Arm kann.',
    scene: (seed) => {
      const random = rng(seed);
      return {
        cubes: CUBE_COLORS.map((rgba) => ({ pos: cubeStart(random), size: CUBE, rgba })),
        tray: { pos: TRAY_POS, size: TRAY_SIZE, rgba: [0.55, 0.58, 0.62, 1] },
      };
    },
    success: () => false,
    progress: () => 0,
  },
];

export const taskById = (id: TaskId) => TASKS.find((t) => t.id === id)!;

export interface ScriptPhase {
  name: string;
  seconds: number;
  targets: (previous: number[]) => number[];
}

/** Klassischer Griff von oben: anfahren, öffnen, absenken, schließen, anheben. */
export function graspScript(sim: Sim, cube: Vec3, lift = 0.1): ScriptPhase[] {
  const above: Vec3 = [cube[0], cube[1], 0.07];
  const grasp: Vec3 = [cube[0], cube[1], Math.max(0.006, cube[2] - 0.004)];
  const up: Vec3 = [cube[0], cube[1], lift];
  const move = (target: Vec3, gripper?: number) => (previous: number[]) => {
    const { q } = sim.ik(target, previous, true, 60);
    // Handgelenk so drehen, dass die Backen parallel zu den Würfelseiten schließen.
    q[4] = -q[0]!;
    if (gripper !== undefined) q[5] = gripper;
    return q;
  };
  return [
    { name: 'Über den Würfel fahren und öffnen', seconds: 1.2, targets: move(above, GRIPPER_OPEN) },
    { name: 'Absenken', seconds: 1.0, targets: move(grasp) },
    { name: 'Greifer schließen', seconds: 0.8, targets: (p) => [...p.slice(0, 5), GRIPPER_CLOSED] },
    { name: 'Anheben', seconds: 1.2, targets: move(up) },
  ];
}

/** Ablegen in der Schale nach einem Griff. */
export function placeScript(sim: Sim): ScriptPhase[] {
  const over: Vec3 = [TRAY_POS[0], TRAY_POS[1], 0.1];
  const low: Vec3 = [TRAY_POS[0], TRAY_POS[1], 0.06];
  const move = (target: Vec3) => (previous: number[]) => {
    const { q } = sim.ik(target, previous, true, 60);
    q[4] = -q[0]!;
    q[5] = previous[5]!;
    return q;
  };
  return [
    { name: 'Zur Schale fahren', seconds: 1.4, targets: move(over) },
    { name: 'Absenken', seconds: 0.8, targets: move(low) },
    { name: 'Loslassen', seconds: 0.6, targets: (p) => [...p.slice(0, 5), GRIPPER_OPEN] },
    { name: 'Zurückziehen', seconds: 0.8, targets: move(over) },
  ];
}
