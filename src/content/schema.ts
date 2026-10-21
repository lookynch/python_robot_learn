import { z } from 'zod';

const markdown = z.string().trim().min(1);
const code = z.string().min(1);
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'nur a-z, 0-9 und -');

export const testCaseSchema = z.strictObject({
  name: z.string().min(1),
  code: code,
});

const common = {
  title: z.string().optional(),
  optional: z.boolean().optional(),
  fading: z.boolean().optional(),
};

const optionSchema = z.strictObject({
  text: markdown,
  correct: z.boolean(),
  why: markdown,
});

export const textStep = z.strictObject({ type: z.literal('text'), ...common, body: markdown });

export const exampleStep = z.strictObject({
  type: z.literal('example'),
  ...common,
  intro: markdown.optional(),
  code,
  subgoals: z
    .array(
      z.strictObject({
        lines: z.union([z.number().int().min(1), z.tuple([z.number().int().min(1), z.number().int().min(1)])]),
        label: z.string().min(1),
      }),
    )
    .optional(),
  after: markdown.optional(),
  stdin: z.array(z.string()).optional(),
  heavy: z.boolean().optional(),
});

export const predictStep = z.strictObject({
  type: z.literal('predict'),
  ...common,
  intro: markdown.optional(),
  code,
  question: markdown.default('Was gibt das Programm aus?'),
  options: z.array(z.string()).min(2).max(5).optional(),
  answer: z.string(),
  explanation: markdown,
  stdin: z.array(z.string()).optional(),
});

export const traceStep = z.strictObject({
  type: z.literal('trace'),
  ...common,
  intro: markdown.optional(),
  code,
  questions: z
    .array(
      z.strictObject({
        line: z.number().int().min(1),
        hit: z.number().int().min(1).default(1),
        var: z.string().min(1),
        answer: z.string(),
        prompt: markdown.optional(),
      }),
    )
    .optional(),
  after: markdown.optional(),
  stdin: z.array(z.string()).optional(),
});

const checkable = {
  expect_output: z.string().optional(),
  tests: z.array(testCaseSchema).optional(),
  stdin: z.array(z.string()).optional(),
  explanation: markdown.optional(),
};

export const parsonsStep = z.strictObject({
  type: z.literal('parsons'),
  ...common,
  prompt: markdown,
  lines: z.array(z.string().min(1)).min(2).max(14),
  distractors: z.array(z.string().min(1)).max(3).optional(),
  ...checkable,
});

export const fillStep = z.strictObject({
  type: z.literal('fill'),
  ...common,
  prompt: markdown,
  code,
  blanks: z
    .array(
      z.strictObject({
        answer: z.string().min(1),
        options: z.array(z.string().min(1)).min(2).max(6),
      }),
    )
    .min(1)
    .max(5),
  ...checkable,
});

export const exerciseStep = z.strictObject({
  type: z.literal('exercise'),
  ...common,
  mode: z.enum(['modify', 'make']).default('make'),
  prompt: markdown,
  starter: z.string(),
  solution: code,
  tests: z.array(testCaseSchema).min(1),
  mutants: z.array(code).min(1),
  hints: z.array(markdown).min(1).max(4),
  stdin: z.array(z.string()).optional(),
  heavy: z.boolean().optional(),
  explanation: markdown.optional(),
});

export const quizStep = z.strictObject({
  type: z.literal('quiz'),
  ...common,
  question: markdown,
  code: z.string().optional(),
  options: z.array(optionSchema).min(2).max(5),
  multi: z.boolean().optional(),
});

export const explainStep = z.strictObject({
  type: z.literal('explain'),
  ...common,
  question: markdown,
  code: z.string().optional(),
  options: z.array(optionSchema).min(2).max(5),
});

export const stepSchema = z.discriminatedUnion('type', [
  textStep,
  exampleStep,
  predictStep,
  traceStep,
  parsonsStep,
  fillStep,
  exerciseStep,
  quizStep,
  explainStep,
]);

export const cardVariantSchema = z.discriminatedUnion('type', [quizStep, predictStep]);

export const cardSchema = z.strictObject({
  id,
  concept: id,
  variants: z.array(cardVariantSchema).min(1).max(6),
});

export const lessonSchema = z.strictObject({
  id,
  title: z.string().min(1),
  kind: z.enum(['lesson', 'checkpoint']).default('lesson'),
  minutes: z.number().int().min(1).max(40),
  goals: z.array(markdown).min(1).max(5),
  concepts: z.array(id).default([]),
  steps: z.array(stepSchema).min(1).max(30),
  cards: z.array(cardSchema).default([]),
});

export const conceptSchema = z.strictObject({
  id,
  name: z.string().min(1),
  description: z.string().min(1),
});

export const moduleSchema = z.strictObject({
  id: z.string().regex(/^m\d{2}$/),
  number: z.number().int().min(0),
  title: z.string().min(1),
  summary: markdown,
  depth: z.enum(['voll', 'spiel', 'konzept']).default('voll'),
  lessons: z.array(id).min(1),
  concepts: z.array(conceptSchema).default([]),
});

export type TestCase = z.infer<typeof testCaseSchema>;
export type TextStep = z.infer<typeof textStep>;
export type ExampleStep = z.infer<typeof exampleStep>;
export type PredictStep = z.infer<typeof predictStep>;
export type TraceStep = z.infer<typeof traceStep>;
export type ParsonsStep = z.infer<typeof parsonsStep>;
export type FillStep = z.infer<typeof fillStep>;
export type ExerciseStep = z.infer<typeof exerciseStep>;
export type QuizStep = z.infer<typeof quizStep>;
export type ExplainStep = z.infer<typeof explainStep>;
export type Step = z.infer<typeof stepSchema>;
export type CardVariant = z.infer<typeof cardVariantSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Concept = z.infer<typeof conceptSchema>;

export type Lesson = z.infer<typeof lessonSchema> & {
  moduleId: string;
  promptSources: Record<number, string>;
};

export type ModuleSource = z.infer<typeof moduleSchema>;

export interface LessonSummary {
  id: string;
  title: string;
  kind: 'lesson' | 'checkpoint';
  minutes: number;
  stepCount: number;
  concepts: string[];
  cardIds: string[];
}

export interface ModuleSummary {
  id: string;
  number: number;
  title: string;
  summary: string;
  depth: 'voll' | 'spiel' | 'konzept';
  concepts: Concept[];
  lessons: LessonSummary[];
}

export interface CourseIndex {
  modules: ModuleSummary[];
}

export interface ModuleContent {
  lessons: Lesson[];
}

export const SCORED_STEP_TYPES = new Set<Step['type']>(['quiz', 'predict', 'parsons', 'fill', 'exercise']);
export const DEFAULT_PREDICT_QUESTION = 'Was gibt das Programm aus?';
