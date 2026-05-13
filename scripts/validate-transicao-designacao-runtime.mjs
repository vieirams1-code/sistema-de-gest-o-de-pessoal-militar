#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const REQUIRED_ENTITIES = [
  'TransicaoDesignacaoLote',
  'TransicaoDesignacaoOperacao',
];

const REQUIRED_FIELDS = {
  TransicaoDesignacaoLote: [
    'militar_id',
    'contrato_designacao_id',
    'preview_hash',
    'idempotency_key',
    'status',
  ],
  TransicaoDesignacaoOperacao: [
    'lote_id',
    'periodo_aquisitivo_id',
    'acao',
    'status_operacao',
  ],
};

const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const stripJsonComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const readJsonLike = (relativePath) => JSON.parse(stripJsonComments(readText(relativePath)));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const logOk = (message) => console.log(`✓ ${message}`);

const verifySchema = (entityName, relativePath, { expectBase44RuntimeShape = false } = {}) => {
  const schema = readJsonLike(relativePath);
  assert(schema.name === entityName, `${relativePath}: schema.name esperado ${entityName}, encontrado ${schema.name || '<vazio>'}`);
  assert(schema.type === 'object', `${relativePath}: type deve ser object`);
  assert(schema.properties && typeof schema.properties === 'object', `${relativePath}: properties ausente`);

  for (const fieldName of REQUIRED_FIELDS[entityName]) {
    assert(Object.prototype.hasOwnProperty.call(schema.properties, fieldName), `${relativePath}: campo obrigatório de runtime ausente: ${fieldName}`);
  }

  for (const fieldName of schema.required || []) {
    assert(Object.prototype.hasOwnProperty.call(schema.properties, fieldName), `${relativePath}: required referencia campo inexistente: ${fieldName}`);
  }

  if (expectBase44RuntimeShape) {
    assert(schema.rls?.read, `${relativePath}: RLS read ausente`);
    assert(schema.rls?.write, `${relativePath}: RLS write ausente`);
  }

  logOk(`${relativePath} consistente para ${entityName}`);
};

for (const entityName of REQUIRED_ENTITIES) {
  verifySchema(entityName, `entities/${entityName}.json`);
  verifySchema(entityName, `base44/entities/${entityName}.jsonc`, { expectBase44RuntimeShape: true });
}

const apiEntities = readText('src/api/entities.js');
for (const entityName of REQUIRED_ENTITIES) {
  assert(
    apiEntities.includes(`export const ${entityName} = base44.entities.${entityName};`),
    `src/api/entities.js: export ausente para ${entityName}`,
  );
  logOk(`src/api/entities.js exporta ${entityName}`);
}

const applyFunction = readText('base44/functions/aplicarTransicaoDesignacaoManual/entry.ts');
for (const entityName of REQUIRED_ENTITIES) {
  assert(
    applyFunction.includes(`base44.asServiceRole.entities.${entityName}`),
    `base44/functions/aplicarTransicaoDesignacaoManual/entry.ts: uso service-role ausente para ${entityName}`,
  );
  logOk(`aplicarTransicaoDesignacaoManual referencia ${entityName} via service-role`);
}

const appConfig = readJsonLike('base44/.app.jsonc');
assert(appConfig.id, 'base44/.app.jsonc: id do app Base44 ausente');
logOk(`base44/.app.jsonc aponta para o app ${appConfig.id}`);

console.log('\nPré-checagem local concluída. Para publicar no runtime, execute: npm run publish:transicao-designacao-runtime');
