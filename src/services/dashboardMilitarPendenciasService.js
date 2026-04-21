import { filtrarMilitaresOperacionais, isMilitarMesclado } from './matriculaMilitarViewService.js';
import { listarInconsistenciasCadastraisMilitar } from '../utils/inconsistenciasCadastrais.js';

const STATUS_CADASTRO_INVALIDOS = new Set(['inativo', 'mesclado', 'excluido', 'excluído']);

function normalizarId(valor) {
  return String(valor || '').trim();
}

function militarOperacionalmenteValido(militar = {}) {
  if (!militar || typeof militar !== 'object') return false;
  if (!normalizarId(militar.id)) return false;
  if (isMilitarMesclado(militar)) return false;

  const statusCadastro = String(militar?.status_cadastro || militar?.situacao_militar || '').trim().toLowerCase();
  if (STATUS_CADASTRO_INVALIDOS.has(statusCadastro)) return false;

  if (militar?.deleted_at || militar?.data_exclusao || militar?.excluido_em) return false;

  return true;
}

export function montarIndiceMilitaresOperacionais(militares = []) {
  const operacionais = filtrarMilitaresOperacionais(militares, { incluirInativos: false })
    .filter(militarOperacionalmenteValido);
  const indice = new Map();

  for (const militar of operacionais) {
    const id = normalizarId(militar?.id);
    if (!id) continue;
    indice.set(id, militar);
  }

  return indice;
}

export function filtrarPendenciasComportamentoDashboard(pendencias = [], militares = []) {
  const militaresIndex = montarIndiceMilitaresOperacionais(militares);

  return (pendencias || []).filter((pendencia) => {
    if (String(pendencia?.status_pendencia || '').trim() !== 'Pendente') return false;

    const militarId = normalizarId(pendencia?.militar_id);
    if (!militarId) return false;

    return militaresIndex.has(militarId);
  });
}

export function listarInconsistenciasCadastraisDashboard(militares = []) {
  const militaresIndex = montarIndiceMilitaresOperacionais(militares);

  return Array.from(militaresIndex.values()).flatMap((militar) => (
    listarInconsistenciasCadastraisMilitar(militar).map((inconsistencia) => ({
      militarId: militar.id,
      militarNome: militar.nome_completo || 'Militar sem nome',
      ...inconsistencia,
    }))
  ));
}
