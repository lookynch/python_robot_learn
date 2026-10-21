import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Robot3DSpec } from '../python/protocol';
import { readPalette, resolveColor } from '../viz/colors';
import { RobotCanvas } from './RobotCanvas';
import { Sim, type CubeSpec } from './sim';

function cubesOf(spec: Robot3DSpec, element: Element): CubeSpec[] {
  const palette = readPalette(element);
  return spec.objects.map((o) => {
    const c = new THREE.Color(resolveColor(o.color, palette));
    return { pos: o.pos, size: o.size, rgba: [c.r, c.g, c.b, 1] };
  });
}

/** Spielt eine Folge von Stellungen aus lab.arm3d ab – als Kinematik oder mit Physik (Sollwinkel). */
export function Robot3DVisual({ spec }: { spec: Robot3DSpec }) {
  const host = useRef<HTMLDivElement>(null);
  const [sim, setSim] = useState<Sim | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frames = spec.frames.length;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(frames > 1);
  const [speed, setSpeed] = useState(1);
  const clock = useRef({ shown: -1, acc: 0 });
  const state = useRef({ frame, playing, speed });
  state.current = { frame, playing, speed };

  useEffect(() => {
    let created: Sim | null = null;
    let cancelled = false;
    Sim.create(cubesOf(spec, host.current!)).then(
      (s) => {
        if (cancelled) return s.dispose();
        created = s;
        clock.current = { shown: -1, acc: 0 };
        setFrame(0);
        setPlaying(spec.frames.length > 1);
        setSim(s);
      },
      (e: unknown) => setError(String(e)),
    );
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [spec]);

  const show = useMemo(
    () => (s: Sim, index: number) => {
      const q = spec.frames[index]!;
      if (!spec.physics) {
        s.setJoints(q);
        s.forward();
      } else {
        // Physik ist nicht umkehrbar: rückwärts springen heißt neu simulieren.
        if (index < clock.current.shown || clock.current.shown < 0) {
          s.reset(spec.frames[0]!);
          clock.current.shown = 0;
        }
        for (let i = clock.current.shown + 1; i <= index; i++) {
          s.setTargets(spec.frames[i]!);
          s.step(1 / spec.fps);
        }
      }
      clock.current.shown = index;
    },
    [spec],
  );

  const onFrame = (dt: number) => {
    if (!sim) return;
    const { frame: current, playing: isPlaying, speed: factor } = state.current;
    let next = current;
    if (isPlaying && frames > 1) {
      clock.current.acc += dt * spec.fps * factor;
      const steps = Math.floor(clock.current.acc);
      clock.current.acc -= steps;
      next = Math.min(frames - 1, current + steps);
      if (next !== current) setFrame(next);
      if (next >= frames - 1) setPlaying(false);
    }
    if (next !== clock.current.shown) show(sim, next);
  };

  const caption = spec.captions?.[frame] ?? null;
  return (
    <div class="visual" ref={host}>
      {spec.title && <div class="title">{spec.title}</div>}
      {error && <div class="banner bad small">3D-Ansicht nicht verfügbar: {error}</div>}
      {!sim && !error && <div class="empty small">3D-Modell wird geladen …</div>}
      {sim && (
        <RobotCanvas
          sim={sim}
          label={spec.title ?? 'SO-101 in 3D'}
          target={spec.target}
          onFrame={onFrame}
        />
      )}
      {spec.captions && <div class="caption">{caption ?? ''}</div>}
      {frames > 1 && (
        <div class="anim-controls">
          <button
            class="icon-btn"
            onClick={() => {
              if (frame >= frames - 1) setFrame(0);
              setPlaying(!playing);
            }}
            aria-label={playing ? 'Pause' : 'Abspielen'}
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={frames - 1}
            value={frame}
            aria-label="Zeitpunkt"
            onInput={(e) => {
              setPlaying(false);
              setFrame(Number((e.target as HTMLInputElement).value));
            }}
          />
          <button
            class="btn small ghost"
            onClick={() => setSpeed(speed >= 4 ? 0.25 : speed * 2)}
            aria-label="Geschwindigkeit"
          >
            {speed}×
          </button>
        </div>
      )}
      {spec.physics && (
        <div class="small muted">Mit Physik: Die Winkel sind Sollwerte für die Servos.</div>
      )}
    </div>
  );
}
