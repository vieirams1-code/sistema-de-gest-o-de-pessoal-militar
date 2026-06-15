import { normalizarTextoBusca } from './normalizarBuscaMilitar.js';

/**
 * Helper centralizado para definir se o cadastro do militar está ativo.
 * Normaliza campos possíveis e legados para garantir que inativos sejam excluídos
 * do uso operacional padrão.
 *
 * @param {Object} militar Objeto militar contendo campos de status ou ativo.
 * @returns {boolean} True se o cadastro estiver ativo, false se for inativo.
 */

const CAMPOS_STATUS = [
  'status_cadastro',
  'statusCadastro',
  'status_do_cadastro',
  'cadastro_status',
  'status'
];

const VALORES_INATIVOS = new Set(['inativo', 'inativa', 'inactive']);

export function isMilitarAtivo(militar) {
  if (!militar) return false;

  // 1. Prioridade para campo booleano explícito (ativo: false)
  if (militar.ativo === false) return false;

  // 2. Verificar campos de status conhecidos (atuais e legados)
  // Normaliza acentos, espaços e capitalização.
  for (const campo of CAMPOS_STATUS) {
    const valor = militar[campo];
    if (valor !== undefined && valor !== null && valor !== '') {
      const valorNormalizado = normalizarTextoBusca(valor);
      if (VALORES_INATIVOS.has(valorNormalizado)) return false;
    }
  }

  // 3. Se houver o campo 'ativo' como true, garante que é ativo (se não houver status contrário)
  if (militar.ativo === true) return true;

  // Caso padrão: se não houver nenhuma indicação de inatividade, o cadastro é Ativo.
  return true;
}
