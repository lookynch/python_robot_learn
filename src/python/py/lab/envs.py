"""Kleine Simulationsumgebungen mit Gymnasium-ähnlicher Schnittstelle (reset/step)."""
import math

import numpy as np

from . import gridworld, robots


def angle_normalize(x):
    return (np.asarray(x) + np.pi) % (2 * np.pi) - np.pi


class GridWorld:
    """Diskrete Welt. Aktionen: 0=hoch, 1=rechts, 2=runter, 3=links.

    Zeichen: '.' frei, '#' Wand, 'S' Start, 'G' Ziel (Episode endet), 'X' Falle.
    env.P[s][a] = Liste von (Wahrscheinlichkeit, nächster Zustand, Belohnung, fertig).
    """

    ACTION_NAMES = ("hoch", "rechts", "runter", "links")
    MOVES = ((-1, 0), (0, 1), (1, 0), (0, -1))
    DEFAULT_LAYOUT = (
        "S...",
        ".#..",
        "...X",
        "#..G",
    )

    def __init__(self, layout=None, slip=0.0, step_reward=-1.0, goal_reward=0.0, trap_reward=-100.0,
                 trap_resets=True, max_steps=200, seed=None):
        self.layout = [str(r) for r in (layout or self.DEFAULT_LAYOUT)]
        self.n_rows, self.n_cols = len(self.layout), len(self.layout[0])
        self.n_states = self.n_rows * self.n_cols
        self.n_actions = 4
        self.slip = slip
        self.step_reward, self.goal_reward, self.trap_reward = step_reward, goal_reward, trap_reward
        self.trap_resets = trap_resets
        self.max_steps = max_steps
        self.rng = np.random.default_rng(seed)
        self.start = next(r * self.n_cols + c for r, row in enumerate(self.layout) for c, ch in enumerate(row) if ch == "S")
        self.P = self._build_transitions()
        self.state, self.t = self.start, 0

    def char(self, s):
        return self.layout[s // self.n_cols][s % self.n_cols]

    def is_terminal(self, s):
        return self.char(s) in "G#" or (self.char(s) == "X" and not self.trap_resets)

    def _move(self, s, a):
        r, c = divmod(s, self.n_cols)
        dr, dc = self.MOVES[a]
        r2, c2 = r + dr, c + dc
        if not (0 <= r2 < self.n_rows and 0 <= c2 < self.n_cols) or self.layout[r2][c2] == "#":
            return s
        return r2 * self.n_cols + c2

    def _outcome(self, s, a):
        s2 = self._move(s, a)
        ch = self.char(s2)
        if ch == "G":
            return s2, self.goal_reward, True
        if ch == "X":
            return (self.start, self.trap_reward, False) if self.trap_resets else (s2, self.trap_reward, True)
        return s2, self.step_reward, False

    def _build_transitions(self):
        P = []
        for s in range(self.n_states):
            row = []
            for a in range(self.n_actions):
                if self.is_terminal(s):
                    row.append([(1.0, s, 0.0, True)])
                    continue
                outcomes = [(1.0 - self.slip, a)]
                if self.slip > 0:
                    outcomes += [(self.slip / 2, (a + 1) % 4), (self.slip / 2, (a + 3) % 4)]
                row.append([(p, *self._outcome(s, b)) for p, b in outcomes])
            P.append(row)
        return P

    def reset(self):
        self.state, self.t = self.start, 0
        return self.state

    def step(self, action):
        options = self.P[self.state][int(action)]
        i = self.rng.choice(len(options), p=[o[0] for o in options]) if len(options) > 1 else 0
        _, s2, reward, done = options[i]
        self.state = s2
        self.t += 1
        return s2, reward, done or self.t >= self.max_steps

    def render(self, values=None, policy=None, path=None, title=None, agent=None, fps=6, show_values=True):
        gridworld.grid(self.layout, values=values, policy=policy, path=path, agent=agent, title=title, fps=fps,
                       show_values=show_values)


class Pendulum:
    """Pendel mit Motor (wie Gymnasium Pendulum-v1). Zustand [theta, theta_dot], theta = 0 oben."""

    def __init__(self, dt=0.05, g=10.0, m=1.0, l=1.0, max_torque=2.0, max_speed=8.0):
        self.dt, self.g, self.m, self.l = dt, g, m, l
        self.max_torque, self.max_speed = max_torque, max_speed
        self.state = np.array([math.pi, 0.0])

    def reset(self, theta=math.pi, theta_dot=0.0):
        self.state = np.array([float(theta), float(theta_dot)])
        return self.state.copy()

    def dynamics(self, state, u):
        state = np.asarray(state, dtype=float)
        u = np.clip(np.asarray(u, dtype=float), -self.max_torque, self.max_torque)
        th, thd = state[..., 0], state[..., 1]
        thdd = 3 * self.g / (2 * self.l) * np.sin(th) + 3.0 / (self.m * self.l ** 2) * u
        thd2 = np.clip(thd + thdd * self.dt, -self.max_speed, self.max_speed)
        return np.stack([th + thd2 * self.dt, thd2], axis=-1)

    def cost(self, state, u):
        state = np.asarray(state, dtype=float)
        u = np.clip(np.asarray(u, dtype=float), -self.max_torque, self.max_torque)
        return angle_normalize(state[..., 0]) ** 2 + 0.1 * state[..., 1] ** 2 + 0.001 * u ** 2

    def step(self, u):
        reward = -float(self.cost(self.state, u))
        self.state = self.dynamics(self.state, u)
        return self.state.copy(), reward, False

    def render(self, states, title=None):
        states = np.asarray(states, dtype=float)
        robots.pendulum(states[:, 0] if states.ndim == 2 else states, self.l, title=title, fps=int(round(1 / self.dt)))


class CartPole:
    """Wagen mit Stab (wie Gymnasium CartPole-v1). Zustand [x, x_dot, theta, theta_dot], Aktion 0=links, 1=rechts."""

    def __init__(self, max_steps=500, seed=None):
        self.gravity, self.m_cart, self.m_pole = 9.8, 1.0, 0.1
        self.half_length, self.force_mag, self.dt = 0.5, 10.0, 0.02
        self.x_limit, self.theta_limit = 2.4, 12 * 2 * math.pi / 360
        self.max_steps = max_steps
        self.rng = np.random.default_rng(seed)
        self.state = np.zeros(4)
        self.t = 0

    def reset(self):
        self.state = self.rng.uniform(-0.05, 0.05, size=4)
        self.t = 0
        return self.state.copy()

    def dynamics(self, state, force):
        state = np.asarray(state, dtype=float)
        x, x_dot, th, th_dot = (state[..., i] for i in range(4))
        total = self.m_cart + self.m_pole
        cos, sin = np.cos(th), np.sin(th)
        tmp = (force + self.m_pole * self.half_length * th_dot ** 2 * sin) / total
        th_acc = (self.gravity * sin - cos * tmp) / (self.half_length * (4.0 / 3.0 - self.m_pole * cos ** 2 / total))
        x_acc = tmp - self.m_pole * self.half_length * th_acc * cos / total
        return np.stack([x + self.dt * x_dot, x_dot + self.dt * x_acc,
                         th + self.dt * th_dot, th_dot + self.dt * th_acc], axis=-1)

    def failed(self, state):
        state = np.asarray(state)
        return (np.abs(state[..., 0]) > self.x_limit) | (np.abs(state[..., 2]) > self.theta_limit)

    def step(self, action):
        force = self.force_mag if int(action) == 1 else -self.force_mag
        self.state = self.dynamics(self.state, force)
        self.t += 1
        done = bool(self.failed(self.state)) or self.t >= self.max_steps
        return self.state.copy(), 1.0, done

    def render(self, states, title=None):
        states = np.asarray(states, dtype=float)
        robots.cartpole(states[:, 0], states[:, 2], pole_length=2 * self.half_length, title=title)


class Reacher2D:
    """Kinematischer 2-Gelenk-Arm: Aktion = Gelenkgeschwindigkeiten (rad/s). Ziel: Spitze zum Zielpunkt."""

    def __init__(self, links=(1.0, 1.0), dt=0.05, max_speed=2.0, seed=None):
        self.links = tuple(float(l) for l in links)
        self.dt, self.max_speed = dt, max_speed
        self.rng = np.random.default_rng(seed)
        self.q = np.zeros(2)
        self.goal = np.array([1.0, 1.0])

    def reset(self, q=(0.0, 0.0), goal=None):
        self.q = np.array(q, dtype=float)
        if goal is None:
            radius = self.rng.uniform(0.4, 0.95) * sum(self.links)
            angle = self.rng.uniform(-math.pi, math.pi)
            goal = (radius * math.cos(angle), radius * math.sin(angle))
        self.goal = np.array(goal, dtype=float)
        return self.observation()

    def observation(self):
        return np.concatenate([self.q, self.goal])

    def fk(self, q):
        q = np.asarray(q, dtype=float)
        l1, l2 = self.links
        a1, a12 = q[..., 0], q[..., 0] + q[..., 1]
        return np.stack([l1 * np.cos(a1) + l2 * np.cos(a12), l1 * np.sin(a1) + l2 * np.sin(a12)], axis=-1)

    def dynamics(self, q, u):
        return np.asarray(q, dtype=float) + np.clip(np.asarray(u, dtype=float), -self.max_speed, self.max_speed) * self.dt

    def cost(self, q, u, goal=None):
        goal = self.goal if goal is None else np.asarray(goal)
        u = np.clip(np.asarray(u, dtype=float), -self.max_speed, self.max_speed)
        return np.linalg.norm(self.fk(q) - goal, axis=-1) + 0.01 * np.sum(u ** 2, axis=-1)

    def step(self, u):
        reward = -float(self.cost(self.q, u))
        self.q = self.dynamics(self.q, u)
        done = bool(np.linalg.norm(self.fk(self.q) - self.goal) < 0.05)
        return self.observation(), reward, done

    def render(self, qs, title=None):
        robots.arm(np.asarray(qs, dtype=float), self.links, target=self.goal, title=title, fps=int(round(1 / self.dt)))


class TwoLinkArm:
    """Dynamischer 2-Gelenk-Arm (Stäbe): M(q) q'' + C(q, q') q' + G(q) = tau - b q'. Zustand [q1, q2, q1', q2']."""

    def __init__(self, masses=(1.0, 1.0), links=(1.0, 1.0), damping=0.1, gravity=0.0, dt=0.01, max_torque=5.0):
        self.m1, self.m2 = masses
        self.l1, self.l2 = links
        self.lc1, self.lc2 = self.l1 / 2, self.l2 / 2
        self.I1, self.I2 = self.m1 * self.l1 ** 2 / 12, self.m2 * self.l2 ** 2 / 12
        self.b, self.g, self.dt, self.max_torque = damping, gravity, dt, max_torque
        self.state = np.zeros(4)

    def reset(self, q=(0.0, 0.0), qd=(0.0, 0.0)):
        self.state = np.array([*q, *qd], dtype=float)
        return self.state.copy()

    def mass_matrix(self, q):
        c2 = np.cos(np.asarray(q)[..., 1])
        m11 = self.I1 + self.I2 + self.m1 * self.lc1 ** 2 + self.m2 * (self.l1 ** 2 + self.lc2 ** 2 + 2 * self.l1 * self.lc2 * c2)
        m12 = self.I2 + self.m2 * (self.lc2 ** 2 + self.l1 * self.lc2 * c2)
        m22 = self.I2 + self.m2 * self.lc2 ** 2 + 0 * c2
        return np.stack([np.stack([m11, m12], -1), np.stack([m12, m22], -1)], -2)

    def bias(self, q, qd):
        q, qd = np.asarray(q), np.asarray(qd)
        h = self.m2 * self.l1 * self.lc2 * np.sin(q[..., 1])
        coriolis = np.stack([-h * (2 * qd[..., 0] * qd[..., 1] + qd[..., 1] ** 2), h * qd[..., 0] ** 2], -1)
        c1, c12 = np.cos(q[..., 0]), np.cos(q[..., 0] + q[..., 1])
        grav = np.stack([(self.m1 * self.lc1 + self.m2 * self.l1) * self.g * c1 + self.m2 * self.lc2 * self.g * c12,
                         self.m2 * self.lc2 * self.g * c12], -1)
        return coriolis + grav + self.b * qd

    def dynamics(self, state, tau):
        state = np.asarray(state, dtype=float)
        tau = np.clip(np.asarray(tau, dtype=float), -self.max_torque, self.max_torque)
        q, qd = state[..., :2], state[..., 2:]
        qdd = np.linalg.solve(self.mass_matrix(q), (tau - self.bias(q, qd))[..., None])[..., 0]
        qd2 = qd + qdd * self.dt
        return np.concatenate([q + qd2 * self.dt, qd2], axis=-1)

    def fk(self, q):
        q = np.asarray(q, dtype=float)
        a1, a12 = q[..., 0], q[..., 0] + q[..., 1]
        return np.stack([self.l1 * np.cos(a1) + self.l2 * np.cos(a12), self.l1 * np.sin(a1) + self.l2 * np.sin(a12)], -1)

    def step(self, tau):
        self.state = self.dynamics(self.state, tau)
        return self.state.copy()

    def render(self, states, target=None, title=None, every=4):
        states = np.asarray(states, dtype=float)[::every]
        robots.arm(states[:, :2], (self.l1, self.l2), target=target, title=title, fps=int(round(1 / (self.dt * every))))
