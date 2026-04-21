import { filtrarMilitaresOperacionais } from './matriculaMilitarViewService.js';
import { listarInconsistenciasCadastraisMilitar } from '../utils/inconsistenciasCadastrais.js';

function normalizarId(valor) {
  return String(valor || '').trim();
}

export function montarIndiceMilitaresOperacionais(militares = []) {
  const operacionais = filtrarMilitaresOperacionais(militares, { incluirInativos: false });
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
