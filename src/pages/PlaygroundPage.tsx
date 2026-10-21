import { useEffect, useRef, useState } from 'preact/hooks';
import { RunPanel } from '../components/RunPanel';
import { toast } from '../components/Toast';
import { CodeEditor } from '../editor/CodeEditor';
import { copyText } from '../learning/ai-context';
import { saveDraft, useProgress } from '../learning/store';
import { useRunner } from '../python/useRunner';

export const EXAMPLES: { name: string; code: string }[] = [
  {
    name: 'Hallo',
    code: 'name = input("Wie heißt du? ")\nprint(f"Hallo {name}!")\n',
  },
  {
    name: 'Roboterarm',
    code: `import math
import lab

# Zwei Gelenke fahren gleichmäßig von 0 zu den Zielwinkeln
frames = []
for i in range(61):
    t = i / 60
    frames.append((t * math.pi / 2, t * -math.pi / 3))

lab.arm(frames, links=(1.0, 0.8), title="Arm fährt zur Zielstellung")
`,
  },
  {
    name: 'Roboter 3D',
    code: `import numpy as np
import lab
from lab import so101

# Der SO-101 fährt per inverser Kinematik über den Würfel.
ziel = np.array([0.24, 0.08, 0.06])
q_ziel, erreicht = so101.ik(ziel)
print("erreichbar:", erreicht)
print("Gelenkwinkel (Grad):", np.round(np.degrees(q_ziel), 1))

frames = [so101.HOME + t * (q_ziel - so101.HOME) for t in np.linspace(0, 1, 60)]
lab.arm3d(frames, gripper=1.0, target=ziel, title="SO-101 fährt zum Ziel",
          objects=[{"pos": (0.24, 0.08, 0.015), "size": 0.03}])
`,
  },
  {
    name: 'Greifen',
    code: `import numpy as np
import lab
from lab import so101

wuerfel = (0.23, 0.06, 0.015)
x, y, _ = wuerfel
AUF, ZU = 1.2, -0.1

def fahre(q_von, ziel, greifer, schritte):
    """Sollwinkel-Folge: Greifer zeigt nach unten, Gelenke laufen linear zum IK-Ergebnis."""
    q_ziel, ok = so101.ik(ziel, q0=q_von, down=True)
    q_ziel[4] = -q_ziel[0]          # Backen parallel zu den Würfelseiten
    return [np.append(q_von + t * (q_ziel - q_von), greifer) for t in np.linspace(0, 1, schritte)], q_ziel

q = so101.HOME.copy()
plan = []
for ziel, greifer, schritte in [((x, y, 0.07), AUF, 40), ((x, y, 0.011), AUF, 30),
                                ((x, y, 0.011), ZU, 25), ((x, y, 0.10), ZU, 40)]:
    teil, q = fahre(q, ziel, greifer, schritte)
    plan += teil

lab.arm3d(plan, physics=True, objects=[{"pos": wuerfel, "size": 0.03}],
          title="Python greift den Würfel (mit Physik)")
`,
  },
  {
    name: 'Pendel',
    code: `import numpy as np
from lab.envs import Pendulum

env = Pendulum()
state = env.reset(theta=2.5)
states = [state]
for _ in range(120):
    state, reward, _ = env.step(0.0)
    states.append(state)

env.render(np.array(states), title="Freies Pendel")
`,
  },
  {
    name: 'Gridworld',
    code: `from lab.envs import GridWorld

env = GridWorld()
policy = [1] * env.n_states
env.render(values=list(range(env.n_states)), policy=policy, path=[0, 1, 2, 6, 10, 14, 15], title="Pfad durch die Welt")
`,
  },
  {
    name: 'Plot',
    code: `import numpy as np
import lab

x = np.linspace(0, 2 * np.pi, 100)
fig = lab.Figure(title="Sinus und Kosinus", xlabel="x (rad)")
fig.line(np.sin(x), x, label="sin")
fig.line(np.cos(x), x, label="cos")
fig.show()
`,
  },
];

const DRAFT_KEY = 'playground';

export function PlaygroundPage() {
  const progress = useProgress();
  const [code, setCode] = useState(() => progress.drafts[DRAFT_KEY]?.code ?? EXAMPLES[1]!.code);
  const runner = useRunner();
  const [resetKey, setResetKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(DRAFT_KEY, code), 800);
    return () => clearTimeout(timer.current);
  }, [code]);

  const copy = async () => {
    const parts = [
      `Mein Python-Code (läuft im Browser mit Pyodide/NumPy):\n\`\`\`python\n${code}\n\`\`\``,
    ];
    if (runner.result?.stdout)
      parts.push(`Ausgabe:\n\`\`\`text\n${runner.result.stdout.slice(-3000)}\n\`\`\``);
    if (runner.result?.error)
      parts.push(`Fehler:\n\`\`\`text\n${runner.result.error.traceback}\n\`\`\``);
    toast(
      (await copyText(parts.join('\n\n')))
        ? 'Code und Ausgabe kopiert.'
        : 'Kopieren nicht möglich.',
    );
  };

  return (
    <div class="page wide stack">
      <h1>Spielwiese</h1>
      <div class="row">
        {EXAMPLES.map((e) => (
          <button
            key={e.name}
            class="btn small"
            onClick={() => {
              setCode(e.code);
              setResetKey((k) => k + 1);
              runner.clear();
            }}
          >
            {e.name}
          </button>
        ))}
      </div>
      <div class="step-grid" style={{ display: 'grid', gap: '14px' }}>
        <CodeEditor
          value={code}
          resetKey={resetKey}
          onChange={setCode}
          errorLine={runner.result?.error?.line}
        />
        <RunPanel
          runner={runner}
          onRun={() => void runner.run(code, { interactive: true })}
          actions={
            <button class="btn small ghost" onClick={copy}>
              KI-Kontext
            </button>
          }
        />
      </div>
    </div>
  );
}
