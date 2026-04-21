import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aplicarContextoMilitarNaFerias,
  feriasCorrespondeBusca,
  montarLabelMilitarFerias,
  montarPayloadRegistroLivroFerias,
} from '../feriasMilitarContextService.js';

test('férias exibe matrícula atual derivada no contexto operacional', () => {
  const ferias = { militar_matricula: '111.111-111' };
  const militar = {
    status_cadastro: 'Ativo',
    matricula: '111.111-111',
    matriculas_historico: [
      { matricula: '111.111-111', matricula_formatada: '111.111-111', is_atual: false },
      { matricula: '222.222-222', matricula_formatada: '222.222-222', is_atual: true },
    ],
  };

  const view = aplicarContextoMilitarNaFerias(ferias, militar, { contexto: 'operacional' });
  assert.equal(view.militar_matricula_atual, '222.222-222');
  assert.equal(view.militar_matricula_label, '222.222-222');
  assert.equal(view.militar_matricula, '111.111-111');
});

test('férias preserva matrícula histórica congelada em contexto documental', () => {
  const ferias = {
    militar_matricula: '111.111-111',
    militar_matricula_vinculo: '111.111-111',
    militar_matricula_atual: '222.222-222',
  };

  const label = montarLabelMilitarFerias(ferias, { contexto: 'documental' });
  assert.equal(label, '111.111-111');

  const view = aplicarContextoMilitarNaFerias(ferias, null, { contexto: 'documental' });
  assert.equal(view.militar_matricula_label, '111.111-111');
  assert.equal(view.militar_matricula, '111.111-111');
});

test('busca/selector de férias encontra matrícula atual e histórica', () => {
  const ferias = {
    militar_nome: 'Maria Oliveira',
    militar_matricula_label: '222.222-222',
    militar_matricula_atual: '222.222-222',
    militar_matricula_vinculo: '111.111-111',
    periodo_aquisitivo_ref: '2025/2026',
  };

  assert.equal(feriasCorrespondeBusca(ferias, 'maria'), true);
  assert.equal(feriasCorrespondeBusca(ferias, '222.222-222'), true);
  assert.equal(feriasCorrespondeBusca(ferias, '111.111-111'), true);
  assert.equal(feriasCorrespondeBusca(ferias, '2025/2026'), true);
  assert.equal(feriasCorrespondeBusca(ferias, '999.999-999'), false);
});

test('sinaliza militar mesclado em vínculo histórico de férias', () => {
  const view = aplicarContextoMilitarNaFerias(
    { militar_matricula: '333.333-333' },
    { status_cadastro: 'Mesclado', merged_into_id: 'destino' },
    { contexto: 'documental' },
  );

  assert.equal(view.militar_mesclado, true);
});

test('payload de registro de livro mantém matrícula documental sem regressão', () => {
  const payload = montarPayloadRegistroLivroFerias(
    {
      militar_id: 'm1',
      militar_nome: 'Fulano',
      militar_posto: 'ST',
      militar_matricula: '111.111-111',
      militar_matricula_vinculo: '111.111-111',
      militar_matricula_atual: '222.222-222',
    },
    { tipo_registro: 'Saída Férias' },
  );

  assert.equal(payload.militar_matricula, '111.111-111');
  assert.equal(payload.militar_matricula_vinculo, '111.111-111');
  assert.equal(payload.militar_matricula_atual, '222.222-222');
  assert.equal(payload.tipo_registro, 'Saída Férias');
});
