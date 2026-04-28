import {
  carregarMilitaresComMatriculas,
  filtrarMilitaresOperacionais,
  isMilitarMesclado,
  resolverMatriculaAtual,
} from './matriculaMilitarViewService.js';

function pickFirstText(...values) {
  for (const value of values) {
    const parsed = String(value || '').trim();
    if (parsed) return parsed;
  }
  return '';
}

export function montarLabelMilitarFerias(ferias = {}, { contexto = 'operacional' } = {}) {
  const matriculaAtual = pickFirstText(
    ferias.militar_matricula_atual,
    ferias.matricula_atual_operacional,
    ferias.militar_matricula,
  );
  const matriculaRegistro = pickFirstText(
    ferias.militar_matricula_vinculo,
    ferias.militar_matricula,
  );

  if (contexto === 'documental') {
    return pickFirstText(matriculaRegistro, matriculaAtual);
  }

  return pickFirstText(matriculaAtual, matriculaRegistro);
}

export function aplicarContextoMilitarNaFerias(ferias = {}, militar = null, { contexto = 'operacional' } = {}) {
  const mesclado = isMilitarMesclado(militar || {});
  const matriculaAtualDerivada = militar ? resolverMatriculaAtual(militar, militar.matriculas_historico || []) : '';

  const matriculaAtual = pickFirstText(
    matriculaAtualDerivada,
    militar?.matricula_atual,
    ferias?.militar_matricula_atual,
    ferias?.militar_matricula,
  );

  const matriculaRegistro = pickFirstText(
    ferias?.militar_matricula_vinculo,
    ferias?.militar_matricula,
  );

  return {
    ...ferias,
    militar_matricula_atual: matriculaAtual,
    matricula_atual_operacional: matriculaAtual,
    militar_matricula_vinculo: matriculaRegistro,
    militar_matricula_label: montarLabelMilitarFerias({
      ...ferias,
      militar_matricula_atual: matriculaAtual,
      matricula_atual_operacional: matriculaAtual,
      militar_matricula_vinculo: matriculaRegistro,
    }, { contexto }),
    militar_mesclado: mesclado,
  };
}

export function feriasCorrespondeBusca(ferias = {}, termo = '') {
  const query = String(termo || '').trim().toLowerCase();
  if (!query) return true;

  const campos = [
    ferias?.militar_nome,
    ferias?.periodo_aquisitivo_ref,
    ferias?.militar_matricula_label,
    ferias?.militar_matricula_atual,
    ferias?.militar_matricula_vinculo,
    ferias?.militar_matricula,
  ].map((item) => String(item || '').toLowerCase());

  return campos.some((campo) => campo.includes(query));
}

export function montarPayloadRegistroLivroFerias(ferias = {}, basePayload = {}) {
  const matriculaDocumental = pickFirstText(ferias?.militar_matricula_vinculo, ferias?.militar_matricula);

  return {
    ...basePayload,
    militar_id: ferias.militar_id,
    militar_nome: ferias.militar_nome,
    militar_posto: ferias.militar_posto,
    militar_matricula: matriculaDocumental,
    militar_matricula_vinculo: matriculaDocumental,
    militar_matricula_atual: pickFirstText(ferias?.militar_matricula_atual, ferias?.matricula_atual_operacional, ferias?.militar_matricula),
  };
}

export async function enriquecerFeriasComContextoMilitar(ferias = [], { contexto = 'operacional', filtrarMesclados = false } = {}) {
  const militarIds = [...new Set((ferias || []).map((item) => String(item?.militar_id || '')).filter(Boolean))];
  if (!militarIds.length) return [];

  const { base44 } = await import('../api/base44Client.js');
  const resultados = await Promise.allSettled(militarIds.map((id) => base44.entities.Militar.filter({ id })));
  const colecoes = resultados
    .filter((resultado) => resultado.status === 'fulfilled')
    .map((resultado) => resultado.value || []);
  const falhas = resultados.length - colecoes.length;

  if (import.meta.env.DEV && falhas > 0) {
    console.warn('[feriasMilitarContextService] Falha parcial ao carregar militares para enriquecimento de férias.', {
      totalMilitares: militarIds.length,
      falhas,
    });
  }

  if (!colecoes.length) {
    return (ferias || []).map((item) => aplicarContextoMilitarNaFerias(item, null, { contexto }));
  }

  const militares = await carregarMilitaresComMatriculas(colecoes.flat());
  const byId = new Map(militares.map((m) => [String(m.id), m]));

  const operacionais = filtrarMesclados
    ? new Set(filtrarMilitaresOperacionais(militares, { incluirInativos: true }).map((m) => String(m.id)))
    : null;

  return (ferias || [])
    .filter((item) => {
      if (!filtrarMesclados) return true;
      return operacionais.has(String(item?.militar_id || ''));
    })
    .map((item) => aplicarContextoMilitarNaFerias(item, byId.get(String(item?.militar_id || '')) || null, { contexto }));
}
