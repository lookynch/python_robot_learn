export const CALIBRATION_CODE = `import numpy as np
total = 0
for i in range(150000):
    total += i % 7
a = np.random.default_rng(0).normal(size=(200, 200))
for _ in range(20):
    a = np.tanh(a @ a.T / 200)
`;

export const REFERENCE_SECONDS = 0.13;
