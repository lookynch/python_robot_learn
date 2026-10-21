import { beforeAll, expect, test } from 'vitest';
import { createNodePython, type NodePython } from '../content/pyodide-node';
import samples from './so101-fk-samples.json';

let python: NodePython;
beforeAll(async () => {
  python = await createNodePython();
});

function run(code: string) {
  const result = python.run({ code });
  if (result.error) throw new Error(result.error.traceback);
  return result;
}

test('Python-FK trifft MuJoCo (Greiferspitze, Orientierung, Kamera)', () => {
  const result = run(`import json
import numpy as np
from lab import so101
samples = json.loads(${JSON.stringify(JSON.stringify(samples))})
worst = 0.0
for s in samples:
    T = so101.fk(s["q"])
    worst = max(worst, np.abs(T[:3, 3] - s["tool_pos"]).max(), np.abs(T[:3, :3].ravel() - s["tool_mat"]).max())
    worst = max(worst, np.abs(so101.camera_pose(s["q"])[:3, 3] - s["cam_pos"]).max())
print(worst)
`);
  expect(Number(result.stdout)).toBeLessThan(1e-5);
});

test('IK erreicht erreichbare Ziele und hält Gelenkgrenzen ein', () => {
  const result = run(`import numpy as np
from lab import so101
ok_all = True
for target in ([0.25, 0.1, 0.08], [0.2, -0.15, 0.05], [0.3, 0.0, 0.2]):
    q, ok = so101.ik(target)
    inside = np.all(q >= so101.LIMITS[:5, 0] - 1e-9) and np.all(q <= so101.LIMITS[:5, 1] + 1e-9)
    ok_all = ok_all and ok and inside and np.linalg.norm(so101.tool_position(q) - target) < 1e-3
q, ok = so101.ik([2.0, 0, 0])
print(ok_all, ok)
`);
  expect(result.stdout.trim()).toBe('True False');
});

test('arm3d erzeugt eine robot3d-Szene und prüft Eingaben', () => {
  const result = run(`import lab
lab.arm3d([[0, 0, 0, 0, 0], [0.5, -0.5, 0.5, 0.2, 0.1]], gripper=0.8, title="Test", target=(0.2, 0, 0.1))
`);
  const scene = result.scenes[0];
  expect(scene?.kind).toBe('robot3d');
  if (scene?.kind !== 'robot3d') return;
  expect(scene.frames).toHaveLength(2);
  expect(scene.frames[1]).toEqual([0.5, -0.5, 0.5, 0.2, 0.1, 0.8]);
  expect(scene.target).toEqual([0.2, 0, 0.1]);
  const bad = python.run({ code: 'import lab\nlab.arm3d([0, 0])' });
  expect(bad.error?.message).toContain('5 Gelenkwinkel');
});
