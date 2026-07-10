import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TIPOS_VALIDOS = new Set(['credito', 'debito']);
const STATUS_IMPACTO_FERIAS = new Set(['Gozada', 'Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);
// Status de férias que representam compromisso válido do período e, portanto,
// bloqueiam o lançamento de débito (mesma base do STATUS_IMPACTO_FERIAS).
// Cancelada é o único status de anulação existente na entidade Ferias.
const STATUS_FERIAS_BLOQUEIA_DEBITO = STATUS_IMPACTO_FERIAS;
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const normalize = (v) => String(v ?? '').trim();

async function assertAdminFerias(base44, authUser) {
  if (String(authUser?.role || '').toLowerCase() === 'admin') return;
  const acessos = await base44.asServiceRole.entities.UsuarioAcesso
    .filter({ user_email: normalizeEmail(authUser?.email), ativo: true }, undefined, 100, 0)
    .catch(() => []);
  if ((acessos || []).some((a) => String(a?.tipo_acesso || '').trim().toLowerCase() === 'admin')) return;
  throw Object.assign(new Error('Acesso negado: operação restrita a administradores do módulo Férias.'), { status: 403 });
}

function diasBase(periodo = {}) {
  for (const campo of ['dias_direito', 'dias_adquiridos', 'dias_base']) {
    const n = Number(periodo?.[campo]);
    if (Number.isFinite(n)) return n;
  }
  return 30;
}

// Vínculo oficial férias → período: prioriza periodo_aquisitivo_id e só usa o
// fallback textual legado quando o id não está presente no registro de férias.
function vinculadaAoPeriodo(item = {}, periodo = {}) {
  if (item?.periodo_aquisitivo_id) return String(item.periodo_aquisitivo_id) === String(periodo.id || '');
  const refFerias = normalize(item?.periodo_aquisitivo_ref);
  const refPeriodo = normalize(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
  return Boolean(refFerias && refPeriodo && refFerias === refPeriodo);
}

function feriasImpactaPeriodo(item = {}, periodo = {}) {
  if (!STATUS_IMPACTO_FERIAS.has(normalize(item?.status))) return false;
  return vinculadaAoPeriodo(item, periodo);
}

function totaisPeriodo(periodo, ajustes = [], ferias = []) {
  const ativos = (ajustes || []).filter((a) => normalize(a?.status).toLowerCase() === 'ativo');
  const creditos = ativos.filter((a) => normalize(a?.tipo).toLowerCase() === 'credito').reduce((acc, a) => acc + Math.max(0, Number(a?.dias) || 0), 0);
  const debitos = ativos.filter((a) => normalize(a?.tipo).toLowerCase() === 'debito').reduce((acc, a) => acc + Math.max(0, Number(a?.dias) || 0), 0);
  const gozadosPrevistos = (ferias || []).filter((f) => feriasImpactaPeriodo(f, periodo)).reduce((acc, f) => acc + Math.max(0, Number(f?.dias) || 0), 0);
  const direitoLiquido = diasBase(periodo) + creditos - debitos;

  return { creditos, debitos, gozadosPrevistos, direitoLiquido, saldoRestante: direitoLiquido - gozadosPrevistos };
}

function nomeMilitar(militar = {}) {
  return [militar?.posto_graduacao, militar?.nome_guerra || militar?.nome_completo || militar?.nome]
    .map(normalize).filter(Boolean).join(' ') || normalize(militar?.nome_completo);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    await assertAdminFerias(base44, authUser);

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    const militarId = normalize(payload?.militar_id);
    const periodoId = normalize(payload?.periodo_aquisitivo_id);
    const tipo = normalize(payload?.tipo).toLowerCase();
    const dias = Number(payload?.dias);
    const motivo = normalize(payload?.motivo);
    const observacoes = normalize(payload?.observacoes);
    const effectiveEmail = normalizeEmail(payload?.effectiveEmail || authUser.email);

    const erros = [];
    if (!militarId) erros.push('militar_id é obrigatório.');
    if (!periodoId) erros.push('periodo_aquisitivo_id é obrigatório.');
    if (!TIPOS_VALIDOS.has(tipo)) erros.push('tipo deve ser credito ou debito.');
    if (!Number.isFinite(dias) || dias <= 0) erros.push('dias deve ser maior que 0.');
    if (!motivo) erros.push('motivo é obrigatório.');
    if (erros.length) return Response.json({ error: erros.join(' ') }, { status: 400 });

    const militar = await base44.asServiceRole.entities.Militar.get(militarId).catch(() => null);
    if (!militar) return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });

    const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodoId).catch(() => null);
    if (!periodo) return Response.json({ error: 'Período aquisitivo não encontrado.' }, { status: 404 });
    if (String(periodo?.militar_id || '') !== militarId) {
      return Response.json({ error: 'Período aquisitivo não pertence ao militar informado.' }, { status: 400 });
    }

    const ajustes = await base44.asServiceRole.entities.AjusteSaldoFerias.filter({ periodo_aquisitivo_id: periodoId }).catch(() => []);
    const ferias = await base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }).catch(() => []);
    const warnings = [];
    if (tipo === 'debito') {
      // Bloqueio: não permitir débito quando o período já tem férias válidas cadastradas.
      // Usa o mesmo vínculo oficial (periodo_aquisitivo_id + fallback textual) do motor.
      const feriasBloqueadoras = (ferias || []).filter((f) => (
        STATUS_FERIAS_BLOQUEIA_DEBITO.has(normalize(f?.status)) && vinculadaAoPeriodo(f, periodo)
      ));
      if (feriasBloqueadoras.length > 0) {
        const qtd = feriasBloqueadoras.length;
        const plural = qtd === 1 ? 'férias cadastrada' : `${qtd} frações de férias cadastradas`;
        return Response.json({
          error: `Este período possui ${plural}. Remova ou cancele as férias existentes, registre o débito e depois cadastre novamente as férias com o saldo atualizado.`,
          code: 'PERIODO_COM_FERIAS_CADASTRADAS',
          ferias_encontradas: qtd,
        }, { status: 400 });
      }
      const totaisProjetados = totaisPeriodo(periodo, [...(ajustes || []), { tipo, dias, status: 'ativo' }], ferias || []);
      if (totaisProjetados.direitoLiquido < 0) return Response.json({ error: 'Débito não permitido: deixaria o direito líquido negativo.' }, { status: 400 });
      if (totaisProjetados.direitoLiquido < totaisProjetados.gozadosPrevistos) {
        warnings.push({
          code: 'DIREITO_LIQUIDO_INFERIOR_FERIAS_PREVISTAS_GOZADAS',
          message: 'Ajuste criado, mas o direito líquido final ficou abaixo das férias previstas/gozadas do período.',
          direito_liquido_final: totaisProjetados.direitoLiquido,
          ferias_previstas_gozadas: totaisProjetados.gozadosPrevistos,
          saldo_restante_final: totaisProjetados.saldoRestante,
        });
      }
    }

    const ajusteSaldoFerias = await base44.asServiceRole.entities.AjusteSaldoFerias.create({
      militar_id: militarId,
      militar_nome: nomeMilitar(militar),
      periodo_aquisitivo_id: periodoId,
      periodo_aquisitivo_ref: normalize(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref || periodoId),
      tipo,
      dias,
      motivo,
      origem: 'manual',
      status: 'ativo',
      observacoes,
      criado_por_email: effectiveEmail,
      created_by: effectiveEmail,
    });

    return Response.json({ ok: true, ajusteSaldoFerias, warnings });
  } catch (error) {
    const status = error?.status || error?.response?.status || 500;
    console.error('[criarAjusteSaldoFerias] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao criar ajuste de saldo de férias.' }, { status });
  }
});