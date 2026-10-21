import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import { Marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import {
  lessonSchema,
  moduleSchema,
  type CourseIndex,
  type Lesson,
  type ModuleContent,
  type ModuleSource,
  type Step,
} from '../src/content/schema';

export interface LoadedModule {
  dir: string;
  source: ModuleSource;
  lessons: (Lesson & { file: string })[];
}

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super(`Inhalte fehlerhaft:\n- ${problems.join('\n- ')}`);
  }
}

function readYaml(file: string): unknown {
  return parseYaml(fs.readFileSync(file, 'utf8'), { prettyErrors: true });
}

function zodProblems(file: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${file}: ${i.path.join('.') || '(Wurzel)'}: ${i.message}`);
}

function lintStep(where: string, step: Step, problems: string[]) {
  const needOneCorrect = (options: { correct: boolean }[], multi?: boolean) => {
    const correct = options.filter((o) => o.correct).length;
    if (multi ? correct < 1 : correct !== 1)
      problems.push(
        `${where}: ${multi ? 'mindestens eine' : 'genau eine'} Option muss correct: true sein (hat ${correct})`,
      );
  };
  switch (step.type) {
    case 'quiz':
      needOneCorrect(step.options, step.multi);
      break;
    case 'explain':
      needOneCorrect(step.options);
      break;
    case 'predict':
      if (step.options && !step.options.includes(step.answer))
        problems.push(`${where}: answer muss exakt einer der options entsprechen`);
      if (step.options && new Set(step.options).size !== step.options.length)
        problems.push(`${where}: options enthalten Duplikate`);
      break;
    case 'fill': {
      const holes = step.code.split('___').length - 1;
      if (holes !== step.blanks.length)
        problems.push(`${where}: ${holes} Lücken (___) im Code, aber ${step.blanks.length} blanks`);
      step.blanks.forEach((b, i) => {
        if (!b.options.includes(b.answer))
          problems.push(`${where}: blanks[${i}].answer fehlt in options`);
      });
      if (step.expect_output === undefined && !step.tests?.length)
        problems.push(`${where}: fill braucht expect_output oder tests`);
      break;
    }
    case 'parsons':
      if (step.expect_output === undefined && !step.tests?.length)
        problems.push(`${where}: parsons braucht expect_output oder tests`);
      if (step.lines.some((l) => /^\t/.test(l)))
        problems.push(`${where}: Einrückung mit Leerzeichen, nicht Tabs`);
      if (step.lines.some((l) => (l.length - l.trimStart().length) % 4 !== 0))
        problems.push(`${where}: Einrückung muss ein Vielfaches von 4 Leerzeichen sein`);
      break;
    case 'exercise':
      if (step.tests.length !== new Set(step.tests.map((t) => t.name)).size)
        problems.push(`${where}: Testnamen müssen eindeutig sein`);
      break;
    case 'example':
      for (const sg of step.subgoals ?? []) {
        const [from, to] = typeof sg.lines === 'number' ? [sg.lines, sg.lines] : sg.lines;
        const count = step.code.trimEnd().split('\n').length;
        if (from > to || to > count)
          problems.push(
            `${where}: subgoal-Zeilen ${from}-${to} außerhalb des Codes (${count} Zeilen)`,
          );
      }
      break;
    default:
      break;
  }
}

export function loadCourseLenient(root: string): { modules: LoadedModule[]; problems: string[] } {
  const problems: string[] = [];
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
    .map((d) => d.name)
    .sort();
  const modules: LoadedModule[] = [];
  const lessonIds = new Map<string, string>();
  const cardIds = new Map<string, string>();
  const conceptModule = new Map<string, number>();

  for (const dir of dirs) {
    const moduleFile = path.join(root, dir, 'module.yaml');
    if (!fs.existsSync(moduleFile)) {
      problems.push(`${dir}: module.yaml fehlt`);
      continue;
    }
    const parsedModule = moduleSchema.safeParse(readYaml(moduleFile));
    if (!parsedModule.success) {
      problems.push(...zodProblems(moduleFile, parsedModule.error));
      continue;
    }
    const source = parsedModule.data;
    if (dir.slice(0, 2) !== source.id.slice(1))
      problems.push(`${moduleFile}: id ${source.id} passt nicht zum Ordner ${dir}`);
    if (Number(dir.slice(0, 2)) !== source.number)
      problems.push(`${moduleFile}: number passt nicht zum Ordner`);
    for (const concept of source.concepts) {
      if (conceptModule.has(concept.id))
        problems.push(`${moduleFile}: Konzept ${concept.id} doppelt definiert`);
      conceptModule.set(concept.id, source.number);
    }
    const files = new Set(
      fs
        .readdirSync(path.join(root, dir))
        .filter((f) => f.endsWith('.yaml') && f !== 'module.yaml'),
    );
    const lessons: LoadedModule['lessons'] = [];
    for (const lessonId of source.lessons) {
      const file = path.join(root, dir, `${lessonId}.yaml`);
      files.delete(`${lessonId}.yaml`);
      if (!fs.existsSync(file)) {
        problems.push(`${moduleFile}: Lektion ${lessonId}.yaml fehlt`);
        continue;
      }
      let raw: unknown;
      try {
        raw = readYaml(file);
      } catch (error) {
        problems.push(`${file}: YAML-Fehler: ${String(error)}`);
        continue;
      }
      const parsed = lessonSchema.safeParse(raw);
      if (!parsed.success) {
        problems.push(...zodProblems(file, parsed.error));
        continue;
      }
      const lesson = parsed.data;
      if (lesson.id !== lessonId) problems.push(`${file}: id ${lesson.id} ≠ Dateiname`);
      if (lessonIds.has(lesson.id))
        problems.push(`${file}: Lektions-id doppelt (auch in ${lessonIds.get(lesson.id)})`);
      lessonIds.set(lesson.id, file);
      lesson.steps.forEach((step, i) =>
        lintStep(`${file}: steps[${i}] (${step.type})`, step, problems),
      );
      for (const card of lesson.cards) {
        if (cardIds.has(card.id)) problems.push(`${file}: Karten-id ${card.id} doppelt`);
        cardIds.set(card.id, file);
        card.variants.forEach((v, i) =>
          lintStep(`${file}: cards.${card.id}.variants[${i}]`, v, problems),
        );
      }
      if (
        lesson.kind === 'checkpoint' &&
        !lesson.steps.some((s) =>
          ['quiz', 'predict', 'parsons', 'fill', 'exercise'].includes(s.type),
        )
      )
        problems.push(`${file}: checkpoint ohne gewertete Schritte`);
      lessons.push({ ...lesson, moduleId: source.id, promptSources: {}, file });
    }
    for (const orphan of files)
      problems.push(`${path.join(root, dir, orphan)}: nicht in module.yaml gelistet`);
    if (!lessons.some((l) => l.kind === 'checkpoint') && source.number > 0)
      problems.push(`${moduleFile}: Modul braucht eine Checkpoint-Lektion`);
    modules.push({ dir, source, lessons });
  }

  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      const refs = [...lesson.concepts, ...lesson.cards.map((c) => c.concept)];
      for (const ref of refs) {
        const definedIn = conceptModule.get(ref);
        if (definedIn === undefined)
          problems.push(`${lesson.file}: Konzept ${ref} ist in keinem module.yaml definiert`);
        else if (definedIn > mod.source.number)
          problems.push(`${lesson.file}: Konzept ${ref} wird erst in Modul ${definedIn} definiert`);
      }
    }
  }

  return { modules, problems };
}

export function loadCourse(root: string): LoadedModule[] {
  const { modules, problems } = loadCourseLenient(root);
  if (problems.length) throw new ContentError(problems);
  return modules;
}

function createMarkdown() {
  const renderMath = (tex: string, displayMode: boolean) =>
    katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      output: 'html',
      strict: 'ignore',
    });
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    extensions: [
      {
        name: 'mathBlock',
        level: 'block',
        start: (src: string) => src.indexOf('$$'),
        tokenizer(src: string) {
          const match = /^\$\$([\s\S]+?)\$\$(?:\n|$)/.exec(src);
          return match ? { type: 'mathBlock', raw: match[0], text: match[1]!.trim() } : undefined;
        },
        renderer: (token) => renderMath(String(token.text), true),
      },
      {
        name: 'mathInline',
        level: 'inline',
        start: (src: string) => src.indexOf('$'),
        tokenizer(src: string) {
          const match = /^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
          return match ? { type: 'mathInline', raw: match[0], text: match[1]! } : undefined;
        },
        renderer: (token) => renderMath(String(token.text), false),
      },
    ],
  });
  return {
    block: (src: string) => marked.parse(src, { async: false }),
    inline: (src: string) => marked.parseInline(src, { async: false }),
  };
}

const MARKDOWN_BLOCK_FIELDS = new Set([
  'body',
  'intro',
  'after',
  'explanation',
  'prompt',
  'question',
  'why',
  'summary',
]);
const MARKDOWN_INLINE_FIELDS = new Set(['text', 'label']);
const RAW_FIELDS = new Set(['tests', 'blanks', 'lines', 'distractors', 'stdin', 'mutants']);
const PROMPT_FIELDS = ['prompt', 'question', 'body', 'intro'] as const;

function renderFields(
  value: unknown,
  md: ReturnType<typeof createMarkdown>,
  where: string,
): unknown {
  if (Array.isArray(value)) return value.map((v, i) => renderFields(v, md, `${where}[${i}]`));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    const at = `${where}.${key}`;
    try {
      if (typeof field === 'string' && MARKDOWN_BLOCK_FIELDS.has(key)) out[key] = md.block(field);
      else if (typeof field === 'string' && MARKDOWN_INLINE_FIELDS.has(key))
        out[key] = md.inline(field);
      else if (key === 'hints' || key === 'goals')
        out[key] = (field as string[]).map((h) => md.block(h));
      else if (
        RAW_FIELDS.has(key) ||
        (key === 'options' && Array.isArray(field) && typeof field[0] === 'string')
      )
        out[key] = field;
      else out[key] = renderFields(field, md, at);
    } catch (error) {
      if (error instanceof ContentError) throw error;
      throw new ContentError([
        `${at}: Markdown/KaTeX-Fehler: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  }
  return out;
}

export function compileModule(mod: LoadedModule): ModuleContent {
  const md = createMarkdown();
  return {
    lessons: mod.lessons.map(({ file, ...lesson }) => {
      const promptSources: Record<number, string> = {};
      lesson.steps.forEach((step, i) => {
        const source = PROMPT_FIELDS.map((f) => (step as Record<string, unknown>)[f]).find(
          (v) => typeof v === 'string',
        );
        if (typeof source === 'string') promptSources[i] = source;
      });
      return { ...(renderFields(lesson, md, file) as Lesson), promptSources };
    }),
  };
}

export function buildIndex(modules: LoadedModule[]): CourseIndex {
  const md = createMarkdown();
  return {
    modules: modules.map(({ source, lessons }) => ({
      id: source.id,
      number: source.number,
      title: source.title,
      summary: md.block(source.summary),
      depth: source.depth,
      concepts: source.concepts,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        kind: l.kind,
        minutes: l.minutes,
        stepCount: l.steps.length,
        concepts: l.concepts,
        cardIds: l.cards.map((c) => c.id),
      })),
    })),
  };
}
