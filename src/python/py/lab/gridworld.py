from ._core import to_list
from .viz import Scene

ARROWS = {0: (0, 0.32), 1: (0.32, 0), 2: (0, -0.32), 3: (-0.32, 0)}


def _cell(state, n_cols):
    return (state // n_cols, state % n_cols) if isinstance(state, int) else (int(state[0]), int(state[1]))


def grid(layout, values=None, policy=None, path=None, agent=None, title=None, fps=6, show_values=True):
    """Gridworld zeichnen.

    layout: Liste von Strings ('.', '#', 'S', 'G', 'X').
    values: Werte pro Zustand (flach, Länge Zeilen*Spalten) für die Einfärbung.
    policy: Aktion pro Zustand (0=hoch, 1=rechts, 2=runter, 3=links) als Pfeile.
    path: Folge von Zuständen -> Animation des Agenten.
    """
    rows = [str(r) for r in layout]
    n_rows, n_cols = len(rows), len(rows[0])
    scene = Scene(title, [0, n_cols, 0, n_rows], fps)
    vals = [float(v) for v in to_list(values)] if values is not None else None
    if vals is not None:
        free = [v for s, v in enumerate(vals) if rows[s // n_cols][s % n_cols] != "#"]
        lo, hi = min(free), max(free)
        span = (hi - lo) or 1.0
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            y = n_rows - 1 - r
            s = r * n_cols + c
            if ch == "#":
                scene.rect(c, y, 1, 1, color="bg", fill="fg", static=True)
                continue
            fill = {"G": "good", "X": "bad"}.get(ch)
            if fill is None and vals is not None:
                fill = f"heat:{(vals[s] - lo) / span:.3f}"
            scene.rect(c, y, 1, 1, color="muted", fill=fill, static=True)
            if ch in "SGX":
                scene.text(c + 0.18, y + 0.8, ch, color="fg", size=11, static=True)
            if vals is not None and show_values and ch not in "GX":
                scene.text(c + 0.5, y + 0.15, f"{vals[s]:.1f}", color="fg", size=10, static=True)
            if policy is not None and ch not in "GX":
                a = int(to_list(policy)[s])
                dx, dy = ARROWS[a]
                scene.arrow(c + 0.5 - dx / 2, y + 0.5 - dy / 2, dx, dy, color="fg", width=2, static=True)
    states = [agent] if agent is not None else []
    states += to_list(path) if path is not None else []
    for i, st in enumerate(states):
        if i:
            scene.next_frame()
        r, c = _cell(int(st) if not hasattr(st, "__len__") else st, n_cols)
        scene.circle(c + 0.5, n_rows - 0.5 - r, 0.28, color="accent", fill="accent")
    scene.show()
