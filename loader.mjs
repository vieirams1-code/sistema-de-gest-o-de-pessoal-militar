import { pathToFileURL } from 'node:url'; import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  // Inject import.meta.env for Node.js tests
  if (typeof globalThis !== 'undefined' && !globalThis.importMetaEnvInjected) {
    globalThis.importMetaEnvInjected = true;
  }

  if (specifier.startsWith('@/')) {
    const rootPath = process.cwd();
    const subPath = specifier.slice(2);
    let finalPath = join(rootPath, 'src', subPath);

    if (!finalPath.endsWith('.js') && !finalPath.endsWith('.jsx')) {
        finalPath += '.jsx';
    }
  }

  if (specifier.includes('/src/') && specifier.endsWith('.js')) {
      const path = specifier.startsWith('file://') ? new URL(specifier).pathname : specifier;
      if (!existsSync(path) && existsSync(path.replace(/\.js$/, '.jsx'))) {
          const newSpecifier = specifier.replace(/\.js$/, '.jsx');
          return nextResolve(newSpecifier, context);
      }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".jsx")) { return { format: "module", shortCircuit: true, source: readFileSync(new URL(url), "utf8").replace(/import React from .react.;/g, "").replace(/import React, \{.*\} from .react.;/g, (m) => m.replace("React, ", "")) }; }
  const result = await nextLoad(url, context);
  if (result.source) {
    let source = result.source.toString();
    // Polyfill common browser/Vite globals
    source = source.replace(/import\.meta\.env/g, 'process.env');

    // Check if it is an assignment
    source = source.replace(/window\.location\.href\s*=/g, 'globalThis.windowLocationHref =');
    // Then replace usages
    source = source.replace(/window\.location\.href/g, '(globalThis.windowLocationHref || "")');

    return { ...result, source };
  }
  return result;
}
