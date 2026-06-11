import { pathToFileURL } from 'node:url'; import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  // Inject import.meta.env for Node.js tests
  if (typeof globalThis !== 'undefined' && !globalThis.importMetaEnvInjected) {
    globalThis.importMetaEnvInjected = true;
  }

  let resolvedSpecifier = specifier;

  if (specifier.startsWith('@/')) {
    const rootPath = process.cwd();
    const subPath = specifier.slice(2);
    let finalPath = join(rootPath, 'src', subPath);

    if (!finalPath.endsWith('.js') && !finalPath.endsWith('.jsx')) {
      if (existsSync(finalPath + '.js')) {
        finalPath += '.js';
      } else if (existsSync(finalPath + '.jsx')) {
        finalPath += '.jsx';
      } else if (existsSync(join(finalPath, 'index.js'))) {
        finalPath = join(finalPath, 'index.js');
      } else if (existsSync(join(finalPath, 'index.jsx'))) {
        finalPath = join(finalPath, 'index.jsx');
      }
    }
    resolvedSpecifier = pathToFileURL(finalPath).href;
  }

  // Handle case where it's already a relative path but needs extension or index
  if (resolvedSpecifier.startsWith('.') || resolvedSpecifier.startsWith('/') || resolvedSpecifier.startsWith('file:')) {
     const url = resolvedSpecifier.startsWith('file:') ? new URL(resolvedSpecifier) : pathToFileURL(join(process.cwd(), resolvedSpecifier));
     let path = url.pathname;

     if (!path.endsWith('.js') && !path.endsWith('.jsx') && !path.endsWith('.json')) {
         if (existsSync(path + '.js')) {
            resolvedSpecifier = pathToFileURL(path + '.js').href;
         } else if (existsSync(path + '.jsx')) {
            resolvedSpecifier = pathToFileURL(path + '.jsx').href;
         } else if (existsSync(join(path, 'index.js'))) {
            resolvedSpecifier = pathToFileURL(join(path, 'index.js')).href;
         } else if (existsSync(join(path, 'index.jsx'))) {
            resolvedSpecifier = pathToFileURL(join(path, 'index.jsx')).href;
         }
     }
  }

  try {
      return await nextResolve(resolvedSpecifier, context);
  } catch (e) {
      if (specifier.startsWith('@/api/')) {
           // Fallback manual resolution for @/api
           const manualPath = join(process.cwd(), 'src', 'api', specifier.slice(6) + (specifier.endsWith('.js') ? '' : '.js'));
           if (existsSync(manualPath)) {
               return nextResolve(pathToFileURL(manualPath).href, context);
           }
      }
      throw e;
  }
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
