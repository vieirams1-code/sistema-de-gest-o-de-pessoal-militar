import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverMilitaresRelacionados } from './militaresRelacionados.js';

// Homônimos de nome de guerra: mesmo "LIMA", graduações diferentes.
const efetivo = [
  { id: 'm1', nome_completo: 'Ricardo Alves Lima', nome_guerra: 'LIMA', posto_graduacao: 'Cabo', status_cadastro: 'Ativo' },
  { id: 'm2', nome_completo: 'Rodrigo Barbosa Lima', nome_guerra: 'LIMA', posto_graduacao: 'Soldado', status_cadastro: 'Ativo' },
  { id: 'm3', nome_completo: 'Marcos Pereira Souza', nome_guerra: 'SOUZA', posto_graduacao: '3º Sargento', status_cadastro: 'Ativo' },
];

const entrada = (posto, postoNormalizado, nome) => ({
  posto,
  posto_normalizado: postoNormalizado,
  nome_guerra: nome,
  responsavel_pelo_ato: false,
});

test('homônimos: nome completo no texto confirma um único militar', () => {
  const entradaNota = entrada('SD', 'Soldado', 'LIMA');
  const texto = 'NOTA N. 123456 O SD PM RODRIGO BARBOSA LIMA, matrícula 123.456-7, foi designado ao serviço.';
  const [r] = resolverMilitaresRelacionados([entradaNota], efetivo, { textoNota: texto });
  assert.equal(r.militar?.id, 'm2');
  assert.equal(r.confianca, 'alta');
  assert.match(r.criterio, /Nome completo confirmado/);
});

test('homônimos: sem nome completo no texto não há confirmação, mesmo com a graduação coincidindo', () => {
  const entradaNota = entrada('CB', 'Cabo', 'LIMA');
  const texto = 'NOTA N. 123456 O CB PM LIMA foi designado ao serviço.';
  const [r] = resolverMilitaresRelacionados([entradaNota], efetivo, { textoNota: texto });
  assert.notEqual(r.confianca, 'alta');
  assert.equal(r.confianca, 'revisar');
  assert.match(r.criterio, /nome completo não consta/);
});

test('homônimos: mais de um nome completo confirmado fica para revisão', () => {
  const entradaNota = entrada('CB', 'Cabo', 'LIMA');
  const texto = 'NOTA N. 123456 O CB RICARDO ALVES LIMA e o SD RODRIGO BARBOSA LIMA foram designados.';
  const [r] = resolverMilitaresRelacionados([entradaNota], efetivo, { textoNota: texto });
  assert.equal(r.militar, null);
  assert.equal(r.confianca, 'revisar');
  assert.match(r.criterio, /Mais de um homônimo/);
});

test('caso inequívoco: um único candidato com a graduação igual continua confirmado', () => {
  const entradaNota = entrada('3 SGT', '3º Sargento', 'SOUZA');
  const texto = 'NOTA N. 123456 O 3º SGT PM SOUZA foi designado ao serviço.';
  const [r] = resolverMilitaresRelacionados([entradaNota], efetivo, { textoNota: texto });
  assert.equal(r.militar?.id, 'm3');
  assert.equal(r.confianca, 'alta');
});

test('nome completo confirma o militar mesmo quando a graduação da nota é outra', () => {
  const entradaNota = entrada('SD', 'Soldado', 'LIMA');
  const texto = 'NOTA N. 123456 O SD PM RICARDO ALVES LIMA foi designado ao serviço.';
  const [r] = resolverMilitaresRelacionados([entradaNota], efetivo, { textoNota: texto });
  assert.equal(r.militar?.id, 'm1');
  assert.equal(r.confianca, 'alta');
});