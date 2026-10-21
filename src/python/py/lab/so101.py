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


def ik(target, q0=None, iterations=200, damping=0.02, tol=1e-4, step=1.0):
    """Inverse Kinematik (Damped Least Squares) für die Position der Greiferspitze.

    Gibt (q, erreicht) zurück. Die Handgelenk-Drehung bleibt wie in q0.
    """
    target = np.asarray(target, dtype=float)
    q = np.array(HOME if q0 is None else np.ravel(q0)[:5], dtype=float)
    for _ in range(iterations):
        error = target - tool_position(q)
        if np.linalg.norm(error) < tol:
            return q, True
        J = jacobian(q)
        J[:, 4] = 0.0
        dq = J.T @ np.linalg.solve(J @ J.T + damping ** 2 * np.eye(3), error)
        q = clip(q + step * dq)
    return q, bool(np.linalg.norm(target - tool_position(q)) < tol * 10)


def intrinsics(width, height):
    """Lochkamera der Handgelenkkamera: (fx, fy, cx, cy) in Pixeln."""
    fy = 0.5 * height / math.tan(math.radians(DATA["camera"]["fovy"]) / 2)
    return fy, fy, (width - 1) / 2, (height - 1) / 2


def backproject(u, v, depth, width, height):
    """Pixel (u nach rechts, v nach unten) mit Tiefe (m, entlang der Blickrichtung) -> Punkt im Kamerasystem."""
    fx, fy, cx, cy = intrinsics(width, height)
    x = (u - cx) / fx * depth
    y = -(v - cy) / fy * depth
    return np.array([x, y, -depth])
