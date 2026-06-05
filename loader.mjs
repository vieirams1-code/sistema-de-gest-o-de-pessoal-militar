import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rootPath = process.cwd();
    const subPath = specifier.slice(2);
    const basePath = join(rootPath, 'src', subPath);

    const extensions = ['', '.js', '.jsx', '.json'];
    for (const ext of extensions) {
      const fullPath = basePath + ext;
      if (existsSync(fullPath)) {
        return nextResolve(pathToFileURL(fullPath).href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
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
