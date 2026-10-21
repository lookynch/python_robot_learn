import { JOINT_LABELS, JOINTS, type Sim } from './sim';

const deg = (rad: number) => Math.round((rad * 180) / Math.PI);

export interface JointSlidersProps {
  sim: Sim;
  targets: number[];
  actual: number[];
  onChange: (index: number, value: number) => void;
}

/** Ein Regler pro Servo: der Wert ist der Sollwinkel, „ist“ zeigt, wo das Gelenk gerade steht. */
export function JointSliders({ sim, targets, actual, onChange }: JointSlidersProps) {
  return (
    <div class="joint-sliders">
      {JOINTS.map((joint, i) => {
        const [lo, hi] = sim.jointRange(i);
        const value = targets[i] ?? 0;
        return (
          <label key={joint} class="joint-slider">
            <span class="joint-name">
              <span class="joint-num">{i + 1}</span>
              {JOINT_LABELS[joint]}
            </span>
            <span class="joint-values small muted">
              Soll {deg(value)}° · Ist {deg(actual[i] ?? 0)}°
            </span>
            <input
              type="range"
              min={lo}
              max={hi}
              step={0.005}
              value={value}
              aria-label={JOINT_LABELS[joint]}
              onInput={(e) => onChange(i, Number((e.target as HTMLInputElement).value))}
            />
          </label>
        );
      })}
    </div>
  );
}
