import type { Lesson, ModuleSummary, Step } from '../content/schema';
import type { RunResult } from '../python/protocol';

export interface AiContextInput {
  module: ModuleSummary;
  lesson: Lesson;
  stepIndex: number;
  step: Step;
  code?: string;
  result?: RunResult | null;
  hintsShown?: number;
}

function htmlToText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, '');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('.katex-mathml').forEach((n) => n.remove());
  doc.querySelectorAll('annotation').forEach((n) => n.remove());
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function fence(code: string, lang = 'python'): string {
  return `\`\`\`${lang}\n${code.replace(/\n+$/, '')}\n\`\`\``;
}

const STEP_LABELS: Record<Step['type'], string> = {
  text: 'Erklärung',
  example: 'Codebeispiel',
  predict: 'Ausgabe vorhersagen',
  trace: 'Programm Schritt für Schritt verfolgen',
  parsons: 'Codezeilen in die richtige Reihenfolge bringen',
  fill: 'Lücken im Code füllen',
  exercise: 'Programmieraufgabe',
  quiz: 'Quizfrage',
  explain: 'Selbsterklärung (Warum-Frage)',
};

export function buildAiContext(input: AiContextInput): string {
  const { module, lesson, step, stepIndex } = input;
  const parts: string[] = [];
  parts.push(
    'Ich lerne Python mit dem Ziel, Roboter mit World Models und Reinforcement Learning zu programmieren. Mathe kann ich (Ingenieurstudium), Programmieren lerne ich gerade. Hilf mir, die folgende Aufgabe zu verstehen. Erkläre mir den Gedanken und stelle Rückfragen, aber verrate die Lösung nicht direkt, solange ich nicht ausdrücklich darum bitte.',
  );
  parts.push(
    `## Kontext\n- Modul ${module.number}: ${module.title}\n- Lektion: ${lesson.title}\n- Lernziele: ${lesson.goals.map(htmlToText).join('; ')}\n- Schritt ${stepIndex + 1} von ${lesson.steps.length}: ${STEP_LABELS[step.type]}`,
  );
  const prompt = lesson.promptSources[stepIndex];
  if (prompt) parts.push(`## Aufgabe\n${prompt.trim()}`);
  if (step.type === 'predict' || step.type === 'trace' || step.type === 'example')
    parts.push(`## Code der Aufgabe\n${fence(step.code)}`);
  if (step.type === 'fill') parts.push(`## Lückencode (___ = Lücke)\n${fence(step.code)}`);
  if (step.type === 'quiz' || step.type === 'explain') {
    parts.push(
      `## Antwortmöglichkeiten\n${step.options.map((o, i) => `${i + 1}. ${htmlToText(o.text)}`).join('\n')}`,
    );
  }
  if (step.type === 'exercise') {
    parts.push(
      `## Tests, die meine Lösung bestehen muss\n${step.tests.map((t) => `- ${t.name}:\n${fence(t.code)}`).join('\n')}`,
    );
    if (input.hintsShown)
      parts.push(
        `## Bereits angezeigte Hinweise\n${step.hints
          .slice(0, input.hintsShown)
          .map((h) => `- ${htmlToText(h)}`)
          .join('\n')}`,
      );
  }
  if (input.code && input.code.trim()) parts.push(`## Mein aktueller Code\n${fence(input.code)}`);
  const result = input.result;
  if (result) {
    if (result.stdout.trim())
      parts.push(`## Ausgabe meines Programms\n${fence(result.stdout.slice(-4000), 'text')}`);
    if (result.error) parts.push(`## Fehlermeldung\n${fence(result.error.traceback, 'text')}`);
    const failed = result.tests?.filter((t) => !t.passed) ?? [];
    if (failed.length)
      parts.push(
        `## Fehlgeschlagene Tests\n${failed.map((t) => `- ${t.name}: ${t.message ?? ''}`).join('\n')}`,
      );
  }
  parts.push(
    '## Umgebung\nPython 3.14 im Browser (Pyodide) mit NumPy. Das App-Modul `lab` stellt Visualisierungen (lab.plot, lab.arm, lab.Scene …) und Simulationen (lab.envs) bereit. Kein matplotlib/torch.',
  );
  return parts.join('\n\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}
