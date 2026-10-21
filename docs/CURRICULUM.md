# Lehrplan

Roter Faden: **Zustand → Schritt-Funktion → Modell → Planen → Lernen**. Das Muster `next_state = step(state, action)` aus Modul 6 zieht sich durch Regelung (9), Planen (11), RL (13–15) und World Models (16–17). Der 2-Gelenk-Arm (Modul 8) ist das wiederkehrende Robotik-Beispiel bis zum Capstone in Modul 16.

Legende Tiefe: **voll** = alles läuft im Browser · **spiel** = Spielversion im Browser, Rest konzeptionell · **konzept** = überwiegend Erklärung/Quiz.

Jedes Modul endet mit `mNN-checkpoint` (kind: checkpoint). Lektions-ids sind Vorschläge; Anzahl und Zuschnitt dürfen innerhalb des Moduls angepasst werden, wenn es didaktisch besser ist.

## Konventionen (modulübergreifend einheitlich)

- Winkel in Radiant. Gelenkwinkel eines planaren Arms sind **relativ** zum vorherigen Glied, Basis im Ursprung, $q_1$ gemessen von der x-Achse gegen den Uhrzeigersinn.
- FK 2 Gelenke: $x = l_1\cos q_1 + l_2\cos(q_1+q_2)$, $y = l_1\sin q_1 + l_2\sin(q_1+q_2)$. Funktionsname `fk(q, l1=1.0, l2=1.0)` → `np.array([x, y])`.
- Jacobi-Matrix `jacobian(q, l1, l2)` → 2×2-Array.
- Pendel: $\theta = 0$ **oben**, positiv gegen den Uhrzeigersinn (wie `lab.envs.Pendulum` und `lab.pendulum`).
- Zustand als NumPy-Array, Aktion als Zahl oder Array. Zeitschritt `dt`.
- Zufall immer mit `rng = np.random.default_rng(seed)` (ab Modul 4), vorher `random.seed(...)`.
- Gridworld-Aktionen 0=hoch, 1=rechts, 2=runter, 3=links; Zustand = zeile * spalten + spalte.

## Module

### 00 Start (`00-start`) – voll
Onboarding: Lernmethode der App.

### 01 Python-Grundlagen (`01-python-grundlagen`) – voll
Vorwissen: keins. Lektionen: `m01-print`, `m01-variablen`, `m01-rechnen` (fertig, Referenz), `m01-typen` (int/float/str/bool, `type()`, `int()`/`float()`/`str()`), `m01-strings` (Verkettung, `len`, Indizes, f-Strings mit `:.2f`), `m01-input` (`input()` liefert immer str, umwandeln), `m01-vergleiche` (`== != < <= > >=`, bool, `and or not`), `m01-if` (if/elif/else, Einrückung), `m01-while` (Zähler, Abbruchbedingung, Endlosschleife und Stopp-Taste), `m01-for` (`for` über `range(start, stop, step)`, Akkumulator-Muster), `m01-listen` (anlegen, Index, `append`, `len`, `for` über Liste, Summe/Maximum selbst berechnen), `m01-fehler-lesen` (Traceback lesen: Zeile, Fehlertyp, Meldung; NameError/TypeError/IndentationError/SyntaxError gezielt), `m01-checkpoint`.

### 02 Funktionen & Datenstrukturen (`02-funktionen-daten`) – voll
Vorwissen: Modul 1. `m02-funktionen` (def, Parameter, return vs print), `m02-rueckgabe` (mehrere Rückgaben/Tupel, Standardwerte, Keyword-Argumente), `m02-scope` (lokal/global, warum keine globalen Variablen ändern), `m02-listen-vertieft` (Slicing, negative Indizes, `sorted`, `in`, Listen sind veränderlich, Aliasing), `m02-tupel-dicts` (Tupel, Dict anlegen/lesen/`get`/iterieren über `items()`), `m02-comprehensions` (List-/Dict-Comprehensions, `zip`, `enumerate`), `m02-module` (`import math`, `math.sin/cos/pi/sqrt/atan2`, `import random`, `random.seed`), `m02-exceptions` (try/except, `raise ValueError`, Eingaben prüfen), `m02-checkpoint`.

### 03 Objekte & Code-Organisation (`03-objekte-code`) – voll
Vorwissen: 1–2. `m03-klassen` (class, `__init__`, Attribute, Methoden, `self`), `m03-roboter-klasse` (`class Joint`, `class Robot` mit Liste von Gelenken, Komposition), `m03-dataclasses` (`@dataclass`, `__repr__`), `m03-type-hints` (Typannotationen lesen/schreiben), `m03-tests` (`assert`, kleine Testfunktionen, Randfälle), `m03-debugging` (print-Debugging, Trace, Hypothese → Test, Rubber Ducking), `m03-checkpoint`.

### 04 NumPy & Visualisierung (`04-numpy-visualisierung`) – voll
Vorwissen: 1–3. `m04-arrays` (`np.array`, dtype, `shape`, `np.zeros/ones/arange/linspace`), `m04-elementweise` (elementweise Operationen, `np.sin` usw.), `m04-indexing` (Indizes, Slicing 2D, boolesche Masken), `m04-broadcasting` (Regeln, Zeilen-/Spaltenvektor), `m04-vektorisierung` (Schleife vs. vektorisiert, Zeitmessung mit `time.perf_counter`), `m04-aggregation` (`sum/mean/max/argmax` mit `axis`), `m04-zufall` (`default_rng`, `normal`, `uniform`, `integers`, Seeds), `m04-plotten` (`lab.plot`, `lab.Figure`, `lab.scatter`, `lab.Scene` Grundlagen), `m04-checkpoint`.

### 05 Lineare Algebra in Code (`05-lineare-algebra`) – voll
Vorwissen: 4. Mathe als kurze Auffrischung. `m05-vektoren` (Addition, Skalierung, Norm, `lab.vectors`), `m05-skalarprodukt` (Projektion, Winkel, Orthogonalität), `m05-matrizen` (`@`, Matrix-Vektor, Matrix-Matrix, `.T`), `m05-rotation` (2D-Rotationsmatrix, Komposition, Inverse = Transponierte), `m05-homogen` (homogene 2D-Transformationen 3×3, Ketten von Transformationen → Vorbereitung FK), `m05-gleichungssysteme` (`np.linalg.solve`, `lstsq`, Ausgleichsgerade), `m05-eigenwerte` (Intuition, `np.linalg.eig`, Stabilität linearer Systeme $x_{k+1} = A x_k$), `m05-checkpoint`.

### 06 Simulation (`06-simulation`) – voll
Vorwissen: 4–5. `m06-zustand` (Zustand, Zeitschritt, Simulationsschleife, Trajektorie speichern), `m06-euler` (expliziter Euler, freier Fall, Vergleich mit analytischer Lösung), `m06-feder-daempfer` (Masse-Feder-Dämpfer, Plot), `m06-semi-implizit` (Energiedrift bei explizitem Euler vs. semi-implizit; Schrittweite), `m06-step-funktion` (`step(state, action, dt) -> state` als Muster, Animation mit `lab.Scene`), `m06-pendel` (Pendel-ODE selbst simulieren, `lab.pendulum`), `m06-checkpoint`.

### 07 Ableitungen & Optimierung (`07-ableitungen-optimierung`) – voll
Vorwissen: 4–6. `m07-numerische-ableitung` (Vorwärts-/Zentraldifferenz, Fehler vs. h), `m07-gradient` (partielle Ableitungen numerisch, Gradient einer 2D-Funktion), `m07-gradientenabstieg` (Algorithmus, Plot der Kosten), `m07-schrittweite` (zu groß/zu klein, Divergenz, Konvergenz), `m07-kettenregel` (Kettenregel als Vorstufe zu Backprop, Rechengraph von Hand), `m07-checkpoint`.

### 08 Kinematik planarer Arm (`08-kinematik`) – voll
Vorwissen: 5, 7. `m08-gelenkraum` (Gelenkwinkel vs. kartesisch, `lab.arm`), `m08-fk` (FK 2 Gelenke selbst implementieren, mit `lab.chain` zeichnen), `m08-fk-allgemein` (n Gelenke mit Schleife/homogenen Transformationen), `m08-arbeitsraum` (Arbeitsraum sampeln und als Punktwolke plotten), `m08-ik-analytisch` (Kosinussatz, elbow up/down, Erreichbarkeit), `m08-jacobi` (analytisch + numerisch prüfen), `m08-differentielle-ik` (iterativ mit $J^{-1}$, Pseudoinverse, Damped Least Squares, Animation zum Ziel), `m08-singularitaeten` (det J = 0, gestreckter Arm, Verhalten von DLS), `m08-checkpoint`.

### 09 Dynamik & Regelung (`09-dynamik-regelung`) – voll
Vorwissen: 6, 8. `m09-regelkreis` (Soll/Ist, Fehler, P-Regler auf ein Gelenk mit einfacher Dynamik), `m09-pd-pid` (D gegen Überschwingen, I gegen bleibende Abweichung, Tuning, Plots), `m09-pendel-regeln` (Pendel oben halten mit PD, Drehmomentgrenze), `m09-schwerkraft` (Schwerkraftkompensation), `m09-zwei-gelenke` (Dynamik $M(q)\ddot q + C\dot q + G = \tau$ – mit `lab.envs.TwoLinkArm`, PD je Gelenk), `m09-task-space` (Kraft am Endeffektor über $\tau = J^T F$), `m09-cartpole` (Unteraktuierung, warum PD hier nicht reicht – Motivation für Planen/RL), `m09-checkpoint`.

### 10 Wahrscheinlichkeit (`10-wahrscheinlichkeit`) – voll
Vorwissen: 4. `m10-zufallsvariablen` (diskret/stetig, Histogramme mit `lab.plot`), `m10-erwartung-varianz` (empirisch vs. analytisch), `m10-normalverteilung` (Sampling, μ/σ, mehrdimensional diagonal), `m10-monte-carlo` (Integrale/Erwartungswerte schätzen, Fehler ~ $1/\sqrt{N}$), `m10-softmax-entropie` (Softmax mit Temperatur, Entropie, numerische Stabilität), `m10-bayes` (Bayes-Regel intuitiv, Sensor-Beispiel), `m10-checkpoint`.

### 11 Planen mit Modell (`11-planen-mit-modell`) – voll
Vorwissen: 6–10. `m11-kostenfunktion` (Ziel als Kosten, Rollout einer Aktionsfolge mit bekanntem Modell), `m11-random-shooting` (N zufällige Aktionsfolgen, beste wählen, vektorisiert), `m11-mpc` (Receding Horizon: nur erste Aktion ausführen, neu planen), `m11-cem` (Cross-Entropy-Method: Elite, μ/σ anpassen), `m11-mppi` (gewichtete Mittelung mit Temperatur), `m11-swing-up` (Pendel-Swing-up mit `Pendulum.dynamics`, heavy), `m11-reacher` (Reacher2D mit wahrem Modell), `m11-checkpoint`.

### 12 Machine Learning von Grund auf (`12-machine-learning`) – voll
Vorwissen: 5, 7, 10. `m12-lineare-regression` (geschlossen + Gradientenabstieg), `m12-overfitting` (Train/Test, Polynomgrad, Regularisierung), `m12-logistische-regression` (Sigmoid, Kreuzentropie), `m12-mlp-forward` (Schichten, Aktivierungen, Shapes), `m12-backprop` (von Hand in NumPy für 1 Hidden Layer), `m12-training` (Minibatches, Normalisierung, Adam, Lernkurven), `m12-gradient-check` (numerischer Vergleich), `m12-checkpoint`.

### 13 RL I – Grundlagen (`13-rl-grundlagen`) – voll
Vorwissen: 10. `m13-bandits` (ε-greedy, UCB, Regret-Plot), `m13-mdp` (Zustände, Aktionen, Belohnung, Übergänge; `GridWorld.P`), `m13-return` (Diskont γ, Return berechnen), `m13-bellman` (Wertfunktion, Bellman-Gleichung, Policy Evaluation), `m13-value-iteration` (mit `lab.grid` Werte + Policy), `m13-policy-iteration`, `m13-checkpoint`.

### 14 RL II – modellfrei, tabellarisch (`14-rl-tabellarisch`) – voll
Vorwissen: 13. `m14-monte-carlo` (MC-Prediction/-Control), `m14-td` (TD(0), Bootstrapping), `m14-sarsa-qlearning` (Cliff-Walking-Layout, Unterschied on/off-policy, Pfade animieren), `m14-exploration` (ε-Zerfall, optimistische Initialisierung), `m14-cartpole-diskret` (Zustände diskretisieren, Q-Learning auf CartPole, heavy), `m14-dyna-q` (gelerntes Tabellenmodell + Planen – erste Begegnung mit „World Model“), `m14-checkpoint`.

### 15 RL III – Funktionsapproximation (`15-rl-approximation`) – voll/spiel
Vorwissen: 12, 14. `m15-lineare-q` (Features, semi-gradient), `m15-reinforce` (Policy Gradient Herleitung kompakt, lineare Softmax-Policy auf CartPole, heavy), `m15-baseline` (Varianzreduktion), `m15-actor-critic` (A2C-Idee, kleine Version), `m15-dqn-ppo` (DQN: Replay Buffer, Target-Netz; PPO: Clipping – Spielversion/Konzept), `m15-sac-ueberblick` (konzeptionell, Einordnung), `m15-checkpoint`.

### 16 World Models I – gelernte Dynamik + Planen (`16-world-models`) – voll · **Capstone**
Vorwissen: 11, 12. `m16-idee` (Was ist ein World Model? Modellbasiert vs. modellfrei, Sample-Effizienz), `m16-daten-sammeln` (Zufallsaktionen auf Reacher2D/Pendulum, Datensatz (s, a, s′)), `m16-dynamikmodell` (MLP sagt Δs vorher, Normalisierung, Training in NumPy, heavy), `m16-compounding-error` (Mehrschritt-Vorhersage driftet, Plot), `m16-ensembles` (Unsicherheit durch Ensemble-Streuung, PETS-Idee), `m16-mpc-gelernt` (CEM auf dem gelernten Modell steuert den Arm zum Ziel, heavy), `m16-iteration` (Daten sammeln → trainieren → planen → mehr Daten), `m16-checkpoint`.

### 17 World Models II – latente Modelle (`17-latente-world-models`) – spiel
Vorwissen: 15, 16. `m17-beobachtungen` (Bilder statt Zustand: 16×16-Rendering des Arms als Array), `m17-autoencoder` (kleiner linearer/MLP-Autoencoder, heavy), `m17-latente-dynamik` (z′ = f(z, a) im latenten Raum, Spielversion), `m17-ha-schmidhuber` (V-M-C, konzeptionell + Quiz), `m17-dreamer` (RSSM, Lernen in der Vorstellung – Konzept + Mini-Imagination-Rollout), `m17-td-mpc` (latentes Modell + Wertfunktion + MPPI – Konzept), `m17-checkpoint`.

### 18 Moderne World Models & Foundation Models (`18-foundation-models`) – konzept
Vorwissen: 17. Jede aktuelle Aussage mit Quelle + „Stand Oktober 2026“. `m18-jepa` (Vorhersage im latenten Raum statt Pixeln, Kollaps-Problem, EMA-Target; ggf. winzige NumPy-Demo), `m18-vjepa2` (V-JEPA 2-AC: Planen mit CEM auf latenter Zielnähe), `m18-video-world-models` (Cosmos, Genie 3 – was sie können, was nicht), `m18-vla` (RT-2, OpenVLA, π0/π0.5, SmolVLA – Vision-Language-Action), `m18-imitation` (Behavior Cloning, ACT, Diffusion Policy; Sim-to-Real), `m18-checkpoint`.

### 19 Brücke nach draußen (`19-bruecke`) – konzept
Vorwissen: alles. `m19-pytorch` (Colab, PyTorch: das MLP aus Modul 12 neu, Autograd statt Backprop von Hand), `m19-gymnasium-mujoco` (Gymnasium-API, MuJoCo `Reacher-v5`, Mapping zu `lab.envs`), `m19-lerobot` (LeRobot-Workflow: teleoperieren → aufnehmen → trainieren → ausführen), `m19-hardware` (SO-101: Kosten, Aufbau, ehrliche Einordnung: heute meist Imitation Learning statt modellbasiertes RL), `m19-ros2` (wann man ROS 2 braucht), `m19-checkpoint`.
