import fs from 'node:fs';
import path from 'node:path';
import loadMujoco from '@mujoco/mujoco';
import { beforeAll, expect, test } from 'vitest';
import { EXAMPLES } from '../../src/pages/PlaygroundPage';
import { createNodePython } from '../content/pyodide-node';
import {
  GRIPPER_CLOSED,
  GRIPPER_OPEN,
  HOME,
  meshFiles,
  Sim,
  type SceneSpec,
  type Vec3,
} from '../../src/robot/sim';
import { graspScript, placeScript, taskById } from '../../src/robot/tasks';
import { cartesianStep } from '../../src/robot/teleop';

const ROOT = path.resolve(__dirname, '../../public/robot/so101');
let mujoco: Awaited<ReturnType<typeof loadMujoco>>;
let files: Map<string, Uint8Array>;

beforeAll(async () => {
  mujoco = await loadMujoco();
  const xml = fs.readFileSync(path.join(ROOT, 'so101.xml'));
  files = new Map([['so101.xml', new Uint8Array(xml)]]);
  for (const mesh of meshFiles(xml.toString()))
    files.set(mesh, new Uint8Array(fs.readFileSync(path.join(ROOT, mesh))));
});

const make = (scene: SceneSpec = {}) => Sim.fromFiles(mujoco, files, scene);

function settle(sim: Sim, targets: number[], seconds: number) {
  sim.setTargets(targets);
  sim.step(seconds);
}

test('IK mit „Greifer nach unten“ trifft Ziel und Orientierung', () => {
  const sim = make();
  for (const target of [
    [0.22, 0.05, 0.08],
    [0.28, -0.1, 0.05],
    [0.2, 0.1, 0.08],
  ] as Vec3[]) {
    const { q, error } = sim.ik(target, HOME, true, 80);
    expect(error).toBeLessThan(2e-3);
    sim.setJoints(q);
    sim.forward();
    expect(sim.toolAxis()[2]).toBeLessThan(-0.97);
  }
  sim.dispose();
});

test('Servo folgt dem Sollwinkel und Zustände lassen sich exakt wiederherstellen', () => {
  const sim = make({ cubes: [{ pos: [0.25, 0, 0.015], size: 0.03, rgba: [1, 0, 0, 1] }] });
  const target = [0.3, -0.2, 0.5, 1.0, 0.4, GRIPPER_OPEN];
  settle(sim, target, 1.5);
  sim.joints().forEach((q, i) => expect(Math.abs(q - target[i]!)).toBeLessThan(0.03));
  const saved = sim.getState();
  settle(sim, HOME, 0.5);
  const after = sim.joints();
  sim.setState(saved);
  settle(sim, HOME, 0.5);
  sim.joints().forEach((q, i) => expect(q).toBeCloseTo(after[i]!, 9));
  sim.dispose();
});

test('Gescripteter Griff hebt den Würfel an (Physik mit Kontakt und Reibung)', () => {
  for (const pos of [
    [0.22, 0.04, 0.015],
    [0.26, -0.08, 0.015],
  ] as Vec3[]) {
    const sim = make({ cubes: [{ pos, size: 0.03, rgba: [1, 0.3, 0.2, 1] }] });
    let targets = [...HOME];
    for (const phase of graspScript(sim, pos)) {
      targets = phase.targets(targets);
      settle(sim, targets, phase.seconds);
    }
    expect(sim.cubePosition(0)[2]).toBeGreaterThan(0.06);
    expect(targets[5]).toBe(GRIPPER_CLOSED);
    sim.dispose();
  }
});

test('Aufgaben: scripted Expert löst „anheben“ und „ablegen“ bei zufälligen Starts', () => {
  for (const id of ['heben', 'ablegen'] as const) {
    const task = taskById(id);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const scene = task.scene(seed);
      const sim = make(scene);
      expect(task.success(sim)).toBe(false);
      const cube = scene.cubes![0]!.pos;
      const phases =
        id === 'heben' ? graspScript(sim, cube) : [...graspScript(sim, cube), ...placeScript(sim)];
      let targets = [...HOME];
      for (const phase of phases) {
        targets = phase.targets(targets);
        settle(sim, targets, phase.seconds);
      }
      sim.step(0.5);
      expect(
        task.success(sim),
        `${id} seed ${seed}: Würfel bei ${sim.cubePosition(0).map((v) => v.toFixed(3))}`,
      ).toBe(true);
      expect(task.progress(sim)).toBe(1);
      sim.dispose();
    }
  }
});

test('Spielwiese „Greifen“: Python-Plan hebt den Würfel in der MuJoCo-Physik an', async () => {
  const python = await createNodePython();
  const code = EXAMPLES.find((e) => e.name === 'Greifen')!.code;
  const result = python.run({ code });
  expect(result.error).toBeNull();
  const spec = result.scenes[0];
  if (spec?.kind !== 'robot3d') throw new Error('keine robot3d-Szene');
  expect(spec.physics).toBe(true);
  const sim = make({
    cubes: spec.objects.map((o) => ({ pos: o.pos, size: o.size, rgba: [1, 0, 0, 1] })),
  });
  // Wie Robot3DVisual: Start in der ersten Stellung, dann je Frame Sollwinkel setzen und 1/fps simulieren.
  sim.reset(spec.frames[0]);
  for (const frame of spec.frames.slice(1)) settle(sim, frame, 1 / spec.fps);
  sim.step(0.5);
  expect(sim.cubePosition(0)[2]).toBeGreaterThan(0.06);
  sim.dispose();
});

test('Kartesische Steuerung: hoch, vor, seitlich – auch dort, wo der Greifer kippen muss', () => {
  const sim = make();
  let targets = [...HOME];
  let goal = sim.toolPosition();
  const drive = (move: Vec3, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 30) {
      ({ targets, goal } = cartesianStep(sim, targets, goal, { move, roll: 0, grip: 0 }, 1 / 30));
      settle(sim, targets, 1 / 30);
    }
  };
  const start = sim.toolPosition();
  drive([0, 0, 1], 1);
  expect(sim.toolPosition()[2]).toBeGreaterThan(start[2] + 0.08);
  drive([0, 1, 0], 0.8);
  expect(sim.toolPosition()[1]).toBeGreaterThan(start[1] + 0.06);
  drive([0, 0, -1], 1.5);
  expect(sim.toolPosition()[2]).toBeLessThan(0.06);
  sim.dispose();
});
