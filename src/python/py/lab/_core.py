import json
import math

MAX_FRAMES = 600
MAX_POINTS = 5000

scenes = []
hooks = {"progress": None}


def reset():
    scenes.clear()


def to_list(values):
    if hasattr(values, "tolist"):
        return values.tolist()
    return list(values)


def num(value, what="Wert"):
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"Visualisierung: {what} ist {value} – nur endliche Zahlen lassen sich zeichnen.")
    return round(value, 5)


def points(pts):
    return [[num(p[0], "x"), num(p[1], "y")] for p in to_list(pts)]


def emit(scene):
    scenes.append(scene)
    if len(scenes) > 20:
        raise RuntimeError("Mehr als 20 Visualisierungen in einem Lauf – rufe show() seltener auf.")


def subsample(items, limit):
    if len(items) <= limit:
        return items
    step = len(items) / limit
    return [items[int(i * step)] for i in range(limit - 1)] + [items[-1]]


def progress(fraction, text=""):
    hook = hooks["progress"]
    if hook is not None:
        hook(json.dumps({"fraction": max(0.0, min(1.0, float(fraction))), "text": str(text)}))
