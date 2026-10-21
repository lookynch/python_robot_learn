import path from 'node:path';
import type { Plugin } from 'vite';
import {
  buildIndex,
  compileModule,
  loadCourse,
  loadCourseLenient,
  type LoadedModule,
} from './content';

const INDEX_ID = 'virtual:course';
const MODULE_PREFIX = 'virtual:course-module/';

function compileLenient(mod: LoadedModule) {
  const lessons = mod.lessons.flatMap((lesson) => {
    try {
      return compileModule({ ...mod, lessons: [lesson] }).lessons;
    } catch (error) {
      console.warn(`[robopy-content] ${lesson.id} übersprungen: ${String(error)}`);
      return [];
    }
  });
  return { lessons };
}

export function contentPlugin(contentDir: string): Plugin {
  const root = path.resolve(contentDir);
  let modules: LoadedModule[] | null = null;
  let strict = true;
  const lenient = () => {
    const { modules: loaded, problems } = loadCourseLenient(root);
    if (problems.length)
      console.warn(
        `\n[robopy-content] ${problems.length} Problem(e):\n- ${problems.slice(0, 20).join('\n- ')}`,
      );
    return loaded
      .map((m) => ({ ...m, source: { ...m.source, lessons: m.lessons.map((l) => l.id) } }))
      .filter((m) => m.lessons.length > 0);
  };
  const load = () => (modules ??= strict ? loadCourse(root) : lenient());

  return {
    name: 'robopy-content',
    configResolved(config) {
      strict = config.command === 'build' && process.env.CONTENT_LENIENT !== '1';
    },
    resolveId(id) {
      if (id === INDEX_ID || id.startsWith(MODULE_PREFIX)) return `\0${id}`;
      return null;
    },
    load(id) {
      if (!id.startsWith('\0')) return null;
      const virtualId = id.slice(1);
      if (virtualId === INDEX_ID) {
        const loaded = load();
        for (const mod of loaded) this.addWatchFile(path.join(root, mod.dir, 'module.yaml'));
        const loaders = loaded
          .map(
            (m) =>
              `${JSON.stringify(m.source.id)}: () => import(${JSON.stringify(MODULE_PREFIX + m.source.id)})`,
          )
          .join(',\n');
        return `export const course = ${JSON.stringify(buildIndex(loaded))};\nexport const loaders = {\n${loaders}\n};`;
      }
      if (virtualId.startsWith(MODULE_PREFIX)) {
        const moduleId = virtualId.slice(MODULE_PREFIX.length);
        const mod = load().find((m) => m.source.id === moduleId);
        if (!mod) throw new Error(`Unbekanntes Modul ${moduleId}`);
        for (const lesson of mod.source.lessons)
          this.addWatchFile(path.join(root, mod.dir, `${lesson}.yaml`));
        return `export default ${JSON.stringify(strict ? compileModule(mod) : compileLenient(mod))};`;
      }
      return null;
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(root)) return;
      modules = null;
      for (const id of [...server.moduleGraph.idToModuleMap.keys()]) {
        if (id.startsWith('\0virtual:course')) {
          const m = server.moduleGraph.getModuleById(id);
          if (m) server.moduleGraph.invalidateModule(m);
        }
      }
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
