import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rootPath = process.cwd();
    const subPath = specifier.slice(2);
    // Try .js, .jsx, or just the path
    const baseResolvedPath = join(rootPath, 'src', subPath);

    // Simplistic approach for this loader
    let finalPath = baseResolvedPath;
    if (!finalPath.endsWith('.js') && !finalPath.endsWith('.jsx')) {
        finalPath += '.js';
    }

    return nextResolve(pathToFileURL(finalPath).href, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (result.source && (url.includes('app-params.js') || url.includes('base44Client.js'))) {
    let source = result.source.toString();
    source = source.replace(/import\.meta\.env/g, 'process.env');
    source = source.replace(/window\.location\.href/g, '""');
    return { ...result, source };
  }
  return result;
}
