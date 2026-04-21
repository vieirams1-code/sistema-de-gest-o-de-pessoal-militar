import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aplicarContextoMilitarNoAtestado,
  montarLabelMilitarAtestado,
} from '../atestadoJisoMilitarContextService.js';

test('contexto operacional prioriza matrícula atual derivada', () => {
  const atestado = { militar_matricula: '111.111-111' };
  const militar = {
    status_cadastro: 'Ativo',
    matricula: '111.111-111',
    matriculas_historico: [
      { matricula: '111.111-111', matricula_formatada: '111.111-111', is_atual: false },
      { matricula: '222.222-222', matricula_formatada: '222.222-222', is_atual: true },
    ],
  };

  const view = aplicarContextoMilitarNoAtestado(atestado, militar, { contexto: 'operacional' });
  assert.equal(view.militar_matricula_atual, '222.222-222');
  assert.equal(view.militar_matricula, '222.222-222');
  assert.equal(view.militar_matricula_vinculo, '111.111-111');
});

test('contexto documental preserva matrícula congelada do registro', () => {
  const atestado = {
    militar_matricula: '111.111-111',
    militar_matricula_vinculo: '111.111-111',
    militar_matricula_atual: '222.222-222',
  };

  const label = montarLabelMilitarAtestado(atestado, { contexto: 'documental' });
  assert.equal(label, '111.111-111');

  const view = aplicarContextoMilitarNoAtestado(atestado, null, { contexto: 'documental' });
  assert.equal(view.militar_matricula, '111.111-111');
  assert.equal(view.militar_matricula_label, '111.111-111');
});

test('sinaliza militar mesclado em registros vinculados', () => {
  const view = aplicarContextoMilitarNoAtestado(
    { militar_matricula: '333.333-333' },
    { status_cadastro: 'Mesclado', merged_into_id: 'destino' },
    { contexto: 'documental' },
  );

  assert.equal(view.militar_mesclado, true);
});
