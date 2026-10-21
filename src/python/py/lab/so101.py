"""SO-101: 5-Achs-Roboterarm mit Greifer. Kinematik exakt wie im MuJoCo-Modell der App.

Koordinaten in Metern, z zeigt nach oben, Winkel in Radiant.
Gelenke: q = [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll] (+ optional gripper).

from lab import so101
T = so101.fk([0, 0, 0, 0, 0])      # 4x4-Pose des Greifers
p = so101.tool_position(q)           # Greiferspitze (x, y, z)
q, ok = so101.ik([0.25, 0.1, 0.1])   # Gelenkwinkel für eine Zielposition
"""
import math

import numpy as np

from ._so101_data import DATA

JOINTS = ("shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll")
ALL_JOINTS = JOINTS + ("gripper",)
LABELS = {
    "shoulder_pan": "Drehen (Basis)",
    "shoulder_lift": "Schulter heben",
    "elbow_flex": "Ellbogen",
    "wrist_flex": "Handgelenk kippen",
    "wrist_roll": "Handgelenk drehen",
    "gripper": "Greifer",
}

_BODIES = {b["name"]: b for b in DATA["bodies"]}
_JOINT_BODY = {b["joint"]["name"]: b["name"] for b in DATA["bodies"] if b["joint"]}

LIMITS = np.array([_BODIES[_JOINT_BODY[name]]["joint"]["range"] for name in ALL_JOINTS])
GRIPPER_OPEN = 1.2
GRIPPER_CLOSED = 0.0
# Bereitstellung: Greifer zeigt nach unten, ca. 24 cm vor der Basis und 12 cm über dem Boden.
HOME = np.array([0.0, -0.5, 0.3, 1.4, 0.0])
REST = np.array([0.0, -1.57, 1.57, 0.8, 0.0])


def quat_to_matrix(quat):
    """Einheitsquaternion (w, x, y, z) -> 3x3-Rotationsmatrix."""
    w, x, y, z = (float(v) for v in quat)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ])


def transform(pos=(0, 0, 0), quat=(1, 0, 0, 0)):
    """Homogene 4x4-Transformation aus Verschiebung und Quaternion."""
    T = np.eye(4)
    T[:3, :3] = quat_to_matrix(quat)
    T[:3, 3] = [float(v) for v in pos]
    return T


def rotation(axis, angle):
    """Drehung um eine Achse (Rodrigues) als 4x4-Matrix."""
    a = np.asarray(axis, dtype=float)
    a = a / np.linalg.norm(a)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    T = np.eye(4)
    T[:3, :3] = np.eye(3) + math.sin(angle) * K + (1 - math.cos(angle)) * (K @ K)
    return T


def _angles(q):
    q = [float(v) for v in np.ravel(q)]
    if len(q) not in (5, 6):
        raise ValueError(f"so101: q braucht 5 Gelenkwinkel (oder 6 mit Greifer), nicht {len(q)}.")
    if len(q) == 5:
        q.append(GRIPPER_CLOSED)
    return dict(zip(ALL_JOINTS, q))


def frames(q):
    """Weltpose (4x4) jedes Körpers: {'base': T, 'shoulder': T, ...}."""
    angles = _angles(q)
    world = {"world": np.eye(4)}
    for body in DATA["bodies"]:
        T = world[body["parent"]] @ transform(body["pos"], body["quat"])
        if body["joint"]:
            T = T @ rotation(body["joint"]["axis"], angles[body["joint"]["name"]])
        world[body["name"]] = T
    del world["world"]
    return world


def fk(q):
    """Vorwärtskinematik: 4x4-Pose der Greiferspitze (Spalte 3 = Position)."""
    tool = DATA["tool"]
    return frames(q)[tool["body"]] @ transform(tool["pos"], tool["quat"])


def tool_position(q):
    """Position der Greiferspitze (x, y, z) in Metern."""
    return fk(q)[:3, 3].copy()


def camera_pose(q):
    """4x4-Pose der Handgelenkkamera. Sie blickt entlang ihrer -z-Achse, y zeigt im Bild nach oben."""
    cam = DATA["camera"]
    return frames(q)[cam["body"]] @ transform(cam["pos"], cam["quat"])


def clip(q):
    """Gelenkwinkel auf die erlaubten Bereiche begrenzen."""
    q = np.array(np.ravel(q), dtype=float)
    return np.clip(q, LIMITS[: len(q), 0], LIMITS[: len(q), 1])


def jacobian(q, eps=1e-6):
    """Positions-Jacobi-Matrix (3x5): wie stark bewegt sich die Spitze pro Radiant Gelenkdrehung?"""
    q = np.array(np.ravel(q)[:5], dtype=float)
    p0 = tool_position(q)
    J = np.zeros((3, 5))
    for i in range(5):
        dq = q.copy()
        dq[i] += eps
        J[:, i] = (tool_position(dq) - p0) / eps
    return J


def tool_axis(q):
    """Richtung, in die die Greiferfinger zeigen (Einheitsvektor)."""
    return fk(q)[:3, 0].copy()


def _residual(q, target, down, weight):
    r = target - tool_position(q)
    if down:
        a = tool_axis(q)
        r = np.concatenate([r, weight * np.cross(a, [0.0, 0.0, -1.0])])
    return r


def ik(target, q0=None, down=False, iterations=200, damping=0.02, tol=1e-4, weight=0.15):
    """Inverse Kinematik (Damped Least Squares) für die Position der Greiferspitze.

    down=True: zusätzlich sollen die Greiferfinger senkrecht nach unten zeigen (Greifen von oben).
    Gibt (q, erreicht) zurück. Die Handgelenk-Drehung q[4] bleibt wie in q0.
    """
    target = np.asarray(target, dtype=float)
    q = np.array(HOME if q0 is None else np.ravel(q0)[:5], dtype=float)
    eps = 1e-6
    for _ in range(iterations):
        r = _residual(q, target, down, weight)
        if np.linalg.norm(target - tool_position(q)) < tol and (not down or np.linalg.norm(r[3:]) < tol * 10):
            return q, True
        J = np.zeros((len(r), 5))
        for i in range(4):
            dq = q.copy()
            dq[i] += eps
            J[:, i] = (r - _residual(dq, target, down, weight)) / eps
        q = clip(q + J.T @ np.linalg.solve(J @ J.T + damping ** 2 * np.eye(len(r)), r))
    return q, bool(np.linalg.norm(target - tool_position(q)) < 2e-3)


# Feste Kamera vor dem Arm (wie „Vorne“ im Roboterlabor): Position, Achsen (x, y), Öffnungswinkel.
FRONT_CAMERA = {"pos": (0.62, 0.0, 0.42), "x": (0.0, 1.0, 0.0), "y": (-0.55, 0.0, 0.83), "fovy": 50.0}
MAX_DEPTH = 2.0


def _fovy(camera):
    return FRONT_CAMERA["fovy"] if camera == "front" else DATA["camera"]["fovy"]


def front_camera_pose():
    """4x4-Pose der festen Frontkamera (blickt entlang −z, y zeigt im Bild nach oben)."""
    x = np.array(FRONT_CAMERA["x"], dtype=float)
    y = np.array(FRONT_CAMERA["y"], dtype=float)
    x /= np.linalg.norm(x)
    y /= np.linalg.norm(y)
    T = np.eye(4)
    T[:3, 0], T[:3, 1], T[:3, 2] = x, y, np.cross(x, y)
    T[:3, 3] = FRONT_CAMERA["pos"]
    return T


def intrinsics(width, height, camera="wrist"):
    """Lochkamera: (fx, fy, cx, cy) in Pixeln. camera = "wrist" (Handgelenk) oder "front"."""
    fy = 0.5 * height / math.tan(math.radians(_fovy(camera)) / 2)
    return fy, fy, (width - 1) / 2, (height - 1) / 2


def backproject(u, v, depth, width, height, camera="wrist"):
    """Pixel (u nach rechts, v nach unten) mit Tiefe (m, entlang der Blickrichtung) -> Punkt im Kamerasystem."""
    fx, fy, cx, cy = intrinsics(width, height, camera)
    x = (u - cx) / fx * depth
    y = -(v - cy) / fy * depth
    return np.array([x, y, -depth])


def depth_image(q, objects=(), width=64, height=48, camera="wrist"):
    """Tiefenbild (Meter entlang der Blickrichtung) per Raycasting gegen Boden und Würfel.

    objects: Würfel wie bei lab.arm3d, z. B. [{"pos": (0.22, 0.05, 0.015), "size": 0.03}].
    Teile des Roboters selbst kommen im Bild nicht vor. Kein Treffer = MAX_DEPTH.
    """
    T = front_camera_pose() if camera == "front" else camera_pose(q)
    fx, fy, cx, cy = intrinsics(width, height, camera)
    u, v = np.meshgrid(np.arange(width), np.arange(height))
    rays = np.stack([(u - cx) / fx, -(v - cy) / fy, -np.ones_like(u, dtype=float)], axis=-1)
    d = rays @ T[:3, :3].T
    o = T[:3, 3]
    depth = np.full((height, width), MAX_DEPTH)
    with np.errstate(divide="ignore", invalid="ignore"):
        t_floor = np.where(d[..., 2] < 0, -o[2] / d[..., 2], np.inf)
        depth = np.minimum(depth, t_floor)
        for obj in objects:
            c = np.asarray(obj["pos"], dtype=float)
            h = float(obj.get("size", 0.03)) / 2
            t1 = (c - h - o) / d
            t2 = (c + h - o) / d
            t_near = np.nanmax(np.minimum(t1, t2), axis=-1)
            t_far = np.nanmin(np.maximum(t1, t2), axis=-1)
            hit = (t_near <= t_far) & (t_far > 0)
            depth = np.where(hit, np.minimum(depth, np.maximum(t_near, 0)), depth)
    return np.minimum(depth, MAX_DEPTH)


def camera_point_to_world(point, q=None, camera="wrist"):
    """Punkt im Kamerasystem -> Weltkoordinaten."""
    T = front_camera_pose() if camera == "front" else camera_pose(q)
    return (T @ np.append(np.asarray(point, dtype=float), 1.0))[:3]
