import { formatarMatriculaPadrao, normalizarMatricula } from './militarIdentidadeService.js';

const STATUS_MESCLADO = 'mesclado';

function normalizarData(data = '') {
  if (!data) return '';
  return String(data).slice(0, 10);
}

export function isMilitarMesclado(militar = {}) {
  const status = String(militar?.status_cadastro || militar?.situacao_militar || '').trim().toLowerCase();
  return status === STATUS_MESCLADO || Boolean(militar?.merged_into_id);
}

export function montarIndiceMatriculas(matriculas = []) {
  const byMilitar = new Map();

  for (const mat of matriculas || []) {
    const militarId = String(mat?.militar_id || '');
    if (!militarId) continue;
    if (!byMilitar.has(militarId)) byMilitar.set(militarId, []);

    byMilitar.get(militarId).push({
      ...mat,
      matricula_formatada: formatarMatriculaPadrao(mat?.matricula || mat?.matricula_normalizada || ''),
      matricula_normalizada: normalizarMatricula(mat?.matricula_normalizada || mat?.matricula),
      data_inicio: normalizarData(mat?.data_inicio),
      data_fim: normalizarData(mat?.data_fim),
      is_atual: Boolean(mat?.is_atual),
    });
  }

  return byMilitar;
}

export function resolverMatriculaAtual(militar = {}, historico = []) {
  const atual = historico.find((m) => m.is_atual)
    || historico.find((m) => String(m?.situacao || '').toLowerCase() === 'ativa')
    || historico[0]
    || null;

  if (atual?.matricula_formatada) return atual.matricula_formatada;
  return formatarMatriculaPadrao(militar?.matricula || '');
}

export function enriquecerMilitarComMatriculas(militar = {}, indiceMatriculas = new Map()) {
  const historico = [...(indiceMatriculas.get(String(militar?.id || '')) || [])]
    .sort((a, b) => {
      if (a.is_atual && !b.is_atual) return -1;
      if (!a.is_atual && b.is_atual) return 1;
      return String(b.data_inicio || '').localeCompare(String(a.data_inicio || ''));
    });

  const matriculaAtual = resolverMatriculaAtual(militar, historico);

  return {
    ...militar,
    matricula: matriculaAtual,
    matricula_atual: matriculaAtual,
    matriculas_historico: historico,
    is_mesclado: isMilitarMesclado(militar),
  };
}

export async function carregarMilitaresComMatriculas(militares = []) {
  const { base44 } = await import('../api/base44Client.js');
  const militarIds = [...new Set((militares || []).map((m) => String(m?.id || '')).filter(Boolean))];
  if (militarIds.length === 0) return [];

  let matriculas = [];

  try {
    matriculas = await base44.entities.MatriculaMilitar.filter({
      militar_id: { in: militarIds },
    }, '-created_date');
  } catch (_error) {
    const lotes = [];
    const tamanhoLote = 20;
    for (let i = 0; i < militarIds.length; i += tamanhoLote) {
      lotes.push(militarIds.slice(i, i + tamanhoLote));
    }

    for (const loteIds of lotes) {
      for (const militarId of loteIds) {
        const lista = await base44.entities.MatriculaMilitar.filter({ militar_id: militarId }, '-created_date');
        matriculas.push(...lista);
      }
    }
  }

  const indice = montarIndiceMatriculas(matriculas);
  return (militares || []).map((m) => enriquecerMilitarComMatriculas(m, indice));
}

export function filtrarMilitaresOperacionais(militares = [], { incluirInativos = false } = {}) {
  return (militares || []).filter((m) => {
    if (isMilitarMesclado(m)) return false;
    if (!incluirInativos && String(m?.status_cadastro || '').toLowerCase() === 'inativo') return false;
    return true;
  });
}

export function militarCorrespondeBusca(militar = {}, termo = '') {
  const query = String(termo || '').trim().toLowerCase();
  if (!query) return true;

  const camposTexto = [
    militar?.nome_completo,
    militar?.nome_guerra,
    militar?.matricula_atual,
    militar?.matricula,
    militar?.cpf,
    militar?.rg,
  ].map((v) => String(v || '').toLowerCase());

  if (camposTexto.some((campo) => campo.includes(query))) return true;

  const queryNorm = normalizarMatricula(query);
  if (!queryNorm) return false;

  return (militar?.matriculas_historico || []).some((mat) => {
    const matNorm = normalizarMatricula(mat?.matricula_normalizada || mat?.matricula);
    return matNorm.includes(queryNorm);
  });
}
