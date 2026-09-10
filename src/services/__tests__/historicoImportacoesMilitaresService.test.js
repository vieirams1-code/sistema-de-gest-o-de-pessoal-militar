import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __setHistoricoImportacoesClientForTests,
  listarHistoricoImportacoesMilitares,
  montarResumoHistorico,
  STATUS_LOTE_LABEL,
} from '../historicoImportacoesMilitaresService.js';

function criarLoteBase({ id, status, totalLinhas, totalImportadas, origem, data }) {
  return {
    id,
    origem_historico: origem,
    nome_arquivo: `lote-${id}.csv`,
    data_importacao: data,
    status_importacao: status,
    total_linhas: totalLinhas,
    total_importadas: totalImportadas,
    total_nao_importadas: Math.max(totalLinhas - totalImportadas, 0),
    total_erros: totalLinhas - totalImportadas,
    relatorio_json: JSON.stringify({ arquivo: { nome: `lote-${id}.csv` }, linhas: [] }),
  };
}

test('listarHistoricoImportacoesMilitares agrega históricos de militares e alterações legado', async () => {
  __setHistoricoImportacoesClientForTests({
    entities: {
      ImportacaoMilitares: {
        list: async () => [
          criarLoteBase({ id: 'm1', status: 'Importado', totalLinhas: 3, totalImportadas: 3, origem: 'ImportacaoMilitares', data: '2026-04-20T10:00:00.000Z' }),
        ],
      },
      ImportacaoAlteracoesLegado: {
        list: async () => [
          criarLoteBase({ id: 'a1', status: 'Importado Parcial', totalLinhas: 5, totalImportadas: 2, origem: 'ImportacaoAlteracoesLegado', data: '2026-04-21T10:00:00.000Z' }),
        ],
      },
    },
  });

  const lotes = await listarHistoricoImportacoesMilitares();

  assert.equal(lotes.length, 2);
  assert.equal(lotes[0].id, 'a1');
  assert.equal(lotes[0].tipoImportacao, 'Migração de Alterações Legado');
  assert.equal(lotes[1].id, 'm1');
  assert.equal(lotes[1].tipoImportacao, 'Migração de Militares');

  __setHistoricoImportacoesClientForTests(null);
});

test('histórico legado não expõe CPF, telefone ou snapshots brutos ao frontend', async () => {
  __setHistoricoImportacoesClientForTests({
    entities: {
      ImportacaoMilitares: {
        list: async () => [{
          id: 'legacy-pii',
          nome_arquivo: 'legado.csv',
          data_importacao: '2026-04-22T10:00:00.000Z',
          status_importacao: 'Importado',
          total_linhas: 1,
          total_importadas: 1,
          relatorio_json: JSON.stringify({
            arquivo: { nome: 'legado.csv' },
            linhas: [{
              linhaNumero: 2,
              status: 'APTO',
              original: { nome: 'Militar Legado', matricula: '111.222-333', cpf: '529.982.247-25', telefone: '67999999999', rg: '123456' },
              transformado: { nome_completo: 'Militar Legado', matricula: '111.222-333', cpf: '52998224725', telefone: '67999999999', banco: '001' },
              importada: true,
            }],
          }),
        }],
      },
      ImportacaoAlteracoesLegado: { list: async () => [] },
    },
  });

  const [lote] = await listarHistoricoImportacoesMilitares();
  const linha = lote.linhas[0];

  assert.equal(linha.nome, 'Militar Legado');
  assert.equal(linha.matricula_atual, '111.222-333');
  assert.equal(Object.hasOwn(linha, 'cpf'), false);
  assert.equal(Object.hasOwn(linha, 'telefone'), false);
  assert.equal(Object.hasOwn(linha, 'dadosOriginais'), false);
  assert.equal(Object.hasOwn(linha, 'dadosTransformados'), false);
  assert.deepEqual(Object.keys(lote.relatorioRaw).sort(), ['origem_historico', 'permite_retomada', 'tipo_relatorio', 'versao_relatorio'].sort());

  __setHistoricoImportacoesClientForTests(null);
});

test('montarResumoHistorico contabiliza cards com base em registros persistidos', () => {
  const lotes = [
    {
      statusGeral: STATUS_LOTE_LABEL.CONCLUIDA,
      resumo: { total_linhas: 3, total_importadas: 3, total_revisar: 0, total_erros: 0, total_aptas_com_alerta: 0 },
    },
    {
      statusGeral: STATUS_LOTE_LABEL.PARCIAL,
      resumo: { total_linhas: 5, total_importadas: 2, total_revisar: 1, total_erros: 2, total_aptas_com_alerta: 1 },
    },
    {
      statusGeral: STATUS_LOTE_LABEL.FALHA,
      resumo: { total_linhas: 4, total_importadas: 0, total_revisar: 0, total_erros: 4, total_aptas_com_alerta: 0 },
    },
  ];

  const resumo = montarResumoHistorico(lotes);

  assert.equal(resumo.totalLotes, 3);
  assert.equal(resumo.totalConcluidas, 1);
  assert.equal(resumo.totalParciais, 1);
  assert.equal(resumo.totalComErro, 1);
  assert.equal(resumo.totalImportadas, 5);
  assert.equal(resumo.totalPendencias, 7);
});
