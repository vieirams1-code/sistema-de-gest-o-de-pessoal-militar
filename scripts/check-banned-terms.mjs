#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

const directoriesToScan = ['src', 'entities', 'scripts'];
const allowedExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.md',
]);

const ignoredDirectories = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vite',
  'coverage',
]);

const forbiddenPatterns = [
  { label: 'antiguidade', regex: /\bantiguidade\b/iu },
  { label: 'promocao', regex: /\bpromocao\b/iu },
  { label: 'promover', regex: /\bpromover\b/iu },
  { label: 'data_promocao', regex: /\bdata_promocao\b/iu },
];

const violations = [];
const selfFilePath = path.resolve(projectRoot, 'scripts/check-banned-terms.mjs');

function collectFilesRecursively(directory) {
  const files = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(fullPath));
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function validateFile(filePath) {
  if (path.resolve(filePath) === selfFilePath) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(line)) {
        violations.push({
          filePath: path.relative(projectRoot, filePath),
          line: index + 1,
          pattern: pattern.label,
          snippet: line.trim(),
        });
      }
    }
  });
}

const filesToScan = directoriesToScan
  .map((directory) => path.join(projectRoot, directory))
  .flatMap((directory) => collectFilesRecursively(directory));

filesToScan.forEach((filePath) => validateFile(filePath));

if (violations.length > 0) {
  console.error('❌ Termos proibidos detectados (módulo removido):');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line} [${violation.pattern}] ${violation.snippet}`);
  }
  process.exit(1);
}

console.log('✅ Checagem de termos proibidos concluída sem violações.');
