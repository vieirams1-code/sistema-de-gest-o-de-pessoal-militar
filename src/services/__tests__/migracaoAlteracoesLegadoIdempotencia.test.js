import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarChaveOrigemLinhaDeterministica,
  gerarHashLotePorTabelaDeterministico,
  resolverEstadoReutilizado,
} from '../migracaoAlteracoesLegadoIdempotencia.js';

test('gera hash_lote estável para mesmo conteúdo normalizado', async () => {
  const tabelaA = [
    ['Nome Completo', 'Matrícula', 'Matéria'],
    ['  João  Silva ', '12345', 'Homologação de Atestado'],
  ];
  const tabelaB = [
    ['nome completo', 'matricula', 'materia'],
    ['JOAO SILVA', '12345', 'homologacao de atestado'],
  ];

  const hashA = await gerarHashLotePorTabelaDeterministico(tabelaA);
  const hashB = await gerarHashLotePorTabelaDeterministico(tabelaB);

  assert.equal(hashA, hashB);
});

test('gera chave_origem estável para variações cosméticas', async () => {
  const linhaA = {
    matricula_legado: '00123-4',
    nome_completo_legado: 'José da Silva',
    materia_legado: 'Elogio Individual',
    numero_bg: 'BG-100',
    data_bg: '2026-03-10',
    conteudo_trecho_legado: '  Texto legado com  espaços  ',
  };

  const linhaB = {
    matricula_legado: '001234',
    nome_completo_legado: 'JOSE DA SILVA',
    materia_legado: 'elogio individual',
    numero_bg: 'bg 100',
    data_publicacao: '10/03/2026',
    conteudo_trecho_legado: 'texto legado com espaços',
  };

  const chaveA = await gerarChaveOrigemLinhaDeterministica(linhaA);
  const chaveB = await gerarChaveOrigemLinhaDeterministica(linhaB);

  assert.equal(chaveA, chaveB);
});

test('reaproveita estado anterior sem perder dados atuais', () => {
  const atual = { destino_final: 'IMPORTAR', motivo_destino: '', tipo_publicacao_confirmado: '' };
  const anterior = { transformado: { destino_final: 'REVISAO', motivo_destino: 'Aguardando análise', tipo_publicacao_confirmado: 'Elogio Individual' } };

  const resultado = resolverEstadoReutilizado(atual, anterior);

  assert.equal(resultado.destino_final, 'REVISAO');
  assert.equal(resultado.motivo_destino, 'Aguardando análise');
  assert.equal(resultado.tipo_publicacao_confirmado, 'Elogio Individual');
});
