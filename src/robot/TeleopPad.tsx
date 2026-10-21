import type { JSX } from 'preact';
import type { Teleop } from './teleop';
import { KEY_HELP } from './teleop';

type Axis = { move?: [number, number, number]; roll?: number };

/** Steuerkreuz für Touch und Maus: gedrückt halten = Greifer bewegt sich. */
export function TeleopPad({
  teleop,
  onToggleGrip,
  gripperOpen,
}: {
  teleop: Teleop;
  onToggleGrip: () => void;
  gripperOpen: boolean;
}) {
  const hold = (axis: Axis, label: string, text: string): JSX.Element => {
    const start = (event: PointerEvent) => {
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // Ohne Capture endet die Bewegung beim Verlassen der Taste – auch in Ordnung.
      }
      teleop.pad = { move: axis.move ?? [0, 0, 0], roll: axis.roll ?? 0, grip: 0 };
    };
    const stop = () => (teleop.pad = { move: [0, 0, 0], roll: 0, grip: 0 });
    return (
      <button
        type="button"
        class="pad-btn"
        aria-label={label}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        {text}
      </button>
    );
  };
  return (
    <div class="teleop">
      <div class="pad-grid" aria-label="Greifer bewegen">
        <span />
        {hold({ move: [1, 0, 0] }, 'Vor', '▲')}
        <span />
        {hold({ move: [0, 1, 0] }, 'Links', '◀')}
        <span class="pad-center small muted">x / y</span>
        {hold({ move: [0, -1, 0] }, 'Rechts', '▶')}
        <span />
        {hold({ move: [-1, 0, 0] }, 'Zurück', '▼')}
        <span />
      </div>
      <div class="pad-column">
        {hold({ move: [0, 0, 1] }, 'Hoch', 'Hoch')}
        {hold({ move: [0, 0, -1] }, 'Runter', 'Runter')}
      </div>
      <div class="pad-column">
        {hold({ roll: 1 }, 'Handgelenk links drehen', '⟲')}
        {hold({ roll: -1 }, 'Handgelenk rechts drehen', '⟳')}
        <button
          type="button"
          class={`pad-btn ${gripperOpen ? '' : 'active'}`}
          onClick={onToggleGrip}
          aria-pressed={!gripperOpen}
        >
          {gripperOpen ? 'Greifen' : 'Loslassen'}
        </button>
      </div>
      <details class="small key-help">
        <summary>Tastatur & Gamepad</summary>
        <table>
          <tbody>
            {KEY_HELP.map(([key, what]) => (
              <tr key={key}>
                <td>
                  <kbd>{key}</kbd>
                </td>
                <td>{what}</td>
              </tr>
            ))}
            <tr>
              <td>Gamepad</td>
              <td>linker Stick: vor/seitlich · rechter Stick: hoch/runter · A: Greifer</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
