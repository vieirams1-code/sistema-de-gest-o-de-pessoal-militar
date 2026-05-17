import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const bashCommand = process.platform === 'win32' ? 'bash.exe' : 'bash';

function logStep(message) {
  console.log(`\n▶ ${message}`);
}

function logSuccess(message) {
  console.log(`✔ ${message}`);
}

function run(command, args, successMessage) {
  logStep(`${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(`✖ Falha ao iniciar comando: ${result.error.message}`);
    process.exit(result.status || 1);
  }

  if (result.status !== 0) {
    console.error(`✖ Comando falhou com exit code ${result.status}: ${command} ${args.join(' ')}`);
    process.exit(result.status || 1);
  }

  logSuccess(successMessage);
}

const promocaoSchemaPath = path.join(repoRoot, 'base44/entities/Promocao.jsonc');
if (!fs.existsSync(promocaoSchemaPath)) {
  console.error('✖ Entidade Promocao não encontrada em base44/entities/Promocao.jsonc.');
  process.exit(1);
}
logSuccess('entidade Promocao encontrada em base44/entities/Promocao.jsonc');

run(npmCommand, ['run', 'validate:promocao-entity'], 'schema Promocao validado localmente');
run(bashCommand, ['./scripts/publish-github-base44.sh'], 'alterações publicadas no GitHub');
run(npmCommand, ['run', 'entities:push'], 'push de entidades executado');
run(npmCommand, ['run', 'verify:promocao-runtime'], 'entidade Promocao criada e consultável no runtime');
run(npmCommand, ['run', 'deploy:base44'], 'deploy Base44 concluído');

logSuccess('publish Base44 concluído com Promocao disponível no runtime');
