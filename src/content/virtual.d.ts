declare module 'virtual:course' {
  export const course: import('./schema').CourseIndex;
  export const loaders: Record<string, () => Promise<{ default: import('./schema').ModuleContent }>>;
}
