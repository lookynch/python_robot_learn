# Leitfaden für Lektionsinhalte

Dieser Leitfaden ist verbindlich für alle Inhalte unter `content/`. Jede Lektion muss den Validator bestehen:

```bash
MODULE=05 npx vitest run tests/content     # nur Modul 05
npx vitest run tests/content               # alles
```

## Zielgruppe

Eine Person mit Ingenieur-/Informatik-Mathe (lineare Algebra, Analysis, etwas Wahrscheinlichkeit) aber **ohne Programmiererfahrung**. Sie lernt hauptsächlich **auf dem Handy** in Einheiten von 5–10 Minuten. Endziel: Roboterarme mit gelernten World Models steuern, Reinforcement Learning verstehen und selbst implementieren.

Konsequenzen:
- Python-Grundlagen sehr kleinschrittig, aber nie kindlich. Mathe nicht neu erklären, sondern **kurz auffrischen und sofort in Code übersetzen**.
- Pro Bildschirm **eine Idee**. Texte kurz (Text-Schritt ≤ ~120 Wörter). Lieber ein Schritt mehr.
- Tippen ist am Handy teuer: Tap-Formate (predict mit Optionen, fill, parsons, quiz) bevorzugen; freie Aufgaben (`exercise`) kurz halten (≤ 10 Zeilen Lösung in frühen Modulen, ≤ 25 später), Startercode mit Gerüst geben.
- Sprache: Deutsch, Du-Form, sachlich, präzise. Fachbegriffe einführen und dann konsequent verwenden (englischer Begriff in Klammern beim ersten Auftreten).
- Code: englische Namen sind okay, deutsche auch – innerhalb eines Moduls einheitlich. Keine Umlaute in Bezeichnern.

## Didaktisches Muster (evidenzbasiert)

Jede normale Lektion folgt grob **PRIMM + Fading**:

1. `text` – Motivation + eine neue Idee (konkret vor abstrakt; bei Robotik/RL: erst das Bild, dann die Formel).
2. `example` – Worked Example mit `subgoals` (3–5 abstrakte Teilziel-Labels, z. B. „Startwert festlegen“, „Schleife über alle Gelenke“, „Ergebnis ausgeben“). Dieselben Labels in Hinweisen wiederverwenden.
3. `explain` – Selbsterklärung: „Warum …?“ mit 3–4 Optionen (eine richtig), jede Option mit `why`.
4. `predict` – Vorhersage vor dem Ausführen (Pflicht im UI, mit Sicherheitsangabe). Optionen sollen **typische Fehlvorstellungen** abbilden.
5. `trace` – bei Kontrollfluss (Schleifen, Funktionen, Rekursion): Schritt-für-Schritt mit 1–2 `questions`.
6. `fill` und/oder `parsons` – Fading: Teile der Lösung sind vorgegeben. Mit `fading: true` markieren (darf übersprungen werden, wenn die folgende Aufgabe sofort gelöst wird).
7. `exercise` mit `mode: modify` (kleine Änderung an vorhandenem Code), dann `mode: make` (eigene Lösung).
8. `quiz` – 1–2 Abrufitems am Ende (Retrieval Practice), Distraktoren = typische Fehler.

Nicht jede Lektion braucht alle Schritte. Richtwerte: Module 1–4: 8–12 Schritte; Module 5–16: 6–9 Schritte mit mindestens einer lauffähigen Aufgabe und (wo sinnvoll) einer Visualisierung; Module 17–19: überwiegend `text`, `quiz`, `explain`, Spielversionen.

Zusätzlich pro Lektion **2–4 `cards`** für die verteilte Wiederholung (Spaced Repetition). Jede Karte prüft ein Konzept und hat **2–3 Varianten** (andere Zahlen/Namen/Situation, gleiche Idee), damit nicht die Antwort auswendig gelernt wird.

Jedes Modul endet mit genau einer Lektion `kind: checkpoint` (6–10 gewertete Schritte: quiz, predict, fill, parsons, exercise – gemischt über alle Lektionen des Moduls, **interleaved**). Bestehen = ≥ 80 % beim ersten Versuch. Der Checkpoint dient auch als Einstufungstest („Kann ich schon“), muss also ohne die Lektionsschritte lösbar sein.

## Dateien

```
content/
  05-lineare-algebra/
    module.yaml
    m05-vektoren.yaml
    m05-checkpoint.yaml
```

- Ordner `NN-slug`, `module.yaml` mit `id: mNN`, `number: NN`.
- Lektionsdatei = `<lesson-id>.yaml`, Lektions-ids global eindeutig, Präfix `mNN-`.
- Reihenfolge der Lektionen = Liste `lessons` in `module.yaml`.

### module.yaml

```yaml
id: m05
number: 5
title: Lineare Algebra in Code
summary: |
  Vektoren und Matrizen mit NumPy – die Sprache, in der Roboter rechnen.
depth: voll            # voll | spiel | konzept
lessons:
  - m05-vektoren
  - m05-checkpoint
concepts:              # Konzepte dieses Moduls (global eindeutige ids)
  - id: vektor-numpy
    name: Vektoren als Arrays
    description: Ein Vektor ist ein 1D-NumPy-Array; + und * wirken elementweise.
```

Lektionen und Karten dürfen Konzepte **dieses oder früherer Module** referenzieren.

### Lektion

```yaml
id: m05-vektoren
title: Vektoren als Arrays
kind: lesson           # oder checkpoint
minutes: 8
goals:
  - Vektoren als NumPy-Arrays anlegen
concepts: [vektor-numpy]
steps:
  - type: text
    body: |
      ...
cards:
  - id: m05-c-vektor-add
    concept: vektor-numpy
    variants:
      - type: predict
        ...
```

## Schritt-Typen

Alle Prosafelder sind **Markdown** (inkl. `code`-Spans, Listen, Tabellen). Formeln mit KaTeX: inline `$x^2$`, Block `$$ … $$` auf eigenen Zeilen. Verwende für Code und mehrzeilige Texte **YAML-Block-Scalars** (`|`), dann gibt es keine Escaping-Probleme. Kurze Strings mit `:` oder `#` in Anführungszeichen setzen.

Gemeinsame optionale Felder: `title`, `optional: true` (zählt nicht für den Abschluss), `fading: true`.

```yaml
- type: text
  body: |
    Markdown …

- type: example
  intro: |            # optional
    …
  code: |
    x = 3
    print(x * 2)
  subgoals:           # optional, Zeilen 1-basiert; Zahl oder [von, bis]
    - lines: 1
      label: Wert festlegen
    - lines: [2, 2]
      label: Ergebnis ausgeben
  after: |            # optional, erscheint nach dem Ausführen
    …
  stdin: ["42"]       # optional, falls der Code input() nutzt
  heavy: true         # optional, erlaubt bis 3 s Laufzeit (sonst 0,5 s)

- type: predict
  intro: |            # optional
  code: |
    print(2 + 3 * 4)
  question: Was gibt das Programm aus?    # optional (Standard)
  options: ["20", "14", "2 + 3 * 4"]       # optional; ohne options tippt man die Ausgabe
  answer: "14"                              # exakte Ausgabe (wird gegen echte Ausgabe geprüft)
  explanation: |
    Punkt vor Strich …

- type: trace
  intro: |
  code: |
    total = 0
    for i in range(3):
        total = total + i
    print(total)
  questions:                 # optional
    - line: 3                # nachdem Zeile 3 …
      hit: 2                 # … zum 2. Mal ausgeführt wurde
      var: total
      answer: "1"            # repr() des Werts, also Strings mit Anführungszeichen: "'abc'"
      prompt: Welchen Wert hat `total` jetzt?   # optional
  after: |

- type: fill
  prompt: |
    Ergänze die Lücken, sodass 10 ausgegeben wird.
  code: |
    x = ___
    print(x ___ 2)
  blanks:
    - answer: "5"
      options: ["5", "8", "x"]
    - answer: "*"
      options: ["*", "+", "-"]
  expect_output: "10"        # und/oder tests
  explanation: |

- type: parsons
  prompt: |
    Bringe die Zeilen in die richtige Reihenfolge und Einrückung.
  lines:                     # Lösung in richtiger Reihenfolge, Einrückung = 4 Leerzeichen
    - "for i in range(3):"
    - "    print(i)"
  distractors: ["for i in range(3)"]   # optional, max 3; erst ab Lektion 3 eines Moduls
  expect_output: |
    0
    1
    2

- type: exercise
  mode: make                 # modify | make
  prompt: |
    Schreibe eine Funktion `area(w, h)` …
  starter: |
    def area(w, h):
        # dein Code
        pass
  solution: |
    def area(w, h):
        return w * h
  tests:
    - name: Rechteck 2×3
      code: |
        assert area(2, 3) == 6, "area(2, 3) sollte 6 sein"
  mutants:                   # PFLICHT: typische falsche Lösungen, die die Tests NICHT bestehen dürfen
    - |
      def area(w, h):
          return w + h
  hints:                     # 1–4 Stufen: Teilziel → Konzept → Teilcode → (fast) Lösung
    - "Teilziel: Ergebnis mit `return` zurückgeben."
    - Die Fläche ist Breite mal Höhe.
    - "`return w * h`"
  stdin: ["3"]               # optional
  heavy: true                # optional
  explanation: |             # optional, nach dem Lösen
    …

- type: quiz
  question: |
    …
  code: |                    # optional, nur Anzeige
  options:
    - text: "`==`"
      correct: true
      why: Vergleicht zwei Werte.
    - text: "`=`"
      correct: false
      why: Weist zu, vergleicht nicht.
  multi: false               # optional; true = mehrere richtige Antworten

- type: explain              # Selbsterklärung, gleiche Struktur wie quiz (genau eine richtig)
  question: Warum …?
  options: [...]
```

### Tests in `exercise`, `fill`, `parsons`

- Tests sind Python-Code, der **nach** dem Lernercode im selben Namensraum läuft. Fehlschlag = `AssertionError` mit **deutscher, hilfreicher Meldung** (was erwartet wurde, was kam).
- Helfer im Test-Namensraum: `output()` (gesamte Ausgabe als String), `lines()` (Ausgabezeilen ohne rechtes Leerzeichen), `close(a, b, tol=1e-6)` (Zahlen/Arrays näherungsweise gleich), `scenes()` (Liste der erzeugten Visualisierungen als Dicts mit `kind` = `"plot"`/`"scene"`).
- Tests müssen **Verhalten** prüfen, nicht Implementierungsdetails. Mehrere Eingaben prüfen (auch Randfälle), damit hart codierte Antworten durchfallen.
- Der Validator prüft: Musterlösung besteht (mit Seed 1 und 2), Startercode, `pass` und jeder Mutant fallen bei mindestens einem Test durch. Mutanten sind **plausible Fehler von Lernenden** (Off-by-one, falscher Operator, vergessenes `return`, Grad statt Radiant, …).
- Für `print`-Aufgaben: `assert lines() == ["…"], f"Erwartet …, bekommen {lines()}"` oder `expect_output`.

### Stolperfallen

- **YAML:** Unquotierte Werte mit `: ` (z. B. `` `IndexError: list index out of range` ``) ergeben „Nested mappings“-Fehler. Solche Strings in Anführungszeichen oder als Block-Scalar (`|`) schreiben.
- **KaTeX:** Indizes mit Befehlen klammern: `q_{\min}`, nicht `q_\min`. Der Validator rendert alle Formeln.
- **`input()`** schreibt Fragetext und Eingabe (mit Zeilenumbruch) in die Ausgabe – genau wie im Terminal. Predict-Antworten und `lines()` enthalten diese Zeilen.
- `predict`/`example`/`trace` müssen fehlerfrei laufen. Fragen wie „Was erscheint vor dem Fehler?“ als `quiz` stellen.
- `stdin` gilt für den ganzen Schritt (ein Testfall für Eingaben). Mehrere Fälle besser über eine Funktion testen, die die Tests direkt aufrufen.
- **YAML-Flow-Listen:** `options: [s2, pol[s]]` bricht – Einträge mit Klammern, Kommas oder Doppelpunkten quoten.
- **NumPy in Pyodide:** Standard-Ganzzahltyp ist `int32` (Desktop: `int64`); `np.linalg.solve`/`inv` liefern bei exakt singulärer Matrix teils `nan` statt `LinAlgError` – mit `det` prüfen.
- **Broadcasting** macht falsche Fill-Optionen oft „zufällig richtig“ – der Validator meldet das; dann Option ersetzen.
- Lernende Animationen mit Spur (`lab.arm`, `trail=True`) zeigen die letzten 60 Spitzenpositionen.
- `GridWorld.step`/`CartPole.step` liefern nur `done` (Ziel/Falle **oder** Zeitlimit); terminal vs. abgeschnitten über `env.is_terminal(s)` bzw. `env.t < env.max_steps` unterscheiden.
- Mutanten, Distraktoren und Fill-Optionen dürfen Endlosschleifen erzeugen: Diese Läufe haben im Validator ein Zeitlimit von 4 s.

### Determinismus und Laufzeit

- `predict`, `trace`, `fill`, `parsons` müssen deterministisch sein: Der Validator führt sie mit zwei verschiedenen Seeds aus. Zufall nur mit festem Seed: `rng = np.random.default_rng(0)` bzw. `random.seed(0)`.
- Laufzeitbudget pro Lauf in Node: **0,5 s**, mit `heavy: true` **3 s**. Auf dem Handy ist es 3–5× langsamer. Vektorisieren (NumPy), kleine Probleme, wenige Episoden. `heavy` sparsam (Training in RL/World-Model-Modulen).
- Trace ≤ 2000 Schritte → kurze Schleifen in `trace`-Schritten.

## Python im Browser

- Python 3.14 (Pyodide 314), Standardbibliothek + **NumPy**. **Kein** matplotlib, scipy, torch, gymnasium.
- `input()` funktioniert (im UI interaktiv; im Validator über `stdin`).
- Visualisierung und Simulation über das App-Modul `lab`:

```python
import lab

lab.plot(y, x=None, label=None, title=None, xlabel=None, ylabel=None, logy=False)
lab.scatter(x, y, label=None, title=None, xlabel=None, ylabel=None)
fig = lab.Figure(title=..., xlabel=..., ylabel=..., logy=False)
fig.line(y, x=None, label=None, color=None); fig.scatter(x, y, label=None); fig.bars(x, heights, label=None)
fig.hline(0.0, label=None); fig.show()
lab.hist(values, bins=20, title=None, xlabel=None, density=False)

lab.vectors([(1, 2), (3, -1)], labels=["a", "b"], origin=(0, 0), title=None)
lab.heatmap(matrix, title=None, labels=False)

lab.arm(q, links=(1, 1), target=None, title=None, trail=True, fps=30, captions=None)
#   q: Gelenkwinkel (relativ, rad) einer Stellung ODER Liste von Stellungen → Animation
lab.arm_points(q, links=(1, 1))      # -> Liste der Gelenkpositionen [(x0,y0), (x1,y1), ...]
lab.chain(frames, title=None, target=None)  # Arm aus selbst berechneten Gelenkpositionen zeichnen
lab.pendulum(theta_or_list, length=1.0, title=None, fps=20)     # theta = 0 oben, + gegen Uhrzeigersinn
lab.cartpole(x_list, theta_list, pole_length=1.0, title=None)   # theta = 0 aufrecht
lab.grid(layout, values=None, policy=None, path=None, agent=None, title=None)
#   layout: Liste von Strings mit '.', '#', 'S', 'G', 'X'; values/policy flach (Index = zeile*spalten + spalte)
#   policy: 0=hoch, 1=rechts, 2=runter, 3=links

s = lab.Scene(title=None, bounds=[xmin, xmax, ymin, ymax], fps=30)   # freie 2D-Animation, y nach oben
s.line(pts, color="fg", width=2, dashed=False, static=False)
s.circle(x, y, r, color="fg", fill=None); s.rect(x, y, w, h, color, fill); s.poly(pts, color, fill)
s.arrow(x, y, dx, dy, color="accent"); s.text(x, y, "txt", size=13, align="c")
s.caption("Text zum aktuellen Frame"); s.next_frame(); s.show()
#   Farben: "fg", "muted", "accent", "good", "bad", "warn", "c1".."c6", "heat:0.0".."heat:1.0" oder "#rrggbb"
#   static=True zeichnet in den Hintergrund (alle Frames). Max. 600 Frames (wird sonst ausgedünnt).

lab.progress(fraction, text="")   # Fortschrittsbalken bei langen Rechnungen

from lab.envs import GridWorld, Pendulum, CartPole, Reacher2D, TwoLinkArm, angle_normalize
```

Umgebungen (`lab.envs`, NumPy, alle `dynamics`-Funktionen sind vektorisiert über führende Achsen):

- `GridWorld(layout=None, slip=0.0, step_reward=-1, goal_reward=0, trap_reward=-100, trap_resets=True, max_steps=200, seed=None)`: `n_states`, `n_actions=4`, `P[s][a] = [(p, s2, r, done), …]`, `reset() -> s`, `step(a) -> (s2, r, done)`, `is_terminal(s)`, `char(s)`, `render(values=None, policy=None, path=None, title=None)`. Standard-Layout 4×4 (`"S..."`, `".#.."`, `"...X"`, `"#..G"`).
- `Pendulum(dt=0.05, g=10, m=1, l=1, max_torque=2, max_speed=8)`: Zustand `[theta, theta_dot]`, theta = 0 oben; `reset(theta=pi, theta_dot=0)`, `dynamics(state, u)`, `cost(state, u)`, `step(u) -> (state, reward, False)`, `render(states)`.
- `CartPole(max_steps=500, seed=None)`: Zustand `[x, x_dot, theta, theta_dot]`, Aktion 0/1; `reset()`, `step(a) -> (state, 1.0, done)`, `dynamics(state, force)`, `failed(state)`, `render(states)`.
- `Reacher2D(links=(1,1), dt=0.05, max_speed=2, seed=None)`: kinematisch, Aktion = Gelenkgeschwindigkeiten; `reset(q=(0,0), goal=None) -> obs=[q1,q2,gx,gy]`, `fk(q)`, `dynamics(q, u)`, `cost(q, u, goal=None)`, `step(u) -> (obs, reward, done)`, `render(qs)`.
- `TwoLinkArm(masses=(1,1), links=(1,1), damping=0.1, gravity=0.0, dt=0.01, max_torque=5)`: Zustand `[q1,q2,q1',q2']`; `mass_matrix(q)`, `bias(q, qd)` (= C·q̇ + G + b·q̇), `dynamics(state, tau)`, `fk(q)`, `step(tau)`, `render(states, target=None, every=4)`.

Lernende sollen Kernalgorithmen **selbst** schreiben (FK, IK, PID, CEM, Q-Learning, Backprop, Dynamikmodell). `lab.envs` ist für spätere Module gedacht, wenn die Physik schon einmal selbst implementiert wurde.

## Qualitätsregeln

- Fachlich korrekt. Bei Unsicherheit: weglassen oder als Vereinfachung kennzeichnen. Keine erfundenen Zahlen, Paper oder Versionen. In Modul 18/19 jede aktuelle Aussage mit Quelle (Link) und „Stand: Oktober 2026“.
- Quiz/Explain: genau eine richtige Option (außer `multi: true`), jede Option mit `why`, das den Denkfehler benennt.
- Predict-Optionen: die echte Ausgabe + 2–3 plausible Fehlvorstellungen.
- Hinweise gestuft: (1) Teilziel-Label, (2) Konzept, (3) Teilcode, (4) fast vollständige Lösung. Kein Hinweis verrät die Lösung schon auf Stufe 1.
- Keine Wiederholung derselben Erklärung in zwei Schritten. Jeder Schritt hat einen Zweck.
- Zahlen mit Einheiten nennen (rad, m, s, N·m). Winkel in Radiant, Hinweis auf Grad wo nötig.
