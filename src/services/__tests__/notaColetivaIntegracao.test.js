import test from 'node:test';
import assert from 'node:assert/strict';
import { vinculaRegistroAoMilitar } from '../registrosMilitarMatcher.js';
import { montarHistoricoFolhaAlteracoes } from '../../components/folha-alteracoes/folhaAlteracoesHistorico.js';
import { analisarBoletimContraRegistros } from '../../utils/boletim/auditoriaPdf.js';
import { avaliarVinculoPublicacao } from '../../utils/boletim/avaliarVinculo.js';
const militares = [{ id: 'm1', nome_completo: 'João Antônio da Silva', matricula: '123456-7', status_cadastro: 'Ativo' }, { id: 'm2', nome_completo: 'Maria Helena de Souza', matricula: '987654-3', status_cadastro: 'Ativo' }];
const texto = 'Ata do teste de aptidão física. João Antônio da Silva matrícula 123456-7 e Maria Helena de Souza matrícula 987654-3 foram considerados aptos na avaliação física anual.';
const pub = { id: 'coletiva-1', coletiva: true, militares_ids: ['m1', 'm2'], militares_vinculados: militares.map(m => ({ militar_id: m.id, militar_nome: m.nome_completo, militar_matricula: m.matricula })), militar_id: '', tipo: 'Geral', texto_publicacao: texto, data_publicacao: '2026-10-29', nota_para_bg: '12345', numero_bg: '045', data_bg: '2026-10-29', status: 'Publicado' };
test('uma única nota coletiva pertence a todos e somente aos IDs vinculados', () => {
  for (const m of militares) assert.equal(vinculaRegistroAoMilitar(pub, m), true);
  assert.equal(vinculaRegistroAoMilitar(pub, { id: 'm3', nome_completo: militares[0].nome_completo, matricula: militares[0].matricula }), false);
});
test('folha individual preserva integralmente a ata compartilhada e deduplica pelo documento', () => {
  for (const militar of militares) {
    const res = montarHistoricoFolhaAlteracoes({ registros: [pub, pub], militar, dataInicial: '2026-01-01', dataFinal: '2026-12-31' });
    assert.equal(res.eventos.length, 1); assert.equal(res.eventos[0].texto, texto);
  }
});
test('conciliação identifica a mesma publicação nos dois participantes sem gerar cópias', () => {
  const nota = { id: 'n1', nota: '12345', contexto: texto, pagina: 1 };
  const res = analisarBoletimContraRegistros([nota], militares, [pub], { numeroBoletim: '045', dataBoletim: '2026-10-29' });
  assert.equal(res.ocorrencias.length, 2);
  for (const o of res.ocorrencias) assert.equal(o.status, 'registro_localizado');
  assert.equal(avaliarVinculoPublicacao(pub, nota, militares).compativel, true);
});
test('conciliação não confirma uma coletiva quando falta um dos militares na nota', () => {
  const nota = { nota: '12345', contexto: 'Ata do teste de aptidão física. João Antônio da Silva matrícula 123456-7 foi considerado apto na avaliação física anual.', pagina: 1 };
  assert.equal(avaliarVinculoPublicacao(pub, nota, militares).identidade, 'nao_identificada');
});