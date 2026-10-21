export interface TestCase {
  name: string;
  code: string;
}

export interface RunRequest {
  code: string;
  stdin?: string[];
  seed?: number;
  tests?: TestCase[];
  trace?: number;
  deadline?: number;
}

export type RunStatus =
  'ok' | 'error' | 'needs_input' | 'output_limit' | 'trace_limit' | 'timeout' | 'stopped';

export interface PyError {
  type: string;
  message: string;
  line: number | null;
  traceback: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message: string | null;
}

export interface TraceFrame {
  name: string;
  vars: Record<string, string>;
}

export interface TraceStep {
  line: number | null;
  event: 'line' | 'return' | 'end';
  stack: TraceFrame[];
  out: number;
}

export type Color = string;

export type Primitive =
  | { t: 'line'; p: [number, number][]; c: Color; lw: number; d: boolean }
  | { t: 'circle'; x: number; y: number; r: number; c: Color; f: Color | null; lw: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; c: Color; f: Color | null; lw: number }
  | { t: 'poly'; p: [number, number][]; c: Color; f: Color | null; lw: number }
  | { t: 'arrow'; x: number; y: number; dx: number; dy: number; c: Color; lw: number }
  | { t: 'text'; x: number; y: number; s: string; c: Color; size: number; a: 'c' | 'l' | 'r' };

export interface SceneSpec {
  kind: 'scene';
  title: string | null;
  bounds: [number, number, number, number] | null;
  fps: number;
  static: Primitive[];
  frames: Primitive[][];
  captions: (string | null)[] | null;
}

export interface PlotSeries {
  x: number[];
  y: number[];
  label: string | null;
  c: Color | null;
  mode: 'line' | 'scatter' | 'bar';
}

export interface PlotSpec {
  kind: 'plot';
  title: string | null;
  xlabel: string | null;
  ylabel: string | null;
  logy: boolean;
  series: PlotSeries[];
  hlines: { y: number; label: string | null }[];
}

export interface Robot3DObject {
  pos: [number, number, number];
  size: number;
  color: Color;
}

export interface Robot3DSpec {
  kind: 'robot3d';
  title: string | null;
  fps: number;
  /** Je Frame 6 Werte: 5 Gelenkwinkel + Greifer (rad). */
  frames: number[][];
  physics: boolean;
  target: [number, number, number] | null;
  objects: Robot3DObject[];
  captions: string[] | null;
}

export type Visual = SceneSpec | PlotSpec | Robot3DSpec;

export interface RunResult {
  status: RunStatus;
  error: PyError | null;
  seconds: number;
  inputsUsed: number;
  stdout: string;
  stderr: string;
  scenes: Visual[];
  tests?: TestResult[];
  trace?: TraceStep[];
}

export interface ProgressInfo {
  fraction: number;
  text: string;
}

export type WorkerRequest = { type: 'run'; id: number; request: RunRequest };

export type WorkerEvent =
  | { type: 'ready' }
  | { type: 'status'; text: string }
  | { type: 'load-failed'; message: string }
  | { type: 'stdout'; id: number; text: string }
  | { type: 'stderr'; id: number; text: string }
  | { type: 'progress'; id: number; info: ProgressInfo }
  | { type: 'result'; id: number; result: RunResult; heapBytes: number };
