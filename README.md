# RoboPy – von Python bis zum Roboterarm mit World Model

Mobile-first Lern-App (PWA) für Handy, iPad und Desktop. Sie führt ohne Vorkenntnisse im Programmieren in kleinen Schritten von `print("Hallo")` über NumPy, lineare Algebra, Simulation, Kinematik, Regelung, Planen mit Modell, Machine Learning und Reinforcement Learning bis zu World Models, die einen simulierten Roboterarm steuern.

Python läuft echt im Browser (Pyodide 314 / Python 3.14 + NumPy) in einem Web Worker – mit Terminal-Ausgabe, interaktivem `input()`, Stopp-Taste, deutschen Fehlererklärungen und Animationen (Arm, Pendel, CartPole, Gridworld, Plots).

## Lernmethoden

| Mechanik | Umsetzung |
|---|---|
| Retrieval Practice | Abruf-Quiz am Ende jeder Lektion, Erklärung pro Antwortoption |
| Spaced Repetition | FSRS (`ts-fsrs`), Ziel-Behaltensquote 90 %, Karten mit mehreren Varianten, max. 10 neue Karten/Tag |
| PRIMM | Vorhersage (mit Sicherheitsangabe) vor jedem Ausführen → ausführen → nachverfolgen → verändern → selbst schreiben |
| Worked Examples + Fading | Beispiele mit Teilziel-Labels → Lückentext → Parsons (Tippen statt Ziehen) → freie Aufgabe; „Kann ich schon“ springt direkt zur Aufgabe |
| Selbsterklärung | menübasierte Warum-Fragen nach Beispielen |
| Programmvisualisierung | Schritt-für-Schritt-Trace mit Variablentabelle und Vorhersagefragen |
| Hyperkorrektur | „sicher, aber falsch“ wird hervorgehoben und als *Again* bewertet |
| Mastery | Checkpoint je Modul (ab 80 % gemeistert), auch als Einstufungstest |
| Hinweise | gestuft, erst nach dem ersten Prüfen; angesehene Lösungen landen als offene Aufgabe in „Wiederholen“ |
| Motivation | Wochenziel statt Streak, Lernpfad mit Fortschritt |

Außerdem: **„Kontext für KI kopieren“** (Symbol oben rechts in jeder Lektion) packt Lernziel, Aufgabe, eigenen Code, Ausgabe, Fehler und fehlgeschlagene Tests in einen Text für Claude o. Ä. – mit der Bitte, die Lösung nicht direkt zu verraten.

## Inhalte

20 Module, 148 Lektionen (`content/`, YAML). Lehrplan: [`docs/CURRICULUM.md`](docs/CURRICULUM.md), Autorenregeln: [`docs/AUTHORING.md`](docs/AUTHORING.md).

Jede Lektion wird automatisch geprüft (`npm run validate`): Der gesamte Code läuft in Pyodide; Vorhersage-Antworten müssen der echten Ausgabe entsprechen, Musterlösungen alle Tests bestehen, Startercode und typische Fehllösungen („Mutanten“) durchfallen, falsche Lückentext-/Parsons-Bausteine dürfen nicht zufällig richtig sein, Formeln müssen rendern, Laufzeiten bleiben im Handy-Budget.

## Entwicklung

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Unit-Tests
npm run validate     # alle Lektionen in Pyodide prüfen (MODULE=08 für ein Modul)
npm run e2e          # Playwright: iPhone-, iPad- und Desktop-Profil
npm run build && npm run pages:dev   # inkl. Pages Functions mit lokaler D1
```

Node 22 (siehe `.node-version`). Die erste Ausführung lädt Pyodide (~9 MB) von jsDelivr; der Service Worker cacht es danach für den Offline-Betrieb.

## Deployment auf Cloudflare Pages

> Hinweis: Cloudflare empfiehlt für *neue* Projekte inzwischen Workers mit Static Assets. Pages wird weiter unterstützt; eine spätere Migration ist mit dieser Struktur (statisches `dist/` + `functions/`) einfach.

1. **Projekt anlegen:** Cloudflare-Dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → dieses Repo.
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
2. **D1-Datenbank** (Fortschritts-Sync): *Storage & Databases* → *D1* → *Create* (z. B. `robopy`). Im Pages-Projekt unter *Settings → Bindings* eine **D1-Bindung mit dem Namen `DB`** auf diese Datenbank anlegen (Production und Preview). Die Tabelle legt die Function beim ersten Aufruf selbst an.
3. **Cloudflare Access** (Login): *Zero Trust* → *Access* → *Applications* → *Add an application* → *Self-hosted*.
   - Domains: `<projekt>.pages.dev` **und** `*.<projekt>.pages.dev` (Preview-Deployments), ggf. eigene Domain.
   - Policy: *Allow*, Include → *Emails* → deine E-Mail-Adresse.
   - Login-Methode: **One-time PIN** (funktioniert zuverlässig auch in der Homescreen-App auf iOS).
   - **Session Duration: 1 month** (sonst musst du dich in der Homescreen-App sehr oft neu anmelden).
   - Nach dem Speichern unter *Overview* den **Application Audience (AUD) Tag** kopieren.
4. **Variablen im Pages-Projekt** (*Settings → Variables and Secrets*, Production und Preview):
   - `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`
   - `ACCESS_AUD` = der AUD-Tag aus Schritt 3
5. Neu deployen (*Deployments → Retry deployment*) und die App aufrufen. Unter *Profil* sollte nach dem Login „Synchronisiert“ und deine E-Mail stehen.

Die Function `functions/api/progress.ts` prüft das von Access gesetzte JWT (`Cf-Access-Jwt-Assertion`) selbst gegen die öffentlichen Schlüssel deines Teams (RS256, `aud`, `iss`). Ohne vollständige Konfiguration antwortet sie mit 503 – die App funktioniert dann rein lokal weiter. Schreibzugriffe akzeptiert sie nur von der eigenen Origin, als JSON und bis 1 MB.

### Auf dem iPhone/iPad

Safari öffnen → Seite aufrufen → anmelden → *Teilen* → **Zum Home-Bildschirm**. Als Homescreen-App bleiben lokale Daten zuverlässiger erhalten (Safari-Tabs löscht iOS nach 7 Tagen ohne Nutzung). Homescreen-App und Safari-Tab haben auf iOS getrennte Speicher; der Server-Sync gleicht beide ab.

### Sync-Modell

- Lokal: `localStorage` (versioniert), Server: eine Zeile pro Access-Nutzer in D1, Schreiben mit Versionsprüfung (bei Konflikt: neu lesen, zusammenführen, erneut schreiben).
- Zusammenführen ist konfliktfrei: Abschlüsse werden vereinigt, Wiederholungen nur angehängt (der FSRS-Zustand wird daraus deterministisch berechnet), Code-Entwürfe: neuester gewinnt. „Zurücksetzen“ erhöht eine Epoche, damit alte Geräte nichts wiederherstellen.
- Eine ältere App-Version überschreibt keine Daten einer neueren (409 → „App aktualisieren“).

## Architektur

```
content/              Lektionen (YAML), pro Modul ein Ordner
build/                YAML → geprüfte, gerenderte Module (Vite-Plugin, Markdown + KaTeX zur Build-Zeit)
src/python/           Pyodide-Worker, Runtime-Client, Python-Paket „lab“ (Visualisierung, Umgebungen), Runner
src/lesson/           Lektions-Player und Schritt-Typen
src/learning/         Fortschritt, Merge, FSRS, Freischaltung, Sync, KI-Kontext
src/viz/              Canvas-Renderer für Szenen und Plots
server/, functions/   Pages Functions: Access-Prüfung + D1-Sync
tests/                Unit, Inhaltsvalidierung (Pyodide in Node), Playwright-E2E
```

## Grenzen

- Kein PyTorch, MuJoCo, matplotlib im Browser; Modelle sind klein und in NumPy geschrieben. Modul 19 zeigt den Weg zu Colab/PyTorch, Gymnasium/MuJoCo, LeRobot und echter Hardware (SO-101).
- Rechenintensive Schritte (RL-Training, World-Model-Training) brauchen auf dem Handy einige Sekunden; sie sind markiert.
- Getestet wurde mit Chromium (iPhone-/iPad-Emulation). Echtes iOS-Safari (Tastatur, Speicher, Access-Login im Homescreen-Modus) bitte auf dem Gerät prüfen.
