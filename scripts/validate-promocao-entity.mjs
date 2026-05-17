import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const requiredFiles = [
  'base44/entities/Promocao.jsonc',
  'entities/Promocao.json',
  'src/api/entities.js',
];

function stripJsonComments(source) {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function readSchema(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
  }
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(stripJsonComments(raw));
}

function assertPromocaoSchema(relativePath) {
  const schema = readSchema(relativePath);
  if (schema.name !== 'Promocao') {
    throw new Error(`${relativePath}: name esperado Promocao, recebido ${schema.name || '<vazio>'}`);
  }
  if (schema.type !== 'object') {
    throw new Error(`${relativePath}: type esperado object, recebido ${schema.type || '<vazio>'}`);
  }
  if (!schema.properties || typeof schema.properties !== 'object') {
    throw new Error(`${relativePath}: properties ausente ou inválido.`);
  }
  for (const field of ['tipo', 'natureza', 'posto_graduacao', 'quadro', 'data_promocao', 'origem']) {
    if (!schema.properties[field]) {
      throw new Error(`${relativePath}: campo obrigatório para runtime ausente em properties.${field}`);
    }
  }
  return schema;
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
  }
}

const publicSchema = assertPromocaoSchema('base44/entities/Promocao.jsonc');
assertPromocaoSchema('entities/Promocao.json');

const entitiesApi = fs.readFileSync(path.join(repoRoot, 'src/api/entities.js'), 'utf8');
if (!/export\s+const\s+Promocao\s*=\s*base44\.entities\.Promocao\s*;/.test(entitiesApi)) {
  throw new Error('src/api/entities.js não exporta Promocao a partir de base44.entities.Promocao.');
}

const base44EntityFiles = fs.readdirSync(path.join(repoRoot, 'base44/entities')).filter((file) => file.endsWith('.jsonc'));
const statusUsers = base44EntityFiles
  .filter((file) => file !== 'Promocao.jsonc')
  .filter((file) => {
    const schema = readSchema(path.join('base44/entities', file));
    return Boolean(schema.properties?.status);
  });

console.log('Promocao OK em base44/entities/Promocao.jsonc e entities/Promocao.json.');
console.log('Export OK em src/api/entities.js.');
console.log(`Campo status em Promocao: ${publicSchema.properties.status ? 'presente' : 'ausente'}; outras entidades publicáveis também usam status: ${statusUsers.join(', ') || 'nenhuma'}.`);
console.log('Manifesto explícito de entidades não encontrado: Base44 publica pelo diretório base44/entities/*.jsonc.');
