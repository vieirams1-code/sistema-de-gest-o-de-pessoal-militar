import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { isPeriodoDisponivelOperacional } from '../../../services/periodosAquisitivosOperacionais.js';

const read = (path) => readFile(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('helper considera indisponíveis períodos arquivados/cancelados/inativos', () => {
  const periodosNaoOperacionais = [
    { legado_ativa: true },
    { excluido_da_cadeia_designacao: true },
    { cancelado_transicao: true },
    { inativo: true },
    { status: 'Inativo' },
  ];

  for (const periodo of periodosNaoOperacionais) {
    assert.equal(isPeriodoDisponivelOperacional(periodo), false, JSON.stringify(periodo));
  }

  assert.equal(isPeriodoDisponivelOperacional({ status: 'Disponível' }), true);
});

test('generator centraliza a janela e a duplicidade no helper de geração automática', async () => {
  const conteudo = await read('components/ferias/PeriodoAquisitivoGenerator.jsx');

  assert.match(
    conteudo,
    /calcularPeriodosAquisitivosParaGeracao/,
  );
  assert.match(
    conteudo,
    /periodoAquisitivoJaExiste/,
  );
  assert.doesNotMatch(
    conteudo,
    /PERIODOS_FUTUROS|ANOS_RETROSPECTIVOS/,
  );
});
