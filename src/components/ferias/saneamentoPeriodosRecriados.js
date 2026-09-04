// =====================================================================
// Saneamento de Períodos Aquisitivos Recriados Indevidamente
// ---------------------------------------------------------------------
// Heurística read-only que identifica períodos recriados pelo gerador
// automático que haviam sido intencionalmente removidos pelo admin.
//
// Critério de suspeito (todos devem ser verdadeiros):
//   - período ativo (não inativo)
//   - status operacional "Disponível"
//   - dias_gozados = 0 e dias_previstos = 0 (sem uso operacional)
//   - nenhuma fração de férias vinculada
//   - NENHUM RegistroLivro / PublicacaoExOfficio vinculado (guard de segurança)
//   - existe um período MAIS NOVO do mesmo militar COM atividade real
//     (dias_gozados > 0 || dias_previstos > 0 || frações > 0)
//
// Esses períodos "pristinos" mais antigos que um período consumido
// são fortes candidatos a recriação indevida pelo gerador.
// =====================================================================

const TIPOS_CADEIA_FERIAS = new Set([
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
]);

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

function contemReferenciaTextual(registro = {}, periodoRef = '') {
  if (!periodoRef) return false;
  return [
    registro?.periodo_aquisitivo,
    registro?.periodo_aquisitivo_ref,
    registro?.ano_referencia,
    registro?.documento_referencia,
    registro?.documento_texto,
    registro?.texto_publicacao,
    registro?.nota_para_bg,
    registro?.observacoes,
    registro?.texto_base,
    registro?.texto_complemento,
  ]
    .map((valor) => normalizarTexto(valor))
    .some((valor) => valor === periodoRef || valor.includes(periodoRef));
}

function registroDoPeriodo(registro, { periodoId, periodoRef, militarId, feriasIds }) {
  const registroMilitarId = normalizarTexto(registro?.militar_id);
  if (registroMilitarId && militarId && registroMilitarId !== militarId) return false;

  const matchFerias = normalizarTexto(registro?.ferias_id) && feriasIds.has(normalizarTexto(registro?.ferias_id));
  const matchId = periodoId && (
    normalizarTexto(registro?.periodo_aquisitivo_id) === periodoId ||
    normalizarTexto(registro?.periodo_id) === periodoId ||
    normalizarTexto(registro?.referencia_id) === periodoId
  );
  const matchRef = contemReferenciaTextual(registro, periodoRef);

  return Boolean(matchFerias || matchId || matchRef);
}

function publicacaoDoPeriodo(publicacao, { periodoId, periodoRef, militarId, feriasIds }) {
  const publicacaoMilitarId = normalizarTexto(publicacao?.militar_id);
  if (publicacaoMilitarId && militarId && publicacaoMilitarId !== militarId) return false;

  const feriasRefs = [
    publicacao?.ferias_id,
    publicacao?.ferias_interrompida_id,
    publicacao?.gozo_ferias_id,
    publicacao?.gozo_id,
  ].map(normalizarTexto).filter(Boolean);

  const matchPeriodo = periodoId && (
    normalizarTexto(publicacao?.periodo_aquisitivo_id) === periodoId ||
    normalizarTexto(publicacao?.periodo_id) === periodoId
  );
  const matchFerias = feriasRefs.some((id) => feriasIds.has(id));
  const matchRef = contemReferenciaTextual(publicacao, periodoRef);

  return Boolean(matchPeriodo || matchFerias || matchRef);
}

function temVinculoAdministrativo(periodo, registrosLivro = [], publicacoes = []) {
  const periodoId = normalizarTexto(periodo?.id);
  const periodoRef = normalizarTexto(periodo?.referencia);
  const militarId = normalizarTexto(periodo?.militar_id);
  const feriasIds = new Set((periodo?.fracoes || []).map((fracao) => normalizarTexto(fracao?.id)).filter(Boolean));

  const temRegistro = (registrosLivro || []).some((registro) =>
    registroDoPeriodo(registro, { periodoId, periodoRef, militarId, feriasIds })
  );
  if (temRegistro) return true;

  const temPublicacao = (publicacoes || []).some((publicacao) =>
    publicacaoDoPeriodo(publicacao, { periodoId, periodoRef, militarId, feriasIds })
  );
  return temPublicacao;
}

function periodoTemAtividadeReal(periodo) {
  if (!periodo) return false;
  if (Number(periodo?.dias_gozados || 0) > 0) return true;
  if (Number(periodo?.dias_previstos || 0) > 0) return true;
  if (periodo?.fracoes?.length > 0) return true;
  const status = normalizarTexto(periodo?.status_operacional);
  if (status === 'Gozado' || status === 'Parcialmente Gozado') return true;
  return false;
}

function periodoEhPristino(periodo) {
  if (!periodo) return false;
  if (periodo?.inativo) return false;
  if (normalizarTexto(periodo?.status_operacional) !== 'Disponível') return false;
  if (Number(periodo?.dias_gozados || 0) > 0) return false;
  if (Number(periodo?.dias_previstos || 0) > 0) return false;
  if (periodo?.fracoes?.length > 0) return false;
  return true;
}

/**
 * Detecta períodos suspeitos de recriação indevida.
 *
 * @param {Object} params
 * @param {Array}  params.gruposMilitares - lista de grupos (do mapper) com .militar e .periodos
 * @param {Array}  [params.registrosLivro=[]]
 * @param {Array}  [params.publicacoesExOfficio=[]]
 * @returns {Array} lista de suspeitos { periodo, militar, motivoDetalhe }
 */
export function detectarPeriodosRecriadosIndevidamente({ gruposMilitares = [], registrosLivro = [], publicacoesExOfficio = [] } = {}) {
  const suspeitos = [];

  for (const grupo of gruposMilitares) {
    const periodos = grupo?.periodos || [];
    if (periodos.length === 0) continue;

    const militar = grupo?.militar || {};
    const existePeriodoComAtividade = periodos.some(periodoTemAtividadeReal);
    if (!existePeriodoComAtividade) continue;

    for (const periodo of periodos) {
      if (!periodoEhPristino(periodo)) continue;

      const dataInicio = normalizarTexto(periodo?.data_inicio_aquisitivo);
      const haNovoComAtividade = periodos.some((outro) => {
        if (outro === periodo) return false;
        const outroData = normalizarTexto(outro?.data_inicio_aquisitivo);
        if (!dataInicio || !outroData) return false;
        if (outroData <= dataInicio) return false;
        return periodoTemAtividadeReal(outro);
      });

      if (!haNovoComAtividade) continue;

      const vinculoAdmin = temVinculoAdministrativo(periodo, registrosLivro, publicacoesExOfficio);
      if (vinculoAdmin) continue;

      suspeitos.push({
        periodo,
        militar,
        motivoDetalhe: 'Período "Disponível" sem férias/Livro/publicações, mais antigo que outro período do mesmo militar com atividade.',
      });
    }
  }

  return suspeitos;
}