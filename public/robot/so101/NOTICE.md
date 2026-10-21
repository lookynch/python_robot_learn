# SO-101 – Herkunft und Änderungen

Modell: The Robot Studio SO-101, MJCF aus MuJoCo Menagerie
(https://github.com/google-deepmind/mujoco_menagerie/tree/3abca2e302625cec9429c49806121ea2855cef81/robotstudio_so101),
Lizenz: Apache License 2.0 (siehe LICENSE).

Änderungen durch RoboPy (scripts/prepare-so101.ts):
- Sicht-Meshes mit meshoptimizer auf ca. 12 % der Dreiecke vereinfacht
  (17.4 MB → 2.6 MB).
- Kollisions-Meshes des Greifers und so101.xml unverändert.
- scene.xml (Boden, Licht, Objekte) ist eine eigene Ergänzung von RoboPy.
