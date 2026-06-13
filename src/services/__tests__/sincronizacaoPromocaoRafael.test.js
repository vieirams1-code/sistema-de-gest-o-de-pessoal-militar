import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Este teste simula a lógica de sincronização para o caso Rafael Stort Zulli.
 *
 * Cenário:
 * - Militar: Rafael Stort Zulli (ID: rafael-id)
 * - Cadastro atual: Soldado / QBMP-1.a
 * - Última promoção publicada (Histórico V2): Cabo / QBMP-1.a
 * - Objetivo: Verificar se a lógica de sincronização identifica a divergência
 *   e prepara o payload correto de atualização.
 */

// Lógica de normalização extraída da Edge Function
const texto = (valor) => String(valor ?? '').trim();
const normalizar = (valor) => {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[°º]/g, 'o')
    .replace(/[•|/]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const POSTOS_HIERARQUIA = [
  'Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento',
  'Subtenente', 'Aspirante a Oficial', '2º Tenente', '1º Tenente',
  'Capitão', 'Major', 'Tenente-Coronel', 'Coronel',
];
const INDICE_POR_POSTO = new Map(POSTOS_HIERARQUIA.map((posto, indice) => [posto, indice]));

function obterPostoCanonico(v) {
  const t = normalizar(v);
  for (const p of POSTOS_HIERARQUIA) {
    if (normalizar(p) === t) return p;
  }
  return v;
}

test('Sincronização Rafael Stort Zulli - Identifica divergência Soldado -> Cabo', () => {
  const militar = {
    id: 'rafael-id',
    nome_completo: 'Rafael Stort Zulli',
    matricula: '123456',
    posto_graduacao: 'Soldado',
    quadro: 'QBMP-1.a',
    status_cadastro: 'Ativo'
  };

  const historicoCabo = {
    id: 'hist-cabo-id',
    militar_id: 'rafael-id',
    posto_graduacao_novo: 'Cabo',
    quadro_novo: 'QBMP-1.a',
    data_promocao: '2023-01-01',
    status_registro: 'ativo',
    publicado: true
  };

  // Simulação da lógica de decisão na Edge Function
  const postoAtual = normalizar(militar.posto_graduacao);
  const quadroAtual = normalizar(militar.quadro);
  const postoNovo = normalizar(historicoCabo.posto_graduacao_novo);
  const quadroNovo = normalizar(historicoCabo.quadro_novo);

  const divergePosto = postoAtual !== postoNovo;
  const divergeQuadro = quadroAtual !== quadroNovo;

  assert.equal(divergePosto, true, 'Deve divergir no posto (Soldado != Cabo)');
  assert.equal(divergeQuadro, false, 'Não deve divergir no quadro');

  const idxAtual = INDICE_POR_POSTO.get(obterPostoCanonico(militar.posto_graduacao)) ?? -1;
  const idxNovo = INDICE_POR_POSTO.get(obterPostoCanonico(historicoCabo.posto_graduacao_novo)) ?? -1;

  assert.equal(idxAtual, 0, 'Índice de Soldado deve ser 0');
  assert.equal(idxNovo, 1, 'Índice de Cabo deve ser 1');

  // Regra: Não rebaixar (idxNovo >= idxAtual)
  const permitirAtualizacao = idxNovo >= idxAtual || idxNovo === -1 || idxAtual === -1;
  assert.equal(permitirAtualizacao, true, 'Deve permitir atualização pois Cabo > Soldado');

  // Payload esperado para a utility shared
  const payloadUpdate = {
    posto_graduacao: historicoCabo.posto_graduacao_novo,
    quadro: historicoCabo.quadro_novo
  };

  assert.equal(payloadUpdate.posto_graduacao, 'Cabo');
  assert.equal(payloadUpdate.quadro, 'QBMP-1.a');
});

test('Lógica de campos redundantes na utility shared', () => {
    // Simula o que a utility shared faria
    const militarNoBanco = {
        id: 'rafael-id',
        posto_graduacao: 'Soldado',
        quadro: 'QBMP-1.a',
        posto_graduacao_atual: 'Soldado', // campo redundante comum
        quadro_atual: 'QBMP-1.a' // campo redundante comum
    };

    const dadosNovos = {
        posto_graduacao: 'Cabo',
        quadro: 'QBMP-1.a'
    };

    const camposPosto = ['posto_graduacao', 'posto_graduacao_atual', 'posto_grad', 'posto', 'graduacao'];
    const camposQuadro = ['quadro', 'quadro_atual', 'militar_quadro'];

    const payloadResult = {};
    for (const campo of camposPosto) {
        if (campo === 'posto_graduacao' || Object.prototype.hasOwnProperty.call(militarNoBanco, campo)) {
            payloadResult[campo] = dadosNovos.posto_graduacao;
        }
    }
    for (const campo of camposQuadro) {
        if (campo === 'quadro' || Object.prototype.hasOwnProperty.call(militarNoBanco, campo)) {
            payloadResult[campo] = dadosNovos.quadro;
        }
    }

    assert.equal(payloadResult.posto_graduacao, 'Cabo');
    assert.equal(payloadResult.posto_graduacao_atual, 'Cabo', 'Campo redundante deve ser incluído no payload');
    assert.equal(payloadResult.quadro, 'QBMP-1.a');
    assert.equal(payloadResult.quadro_atual, 'QBMP-1.a', 'Campo redundante deve ser incluído no payload');
    assert.equal(payloadResult.posto, undefined, 'Campos inexistentes no registro não devem ser incluídos');
});
