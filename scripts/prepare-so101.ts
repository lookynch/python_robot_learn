// Holt das SO-101-Modell aus MuJoCo Menagerie (Apache-2.0), vereinfacht die Sicht-Meshes
// und erzeugt die Kinematikdaten für lab.so101. Ausführen: node scripts/prepare-so101.ts
// Das Ergebnis wird committet; der Build braucht kein Netz.
import fs from 'node:fs';
import path from 'node:path';
import loadMujoco from '@mujoco/mujoco';
import { MeshoptSimplifier } from 'meshoptimizer';

const COMMIT = '3abca2e302625cec9429c49806121ea2855cef81';
const SOURCE = `https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/${COMMIT}/robotstudio_so101`;
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/robot/so101');
const PY_OUT = path.join(ROOT, 'src/python/py/lab/_so101_data.py');
const TEST_OUT = path.join(ROOT, 'tests/unit/so101-fk-samples.json');

// Anteil der Dreiecke, der von Sicht-Meshes übrig bleibt; Kollisions-Meshes bleiben unverändert.
const KEEP = 0.12;
const MAX_ERROR = 0.004;

async function download(file: string): Promise<Uint8Array> {
  const response = await fetch(`${SOURCE}/${file}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function readStl(bytes: Uint8Array): { positions: Float32Array; indices: Uint32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = view.getUint32(80, true);
  if (84 + triangles * 50 !== bytes.byteLength)
    throw new Error('Nur binäre STL-Dateien werden unterstützt.');
  const lookup = new Map<string, number>();
  const positions: number[] = [];
  const indices = new Uint32Array(triangles * 3);
  for (let t = 0; t < triangles; t++) {
    for (let v = 0; v < 3; v++) {
      const offset = 84 + t * 50 + 12 + v * 12;
      const xyz = [0, 4, 8].map((o) => view.getFloat32(offset + o, true));
      const key = xyz.join(',');
      let index = lookup.get(key);
      if (index === undefined) {
        index = positions.length / 3;
        lookup.set(key, index);
        positions.push(...xyz);
      }
      indices[t * 3 + v] = index;
    }
  }
  return { positions: new Float32Array(positions), indices };
}

function writeStl(positions: Float32Array, indices: Uint32Array): Uint8Array {
  const triangles = indices.length / 3;
  const bytes = new Uint8Array(84 + triangles * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, triangles, true);
  for (let t = 0; t < triangles; t++) {
    const p = [0, 1, 2].map((v) => {
      const i = indices[t * 3 + v]!;
      return [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
    });
    const [a, b, c] = p as [number[], number[], number[]];
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const w = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const n = [
      u[1]! * w[2]! - u[2]! * w[1]!,
      u[2]! * w[0]! - u[0]! * w[2]!,
      u[0]! * w[1]! - u[1]! * w[0]!,
    ];
    const len = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    const base = 84 + t * 50;
    n.forEach((x, k) => view.setFloat32(base + k * 4, x / len, true));
    p.flat().forEach((x, k) => view.setFloat32(base + 12 + k * 4, x, true));
  }
  return bytes;
}

function simplify(bytes: Uint8Array): Uint8Array {
  const { positions, indices } = readStl(bytes);
  const target = Math.max(36, Math.floor((indices.length * KEEP) / 3) * 3);
  const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, target, MAX_ERROR, [
    'Prune',
  ]);
  return writeStl(positions, simplified);
}

function round(values: ArrayLike<number>, digits = 7): number[] {
  return Array.from(values, (v) => Number(v.toFixed(digits)) + 0);
}

async function main() {
  await MeshoptSimplifier.ready;
  const xml = new TextDecoder().decode(await download('so101.xml'));
  const meshes = [...xml.matchAll(/<mesh[^>]*file="([^"]+)"/g)].map((m) => m[1]!);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

  let before = 0;
  let after = 0;
  const files = new Map<string, Uint8Array>();
  for (const mesh of meshes) {
    const raw = await download(`assets/${mesh}`);
    const collision = mesh.includes('_gripper_part');
    const out = collision ? raw : simplify(raw);
    before += raw.byteLength;
    after += out.byteLength;
    files.set(mesh, out);
    fs.writeFileSync(path.join(OUT, 'assets', mesh), out);
  }
  fs.writeFileSync(path.join(OUT, 'so101.xml'), xml);
  fs.writeFileSync(path.join(OUT, 'LICENSE'), await download('LICENSE'));
  fs.writeFileSync(
    path.join(OUT, 'NOTICE.md'),
    `# SO-101 – Herkunft und Änderungen

Modell: The Robot Studio SO-101, MJCF aus MuJoCo Menagerie
(https://github.com/google-deepmind/mujoco_menagerie/tree/${COMMIT}/robotstudio_so101),
Lizenz: Apache License 2.0 (siehe LICENSE).

Änderungen durch RoboPy (scripts/prepare-so101.ts):
- Sicht-Meshes mit meshoptimizer auf ca. ${Math.round(KEEP * 100)} % der Dreiecke vereinfacht
  (${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB).
- Kollisions-Meshes des Greifers und so101.xml unverändert.
- scene.xml (Boden, Licht, Objekte) ist eine eigene Ergänzung von RoboPy.
`,
  );

  const mujoco = await loadMujoco();
  const vfs = new mujoco.MjVFS();
  vfs.addBuffer('so101.xml', new TextEncoder().encode(xml));
  for (const [name, bytes] of files) vfs.addBuffer(`assets/${name}`, bytes);
  const model = mujoco.MjModel.mj_loadXML('so101.xml', vfs);
  const data = new mujoco.MjData(model);

  const bodyName = (id: number) =>
    mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY.value, id) as string;
  const bodies = [];
  for (let b = 1; b < model.nbody; b++) {
    const jointId = model.body_jntadr[b] as number;
    bodies.push({
      name: bodyName(b),
      parent: bodyName(model.body_parentid[b] as number),
      pos: round(model.body_pos.slice(b * 3, b * 3 + 3)),
      quat: round(model.body_quat.slice(b * 4, b * 4 + 4)),
      joint:
        jointId < 0
          ? null
          : {
              name: mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT.value, jointId) as string,
              axis: round(model.jnt_axis.slice(jointId * 3, jointId * 3 + 3)),
              range: round(model.jnt_range.slice(jointId * 2, jointId * 2 + 2), 6),
            },
    });
  }
  const siteId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE.value, 'gripperframe');
  const camId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_CAMERA.value, 'wrist_cam');
  const kinematics = {
    source: `mujoco_menagerie@${COMMIT.slice(0, 7)}/robotstudio_so101`,
    bodies,
    tool: {
      body: bodyName(model.site_bodyid[siteId] as number),
      pos: round(model.site_pos.slice(siteId * 3, siteId * 3 + 3)),
      quat: round(model.site_quat.slice(siteId * 4, siteId * 4 + 4)),
    },
    camera: {
      body: bodyName(model.cam_bodyid[camId] as number),
      pos: round(model.cam_pos.slice(camId * 3, camId * 3 + 3)),
      quat: round(model.cam_quat.slice(camId * 4, camId * 4 + 4)),
      fovy: Number(model.cam_fovy[camId]),
    },
  };

  // Stichproben für den Test: Python-FK muss MuJoCo exakt treffen.
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const samples = [];
  for (let s = 0; s < 12; s++) {
    const q = [];
    for (let j = 0; j < model.njnt; j++) {
      const [lo, hi] = [model.jnt_range[j * 2] as number, model.jnt_range[j * 2 + 1] as number];
      q.push(s === 0 ? 0 : lo + (hi - lo) * rand());
    }
    data.qpos.set(q);
    mujoco.mj_forward(model, data);
    samples.push({
      q: round(q),
      tool_pos: round(data.site_xpos.slice(siteId * 3, siteId * 3 + 3)),
      tool_mat: round(data.site_xmat.slice(siteId * 9, siteId * 9 + 9)),
      cam_pos: round(data.cam_xpos.slice(camId * 3, camId * 3 + 3)),
    });
  }
  data.delete();
  model.delete();
  vfs.delete();

  fs.writeFileSync(
    PY_OUT,
    `# Automatisch erzeugt von scripts/prepare-so101.ts – nicht von Hand ändern.\n` +
      `# Quelle: ${kinematics.source} (Apache-2.0)\n` +
      `import json\n\nDATA = json.loads(${JSON.stringify(JSON.stringify(kinematics))})\n`,
  );
  fs.writeFileSync(TEST_OUT, `${JSON.stringify(samples, null, 1)}\n`);
  console.log(
    `Meshes: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB, ${bodies.length} Körper`,
  );
}

await main();
