import math

from ._core import to_list
from .viz import Scene

TRAIL_POINTS = 60


def _is_sequence_of_configs(q):
    first = to_list(q)[0] if len(to_list(q)) else 0
    return hasattr(first, "__len__") or hasattr(first, "tolist")


def arm_points(q, links=(1.0, 1.0), base=(0.0, 0.0)):
    """Gelenkpositionen eines planaren Arms (Winkel relativ zum vorherigen Glied)."""
    x, y = float(base[0]), float(base[1])
    angle = 0.0
    pts = [(x, y)]
    for qi, li in zip(to_list(q), links):
        angle += float(qi)
        x += float(li) * math.cos(angle)
        y += float(li) * math.sin(angle)
        pts.append((x, y))
    return pts


def chain(frames, title=None, target=None, trail=True, bounds=None, fps=30, captions=None):
    """Zeichnet einen Arm aus fertigen Gelenkpositionen: frames = [[(x0,y0),(x1,y1),...], ...]."""
    frames = [[tuple(map(float, p)) for p in to_list(f)] for f in to_list(frames)]
    reach = max(math.hypot(px - frames[0][0][0], py - frames[0][0][1]) for f in frames for px, py in f) or 1.0
    bx, by = frames[0][0]
    pad = reach * 1.15
    scene = Scene(title, bounds or [bx - pad, bx + pad, by - pad, by + pad], fps)
    scene.circle(bx, by, reach, color="muted", width=1, static=True)
    scene.rect(bx - reach * 0.08, by - reach * 0.08, reach * 0.16, reach * 0.08, color="muted", fill="muted", static=True)
    if target is not None:
        tx, ty = float(target[0]), float(target[1])
        scene.circle(tx, ty, reach * 0.04, color="bad", fill="bad", static=True)
        scene.circle(tx, ty, reach * 0.08, color="bad", width=1, static=True)
    tips = []
    for i, pts in enumerate(frames):
        if i:
            scene.next_frame()
        tips.append(pts[-1])
        if trail and len(tips) > 1:
            scene.line(tips[-TRAIL_POINTS:], color="accent", width=1, dashed=True)
        scene.line(pts, color="c1", width=7)
        for px, py in pts[:-1]:
            scene.circle(px, py, reach * 0.035, color="fg", fill="bg", width=2)
        scene.circle(pts[-1][0], pts[-1][1], reach * 0.03, color="accent", fill="accent")
        if captions is not None and i < len(captions):
            scene.caption(captions[i])
    scene.show()


def arm(q, links=(1.0, 1.0), target=None, title=None, trail=True, fps=30, captions=None):
    """Planarer Arm. q = Gelenkwinkel (eine Stellung) oder Folge von Stellungen (Animation)."""
    configs = to_list(q) if _is_sequence_of_configs(q) else [q]
    chain([arm_points(c, links) for c in configs], title=title, target=target, trail=trail, fps=fps, captions=captions)


def pendulum(theta, length=1.0, title=None, fps=20, captions=None):
    """Pendel; theta = 0 zeigt nach oben, positiv gegen den Uhrzeigersinn."""
    thetas = to_list(theta) if hasattr(theta, "__len__") or hasattr(theta, "tolist") else [theta]
    pad = length * 1.25
    scene = Scene(title, [-pad, pad, -pad, pad], fps)
    scene.circle(0, 0, length, color="muted", width=1, static=True)
    scene.line([(0, 0), (0, length)], color="good", width=1, dashed=True, static=True)
    for i, th in enumerate(thetas):
        if i:
            scene.next_frame()
        x, y = -length * math.sin(float(th)), length * math.cos(float(th))
        scene.line([(0, 0), (x, y)], color="c1", width=5)
        scene.circle(x, y, length * 0.09, color="c1", fill="c1")
        scene.circle(0, 0, length * 0.04, color="fg", fill="bg")
        if captions is not None and i < len(captions):
            scene.caption(captions[i])
    scene.show()


def cartpole(x, theta, pole_length=1.0, title=None, fps=50, track=2.4, captions=None):
    """Wagen mit Stab; theta = 0 aufrecht."""
    xs = to_list(x) if hasattr(x, "__len__") or hasattr(x, "tolist") else [x]
    ths = to_list(theta) if hasattr(theta, "__len__") or hasattr(theta, "tolist") else [theta]
    scene = Scene(title, [-track - 0.6, track + 0.6, -0.6, pole_length + 0.8], fps)
    scene.line([(-track - 0.4, -0.15), (track + 0.4, -0.15)], color="muted", width=2, static=True)
    for edge in (-track, track):
        scene.line([(edge, -0.3), (edge, 0.2)], color="bad", width=1, dashed=True, static=True)
    for i, (cx, th) in enumerate(zip(xs, ths)):
        if i:
            scene.next_frame()
        cx, th = float(cx), float(th)
        scene.rect(cx - 0.25, -0.15, 0.5, 0.3, color="fg", fill="c2")
        tip = (cx + pole_length * math.sin(th), 0.15 + pole_length * math.cos(th))
        scene.line([(cx, 0.15), tip], color="c1", width=6)
        scene.circle(cx, 0.15, 0.05, color="fg", fill="bg")
        if captions is not None and i < len(captions):
            scene.caption(captions[i])
    scene.show()
