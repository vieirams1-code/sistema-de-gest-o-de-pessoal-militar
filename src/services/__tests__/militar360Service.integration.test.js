import test from 'node:test';
import assert from 'node:assert/strict';
import { montarMilitar360Bundle } from '../militar360Service.js';

test('montarMilitar360Bundle - Integração completa com todos os serviços', () => {
  const militar = {
    id: '1',
    nome_completo: 'João Silva',
    nome_guerra: 'João',
    matricula: '123456789',
    posto_graduacao: 'Soldado',
    quadro: 'QPM-1',
    comportamento: 'Bom',
    lotacao: '1º BPM',
    funcao: 'Motorista',
    data_inclusao: '2020-01-01',
    cpf: '12345678909',
    data_nascimento: '1990-01-01',
    created_date: '2023-01-01T10:00:00Z',
    last_modified_date: '2023-12-01T10:00:00Z',
    status_cadastro: 'Ativo'
  };

  const hoje = new Date('2024-05-20');
  const atestados = [
    { id: 'a1', status: 'Ativo', tipo_afastamento: 'LTS', data_inicio: '2024-05-20', data_termino: '2024-05-21' }
  ];
  const ferias = [
    { id: 'f1', status: 'Em Curso', data_inicio: '2024-05-20', data_fim: '2024-05-21', dias: 15 }
  ];
  const periodosAquisitivos = [
    { id: 'p1', ano_referencia: '2023', inicio_aquisitivo: '2023-01-01', fim_aquisitivo: '2023-12-31', status: 'Aberto' }
  ];

  const bundle = montarMilitar360Bundle({
    militar,
    atestados,
    ferias,
    periodosAquisitivos,
    hoje
  });

  // 1. Identidade
  assert.equal(bundle.identidade.id, '1');
  assert.equal(bundle.identidade.nomeCompleto, 'João Silva');

  // 2. Status Operacional (determinarStatusOperacional)
  // Atestado Ativo (prioridade 4) vs Férias (prioridade 3). Deve ser AFASTADO.
  assert.equal(bundle.statusOperacional.status, 'AFASTADO');

  // 3. Saúde (consolidarSaudeMilitar)
  assert.equal(bundle.saude.afastamentoAtivo, true);
  assert.equal(bundle.saude.possuiAtestadoVigente, true); // Backward compatibility
  assert.equal(bundle.saude.statusSaude, 'Com afastamento');

  // 4. Férias (consolidarFerias)
  assert.equal(bundle.ferias.situacaoAtual.emGozo, true);
  assert.equal(bundle.ferias.emFerias, true); // Backward compatibility
  assert.ok(bundle.ferias.periodos.length > 0);

  // 5. Carreira (montarConsolidadoCarreira)
  assert.ok(bundle.carreira.tempoServico);
  assert.ok(bundle.carreira.resumoCarreira.texto.includes('Soldado'));

  // 6. Documentos (getDocumentosUnificados)
  assert.ok(bundle.documentos.itens.length >= 2); // 1 atestado + 1 ferias
  assert.ok(bundle.documentos.itens.some(d => d.tipo === 'Atestado'));
  assert.ok(bundle.documentos.itens.some(d => d.tipo === 'Férias'));
  assert.equal(typeof bundle.documentos.quantidadePublicacoes, 'number');

  // 7. Auditoria (auditarMilitar)
  assert.ok(bundle.auditoria.score > 0);
  assert.equal(bundle.auditoria.statusCadastro, 'Ativo');

  // 8. Completude (calcularCompletudeMilitar)
  assert.ok(bundle.completude.percentual > 0);
  assert.ok(bundle.completude.preenchidos.includes('nome_completo'));

  // 9. Resumo Executivo (Agregado)
  assert.equal(bundle.resumoExecutivo.statusOperacional, 'AFASTADO');
  assert.equal(bundle.resumoExecutivo.scoreCompletude, bundle.auditoria.score);
  assert.equal(bundle.resumoExecutivo.situacaoFerias, 'Em gozo');
  assert.equal(bundle.resumoExecutivo.situacaoSaude, 'Com afastamento');
});

test('montarMilitar360Bundle - Valores default e segurança contra nulos', () => {
  const bundle = montarMilitar360Bundle({});

  assert.equal(bundle.identidade.nomeCompleto, 'Não informado');
  assert.equal(bundle.statusOperacional.status, 'DISPONIVEL');
  assert.equal(bundle.saude.afastamentoAtivo, false);
  assert.equal(bundle.ferias.emFerias, false);
  assert.ok(Array.isArray(bundle.documentos.itens));
  assert.ok(bundle.auditoria.score >= 0);
  assert.ok(bundle.completude.percentual >= 0);
});

test('montarMilitar360Bundle - Teste de promocoes vs historicoPromocoes', () => {
  const militar = { id: '1', posto_graduacao: 'Major' };
  const historicoPromocoes = [{ militar_id: '1', data_promocao: '2020-01-01', posto_graduacao_novo: 'Capitão', status_registro: 'ativo' }];
  const promocoes = [{ militar_id: '1', data_promocao: '2021-01-01', posto_graduacao_novo: 'Major', status_registro: 'ativo' }];

  // Se passar os dois, promocoes deve ter precedência conforme lógica implementada
  const bundle = montarMilitar360Bundle({ militar, historicoPromocoes, promocoes });
  assert.ok(bundle.carreira.historicoPromocoes.length > 0);
  assert.equal(bundle.carreira.historicoPromocoes[0].data_promocao, '2021-01-01');

  // Se passar só historicoPromocoes
  const bundle2 = montarMilitar360Bundle({ militar, historicoPromocoes });
  assert.ok(bundle2.carreira.historicoPromocoes.length > 0);
  assert.equal(bundle2.carreira.historicoPromocoes[0].data_promocao, '2020-01-01');
});
