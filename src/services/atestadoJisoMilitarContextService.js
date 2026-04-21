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

export function montarLabelMilitarAtestado(atestado = {}, { contexto = 'operacional' } = {}) {
  const matriculaAtual = pickFirstText(atestado.militar_matricula_atual, atestado.matricula_atual_operacional, atestado.militar_matricula);
  const matriculaRegistro = pickFirstText(atestado.militar_matricula_vinculo, atestado.militar_matricula);

  if (contexto === 'documental') {
    return pickFirstText(matriculaRegistro, matriculaAtual);
  }

  return pickFirstText(matriculaAtual, matriculaRegistro);
}

export function aplicarContextoMilitarNoAtestado(atestado = {}, militar = null, { contexto = 'operacional' } = {}) {
  const mesclado = isMilitarMesclado(militar || {});
  const matriculaAtualDerivada = militar ? resolverMatriculaAtual(militar, militar.matriculas_historico || []) : '';
  const matriculaAtual = pickFirstText(
    matriculaAtualDerivada,
    militar?.matricula_atual,
    atestado?.militar_matricula_atual,
    atestado?.militar_matricula,
  );

  const matriculaRegistro = pickFirstText(
    atestado?.militar_matricula_vinculo,
    atestado?.militar_matricula,
  );

  const enriquecido = {
    ...atestado,
    militar_matricula_atual: matriculaAtual,
    militar_matricula_vinculo: matriculaRegistro,
    militar_matricula: contexto === 'documental' ? pickFirstText(matriculaRegistro, matriculaAtual) : pickFirstText(matriculaAtual, matriculaRegistro),
    matricula_atual_operacional: matriculaAtual,
    militar_mesclado: mesclado,
  };

  enriquecido.militar_matricula_label = montarLabelMilitarAtestado(enriquecido, { contexto });

  return enriquecido;
}

export async function enriquecerAtestadosComContextoMilitar(atestados = [], { contexto = 'operacional', filtrarMesclados = false } = {}) {
  const militarIds = [...new Set((atestados || []).map((item) => String(item?.militar_id || '')).filter(Boolean))];
  if (!militarIds.length) return [];

  const { base44 } = await import('../api/base44Client.js');
  const colecoes = await Promise.all(militarIds.map((id) => base44.entities.Militar.filter({ id })));
  const militares = await carregarMilitaresComMatriculas(colecoes.flat());
  const byId = new Map(militares.map((m) => [String(m.id), m]));
  const operacionais = filtrarMesclados ? new Set(filtrarMilitaresOperacionais(militares, { incluirInativos: true }).map((m) => String(m.id))) : null;

  return (atestados || [])
    .filter((atestado) => {
      if (!filtrarMesclados) return true;
      const militarId = String(atestado?.militar_id || '');
      return operacionais.has(militarId);
    })
    .map((atestado) => aplicarContextoMilitarNoAtestado(atestado, byId.get(String(atestado?.militar_id || '')) || null, { contexto }));
}
