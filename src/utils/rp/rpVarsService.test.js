import test from 'node:test';
import assert from 'node:assert/strict';

import { montarVariaveisTemplateRP } from '../rp/rpVarsService.js';

test('montarVariaveisTemplateRP inclui dias e dias_extenso para Dispensa Recompensa', () => {
  const formData = {
    tipo_registro: 'Dispensa Recompensa',
    dias: 5,
    data_registro: '2026-05-10',
    motivo_dispensa: 'Serviços prestados',
  };

  const militar = {
    nome_completo: 'Soldado Zero',
    posto_graduacao: 'Soldado',
    matricula: '999888',
    quadro: 'QPBM',
  };

  const vars = montarVariaveisTemplateRP({ formData, militar });

  assert.equal(vars.dias, '5');
  assert.equal(vars.dias_extenso, 'cinco');
  assert.equal(vars.tipo_registro, 'Dispensa Recompensa');
});

test('montarVariaveisTemplateRP inclui dias e dias_extenso para Homologação de Atestado', () => {
  const formData = {
    tipo_registro: 'Homologação de Atestado',
    atestado_homologado_id: 'atest-1',
  };

  const atestado = {
    id: 'atest-1',
    dias: 10,
    tipo_afastamento: 'Tratamento de Saúde',
    data_inicio: '2026-05-01',
    data_termino: '2026-05-10',
  };

  const militar = {
    nome_completo: 'Cabo Um',
    posto_graduacao: 'Cabo',
    matricula: '777666',
    quadro: 'QPBM',
  };

  const vars = montarVariaveisTemplateRP({
    formData,
    militar,
    atestadosDisponiveis: [atestado]
  });

  assert.equal(vars.dias, '10');
  assert.equal(vars.dias_extenso, 'dez');
});

test('montarVariaveisTemplateRP lida com dias zero ou ausentes sem quebrar', () => {
  const formData = {
    tipo_registro: 'Elogio Individual',
  };

  const militar = {
    nome_completo: 'Major Dois',
    posto_graduacao: 'Major',
    matricula: '555444',
  };

  const vars = montarVariaveisTemplateRP({ formData, militar });

  assert.equal(vars.dias, '');
  assert.equal(vars.dias_extenso, '');
});
