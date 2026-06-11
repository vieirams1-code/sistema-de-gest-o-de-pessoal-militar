import {
  analisarPlanilhaMedalha,
  importarMedalhas,
  STATUS_LINHA_MEDALHA,
  normalizarNome,
  normalizarDoems,
  parseDataExcel,
} from './importacaoMedalhaService';

/**
 * Módulo de Migração Fixa da Medalha Dom Pedro II.
 * Refatorado para utilizar o serviço genérico de importação de medalhas.
 */

export { STATUS_LINHA_MEDALHA, normalizarNome, normalizarDoems, parseDataExcel };

export async function analisarPlanilhaDomPedro(file) {
  return analisarPlanilhaMedalha(file, 'DOM_PEDRO_II');
}

export async function importarMedalhasDomPedro(linhas, userEmail) {
  return importarMedalhas(linhas, userEmail);
}
