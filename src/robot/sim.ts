import type { MainModule, MjData, MjModel, MjVFS } from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';

export const ROBOT_BASE = '/robot/so101/';
export const JOINTS = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
] as const;
export const JOINT_LABELS: Record<(typeof JOINTS)[number], string> = {
  shoulder_pan: 'Drehen (Basis)',
  shoulder_lift: 'Schulter heben',
  elbow_flex: 'Ellbogen',
  wrist_flex: 'Handgelenk kippen',
  wrist_roll: 'Handgelenk drehen',
  gripper: 'Greifer',
};
/** Bereitstellung wie lab.so101.HOME (Greifer zeigt nach unten), Greifer halb offen. */
export const HOME: number[] = [0, -0.5, 0.3, 1.4, 0, 0.6];
/** Ruhestellung wie lab.so101.REST: zusammengefaltet. */
export const REST: number[] = [0, -1.57, 1.57, 0.8, 0, 0];

export interface CubeSpec {
  pos: [number, number, number];
  size: number;
  rgba: [number, number, number, number];
}

let mujocoPromise: Promise<MainModule> | null = null;
let filesPromise: Promise<Map<string, Uint8Array>> | null = null;

export function loadMujoco(): Promise<MainModule> {
  mujocoPromise ??= import('@mujoco/mujoco').then((m) =>
    m.default({ locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file) }),
  );
  return mujocoPromise;
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(ROBOT_BASE + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function loadFiles(): Promise<Map<string, Uint8Array>> {
  filesPromise ??= (async () => {
    const xml = await fetchBytes('so101.xml');
    const meshes = [...new TextDecoder().decode(xml).matchAll(/<mesh[^>]*file="([^"]+)"/g)].map(
      (m) => `assets/${m[1]}`,
    );
    const files = new Map([['so101.xml', xml]]);
    await Promise.all(meshes.map(async (mesh) => files.set(mesh, await fetchBytes(mesh))));
    return files;
  })();
  filesPromise.catch(() => (filesPromise = null));
  return filesPromise;
}

function sceneXml(cubes: CubeSpec[]): string {
  const bodies = cubes
    .map(
      (c, i) => `
    <body name="cube${i}" pos="${c.pos.join(' ')}">
      <freejoint/>
      <geom type="box" size="${c.size / 2} ${c.size / 2} ${c.size / 2}" rgba="${c.rgba.join(' ')}"
        mass="0.03" condim="3" friction="1 .03 .003" contype="2" conaffinity="1" solref="0.01 1"/>
    </body>`,
    )
    .join('');
  return `<mujoco model="robopy-so101">
  <include file="so101.xml"/>
  <worldbody>
    <light pos="0.3 -0.4 1.2" dir="-0.2 0.3 -1" directional="true"/>
    <geom name="floor" type="plane" size="0 0 0.05" rgba="0.5 0.55 0.6 1"/>${bodies}
  </worldbody>
</mujoco>`;
}

/** Ein simulierter SO-101. Die Servos sind Positionsregler: setTargets() gibt Sollwinkel vor wie beim echten Arm. */
export class Sim {
  readonly model: MjModel;
  readonly data: MjData;
  readonly cubes: CubeSpec[];
  private readonly qposAdr: number[];
  private readonly toolSite: number;

  private constructor(
    readonly mujoco: MainModule,
    vfs: MjVFS,
    cubes: CubeSpec[],
  ) {
    this.cubes = cubes;
    vfs.addBuffer('scene.xml', new TextEncoder().encode(sceneXml(cubes)));
    this.model = mujoco.MjModel.mj_loadXML('scene.xml', vfs);
    this.data = new mujoco.MjData(this.model);
    const id = (type: number, name: string) => mujoco.mj_name2id(this.model, type, name);
    this.qposAdr = JOINTS.map(
      (j) => this.model.jnt_qposadr[id(mujoco.mjtObj.mjOBJ_JOINT.value, j)] as number,
    );
    this.toolSite = id(mujoco.mjtObj.mjOBJ_SITE.value, 'gripperframe');
    this.reset();
  }

  static async create(cubes: CubeSpec[] = []): Promise<Sim> {
    const [mujoco, files] = await Promise.all([loadMujoco(), loadFiles()]);
    const vfs = new mujoco.MjVFS();
    try {
      for (const [name, bytes] of files) vfs.addBuffer(name, bytes);
      return new Sim(mujoco, vfs, cubes);
    } finally {
      vfs.delete();
    }
  }

  get timestep(): number {
    return this.model.opt.timestep;
  }

  get time(): number {
    return this.data.time;
  }

  reset(q: number[] = HOME) {
    this.mujoco.mj_resetData(this.model, this.data);
    this.setJoints(q);
    this.setTargets(q);
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** Sollwinkel der sechs Servos (rad), begrenzt auf den erlaubten Bereich. */
  setTargets(q: number[]) {
    const ctrl = this.data.ctrl as Float64Array;
    const range = this.model.actuator_ctrlrange as Float64Array;
    for (let i = 0; i < JOINTS.length; i++) {
      const value = q[i] ?? ctrl[i]!;
      ctrl[i] = Math.min(range[i * 2 + 1]!, Math.max(range[i * 2]!, value));
    }
  }

  targets(): number[] {
    return Array.from((this.data.ctrl as Float64Array).slice(0, JOINTS.length));
  }

  /** Gelenkwinkel direkt setzen (ohne Physik), z. B. für reine Kinematik-Animationen. */
  setJoints(q: number[]) {
    const qpos = this.data.qpos as Float64Array;
    q.forEach((value, i) => {
      if (i < JOINTS.length) qpos[this.qposAdr[i]!] = value;
    });
  }

  joints(): number[] {
    const qpos = this.data.qpos as Float64Array;
    return this.qposAdr.map((adr) => qpos[adr]!);
  }

  forward() {
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** Simuliert `seconds` Sekunden (in Schritten von model.opt.timestep). */
  step(seconds: number) {
    const steps = Math.max(1, Math.round(seconds / this.timestep));
    for (let i = 0; i < steps; i++) this.mujoco.mj_step(this.model, this.data);
  }

  toolPosition(): [number, number, number] {
    const xpos = this.data.site_xpos as Float64Array;
    const i = this.toolSite * 3;
    return [xpos[i]!, xpos[i + 1]!, xpos[i + 2]!];
  }

  jointRange(index: number): [number, number] {
    const range = this.model.actuator_ctrlrange as Float64Array;
    return [range[index * 2]!, range[index * 2 + 1]!];
  }

  dispose() {
    this.data.delete();
    this.model.delete();
  }
}
