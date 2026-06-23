import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// =====================================================================
// criarDescontoFeriasGateway — Fase 1 (Fundação e Gateway)
// ---------------------------------------------------------------------
// Gateway ÚNICO de criação de Desconto em Férias.
// Cria, de forma atômica do ponto de vista do frontend:
//   1) uma PublicacaoExOfficio do tipo interno "Dispensa com Desconto em Férias";
//   2) um registro DescontoFerias vinculado (publicacao_id).
//
// Regras desta fase:
//   - DescontoFerias nasce SEMPRE como status=pendente_publicacao, saldo_aplicado=false;
//   - NÃO altera saldo do PeriodoAquisitivo (mesmo que a publicação já nasça Publicado);
//   - status da publicação segue a regra padrão do RP (sem nota / com nota / com BG);
//   - idempotência: não cria DescontoFerias duplicado para a mesma publicacao_id;
//   - somente admin (role admin OU UsuarioAcesso tipo_acesso=admin).
// =====================================================================

const TIPO_INTERNO = 'Dispensa com Desconto em Férias';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

function calcStatusPublicacao({ numero_bg, data_bg, nota_para_bg }) {
  if (numero_bg || data_bg) return 'Publicado';
  if (nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function calcDataFim(dataInicio, dias) {
  const base = new Date(`${String(dataInicio).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(dias) - 1));
  return base.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_e) { payload = {}; }

    // ---- Autorização: somente admin ----
    const isAdminByRole = String(authUser.role || '').toLowerCase() === 'admin';
    let isAdminByAccess = false;
    try {
      const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter(
        { user_email: normalizeEmail(authUser.email), ativo: true }, undefined, 100, 0, ['tipo_acesso'],
      );
      isAdminByAccess = (acessos || []).some((a) => String(a?.tipo_acesso || '').trim().toLowerCase() === 'admin');
    } catch (_e) { isAdminByAccess = false; }

    if (!isAdminByRole && !isAdminByAccess) {
      return Response.json({ error: 'Acesso negado: somente administradores.' }, { status: 403 });
    }

    // ---- Validação de entrada ----
    const militarId = String(payload?.militar_id || '').trim();
    const periodoAquisitivoId = String(payload?.periodo_aquisitivo_id || '').trim();
    const dias = Number(payload?.dias);
    const dataInicio = String(payload?.data_inicio || '').slice(0, 10);
    const observacoes = String(payload?.observacoes || '');
    const notaParaBg = String(payload?.nota_para_bg || '');
    const numeroBg = String(payload?.numero_bg || '');
    const dataBg = String(payload?.data_bg || '').slice(0, 10);
    const textoPublicacao = String(payload?.texto_publicacao || '');

    const erros = [];
    if (!militarId) erros.push('militar_id é obrigatório.');
    if (!periodoAquisitivoId) erros.push('periodo_aquisitivo_id é obrigatório.');
    if (!Number.isFinite(dias) || dias <= 0) erros.push('dias deve ser maior que 0.');
    if (!dataInicio) erros.push('data_inicio é obrigatória.');
    if (erros.length) return Response.json({ error: erros.join(' ') }, { status: 400 });

    // ---- Carregar entidades de referência ----
    const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodoAquisitivoId).catch(() => null);
    if (!periodo) return Response.json({ error: 'Período aquisitivo não encontrado.' }, { status: 404 });
    if (String(periodo.militar_id) !== militarId) {
      return Response.json({ error: 'Período aquisitivo não pertence ao militar informado.' }, { status: 400 });
    }

    const militar = await base44.asServiceRole.entities.Militar.get(militarId).catch(() => null);
    if (!militar) return Response.json({ error: 'Militar não encontrado.' }, { status: 404 });

    // ---- Limite acumulado de 8 dias por período (ativos + pendentes) ----
    const existentes = await base44.asServiceRole.entities.DescontoFerias
      .filter({ periodo_aquisitivo_id: periodoAquisitivoId }).catch(() => []);
    const diasAcumulados = (existentes || [])
      .filter((d) => ['ativo', 'pendente_publicacao'].includes(String(d?.status || '')))
      .reduce((acc, d) => acc + Math.max(0, Number(d?.dias) || 0), 0);
    if (diasAcumulados + dias > 8) {
      return Response.json({
        error: `Limite de 8 dias por período aquisitivo excedido. Já acumulados: ${diasAcumulados}d, solicitados: ${dias}d.`,
      }, { status: 400 });
    }

    const dataFim = calcDataFim(dataInicio, dias);

    // ---- 1) Criar PublicacaoExOfficio ----
    const statusPublicacao = calcStatusPublicacao({ numero_bg: numeroBg, data_bg: dataBg, nota_para_bg: notaParaBg });
    const publicacao = await base44.asServiceRole.entities.PublicacaoExOfficio.create({
      militar_id: militarId,
      militar_nome: militar.nome_completo || '',
      militar_posto: militar.posto_graduacao || '',
      militar_matricula: militar.matricula || '',
      tipo: TIPO_INTERNO,
      data_publicacao: dataBg || dataInicio,
      texto_publicacao: textoPublicacao,
      nota_para_bg: notaParaBg,
      numero_bg: numeroBg,
      data_bg: dataBg,
      status: statusPublicacao,
      observacoes,
    });

    // ---- 2) Criar DescontoFerias vinculado (idempotente por publicacao_id) ----
    const jaExiste = await base44.asServiceRole.entities.DescontoFerias
      .filter({ publicacao_id: publicacao.id }).catch(() => []);
    if (jaExiste && jaExiste.length > 0) {
      return Response.json({ ok: true, publicacao, descontoFerias: jaExiste[0], idempotente: true });
    }

    const descontoFerias = await base44.asServiceRole.entities.DescontoFerias.create({
      militar_id: militarId,
      militar_nome: militar.nome_completo || '',
      militar_posto: militar.posto_graduacao || '',
      militar_matricula: militar.matricula || '',
      periodo_aquisitivo_id: periodoAquisitivoId,
      periodo_aquisitivo_ref: periodo.ano_referencia || '',
      publicacao_id: publicacao.id,
      dias,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status: 'pendente_publicacao',
      saldo_aplicado: false,
      observacoes,
      criado_por_email: authUser.email,
      criado_em: new Date().toISOString(),
    });

    return Response.json({ ok: true, publicacao, descontoFerias });
  } catch (error) {
    const status = error?.response?.status || error?.status || 500;
    console.error('[criarDescontoFeriasGateway] erro', { message: error?.message, status });
    return Response.json({ error: error?.message || 'Erro ao criar desconto em férias.' }, { status });
  }
});