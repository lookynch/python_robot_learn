import { useEffect, useRef, useState } from 'preact/hooks';
import { CAMERA_LABELS, drawFrame, type CameraName, type CameraRig, type Frame } from './camera';

export const PREVIEW_SIZE: [number, number] = [128, 96];

/** Livebild einer Roboterkamera: Farbe und Tiefe nebeneinander. `frame` kommt vom Aufrufer (ca. 8 Hz). */
export function CameraPanel({
  frame,
  camera,
  onCamera,
}: {
  frame: Frame | null;
  camera: CameraName;
  onCamera: (camera: CameraName) => void;
}) {
  const rgb = useRef<HTMLCanvasElement>(null);
  const depth = useRef<HTMLCanvasElement>(null);
  const [center, setCenter] = useState<number | null>(null);

  useEffect(() => {
    if (!frame) return;
    drawFrame(rgb.current!, frame, 'rgb');
    drawFrame(depth.current!, frame, 'depth');
    const mid = Math.floor(frame.height / 2) * frame.width + Math.floor(frame.width / 2);
    setCenter(frame.depth[mid] ?? null);
  }, [frame]);

  return (
    <div class="camera-panel">
      <div class="row">
        <strong class="small">Kamera</strong>
        <span class="spacer" />
        {(Object.keys(CAMERA_LABELS) as CameraName[]).map((name) => (
          <button
            key={name}
            class={`btn small ${camera === name ? 'primary' : 'ghost'}`}
            onClick={() => onCamera(name)}
            aria-pressed={camera === name}
          >
            {CAMERA_LABELS[name]}
          </button>
        ))}
      </div>
      <div class="camera-images">
        <figure>
          <canvas ref={rgb} role="img" aria-label="Kamerabild" />
          <figcaption class="small muted">Farbbild</figcaption>
        </figure>
        <figure>
          <canvas ref={depth} role="img" aria-label="Tiefenbild" />
          <figcaption class="small muted">
            Tiefe (hell = nah){center !== null && ` · Mitte ${(center * 100).toFixed(1)} cm`}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

export function captureSafely(rig: CameraRig | null, camera: CameraName): Frame | null {
  try {
    return rig ? rig.capture(camera, ...PREVIEW_SIZE) : null;
  } catch {
    return null;
  }
}
