from . import _core
from ._core import num, points, to_list


class Scene:
    """Animierte 2D-Szene in Weltkoordinaten (y zeigt nach oben)."""

    def __init__(self, title=None, bounds=None, fps=30):
        self.title = title
        self.bounds = [num(b) for b in bounds] if bounds is not None else None
        self.fps = fps
        self.background = []
        self.frames = [[]]
        self.captions = [None]

    def _add(self, prim, static):
        (self.background if static else self.frames[-1]).append(prim)
        return self

    def line(self, pts, color="fg", width=2, dashed=False, static=False):
        return self._add({"t": "line", "p": points(pts), "c": color, "lw": width, "d": bool(dashed)}, static)

    def circle(self, x, y, r, color="fg", fill=None, width=2, static=False):
        return self._add({"t": "circle", "x": num(x), "y": num(y), "r": num(r), "c": color, "f": fill, "lw": width}, static)

    def rect(self, x, y, w, h, color="fg", fill=None, width=1, static=False):
        return self._add({"t": "rect", "x": num(x), "y": num(y), "w": num(w), "h": num(h), "c": color, "f": fill, "lw": width}, static)

    def poly(self, pts, color="fg", fill=None, width=2, static=False):
        return self._add({"t": "poly", "p": points(pts), "c": color, "f": fill, "lw": width}, static)

    def arrow(self, x, y, dx, dy, color="accent", width=2, static=False):
        return self._add({"t": "arrow", "x": num(x), "y": num(y), "dx": num(dx), "dy": num(dy), "c": color, "lw": width}, static)

    def text(self, x, y, s, color="fg", size=13, align="c", static=False):
        return self._add({"t": "text", "x": num(x), "y": num(y), "s": str(s), "c": color, "size": size, "a": align}, static)

    def caption(self, s):
        self.captions[-1] = str(s)
        return self

    def next_frame(self):
        self.frames.append([])
        self.captions.append(None)
        return self

    def show(self):
        frames = self.frames if self.frames[-1] or len(self.frames) == 1 else self.frames[:-1]
        captions = self.captions[: len(frames)]
        if len(frames) > _core.MAX_FRAMES:
            keep = _core.subsample(list(range(len(frames))), _core.MAX_FRAMES)
            frames = [frames[i] for i in keep]
            captions = [captions[i] for i in keep]
        _core.emit({
            "kind": "scene",
            "title": self.title,
            "bounds": self.bounds,
            "fps": self.fps,
            "static": self.background,
            "frames": frames,
            "captions": captions if any(c is not None for c in captions) else None,
        })


class Figure:
    """Liniendiagramm oder Punktwolke mit beliebig vielen Reihen."""

    def __init__(self, title=None, xlabel=None, ylabel=None, logy=False):
        self.title = title
        self.xlabel = xlabel
        self.ylabel = ylabel
        self.logy = logy
        self.series = []
        self.hlines = []

    def _series(self, x, y, label, color, mode):
        ys = to_list(y)
        xs = to_list(x) if x is not None else list(range(len(ys)))
        if len(xs) != len(ys):
            raise ValueError(f"plot: x hat {len(xs)} Werte, y hat {len(ys)} – beide müssen gleich lang sein.")
        pairs = _core.subsample(list(zip(xs, ys)), _core.MAX_POINTS)
        self.series.append({
            "x": [num(p[0], "x") for p in pairs],
            "y": [num(p[1], "y") for p in pairs],
            "label": label,
            "c": color,
            "mode": mode,
        })
        return self

    def line(self, y, x=None, label=None, color=None):
        return self._series(x, y, label, color, "line")

    def scatter(self, x, y, label=None, color=None):
        return self._series(x, y, label, color, "scatter")

    def bars(self, x, heights, label=None, color=None):
        return self._series(x, heights, label, color, "bar")

    def hline(self, y, label=None):
        self.hlines.append({"y": num(y), "label": label})
        return self

    def show(self):
        _core.emit({
            "kind": "plot",
            "title": self.title,
            "xlabel": self.xlabel,
            "ylabel": self.ylabel,
            "logy": self.logy,
            "series": self.series,
            "hlines": self.hlines,
        })


def plot(y, x=None, label=None, title=None, xlabel=None, ylabel=None, logy=False):
    Figure(title, xlabel, ylabel, logy).line(y, x, label).show()


def scatter(x, y, label=None, title=None, xlabel=None, ylabel=None):
    Figure(title, xlabel, ylabel).scatter(x, y, label).show()


def hist(values, bins=20, title=None, xlabel=None, ylabel="Anzahl", density=False):
    values = [float(v) for v in to_list(values)]
    lo, hi = min(values), max(values)
    if lo == hi:
        lo, hi = lo - 0.5, hi + 0.5
    width = (hi - lo) / bins
    counts = [0] * bins
    for v in values:
        counts[min(bins - 1, int((v - lo) / width))] += 1
    if density:
        counts = [c / (len(values) * width) for c in counts]
    centers = [lo + (i + 0.5) * width for i in range(bins)]
    Figure(title, xlabel, ylabel).bars(centers, counts).show()


def vectors(vecs, labels=None, origin=(0, 0), title=None, bounds=None):
    vecs = [to_list(v) for v in vecs]
    scene = Scene(title, bounds)
    ox, oy = num(origin[0]), num(origin[1])
    reach = max([abs(ox) + abs(v[0]) for v in vecs] + [abs(oy) + abs(v[1]) for v in vecs] + [1.0])
    scene.line([(-reach, 0), (reach, 0)], color="muted", width=1, static=True)
    scene.line([(0, -reach), (0, reach)], color="muted", width=1, static=True)
    for i, v in enumerate(vecs):
        color = f"c{i % 6 + 1}"
        scene.arrow(ox, oy, v[0], v[1], color=color, width=3)
        if labels is not None and i < len(labels):
            scene.text(ox + v[0] * 1.08, oy + v[1] * 1.08, labels[i], color=color)
    scene.show()


def heatmap(matrix, title=None, labels=False):
    rows = [to_list(r) for r in to_list(matrix)]
    flat = [float(v) for r in rows for v in r]
    lo, hi = min(flat), max(flat)
    span = (hi - lo) or 1.0
    n_rows = len(rows)
    scene = Scene(title, bounds=[0, len(rows[0]), 0, n_rows])
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            t = (float(value) - lo) / span
            scene.rect(j, n_rows - 1 - i, 1, 1, color="bg", fill=f"heat:{t:.3f}")
            if labels:
                scene.text(j + 0.5, n_rows - 0.5 - i, f"{float(value):.2g}", size=11)
    scene.show()
