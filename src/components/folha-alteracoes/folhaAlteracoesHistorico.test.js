import test from 'node:test';
import assert from 'node:assert/strict';

import {
  agruparHistoricoPorAnoMes,
  deduplicarEventosFolhaAlteracoes,
  ordenarEventosFolhaAlteracoes,
} from './folhaAlteracoesHistorico.js';

test('Folha de Alterações preserva múltiplos registros publicados na mesma data', () => {
  const eventos = ordenarEventosFolhaAlteracoes(deduplicarEventosFolhaAlteracoes([
    {
      id: 'licenca-paternidade',
      data: '2026-05-22',
      texto: 'Licença Paternidade',
      referenciaBoletim: 'Boletim 100, de 22/05/2026',
      origem: 'PublicacaoExOfficio',
    },
    {
      id: 'dispensa-recompensa',
      data: '2026-05-22',
      texto: 'Dispensa como Recompensa',
      referenciaBoletim: 'Boletim 100, de 22/05/2026',
      origem: 'PublicacaoExOfficio',
    },
  ]));

  const historico = agruparHistoricoPorAnoMes(eventos, '2026-05-01', '2026-05-31');
  const maio = historico[0].meses[0];

  assert.equal(maio.titulo, 'MÊS DE MAIO/2026');
  assert.deepEqual(maio.eventos.map((evento) => evento.texto), [
    'Licença Paternidade',
    'Dispensa como Recompensa',
  ]);
});

test('Folha de Alterações deduplica somente o mesmo registro por origem e id', () => {
  const eventos = deduplicarEventosFolhaAlteracoes([
    { id: 'registro-1', data: '2026-05-22', texto: 'Licença Paternidade', origem: 'PublicacaoExOfficio' },
    { id: 'registro-1', data: '2026-05-22', texto: 'Licença Paternidade', origem: 'PublicacaoExOfficio' },
    { id: 'registro-2', data: '2026-05-22', texto: 'Dispensa como Recompensa', origem: 'PublicacaoExOfficio' },
  ]);

  assert.deepEqual(eventos.map((evento) => evento.texto), [
    'Licença Paternidade',
    'Dispensa como Recompensa',
  ]);
});
