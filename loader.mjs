import { pathToFileURL } from 'node:url';
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
        if (existsSync(finalPath + '.js')) {
            finalPath += '.js';
        } else if (existsSync(finalPath + '.jsx')) {
            finalPath += '.jsx';
        } else {
            finalPath += '.js';
        }
    }

    return nextResolve(pathToFileURL(finalPath).href, context);
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
  if (url.endsWith('.jsx')) {
    const result = await nextLoad(url, { ...context, format: 'module' });
    let source = result.source.toString();
    // Remove typical React imports that might fail in Node
    source = source.replace(/import React from 'react';/g, '');
    source = source.replace(/import \{ [^}]* \} from 'react';/g, '');
    // Replace any JSX-specific syntax if it's simple enough, or just wrap in a try-catch
    return { ...result, source, format: 'module' };
  }

  const result = await nextLoad(url, context);
  if (result.source && (url.includes('app-params.js') || url.includes('base44Client.js'))) {
    let source = result.source.toString();
    source = source.replace(/import\.meta\.env/g, 'process.env');
    source = source.replace(/window\.location\.href/g, '""');
    return { ...result, source };
  }
  return result;
}
