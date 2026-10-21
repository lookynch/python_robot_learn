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

test('IK mit down=True: Finger zeigen senkrecht nach unten', () => {
  const result = run(`import numpy as np
from lab import so101
ok = True
for target in ([0.22, 0.05, 0.03], [0.26, -0.06, 0.015]):
    q, reached = so101.ik(target, down=True)
    ok = ok and reached and so101.tool_axis(q)[2] < -0.99
print(ok)
`);
  expect(result.stdout.trim()).toBe('True');
});

test('Tiefenbild: Boden und Würfel stimmen, Rückprojektion findet die Würfeloberseite', () => {
  const result = run(`import numpy as np
from lab import so101
cube = {"pos": (0.22, 0.0, 0.015), "size": 0.03}
q, _ = so101.ik([0.22, 0.0, 0.09], down=True)
D = so101.depth_image(q, [cube], 64, 48)
empty = so101.depth_image(q, [], 64, 48)
h, w = D.shape
# Pixel, die den Würfel treffen, in Weltpunkte zurückrechnen: die höchsten liegen auf der Oberseite.
points = [so101.camera_point_to_world(so101.backproject(u, v, D[v, u], w, h), q)
          for v, u in zip(*np.nonzero(empty - D > 0.005))]
top = max(p[2] for p in points)
inside = all(abs(p[0] - 0.22) < 0.016 and abs(p[1]) < 0.016 for p in points)
print(round(top, 3), inside)
F = so101.depth_image(None, [], 32, 24, camera="front")
print(bool(F.min() > 0.4 and F[12, 16] < 1.0))
`);
  const [top, near, front] = result.stdout.trim().split(/\s+/);
  expect(Number(top)).toBeCloseTo(0.03, 2);
  expect(near).toBe('True');
  expect(front).toBe('True');
});
