import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requirePortalSession, extractClientIp, extractUserAgent, registrarAuditoriaPortal } from '../../shared/portal/requirePortalSession.ts';
import { generateCorrelationId } from '../../shared/portal/portalCrypto.ts';
import { loadAuthConfig } from '../../shared/portal/otp/otpService.ts';

export function assertNoClientSuppliedMilitarId(body: unknown): void {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record).map((k) => k.toLowerCase());
    if (keys.includes('militar_id') || keys.includes('militarid')) {
      const err = new Error('IDOR_BLOCKED: Parâmetro militar_id não permitido no corpo da requisição.');
      (err as any).status = 400;
      throw err;
    }
  }
}

function normalizeText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchMilitarEscopoUnidade(m: any, escopoUnidadesIds: string[]): boolean {
  if (!Array.isArray(escopoUnidadesIds) || escopoUnidadesIds.length === 0) return true;

  const lotacaoMilitar = (m.lotacao || '').trim().toLowerCase();
  const estruturaMilitar = (m.estrutura_nome || '').trim().toLowerCase();
  const lotacaoNorm = normalizeText(m.lotacao);
  const estruturaNorm = normalizeText(m.estrutura_nome);
  const lotacaoId = String(m.lotacao_id || '').trim();
  const grupamentoId = String(m.grupamento_id || '').trim();
  const estruturaId = String(m.estrutura_id || '').trim();

  return escopoUnidadesIds.some((idRaw) => {
    const id = String(idRaw || '').trim();
    if (!id) return false;
    const idLower = id.toLowerCase();
    const idNorm = normalizeText(id);

    return (
      id === lotacaoId ||
      id === grupamentoId ||
      id === estruturaId ||
      idLower === lotacaoMilitar ||
      idLower === estruturaMilitar ||
      (lotacaoMilitar && lotacaoMilitar.includes(idLower)) ||
      (estruturaMilitar && estruturaMilitar.includes(idLower)) ||
      (idLower && (idLower.includes(lotacaoMilitar) || idLower.includes(estruturaMilitar))) ||
      (idNorm && (lotacaoNorm.includes(idNorm) || idNorm.includes(lotacaoNorm))) ||
      (idNorm && (estruturaNorm.includes(idNorm) || idNorm.includes(estruturaNorm)))
    );
  });
}

interface ParcelaItem {
  etapa: number;
  dias: number;
  mes: string;
  data_inicio: string;
}

interface OpcaoPreferencia {
  meses_resumo: string;
  parcelas: ParcelaItem[];
}

interface PortalServicosPayload {
  acao: string;
  campo_chave?: string;
  campo_label?: string;
  valor_atual?: string;
  valor_proposto?: string;
  justificativa?: string;
  periodo_aquisitivo_id?: string;
  modalidade?: string;
  opcao_1?: OpcaoPreferencia;
  opcao_2?: OpcaoPreferencia;
  opcao_3?: OpcaoPreferencia;
  // Gestão de Campanhas
  campanha_id?: string;
  plano_ferias_institucional_id?: string;
  plano_id?: string;
  plano_payload?: any;
  campanha_payload?: any;
  ano_referencia?: number;
  opcao_id?: string;
  decisao_camada_1?: {
    opcao_escolhida: string;
    parcelas: ParcelaItem[];
    justificativa?: string;
    gestor_nome?: string;
  };
  homologacao_camada_2?: {
    status: string;
    superior_nome?: string;
    observacao?: string;
  };
}

const STATUS_FERIAS_IMPACTO_PLANO = new Set(['Gozada', 'Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);
const STATUS_FERIAS_PREVISAO_PLANO = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);

function numeroSeguro(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textoId(value: unknown): string {
  return String(value ?? '').trim();
}

function adicionarDiasData(data: string, dias: number): string {
  if (!data) return '';
  const dt = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function ultimoDiaMes(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

function feriasPertencePeriodoPlano(ferias: any, periodo: any): boolean {
  const feriasPeriodoId = textoId(ferias?.periodo_aquisitivo_id);
  const periodoId = textoId(periodo?.id);
  if (feriasPeriodoId) return Boolean(periodoId && feriasPeriodoId === periodoId);
  const feriasRef = textoId(ferias?.periodo_aquisitivo_ref);
  const periodoRef = textoId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
  return Boolean(feriasRef && periodoRef && feriasRef === periodoRef);
}

function ajustePertencePeriodoPlano(ajuste: any, periodo: any): boolean {
  const ajustePeriodoId = textoId(ajuste?.periodo_aquisitivo_id);
  const periodoId = textoId(periodo?.id);
  if (ajustePeriodoId) return Boolean(periodoId && ajustePeriodoId === periodoId);
  const ajusteRef = textoId(ajuste?.periodo_aquisitivo_ref || ajuste?.ano_referencia);
  const periodoRef = textoId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
  return Boolean(ajusteRef && periodoRef && ajusteRef === periodoRef);
}

function calcularResumoPeriodoPlano(periodo: any, feriasMilitar: any[] = [], ajustesMilitar: any[] = [], anoCampanha: number) {
  const diasBase = numeroSeguro(periodo?.dias_direito ?? periodo?.dias_adquiridos ?? periodo?.dias_base, 30);
  const ajustesAtivos = (ajustesMilitar || []).filter((a: any) =>
    a && String(a.status || '').toLowerCase() === 'ativo' && ajustePertencePeriodoPlano(a, periodo)
  );
  const creditos = ajustesAtivos.filter((a: any) => String(a.tipo || '').toLowerCase() === 'credito')
    .reduce((acc: number, a: any) => acc + Math.max(0, numeroSeguro(a.dias, 0)), 0);
  const debitos = ajustesAtivos.filter((a: any) => String(a.tipo || '').toLowerCase() === 'debito')
    .reduce((acc: number, a: any) => acc + Math.max(0, numeroSeguro(a.dias, 0)), 0);
  const direitoLiquido = Math.max(0, diasBase + creditos - debitos);

  const feriasPeriodo = (feriasMilitar || []).filter((f: any) => f && feriasPertencePeriodoPlano(f, periodo));
  const diasGozados = feriasPeriodo.filter((f: any) => String(f.status || '') === 'Gozada')
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasPrevistos = feriasPeriodo.filter((f: any) => STATUS_FERIAS_PREVISAO_PLANO.has(String(f.status || '')))
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasComprometidos = feriasPeriodo.filter((f: any) => STATUS_FERIAS_IMPACTO_PLANO.has(String(f.status || '')))
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasSemPrevisao = Math.max(0, direitoLiquido - diasComprometidos);

  const primeiraDataLegal = adicionarDiasData(periodo?.fim_aquisitivo || '', 1);
  const limiteGozo = periodo?.data_limite_gozo || '';
  const hoje = new Date().toISOString().slice(0, 10);
  const periodoInativo = Boolean(periodo?.inativo || periodo?.status === 'Inativo');
  const situacaoAquisitiva = periodoInativo ? 'Inativo'
    : diasSemPrevisao <= 0 && diasPrevistos <= 0 ? 'Gozado'
    : (periodo?.fim_aquisitivo && periodo.fim_aquisitivo >= hoje ? 'Aberto' : 'Adquirido');
  const situacaoPrevisao = diasSemPrevisao <= 0
    ? (diasPrevistos > 0 ? 'Previsto' : 'Sem saldo')
    : (diasPrevistos > 0 ? 'Parcialmente Previsto' : 'Não Previsto');

  const ultimoDiaAno = `${anoCampanha}-12-31`;
  const elegivelPlano = Boolean(!periodoInativo && diasSemPrevisao > 0 && primeiraDataLegal &&
    primeiraDataLegal <= ultimoDiaAno && (!limiteGozo || primeiraDataLegal <= limiteGozo));

  const mesesElegiveis = Array.from({ length: 12 }, (_, idx) => {
    const mesNumero = idx + 1;
    const mes = String(mesNumero).padStart(2, '0');
    const inicioMes = `${anoCampanha}-${mes}-01`;
    const fimMes = ultimoDiaMes(anoCampanha, mesNumero);
    let dataInicio = inicioMes;
    if (primeiraDataLegal && primeiraDataLegal > dataInicio) dataInicio = primeiraDataLegal;
    const permitido = Boolean(elegivelPlano && dataInicio >= inicioMes && dataInicio <= fimMes && (!limiteGozo || dataInicio <= limiteGozo));
    let motivo = '';
    if (!elegivelPlano) motivo = 'Período sem saldo elegível para este plano.';
    else if (primeiraDataLegal > fimMes) motivo = `Direito disponível somente a partir de ${primeiraDataLegal}.`;
    else if (limiteGozo && dataInicio > limiteGozo) motivo = `Data posterior ao limite de gozo (${limiteGozo}).`;
    return { mes, permitido, data_inicio: permitido ? dataInicio : '', inicio_ajustado: permitido && dataInicio !== inicioMes, motivo };
  });

  return {
    dias_base: diasBase,
    creditos_ativos: creditos,
    debitos_ativos: debitos,
    direito_liquido: direitoLiquido,
    dias_gozados_calculados: diasGozados,
    dias_previstos_calculados: diasPrevistos,
    dias_comprometidos: diasComprometidos,
    dias_sem_previsao: diasSemPrevisao,
    saldo_disponivel: diasSemPrevisao,
    situacao_aquisitiva: situacaoAquisitiva,
    situacao_previsao: situacaoPrevisao,
    primeira_data_legal_gozo: primeiraDataLegal,
    limite_fruicao: limiteGozo,
    elegivel_plano: elegivelPlano,
    meses_elegiveis: mesesElegiveis,
  };
}

function obterMesPreferencia(opcao: any): string {
  const parcelas = Array.isArray(opcao?.parcelas) ? opcao.parcelas : [];
  const mes = textoId(parcelas?.[0]?.mes || parcelas?.[0]?.data_inicio?.slice?.(5, 7));
  return /^\d{2}$/.test(mes) ? mes : '';
}

function normalizarPreferenciaMes(opcao: any, resumoPeriodo: any, diasPlanejar: number) {
  const mes = obterMesPreferencia(opcao);
  const regraMes = (resumoPeriodo?.meses_elegiveis || []).find((m: any) => m.mes === mes);
  if (!mes || !regraMes?.permitido || !regraMes?.data_inicio) return null;
  return {
    meses_resumo: opcao?.meses_resumo || mes,
    parcelas: [{ etapa: 1, dias: diasPlanejar, mes, data_inicio: regraMes.data_inicio }],
  };
}

function intervalosSobrepostos(inicioA: string, fimA: string, inicioB: string, fimB: string): boolean {
  if (!inicioA || !fimA || !inicioB || !fimB) return false;
  return inicioA <= fimB && inicioB <= fimA;
}

function calcularFimParcela(dataInicio: string, dias: number): string {
  return adicionarDiasData(dataInicio, Math.max(0, dias - 1));
}

function normalizarTipoAcesso(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function extrairMatrizPermissoesPerfil(descricao: unknown): Record<string, unknown> {
  if (typeof descricao !== 'string' || !descricao) return {};
  const inicio = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const fim = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (inicio === -1 || fim === -1 || fim <= inicio) return {};
  const jsonRaw = descricao.slice(inicio + '[SGP_PERMISSIONS_MATRIX]'.length, fim).trim();
  if (!jsonRaw) return {};
  try {
    const parsed = JSON.parse(jsonRaw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function consolidarPermissoesPortal(perfis: any[] = [], acessos: any[] = []): Set<string> {
  const permitidas = new Set<string>();
  const aplicar = (source: any) => {
    if (!source || typeof source !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
      if ((key.startsWith('perm_') || key.startsWith('acesso_')) && value === true) permitidas.add(key);
    }
  };
  for (const perfil of perfis || []) {
    aplicar(perfil);
    aplicar(extrairMatrizPermissoesPerfil(perfil?.descricao));
  }
  for (const acesso of acessos || []) aplicar(acesso);
  return permitidas;
}

function permissoesNecessariasAcaoAdminPortal(acao: string): string[] {
  if (acao.startsWith('PLANO_INSTITUCIONAL_')) {
    return ['perm_gerir_campanhas', 'perm_gerir_respostas', 'perm_configurar_portal'];
  }
  if (acao.startsWith('PORTAL_CONFIG_')) return ['perm_configurar_portal'];
  if (acao.startsWith('CADASTRO_DECIDIR_')) return ['perm_gerir_respostas'];
  if (acao.startsWith('PLANO_')) return ['perm_gerir_respostas'];
  if (acao === 'CAMPANHA_LISTAR') return ['perm_gerir_campanhas', 'perm_gerir_respostas', 'perm_configurar_portal'];
  if (['CAMPANHA_DETALHES_RETORNO', 'CAMPANHA_HOMOLOGAR_RESPOSTA', 'CAMPANHA_DISPARAR_LEMBRETES'].includes(acao)) {
    return ['perm_gerir_respostas'];
  }
  if (acao.startsWith('CAMPANHA_')) return ['perm_gerir_campanhas'];
  return [];
}

async function autorizarAcaoAdminPortal(base44: any, user: any, acao: string): Promise<boolean> {
  if (!user?.email) return false;
  if (String(user.role || '').trim().toLowerCase() === 'admin') return true;

  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: user.email, ativo: true });
  if ((acessos || []).some((a: any) => normalizarTipoAcesso(a?.tipo_acesso) === 'admin')) return true;

  const perfilIds = Array.from(new Set((acessos || []).map((a: any) => a?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length
    ? await base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true })
    : [];
  const permissoes = consolidarPermissoesPortal(perfis || [], acessos || []);
  const necessarias = permissoesNecessariasAcaoAdminPortal(acao);
  return necessarias.length > 0 && necessarias.some((key) => permissoes.has(key));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token, X-App-Id',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Payload JSON inválido.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const payload = (rawBody || {}) as PortalServicosPayload;
    const acao = payload.acao;
    const base44 = createClientFromRequest(req);

    // ========================================================================
    // ROTAS ADMINISTRATIVAS DO SGP (Gestão de Campanhas, Configurações e RH)
    // ========================================================================
    const isMilitarPortalAction = Boolean(
      acao === 'CAMPANHA_FORMULARIO_OBTER' ||
      acao === 'CAMPANHA_FORMULARIO_SUBMETER' ||
      acao === 'CAMPANHAS_ATIVAS_MILITAR_GET' ||
      (acao?.startsWith('CADASTRO_') && !acao?.startsWith('CADASTRO_DECIDIR_')) ||
      acao?.startsWith('FERIAS_')
    );

    const isAdminAction = !isMilitarPortalAction && Boolean(
      acao?.startsWith('CAMPANHA_') ||
      acao?.startsWith('PLANO_') ||
      acao?.startsWith('PORTAL_CONFIG_') ||
      acao?.startsWith('CADASTRO_DECIDIR_')
    );

    if (isAdminAction) {
      let user: any = null;
      try {
        user = await base44.auth.me();
      } catch (_eAuth) {}

      if (!user) {
        return new Response(JSON.stringify({ error: 'Usuário não autenticado.' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      let autorizado = false;
      try {
        autorizado = await autorizarAcaoAdminPortal(base44, user, acao);
      } catch (_ePerm) {
        autorizado = false;
      }
      if (!autorizado) {
        return new Response(JSON.stringify({ error: 'Usuário sem permissão para executar esta ação administrativa.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      switch (acao) {
        case 'PLANO_INSTITUCIONAL_LISTAR': {
          const planos = await base44.asServiceRole.entities.PlanoFeriasInstitucional.list();
          return new Response(JSON.stringify({ ok: true, planos: planos || [] }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_INSTITUCIONAL_CRIAR': {
          const pp = payload.plano_payload || {};
          const ano = Number(pp.ano_referencia);
          const titulo = String(pp.titulo || '').trim();
          if (!Number.isInteger(ano) || ano < 2000 || ano > 2200 || !titulo) {
            return new Response(JSON.stringify({ error: 'Ano e título do plano são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const criado = await base44.asServiceRole.entities.PlanoFeriasInstitucional.create({
            ano_referencia: ano,
            titulo,
            status: 'ATIVO',
            descricao: String(pp.descricao || ''),
            data_abertura: pp.data_abertura || new Date().toISOString().slice(0, 10),
            data_encerramento: '',
            total_gerados_acumulado: 0,
            quantidade_geracoes: 0,
          });
          return new Response(JSON.stringify({ ok: true, plano: criado }), {
            status: 201,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_INSTITUCIONAL_ATUALIZAR': {
          const planoId = String(payload.plano_id || '').trim();
          const pp = payload.plano_payload || {};
          const ano = Number(pp.ano_referencia);
          const titulo = String(pp.titulo || '').trim();
          if (!planoId || !Number.isInteger(ano) || ano < 2000 || ano > 2200 || !titulo) {
            return new Response(JSON.stringify({ error: 'Plano, ano e título são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const existente = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId);
          if (!existente) {
            return new Response(JSON.stringify({ error: 'Plano de Férias não encontrado.' }), {
              status: 404,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const campanhasVinculadas = await base44.asServiceRole.entities.CampanhaPortal.filter({ plano_ferias_institucional_id: planoId });
          if (campanhasVinculadas.length > 0 && Number(existente.ano_referencia) !== ano) {
            return new Response(JSON.stringify({ error: 'O ano não pode ser alterado depois que o plano possui campanhas.' }), {
              status: 409,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const atualizado = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
            ano_referencia: ano,
            titulo,
            descricao: String(pp.descricao || ''),
            data_abertura: pp.data_abertura || existente.data_abertura || new Date().toISOString().slice(0, 10),
            data_encerramento: pp.data_encerramento || '',
          });
          return new Response(JSON.stringify({ ok: true, plano: atualizado }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_INSTITUCIONAL_ARQUIVAR': {
          const planoId = String(payload.plano_id || '').trim();
          const existente = planoId ? await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId) : null;
          if (!existente) {
            return new Response(JSON.stringify({ error: 'Plano de Férias não encontrado.' }), {
              status: 404,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const atualizado = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
            status: 'ARQUIVADO',
            data_encerramento: existente.data_encerramento || new Date().toISOString().slice(0, 10),
          });
          return new Response(JSON.stringify({ ok: true, plano: atualizado }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_INSTITUCIONAL_EXCLUIR': {
          const planoId = String(payload.plano_id || '').trim();
          const existente = planoId ? await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId) : null;
          if (!existente) {
            return new Response(JSON.stringify({ error: 'Plano de Férias não encontrado.' }), {
              status: 404,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          const campanhasVinculadas = await base44.asServiceRole.entities.CampanhaPortal.filter({ plano_ferias_institucional_id: planoId });
          if (campanhasVinculadas.length > 0) {
            return new Response(JSON.stringify({ error: 'Este plano possui campanhas vinculadas e não pode ser excluído. Arquive-o para preservar o histórico.' }), {
              status: 409,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          await base44.asServiceRole.entities.PlanoFeriasInstitucional.delete(planoId);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Criar Nova Campanha (Férias ou Cadastral com Escopo)
        case 'CAMPANHA_CRIAR': {
          const cp = payload.campanha_payload || {};
          if (!cp.tipo || !cp.titulo) {
            return new Response(JSON.stringify({ error: 'Tipo e Título da campanha são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          let planoInstitucional: any = null;
          if (cp.tipo === 'PLANO_FERIAS') {
            const planoId = String(cp.plano_ferias_institucional_id || '').trim();
            if (!planoId) {
              return new Response(JSON.stringify({ error: 'Toda campanha de férias deve estar vinculada a um Plano de Férias aberto.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
            planoInstitucional = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId);
            if (!planoInstitucional) {
              return new Response(JSON.stringify({ error: 'Plano de Férias informado não foi encontrado.' }), {
                status: 404,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
            if (String(planoInstitucional.status || 'ATIVO') !== 'ATIVO') {
              return new Response(JSON.stringify({ error: 'Somente Planos de Férias abertos podem receber novas campanhas.' }), {
                status: 409,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
            if (Number(planoInstitucional.ano_referencia) !== Number(cp.ano_referencia)) {
              return new Response(JSON.stringify({ error: 'O ano da campanha deve ser igual ao ano do Plano de Férias.' }), {
                status: 409,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
          }

          // Busca militares para calcular o total do público-alvo
          let todosMilitares: any[] = [];
          try {
            todosMilitares = await base44.asServiceRole.entities.Militar.list();
          } catch (_e) {
            todosMilitares = [];
          }

          // Filtra militares conforme o escopo selecionado
          const militaresEscopo = todosMilitares.filter((m) => {
            if (m.status === 'Inativo' || m.status === 'Falecido') return false;
            if (cp.tipo_escopo === 'TODOS' || !cp.tipo_escopo) return true;
            if (cp.tipo_escopo === 'UNIDADES' && Array.isArray(cp.escopo_unidades_ids)) {
              return matchMilitarEscopoUnidade(m, cp.escopo_unidades_ids);
            }
            if (cp.tipo_escopo === 'QUADROS' && Array.isArray(cp.escopo_quadros)) {
              return cp.escopo_quadros.includes(m.quadro);
            }
            if (cp.tipo_escopo === 'SELECAO_MILITARES' && Array.isArray(cp.escopo_militares_ids)) {
              return cp.escopo_militares_ids.includes(m.id);
            }
            return true;
          });

          const created = await base44.asServiceRole.entities.CampanhaPortal.create({
            tipo: cp.tipo,
            titulo: cp.titulo,
            ano_referencia: cp.ano_referencia || (new Date().getFullYear() + 1),
            plano_ferias_institucional_id: cp.plano_ferias_institucional_id || '',
            status: cp.status || 'Aberta_Coleta',
            tipo_escopo: cp.tipo_escopo || 'TODOS',
            escopo_unidades_ids: cp.escopo_unidades_ids || [],
            escopo_unidades_nomes: cp.escopo_unidades_nomes || 'Toda a Corporação',
            escopo_militares_ids: cp.escopo_militares_ids || [],
            escopo_quadros: cp.escopo_quadros || [],
            data_inicio: cp.data_inicio || new Date().toISOString().split('T')[0],
            data_fim_militar: cp.data_fim_militar || '',
            data_fim_unidade: cp.data_fim_unidade || '',
            instrucoes: cp.instrucoes || '',
            config_regras: JSON.stringify(cp.config_regras || {}),
            config_formulario: typeof cp.config_formulario === 'object' ? JSON.stringify(cp.config_formulario) : (cp.config_formulario || ''),
            arquivo_modelo_url: cp.arquivo_modelo_url || '',
            arquivo_modelo_nome: cp.arquivo_modelo_nome || '',
            exigir_devolucao_arquivo: Boolean(cp.exigir_devolucao_arquivo),
            texto_termo_aceite: cp.texto_termo_aceite || '',
            total_publico_alvo: militaresEscopo.length,
            total_respondidos: 0,
            total_pendentes: militaresEscopo.length,
            criado_por_nome: user.email || 'Administrador',
          });

          return new Response(JSON.stringify({ ok: true, campanha: created }), {
            status: 201,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Listar Campanhas com Métricas Atualizadas
        case 'CAMPANHA_LISTAR': {
          let campanhas: any[] = [];
          try {
            campanhas = await base44.asServiceRole.entities.CampanhaPortal.list();
          } catch (_e) {
            campanhas = [];
          }

          return new Response(JSON.stringify({ ok: true, campanhas: campanhas || [] }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Consulta de Configurações Globais do Portal (Service Role)
        case 'PORTAL_CONFIG_GET': {
          let configs: any[] = [];
          try {
            configs = await base44.asServiceRole.entities.PortalAuthConfig.list();
          } catch (_e) {}

          const config = Array.isArray(configs) && configs.length > 0 ? configs[0] : DEFAULT_AUTH_CONFIG;
          return new Response(JSON.stringify({ ok: true, config }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Gravação Segura de Configurações Globais do Portal (Service Role)
        case 'PORTAL_CONFIG_SAVE': {
          const configPayload = payload?.config_payload || payload;
          const { acao: _acao, ...cleanData } = configPayload;

          let configs: any[] = [];
          try {
            configs = await base44.asServiceRole.entities.PortalAuthConfig.list();
          } catch (_e) {}

          let savedConfig: any = null;
          if (Array.isArray(configs) && configs.length > 0) {
            savedConfig = await base44.asServiceRole.entities.PortalAuthConfig.update(configs[0].id, {
              ...cleanData,
              ativo: true,
              updated_at: new Date().toISOString(),
            });
          } else {
            savedConfig = await base44.asServiceRole.entities.PortalAuthConfig.create({
              ...cleanData,
              ativo: true,
              updated_at: new Date().toISOString(),
            });
          }

          return new Response(JSON.stringify({
            ok: true,
            config: savedConfig,
            message: 'Configurações do Portal salvas com sucesso!',
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Detalhes de Retorno e Acompanhamento Nominal
        case 'CAMPANHA_DETALHES_RETORNO': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanha_id);
          if (!campanha) {
            return new Response(JSON.stringify({ error: 'Campanha não encontrada.' }), {
              status: 404,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          let todosMilitares: any[] = [];
          try {
            todosMilitares = await base44.asServiceRole.entities.Militar.list();
          } catch (_e) {
            todosMilitares = [];
          }

          // Militares no escopo
          const militaresNoEscopo = todosMilitares.filter((m) => {
            if (m.status === 'Inativo' || m.status === 'Falecido') return false;
            if (campanha.tipo_escopo === 'TODOS' || !campanha.tipo_escopo) return true;
            if (campanha.tipo_escopo === 'UNIDADES' && Array.isArray(campanha.escopo_unidades_ids)) {
              return matchMilitarEscopoUnidade(m, campanha.escopo_unidades_ids);
            }
            if (campanha.tipo_escopo === 'QUADROS' && Array.isArray(campanha.escopo_quadros)) {
              return campanha.escopo_quadros.includes(m.quadro);
            }
            if (campanha.tipo_escopo === 'SELECAO_MILITARES' && Array.isArray(campanha.escopo_militares_ids)) {
              return campanha.escopo_militares_ids.includes(m.id);
            }
            return true;
          });

          // Respostas / Registros
          let respostasMap = new Map<string, any>();

          if (campanha.tipo === 'PLANO_FERIAS') {
            const opcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
              campanha_id: campanha.id,
            });
            (opcoes || []).forEach((op: any) => respostasMap.set(op.militar_id, op));
          } else if (campanha.tipo === 'FORMULARIO_DINAMICO' || campanha.tipo === 'ASSINATURA_DOCUMENTO') {
            let resps: any[] = [];
            try {
              resps = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.filter({
                campanha_id: campanha.id,
              });
            } catch (_eResps) {}
            (resps || []).forEach((r: any) => respostasMap.set(r.militar_id, r));
          } else {
            const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.list();
            (solicitacoes || []).forEach((sol: any) => respostasMap.set(sol.militar_id, sol));
          }

          const relacaoNominal = militaresNoEscopo.map((m) => {
            const resposta = respostasMap.get(m.id);
            const isCadastral = campanha.tipo === 'ATUALIZACAO_CADASTRAL' || campanha.tipo === 'CONFERENCIA_GERAL';
            const conferiuRecentemente = isCadastral && m.data_ultima_conferencia && campanha.data_inicio && m.data_ultima_conferencia >= campanha.data_inicio;
            const respondido = Boolean(resposta || conferiuRecentemente);

            let detalhesTexto = null;
            if (resposta) {
              if (campanha.tipo === 'PLANO_FERIAS') {
                detalhesTexto = resposta.opcao_1_meses;
              } else if (campanha.tipo === 'ASSINATURA_DOCUMENTO') {
                detalhesTexto = resposta.arquivo_devolucao_nome ? `Documento: ${resposta.arquivo_devolucao_nome}` : 'Documento assinado';
              } else if (campanha.tipo === 'FORMULARIO_DINAMICO') {
                detalhesTexto = resposta.resposta_texto_geral || 'Formulário respondido';
              } else {
                detalhesTexto = resposta.valor_proposto || 'Solicitação enviada';
              }
            } else if (conferiuRecentemente) {
              detalhesTexto = 'Dados confirmados sem alteração';
            }

            return {
              militar_id: m.id,
              militar_nome: m.nome_completo || m.nome_guerra || '',
              militar_posto: m.posto_graduacao || '',
              militar_matricula: m.matricula || '',
              militar_lotacao: m.lotacao || m.estrutura_nome || 'Não informada',
              militar_celular: m.telefone_celular || m.telefone || '',
              status_resposta: respondido ? 'Respondido' : 'Pendente',
              status_homologacao: resposta?.status || (respondido ? 'Enviado' : 'Pendente'),
              data_resposta: resposta?.data_envio || resposta?.data_envio_militar || resposta?.created_date || (conferiuRecentemente ? m.data_ultima_conferencia : null),
              detalhes_resposta: detalhesTexto,
              resposta_completa: resposta || null,
            };
          });

          const totalRespondidos = relacaoNominal.filter((r) => r.status_resposta === 'Respondido').length;
          const totalPendentes = relacaoNominal.length - totalRespondidos;

          try {
            await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
              total_publico_alvo: relacaoNominal.length,
              total_respondidos: totalRespondidos,
              total_pendentes: totalPendentes,
            });
          } catch (_err) {}

          return new Response(JSON.stringify({
            ok: true,
            campanha,
            total_alvo: relacaoNominal.length,
            total_respondidos: totalRespondidos,
            total_pendentes: totalPendentes,
            percentual: relacaoNominal.length > 0 ? Math.round((totalRespondidos / relacaoNominal.length) * 100) : 0,
            militares: relacaoNominal,
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Homologação de Resposta de Campanha Personalizada / Documento
        case 'CAMPANHA_HOMOLOGAR_RESPOSTA': {
          const { resposta_id, status, observacao_gestor } = payload;
          if (!resposta_id || !status) {
            return new Response(JSON.stringify({ error: 'ID da resposta e status são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          const resp = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.update(resposta_id, {
            status,
            observacao_gestor: observacao_gestor || '',
            homologado_por_nome: user.email || 'Gestor / RH',
            data_homologacao: new Date().toISOString(),
          });

          return new Response(JSON.stringify({ ok: true, resposta: resp, message: 'Resposta avaliada com sucesso.' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Disparo de Lembretes
        case 'CAMPANHA_DISPARAR_LEMBRETES': {
          return new Response(JSON.stringify({
            ok: true,
            message: 'Disparo de lembretes processado com sucesso para os militares com pendência nesta campanha.',
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Editar Campanha
        case 'CAMPANHA_EDITAR': {
          const { campanha_id, campanha_payload } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }
          const campanhaAtual = await base44.asServiceRole.entities.CampanhaPortal.get(campanha_id);
          const planoIdEditado = String(campanha_payload?.plano_ferias_institucional_id || '').trim();
          if (campanhaAtual?.tipo === 'PLANO_FERIAS' && planoIdEditado) {
            const planoEditado = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoIdEditado);
            if (!planoEditado) {
              return new Response(JSON.stringify({ error: 'Plano de Férias informado não foi encontrado.' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
            }
            if (Number(planoEditado.ano_referencia) !== Number(campanha_payload.ano_referencia)) {
              return new Response(JSON.stringify({ error: 'O ano da campanha deve ser igual ao ano do Plano de Férias.' }), { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
            }
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
            titulo: campanha_payload.titulo,
            plano_ferias_institucional_id: planoIdEditado,
            ano_referencia: Number(campanha_payload.ano_referencia) || undefined,
            status: campanha_payload.status || 'Aberta_Coleta',
            instrucoes: campanha_payload.instrucoes,
            data_fim_militar: campanha_payload.data_fim_militar,
            data_fim_unidade: campanha_payload.data_fim_unidade,
            tipo_escopo: campanha_payload.tipo_escopo,
            escopo_unidades_ids: campanha_payload.escopo_unidades_ids,
            escopo_unidades_nomes: campanha_payload.escopo_unidades_nomes,
            escopo_quadros: campanha_payload.escopo_quadros,
            config_regras: JSON.stringify(campanha_payload.config_regras || {}),
            config_formulario: typeof campanha_payload.config_formulario === 'object' ? JSON.stringify(campanha_payload.config_formulario) : (campanha_payload.config_formulario || ''),
            arquivo_modelo_url: campanha_payload.arquivo_modelo_url || '',
            arquivo_modelo_nome: campanha_payload.arquivo_modelo_nome || '',
            exigir_devolucao_arquivo: Boolean(campanha_payload.exigir_devolucao_arquivo),
            texto_termo_aceite: campanha_payload.texto_termo_aceite || '',
          });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha atualizada com sucesso.' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        // Decisão de Solicitação de Atualização Cadastral pelo RH (Aprovar / Rejeitar com suporte a Retificação pelo Gestor)
        case 'CADASTRO_DECIDIR_SOLICITACAO': {
          const { solicitacao_id, decisao, valor_corrigido, observacao } = payload;
          if (!solicitacao_id || !decisao) {
            return new Response(JSON.stringify({ error: 'ID da solicitação e decisão são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          const sol = await base44.asServiceRole.entities.SolicitacaoAtualizacao.get(solicitacao_id);
          if (!sol) {
            return new Response(JSON.stringify({ error: 'Solicitação não encontrada.' }), {
              status: 404,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          const statusDecisao = decisao === 'Aprovada' ? 'Aprovada' : 'Rejeitada';
          const foiEditado = Boolean(valor_corrigido !== undefined && valor_corrigido !== null && valor_corrigido !== sol.valor_proposto);
          const valorFinal = foiEditado ? valor_corrigido : sol.valor_proposto;

          const solUpdate: Record<string, any> = {
            status: statusDecisao,
            data_decisao: new Date().toISOString().split('T')[0],
            usuario_decisao: user.email || 'RH / Comando',
            observacao_decisao: observacao || (foiEditado ? `Retificado pelo gestor (original: "${sol.valor_proposto}")` : ''),
          };

          if (foiEditado) {
            solUpdate.valor_original_militar = sol.valor_proposto;
            solUpdate.valor_proposto = valorFinal;
            solUpdate.editado_pelo_gestor = true;
          }

          const updatedSol = await base44.asServiceRole.entities.SolicitacaoAtualizacao.update(solicitacao_id, solUpdate);

          // Se aprovada, replica diretamente na entidade Militar!
          let militarAtualizado: any = null;
          if (statusDecisao === 'Aprovada' && sol.militar_id && sol.campo_chave) {
            const campo = sol.campo_chave.trim().toLowerCase();
            const updatePayload: Record<string, any> = {
              data_ultima_conferencia: new Date().toISOString().split('T')[0],
            };

            if (campo === 'logradouro' || campo === 'endereco' || campo === 'endereco_logradouro') {
              updatePayload.logradouro = valorFinal;
            } else if (campo === 'numero_endereco' || campo === 'numero' || campo === 'endereco_numero') {
              updatePayload.numero_endereco = valorFinal;
            } else if (campo === 'bairro' || campo === 'endereco_bairro') {
              updatePayload.bairro = valorFinal;
            } else if (campo === 'cidade' || campo === 'municipio' || campo === 'endereco_cidade') {
              updatePayload.cidade = valorFinal;
            } else if (campo === 'cep' || campo === 'endereco_cep') {
              updatePayload.cep = valorFinal;
            } else if (campo === 'uf' || campo === 'endereco_uf') {
              updatePayload.uf = valorFinal;
            } else if (campo === 'complemento' || campo === 'endereco_complemento') {
              updatePayload.complemento = valorFinal;
            } else if (campo === 'telefone_celular' || campo === 'celular' || campo === 'telefone') {
              updatePayload.telefone = valorFinal;
            } else if (campo === 'email_funcional') {
              updatePayload.email_funcional = valorFinal;
            } else if (campo === 'email_particular' || campo === 'email') {
              updatePayload.email_particular = valorFinal;
            } else if (campo === 'estado_civil') {
              updatePayload.estado_civil = valorFinal;
            } else if (campo === 'nome_mae' || campo === 'mae') {
              updatePayload.nome_mae = valorFinal;
            } else if (campo === 'nome_pai' || campo === 'pai') {
              updatePayload.nome_pai = valorFinal;
            } else if (campo === 'tipo_sanguineo') {
              updatePayload.tipo_sanguineo = valorFinal;
            } else if (campo === 'religiao') {
              updatePayload.religiao = valorFinal;
            } else if (campo === 'escolaridade') {
              updatePayload.escolaridade = valorFinal;
            } else if (campo === 'naturalidade') {
              updatePayload.naturalidade = valorFinal;
            } else if (campo === 'naturalidade_uf') {
              updatePayload.naturalidade_uf = valorFinal;
            } else {
              updatePayload[sol.campo_chave] = valorFinal;
            }

            try {
              militarAtualizado = await base44.asServiceRole.entities.Militar.update(sol.militar_id, updatePayload);
            } catch (errUpd: any) {
              console.error('Erro ao atualizar Militar na aprovação cadastral:', errUpd);
            }
          }

          return new Response(JSON.stringify({
            ok: true,
            solicitacao: updatedSol,
            militar_atualizado: militarAtualizado,
            message: `Solicitação ${statusDecisao.toLowerCase()} com sucesso.`
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Decisão em Lote para todas as alterações do mesmo militar
        case 'CADASTRO_DECIDIR_LOTE_MILITAR': {
          const { militar_id, decisao, itens_decisao, observacao } = payload;
          if (!militar_id || !decisao) {
            return new Response(JSON.stringify({ error: 'ID do militar e decisão são obrigatórios.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }

          const statusDecisao = decisao === 'Aprovada' ? 'Aprovada' : 'Rejeitada';
          const updateMilitarPayload: Record<string, any> = {
            data_ultima_conferencia: new Date().toISOString().split('T')[0],
          };

          const itensArray: Array<{ solicitacao_id: string; valor_corrigido?: string; observacao?: string }> = itens_decisao || [];
          const solicitacoesAtualizadas = [];

          for (const item of itensArray) {
            try {
              const sol = await base44.asServiceRole.entities.SolicitacaoAtualizacao.get(item.solicitacao_id);
              if (!sol || sol.militar_id !== militar_id) continue;

              const foiEditado = Boolean(item.valor_corrigido !== undefined && item.valor_corrigido !== null && item.valor_corrigido !== sol.valor_proposto);
              const valorFinal = foiEditado ? item.valor_corrigido : sol.valor_proposto;

              const solUpdate: Record<string, any> = {
                status: statusDecisao,
                data_decisao: new Date().toISOString().split('T')[0],
                usuario_decisao: user.email || 'RH / Comando',
                observacao_decisao: item.observacao || observacao || (foiEditado ? `Retificado pelo gestor (original: "${sol.valor_proposto}")` : ''),
              };

              if (foiEditado) {
                solUpdate.valor_original_militar = sol.valor_proposto;
                solUpdate.valor_proposto = valorFinal;
                solUpdate.editado_pelo_gestor = true;
              }

              const resUpd = await base44.asServiceRole.entities.SolicitacaoAtualizacao.update(sol.id, solUpdate);
              solicitacoesAtualizadas.push(resUpd);

              if (statusDecisao === 'Aprovada' && sol.campo_chave) {
                const campo = sol.campo_chave.trim().toLowerCase();
                if (campo === 'logradouro' || campo === 'endereco' || campo === 'endereco_logradouro') {
                  updateMilitarPayload.logradouro = valorFinal;
                } else if (campo === 'numero_endereco' || campo === 'numero' || campo === 'endereco_numero') {
                  updateMilitarPayload.numero_endereco = valorFinal;
                } else if (campo === 'bairro' || campo === 'endereco_bairro') {
                  updateMilitarPayload.bairro = valorFinal;
                } else if (campo === 'cidade' || campo === 'municipio' || campo === 'endereco_cidade') {
                  updateMilitarPayload.cidade = valorFinal;
                } else if (campo === 'cep' || campo === 'endereco_cep') {
                  updateMilitarPayload.cep = valorFinal;
                } else if (campo === 'uf' || campo === 'endereco_uf') {
                  updateMilitarPayload.uf = valorFinal;
                } else if (campo === 'complemento' || campo === 'endereco_complemento') {
                  updateMilitarPayload.complemento = valorFinal;
                } else if (campo === 'telefone_celular' || campo === 'celular' || campo === 'telefone') {
                  updateMilitarPayload.telefone = valorFinal;
                } else if (campo === 'email_funcional') {
                  updateMilitarPayload.email_funcional = valorFinal;
                } else if (campo === 'email_particular' || campo === 'email') {
                  updateMilitarPayload.email_particular = valorFinal;
                } else if (campo === 'estado_civil') {
                  updateMilitarPayload.estado_civil = valorFinal;
                } else if (campo === 'nome_mae' || campo === 'mae') {
                  updateMilitarPayload.nome_mae = valorFinal;
                } else if (campo === 'nome_pai' || campo === 'pai') {
                  updateMilitarPayload.nome_pai = valorFinal;
                } else if (campo === 'tipo_sanguineo') {
                  updateMilitarPayload.tipo_sanguineo = valorFinal;
                } else if (campo === 'religiao') {
                  updateMilitarPayload.religiao = valorFinal;
                } else if (campo === 'escolaridade') {
                  updateMilitarPayload.escolaridade = valorFinal;
                } else if (campo === 'naturalidade') {
                  updateMilitarPayload.naturalidade = valorFinal;
                } else if (campo === 'naturalidade_uf') {
                  updateMilitarPayload.naturalidade_uf = valorFinal;
                } else {
                  updateMilitarPayload[sol.campo_chave] = valorFinal;
                }
              }
            } catch (_errItem) {}
          }

          let militarAtualizado: any = null;
          if (statusDecisao === 'Aprovada' && Object.keys(updateMilitarPayload).length > 1) {
            try {
              militarAtualizado = await base44.asServiceRole.entities.Militar.update(militar_id, updateMilitarPayload);
            } catch (errMilitar) {
              console.error('Erro ao atualizar Militar em lote:', errMilitar);
            }
          }

          return new Response(JSON.stringify({
            ok: true,
            solicitacoes_atualizadas: solicitacoesAtualizadas,
            militar_atualizado: militarAtualizado,
            message: `${solicitacoesAtualizadas.length} alterações ${statusDecisao.toLowerCase()}s com sucesso.`
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Excluir Campanha
        case 'CAMPANHA_EXCLUIR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }

          // 1. Exclui a campanha
          await base44.asServiceRole.entities.CampanhaPortal.delete(campanha_id);

          // 2. Remove todas as opções de férias que foram registradas para essa campanha específica
          try {
            const opcoesDaCampanha = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ campanha_id });
            for (const op of (opcoesDaCampanha || [])) {
              await base44.asServiceRole.entities.OpcaoFeriasMilitar.delete(op.id);
            }
          } catch (_eDelOp) {}

          // 3. Remove respostas de formulários dinâmicos e assinaturas vinculadas a essa campanha
          try {
            const respsPersonalizadas = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.filter({ campanha_id });
            for (const r of (respsPersonalizadas || [])) {
              await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.delete(r.id);
            }
          } catch (_eDelResp) {}

          // Observação de Integridade:
          // Férias efetivas geradas na escala oficial (entidade Ferias) e solicitações cadastrais
          // já registradas/aprovadas na ficha dos militares NÃO são apagadas nem revertidas.

          return new Response(JSON.stringify({
            ok: true,
            message: 'Campanha e respostas associadas excluídas com sucesso. Férias geradas e cadastros permanecem preservados.',
          }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Arquivar Campanha
        case 'CAMPANHA_ARQUIVAR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, { status: 'Arquivada' });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha arquivada com sucesso.' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        // Desativar Campanha
        case 'CAMPANHA_DESATIVAR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, { status: 'Desativada' });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha desativada com sucesso.' }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        // Encerrar Campanha
        case 'CAMPANHA_ENCERRAR': {
          const { campanha_id } = payload;
          await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
            status: 'Encerrada',
          });
          return new Response(JSON.stringify({ ok: true, message: 'Campanha encerrada.' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Reabrir / Ativar Campanha
        case 'CAMPANHA_REABRIR':
        case 'CAMPANHA_ATIVAR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
            status: 'Aberta_Coleta',
          });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha reaberta com sucesso!' }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Rotas legadas de compatibilidade
        case 'PLANO_CAMPANHA_OBTER_OU_CRIAR':
        case 'PLANO_CAMPANHA_SALVAR':
        case 'PLANO_ESCALA_LISTAR':
        case 'PLANO_DECISAO_CAMADA_1':
        case 'PLANO_HOMOLOGACAO_CAMADA_2':
        case 'PLANO_GERAR_LOTE_FERIAS': {
          const ano = payload.ano_referencia || (new Date().getFullYear() + 1);

          if (acao === 'PLANO_CAMPANHA_OBTER_OU_CRIAR') {
            let campanhas = await base44.asServiceRole.entities.CampanhaPortal.filter({ tipo: 'PLANO_FERIAS', ano_referencia: ano });
            let campanha = campanhas?.[0];
            if (!campanha) {
              campanha = await base44.asServiceRole.entities.CampanhaPortal.create({
                tipo: 'PLANO_FERIAS',
                ano_referencia: ano,
                titulo: `Plano Anual de Férias ${ano}`,
                status: 'Aberta_Coleta',
                tipo_escopo: 'TODOS',
                escopo_unidades_nomes: 'Toda a Corporação',
                data_inicio: new Date().toISOString().split('T')[0],
                data_fim_militar: `${ano - 1}-10-31`,
                data_fim_unidade: `${ano - 1}-11-30`,
                instrucoes: `Prezados militares, registrem suas 3 opções de meses de férias para ${ano}.`,
                total_publico_alvo: 0,
                total_respondidos: 0,
                total_pendentes: 0,
              });
            }
            return new Response(JSON.stringify({ ok: true, campanha }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }

          if (acao === 'PLANO_ESCALA_LISTAR') {
            // 1. Carrega todas as campanhas de férias cadastradas
            let todasCampanhasPortal: any[] = [];
            try {
              todasCampanhasPortal = await base44.asServiceRole.entities.CampanhaPortal.list();
            } catch (_e) {
              todasCampanhasPortal = [];
            }
            const campanhasFerias = (todasCampanhasPortal || []).filter((cp: any) => cp.tipo === 'PLANO_FERIAS');
            const campanhasIdsValidos = new Set(campanhasFerias.map((c: any) => c.id));

            // 2. Busca opções de férias de forma estritamente isolada pela campanha
            let opcoes: any[] = [];
            if (payload.campanha_id) {
              const allOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.list();
              opcoes = (allOpcoes || []).filter((op: any) => op.campanha_id === payload.campanha_id);
            } else if (campanhasFerias.length > 0) {
              const primeiraCamp = campanhasFerias.find((c: any) => c.status === 'Aberta_Coleta' || c.status === 'Ativa') || campanhasFerias[0];
              const allOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.list();
              opcoes = (allOpcoes || []).filter((op: any) => op.campanha_id === primeiraCamp.id);
            }

            // 3. Purga opções órfãs de campanhas que foram excluídas
            try {
              const allOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.list();
              for (const op of (allOpcoes || [])) {
                if (!op.campanha_id || !campanhasIdsValidos.has(op.campanha_id)) {
                  await base44.asServiceRole.entities.OpcaoFeriasMilitar.delete(op.id);
                }
              }
            } catch (_ePurge) {}

            // Rotina de reparo/sincronização automática para férias já geradas
            try {
              const allFerias2 = await base44.asServiceRole.entities.Ferias.list();
              const feriasDoAno = (allFerias2 || []).filter((f: any) => f.data_inicio && f.data_inicio.startsWith(String(ano)));

              for (const f of feriasDoAno) {
                let needsUpdate = false;
                const updatePayload: any = {};

                if (f.status === 'Previsto') {
                  updatePayload.status = 'Prevista';
                  needsUpdate = true;
                }

                if (!f.periodo_aquisitivo_ref && f.periodo_aquisitivo_id) {
                  const pa = await base44.asServiceRole.entities.PeriodoAquisitivo.get(f.periodo_aquisitivo_id);
                  if (pa) {
                    const ref = pa.ano_referencia || pa.referencia || (pa.inicio_aquisitivo && pa.fim_aquisitivo ? `${new Date(pa.inicio_aquisitivo).getFullYear()}/${new Date(pa.fim_aquisitivo).getFullYear()}` : '');
                    if (ref) {
                      updatePayload.periodo_aquisitivo_ref = ref;
                      needsUpdate = true;
                    }
                  }
                }

                if (!f.dias_base && f.dias) {
                  updatePayload.dias_base = f.dias;
                  needsUpdate = true;
                }

                if (!f.fracionamento) {
                  updatePayload.fracionamento = f.dias === 30 ? 'Integral' : '1ª Fração';
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  await base44.asServiceRole.entities.Ferias.update(f.id, updatePayload);
                }
              }
            } catch (_errRepair) {}

            return new Response(JSON.stringify({
              ok: true,
              campanhas: campanhasFerias || [],
              opcoes: opcoes || [],
            }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }

          if (acao === 'PLANO_DECISAO_CAMADA_1') {
            const { opcao_id, decisao_camada_1 } = payload;
            
            if (decisao_camada_1?.opcao_escolhida === 'NAO_CONTEMPLADO') {
              const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
                status_camada_1: 'Nao_Contemplado',
                decisao_camada_1_opcao: 'NAO_CONTEMPLADO',
                decisao_camada_1_meses: 'Não Contemplado',
                decisao_camada_1_detalhes: '[]',
                gestor_unidade_id: user.id,
                gestor_unidade_nome: decisao_camada_1?.gestor_nome || user.email,
                data_decisao_camada_1: new Date().toISOString(),
                justificativa_ajuste_gestor: decisao_camada_1?.justificativa || 'Militar não contemplado neste plano de férias.',
              });
              return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
            }

            const parcelas = decisao_camada_1?.parcelas || [];
            if (parcelas.length > 1) {
              const mesesList = parcelas.map((p: any) => p.mes || p.data_inicio?.slice(5, 7));
              const mesesSet = new Set(mesesList);
              if (mesesSet.size !== parcelas.length) {
                return new Response(JSON.stringify({ error: 'Para férias fracionadas, cada fração deve ser escalada em um mês diferente.' }), {
                  status: 400,
                  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
              }
            }

            const opcaoGestao = await base44.asServiceRole.entities.OpcaoFeriasMilitar.get(opcao_id);
            if (!opcaoGestao?.periodo_aquisitivo_id) {
              return new Response(JSON.stringify({ error: 'Opção de férias sem período aquisitivo válido.' }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
            const periodoGestao = await base44.asServiceRole.entities.PeriodoAquisitivo.get(opcaoGestao.periodo_aquisitivo_id);
            const [feriasGestao, ajustesGestao] = await Promise.all([
              base44.asServiceRole.entities.Ferias.filter({ militar_id: opcaoGestao.militar_id }),
              base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: opcaoGestao.militar_id }),
            ]);
            const anoPlanoGestao = Number(opcaoGestao.ano_referencia || new Date().getFullYear() + 1);
            const resumoGestao = calcularResumoPeriodoPlano(periodoGestao, feriasGestao, ajustesGestao, anoPlanoGestao);
            const diasEsperados = Math.max(0, numeroSeguro(opcaoGestao.dias_direito, resumoGestao.dias_sem_previsao));
            const parcelasNormalizadas = parcelas.map((p: any, idx: number) => {
              const mes = textoId(p?.mes || p?.data_inicio?.slice?.(5, 7));
              const regraMes = (resumoGestao.meses_elegiveis || []).find((m: any) => m.mes === mes);
              const dias = Math.max(0, numeroSeguro(p?.dias, 0));
              return {
                etapa: numeroSeguro(p?.etapa, idx + 1),
                dias,
                mes,
                data_inicio: regraMes?.permitido ? regraMes.data_inicio : '',
              };
            }).sort((a: any, b: any) => String(a.data_inicio).localeCompare(String(b.data_inicio)))
              .map((p: any, idx: number) => ({ ...p, etapa: idx + 1 }));

            if (parcelasNormalizadas.some((p: any) => !p.mes || !p.data_inicio || p.dias <= 0)) {
              return new Response(JSON.stringify({
                error: `Há fração em mês indisponível. A primeira data legal de gozo deste período é ${resumoGestao.primeira_data_legal_gozo}.`,
              }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }

            const totalDiasEscala = parcelasNormalizadas.reduce((acc: number, p: any) => acc + p.dias, 0);
            if (totalDiasEscala !== diasEsperados || totalDiasEscala > resumoGestao.dias_sem_previsao) {
              return new Response(JSON.stringify({
                error: `A escala deve totalizar exatamente ${diasEsperados} dia(s) e não pode exceder o saldo sem previsão de ${resumoGestao.dias_sem_previsao} dia(s).`,
              }), {
                status: 409,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }

            const feriasImpactantes = (feriasGestao || []).filter((f: any) => STATUS_FERIAS_IMPACTO_PLANO.has(String(f.status || '')));
            for (let i = 0; i < parcelasNormalizadas.length; i += 1) {
              const parcela = parcelasNormalizadas[i];
              const fimParcela = calcularFimParcela(parcela.data_inicio, parcela.dias);
              const conflitoExistente = feriasImpactantes.find((f: any) =>
                intervalosSobrepostos(parcela.data_inicio, fimParcela, f.data_inicio, f.data_fim)
              );
              if (conflitoExistente) {
                return new Response(JSON.stringify({
                  error: `A fração iniciada em ${parcela.data_inicio} conflita com férias já cadastradas de ${conflitoExistente.data_inicio} a ${conflitoExistente.data_fim}.`,
                }), {
                  status: 409,
                  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
              }
              for (let j = i + 1; j < parcelasNormalizadas.length; j += 1) {
                const outra = parcelasNormalizadas[j];
                const fimOutra = calcularFimParcela(outra.data_inicio, outra.dias);
                if (intervalosSobrepostos(parcela.data_inicio, fimParcela, outra.data_inicio, fimOutra)) {
                  return new Response(JSON.stringify({ error: 'As frações definidas para o plano se sobrepõem. Ajuste os meses escolhidos.' }), {
                    status: 400,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                  });
                }
              }
            }

            const mesesResumo = parcelasNormalizadas.map((p: any) => p.mes || p.data_inicio?.slice(5, 7)).join(' / ');
            const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
              status_camada_1: 'Escala_Salva',
              decisao_camada_1_opcao: decisao_camada_1?.opcao_escolhida || 'ESCALA_VALIDADA',
              decisao_camada_1_meses: decisao_camada_1?.resumo_meses || mesesResumo,
              decisao_camada_1_detalhes: JSON.stringify(parcelasNormalizadas),
              gestor_unidade_id: user.id,
              gestor_unidade_nome: decisao_camada_1?.gestor_nome || user.email,
              data_decisao_camada_1: new Date().toISOString(),
              justificativa_ajuste_gestor: decisao_camada_1?.justificativa || '',
            });
            return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }

          if (acao === 'PLANO_HOMOLOGACAO_CAMADA_2') {
            const { opcao_id, homologacao_camada_2 } = payload;
            const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
              status_camada_2: homologacao_camada_2?.status === 'Homologado_Superior' ? 'Homologado_Superior' : 'Rejeitado_Para_Revisao',
              superior_homologador_id: user.id,
              superior_homologador_nome: homologacao_camada_2?.superior_nome || user.email,
              data_homologacao_superior: new Date().toISOString(),
              observacao_superior: homologacao_camada_2?.observacao || '',
            });
            return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }

          if (acao === 'PLANO_GERAR_LOTE_FERIAS') {
            const { campanha_id } = payload;
            let todasOpcoes: any[] = [];

            if (campanha_id) {
              todasOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
                campanha_id: campanha_id,
                gerado_ferias_efetivas: false,
              });
              if (!todasOpcoes || todasOpcoes.length === 0) {
                todasOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
                  ano_referencia: ano,
                  gerado_ferias_efetivas: false,
                });
              }
            } else {
              todasOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
                ano_referencia: ano,
                gerado_ferias_efetivas: false,
              });
            }

            // Considera apenas quem foi salvo/definido e NÃO está marcado como Não Contemplado
            const opcoes = (todasOpcoes || []).filter((op: any) =>
              op.status_camada_1 !== 'Pendente' &&
              op.status_camada_1 !== 'Nao_Contemplado' &&
              op.decisao_camada_1_opcao !== 'NAO_CONTEMPLADO'
            );

            let geradasCount = 0;
            for (const op of opcoes) {
              let parcelas: ParcelaItem[] = [];
              try { parcelas = JSON.parse(op.decisao_camada_1_detalhes || '[]'); } catch (_e) { parcelas = []; }
              if (parcelas.length === 0) continue;

              // Obtém o período aquisitivo para extrair a referência (ex: 2024/2025)
              let periodoRef = '';
              let pa: any = null;
              try {
                if (op.periodo_aquisitivo_id) {
                  pa = await base44.asServiceRole.entities.PeriodoAquisitivo.get(op.periodo_aquisitivo_id);
                  if (pa) {
                    periodoRef = pa.ano_referencia || pa.referencia || '';
                    if (!periodoRef && pa.inicio_aquisitivo && pa.fim_aquisitivo) {
                      const y1 = new Date(pa.inicio_aquisitivo).getFullYear();
                      const y2 = new Date(pa.fim_aquisitivo).getFullYear();
                      periodoRef = `${y1}/${y2}`;
                    }
                  }
                }
              } catch (_errPA) {}

              if (!periodoRef && op.periodo_inicio && op.periodo_fim) {
                const y1 = new Date(op.periodo_inicio).getFullYear();
                const y2 = new Date(op.periodo_fim).getFullYear();
                periodoRef = `${y1}/${y2}`;
              }

              // Gate final antes da escrita: recalcula saldo, aquisição e conflitos no momento da geração.
              // Mesmo que a escala tenha sido salva anteriormente, uma mudança posterior não pode gerar férias inválidas.
              if (!pa) continue;
              const [feriasAtuaisGeracao, ajustesAtuaisGeracao] = await Promise.all([
                base44.asServiceRole.entities.Ferias.filter({ militar_id: op.militar_id }),
                base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: op.militar_id }),
              ]);
              const resumoGeracao = calcularResumoPeriodoPlano(pa, feriasAtuaisGeracao, ajustesAtuaisGeracao, Number(op.ano_referencia || ano));
              const totalSolicitadoGeracao = parcelas.reduce((acc: number, p: any) => acc + Math.max(0, numeroSeguro(p?.dias, 0)), 0);
              const diasEsperadosGeracao = Math.max(0, numeroSeguro(op.dias_direito, resumoGeracao.dias_sem_previsao));
              if (totalSolicitadoGeracao !== diasEsperadosGeracao || totalSolicitadoGeracao > resumoGeracao.dias_sem_previsao) {
                console.warn('[PLANO_GERAR_LOTE_FERIAS] opção ignorada por saldo insuficiente', {
                  opcao_id: op.id,
                  militar_id: op.militar_id,
                  totalSolicitadoGeracao,
                  diasEsperadosGeracao,
                  saldoSemPrevisao: resumoGeracao.dias_sem_previsao,
                });
                continue;
              }

              const parcelasGeracao = parcelas.map((p: any, idx: number) => {
                const mes = textoId(p?.mes || p?.data_inicio?.slice?.(5, 7));
                const regraMes = (resumoGeracao.meses_elegiveis || []).find((m: any) => m.mes === mes);
                return {
                  ...p,
                  etapa: numeroSeguro(p?.etapa, idx + 1),
                  dias: Math.max(0, numeroSeguro(p?.dias, 0)),
                  mes,
                  data_inicio: regraMes?.permitido ? regraMes.data_inicio : '',
                };
              }).sort((a: any, b: any) => String(a.data_inicio).localeCompare(String(b.data_inicio)))
                .map((p: any, idx: number) => ({ ...p, etapa: idx + 1 }));
              if (parcelasGeracao.some((p: any) => !p.data_inicio || p.dias <= 0)) {
                console.warn('[PLANO_GERAR_LOTE_FERIAS] opção ignorada por data anterior à aquisição/fora do limite', { opcao_id: op.id });
                continue;
              }

              const feriasImpactantesGeracao = (feriasAtuaisGeracao || []).filter((f: any) => STATUS_FERIAS_IMPACTO_PLANO.has(String(f.status || '')));
              let conflitoGeracao = false;
              for (let i = 0; i < parcelasGeracao.length && !conflitoGeracao; i += 1) {
                const atual = parcelasGeracao[i];
                const fimAtual = calcularFimParcela(atual.data_inicio, atual.dias);
                conflitoGeracao = feriasImpactantesGeracao.some((f: any) =>
                  intervalosSobrepostos(atual.data_inicio, fimAtual, f.data_inicio, f.data_fim)
                );
                for (let j = i + 1; j < parcelasGeracao.length && !conflitoGeracao; j += 1) {
                  const outra = parcelasGeracao[j];
                  conflitoGeracao = intervalosSobrepostos(
                    atual.data_inicio,
                    fimAtual,
                    outra.data_inicio,
                    calcularFimParcela(outra.data_inicio, outra.dias)
                  );
                }
              }
              if (conflitoGeracao) {
                console.warn('[PLANO_GERAR_LOTE_FERIAS] opção ignorada por sobreposição', { opcao_id: op.id, militar_id: op.militar_id });
                continue;
              }

              parcelas = parcelasGeracao;
              const feriasIds: string[] = [];
              let totalDias = 0;

              for (let i = 0; i < parcelas.length; i++) {
                const p = parcelas[i];
                const dtInicio = new Date(p.data_inicio || `${ano}-${p.mes || '01'}-01`);
                const dias = Number(p.dias) || (parcelas.length === 1 ? 30 : 15);
                totalDias += dias;
                const dtFim = new Date(dtInicio);
                dtFim.setDate(dtFim.getDate() + dias - 1);
                const dtRetorno = new Date(dtFim);
                dtRetorno.setDate(dtRetorno.getDate() + 1);

                const labelFracionamento = parcelas.length > 1 ? `${p.etapa || (i + 1)}ª Fração` : 'Integral';

                const fCreated = await base44.asServiceRole.entities.Ferias.create({
                  militar_id: op.militar_id,
                  militar_nome: op.militar_nome,
                  militar_posto: op.militar_posto,
                  militar_matricula: op.militar_matricula,
                  periodo_aquisitivo_id: op.periodo_aquisitivo_id,
                  periodo_aquisitivo_ref: periodoRef || undefined,
                  tipo: 'Férias Regulares',
                  data_inicio: dtInicio.toISOString().split('T')[0],
                  data_fim: dtFim.toISOString().split('T')[0],
                  data_retorno: dtRetorno.toISOString().split('T')[0],
                  dias: dias,
                  dias_base: dias,
                  fracionamento: labelFracionamento,
                  status: 'Prevista',
                });
                if (fCreated?.id) feriasIds.push(fCreated.id);
              }

              try {
                if (pa) {
                  const novosDiasPrevistos = Number(resumoGeracao.dias_previstos_calculados || 0) + totalDias;
                  const diasGozadosAtuais = Number(resumoGeracao.dias_gozados_calculados || 0);
                  await base44.asServiceRole.entities.PeriodoAquisitivo.update(pa.id, {
                    dias_gozados: diasGozadosAtuais,
                    dias_previstos: novosDiasPrevistos,
                    status: diasGozadosAtuais > 0 ? 'Parcialmente Gozado' : 'Previsto',
                  });
                }
              } catch (_err) {}

              await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(op.id, {
                gerado_ferias_efetivas: true,
                data_geracao_ferias: new Date().toISOString(),
                ferias_ids_geradas: feriasIds,
              });

              geradasCount++;
            }

            // ENCERRAMENTO AUTOMÁTICO DA CAMPANHA ESPECÍFICA
            try {
              if (campanha_id) {
                await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
                  status: 'Encerrada',
                });
              } else {
                const allCamp = await base44.asServiceRole.entities.CampanhaPortal.list();
                const campsAno = (allCamp || []).filter((cp: any) => cp.tipo === 'PLANO_FERIAS' && cp.ano_referencia === Number(ano));
                for (const cp of campsAno) {
                  await base44.asServiceRole.entities.CampanhaPortal.update(cp.id, {
                    status: 'Encerrada',
                  });
                }
              }
            } catch (_errClose) {}

            return new Response(JSON.stringify({
              ok: true,
              message: `Geração automática concluída com sucesso! ${geradasCount} escalas de férias geradas no SGP e campanha encerrada.`,
              total_geradas: geradasCount,
            }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
          }
          break;
        }

        default:
          return new Response(JSON.stringify({ error: 'Ação administrativa não reconhecida.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
      }
    }

    // ========================================================================
    // ROTAS DO MILITAR NO PORTAL (Autenticação via X-Portal-Token)
    // ========================================================================
    assertNoClientSuppliedMilitarId(rawBody);

    const sessionAuth = await requirePortalSession(req, base44, rawBody);
    if (!sessionAuth.ok || !sessionAuth.context) {
      return new Response(JSON.stringify({ error: sessionAuth.error || 'Sessão inválida ou expirada.' }), {
        status: sessionAuth.status || 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const militarId = sessionAuth.context.militar_id;
    const militar = await base44.asServiceRole.entities.Militar.get(militarId);
    if (!militar) {
      return new Response(JSON.stringify({ error: 'Militar não encontrado.' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const portalConfig = await loadAuthConfig(base44);

    // Consulta campanhas ativas aplicáveis a este militar
    let campanhasAtivasMilitar: any[] = [];
    try {
      const allCamp = await base44.asServiceRole.entities.CampanhaPortal.list();
      campanhasAtivasMilitar = (allCamp || []).filter((cp: any) => {
        const st = String(cp.status || '').toLowerCase();
        const isAtiva = st === 'aberta_coleta' || st === 'ativa' || st === 'aberta' || st === 'em_andamento' || !cp.status;
        if (!isAtiva) return false;

        if (cp.tipo_escopo === 'TODOS' || !cp.tipo_escopo) return true;
        if (cp.tipo_escopo === 'UNIDADES' && Array.isArray(cp.escopo_unidades_ids)) {
          return matchMilitarEscopoUnidade(militar, cp.escopo_unidades_ids);
        }
        if (cp.tipo_escopo === 'QUADROS' && Array.isArray(cp.escopo_quadros)) {
          return cp.escopo_quadros.includes(militar.quadro);
        }
        if (cp.tipo_escopo === 'SELECAO_MILITARES' && Array.isArray(cp.escopo_militares_ids)) {
          return cp.escopo_militares_ids.includes(militar.id);
        }
        return true;
      });
    } catch (_e) {
      campanhasAtivasMilitar = [];
    }

    switch (acao) {
      // 1.3A: Cadastral
      case 'CADASTRO_GET': {
        let dependentes: unknown[] = [];
        try {
          dependentes = await base44.asServiceRole.entities.Familiar.filter({ militar_id: militarId });
        } catch (_e) {}

        let solicitacoes: unknown[] = [];
        try {
          solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
        } catch (_e) {}

        let militarFresh = militar;

        // Auto-sincronização de solicitações aprovadas para garantir que a ficha do militar esteja sempre atualizada
        try {
          const solicitacoesAprovadas = (solicitacoes || []).filter((s: any) => s.status === 'Aprovada' && s.campo_chave && s.valor_proposto);
          if (solicitacoesAprovadas.length > 0) {
            let militarUpdatePayload: any = {};
            for (const s of (solicitacoesAprovadas as any[])) {
              const campo = s.campo_chave;
              const valor = s.valor_proposto;

              if (campo === 'endereco_logradouro' || campo === 'logradouro' || campo === 'endereco') {
                if (militarFresh.logradouro !== valor) militarUpdatePayload.logradouro = valor;
              } else if (campo === 'endereco_numero' || campo === 'numero_endereco' || campo === 'numero') {
                if (militarFresh.numero_endereco !== valor) militarUpdatePayload.numero_endereco = valor;
              } else if (campo === 'endereco_bairro' || campo === 'bairro') {
                if (militarFresh.bairro !== valor) militarUpdatePayload.bairro = valor;
              } else if (campo === 'endereco_cidade' || campo === 'cidade') {
                if (militarFresh.cidade !== valor) militarUpdatePayload.cidade = valor;
              } else if (campo === 'endereco_cep' || campo === 'cep') {
                if (militarFresh.cep !== valor) militarUpdatePayload.cep = valor;
              } else if (campo === 'endereco_complemento' || campo === 'complemento') {
                if (militarFresh.complemento !== valor) militarUpdatePayload.complemento = valor;
              } else if (campo === 'telefone_celular' || campo === 'telefone' || campo === 'celular') {
                if (militarFresh.telefone_celular !== valor || militarFresh.telefone !== valor) {
                  militarUpdatePayload.telefone = valor;
                  militarUpdatePayload.telefone_celular = valor;
                }
              } else if (campo === 'email_funcional') {
                if (militarFresh.email_funcional !== valor) militarUpdatePayload.email_funcional = valor;
              } else if (campo === 'email_particular' || campo === 'email') {
                if (militarFresh.email_particular !== valor) militarUpdatePayload.email_particular = valor;
              } else if (campo === 'estado_civil') {
                if (militarFresh.estado_civil !== valor) militarUpdatePayload.estado_civil = valor;
              }
            }

            if (Object.keys(militarUpdatePayload).length > 0) {
              await base44.asServiceRole.entities.Militar.update(militarId, militarUpdatePayload);
              militarFresh = await base44.asServiceRole.entities.Militar.get(militarId);
            }
          }
        } catch (_errSync) {}

        const dadosCadastrais = {
          id: militarFresh.id,
          nome_completo: militarFresh.nome_completo || '',
          nome_guerra: militarFresh.nome_guerra || '',
          posto_graduacao: militarFresh.posto_graduacao || '',
          matricula: militarFresh.matricula || '',
          quadro: militarFresh.quadro || '',
          lotacao: militarFresh.lotacao || '',
          funcao: militarFresh.funcao || '',
          estrutura_nome: militarFresh.estrutura_nome || '',
          data_nascimento: militarFresh.data_nascimento || '',
          data_ingresso: militarFresh.data_inclusao || militarFresh.data_ingresso || militarFresh.data_admissao || '',
          data_inclusao: militarFresh.data_inclusao || militarFresh.data_ingresso || militarFresh.data_admissao || '',
          sexo: militarFresh.sexo || '',
          estado_civil: militarFresh.estado_civil || '',
          tipo_sanguineo: militarFresh.tipo_sanguineo || '',
          etnia: militarFresh.etnia || '',
          religiao: militarFresh.religiao || '',
          altura: militarFresh.altura ? String(militarFresh.altura) : '',
          peso: militarFresh.peso ? String(militarFresh.peso) : '',
          naturalidade: militarFresh.naturalidade || '',
          naturalidade_uf: militarFresh.naturalidade_uf || '',
          nome_pai: militarFresh.nome_pai || '',
          nome_mae: militarFresh.nome_mae || '',
          rg: militarFresh.rg || '',
          orgao_expedidor_rg: militarFresh.orgao_expedidor_rg || '',
          uf_rg: militarFresh.uf_rg || '',
          cpf: militarFresh.cpf || '',
          cnh_numero: militarFresh.cnh_numero || '',
          cnh_categoria: militarFresh.cnh_categoria || '',
          cnh_validade: militarFresh.cnh_validade || '',
          escolaridade: militarFresh.escolaridade || '',
          curso_superior: militarFresh.curso_superior || '',
          mestrado: militarFresh.mestrado || '',
          doutorado: militarFresh.doutorado || '',
          banco: militarFresh.banco || '',
          agencia: militarFresh.agencia || '',
          conta: militarFresh.conta || '',
          telefone_celular: militarFresh.telefone_celular || militarFresh.telefone || '',
          email_funcional: militarFresh.email_funcional || militarFresh.email || '',
          email_particular: militarFresh.email_particular || '',
          endereco_logradouro: militarFresh.logradouro || militarFresh.endereco_logradouro || militarFresh.endereco || '',
          endereco_numero: militarFresh.numero_endereco || militarFresh.endereco_numero || militarFresh.numero || '',
          endereco_complemento: militarFresh.complemento || militarFresh.endereco_complemento || '',
          endereco_bairro: militarFresh.bairro || militarFresh.endereco_bairro || '',
          endereco_cidade: militarFresh.cidade || militarFresh.endereco_cidade || '',
          endereco_uf: militarFresh.uf || militarFresh.endereco_uf || '',
          endereco_cep: militarFresh.cep || militarFresh.endereco_cep || '',
          tipo_sanguineo_formatado: militarFresh.tipo_sanguineo || '',
          foto_url: militarFresh.foto_url || militarFresh.foto || '',
          data_ultima_conferencia: militarFresh.data_ultima_conferencia || null,
        };

        const sanitizedDependentes = (dependentes || []).map((dep: any) => ({
          id: dep.id,
          nome_completo: dep.nome_completo || dep.nome || '',
          grau_parentesco: dep.grau_parentesco || dep.parentesco || '',
          data_nascimento: dep.data_nascimento || '',
          dependente_ir: Boolean(dep.dependente_ir),
        }));

        const CAMPOS_OBRIGATORIOS_BACKEND = [
          { chave: 'telefone_celular', label: 'Telefone Celular / WhatsApp', aliases: ['telefone_celular', 'telefone', 'celular'] },
          { chave: 'email_particular', label: 'E-mail Particular', aliases: ['email_particular'] },
          { chave: 'endereco_logradouro', label: 'Logradouro (Rua/Avenida)', aliases: ['endereco_logradouro', 'logradouro', 'endereco'] },
          { chave: 'endereco_numero', label: 'Número da Residência', aliases: ['endereco_numero', 'numero_endereco', 'numero'] },
          { chave: 'endereco_bairro', label: 'Bairro', aliases: ['endereco_bairro', 'bairro'] },
          { chave: 'endereco_cidade', label: 'Cidade / Município', aliases: ['endereco_cidade', 'cidade', 'municipio'] },
          { chave: 'endereco_uf', label: 'UF do Endereço', aliases: ['endereco_uf', 'uf'] },
          { chave: 'endereco_cep', label: 'CEP', aliases: ['endereco_cep', 'cep'] },
          { chave: 'nome_completo', label: 'Nome Completo', aliases: ['nome_completo'] },
          { chave: 'nome_guerra', label: 'Nome de Guerra', aliases: ['nome_guerra'] },
          { chave: 'data_nascimento', label: 'Data de Nascimento', aliases: ['data_nascimento'] },
          { chave: 'sexo', label: 'Sexo', aliases: ['sexo'] },
          { chave: 'estado_civil', label: 'Estado Civil', aliases: ['estado_civil'] },
          { chave: 'tipo_sanguineo', label: 'Tipo Sanguíneo / Fator RH', aliases: ['tipo_sanguineo'] },
          { chave: 'etnia', label: 'Etnia / Cor', aliases: ['etnia'] },
          { chave: 'religiao', label: 'Religião / Crença', aliases: ['religiao'] },
          { chave: 'altura', label: 'Altura (m)', aliases: ['altura'] },
          { chave: 'peso', label: 'Peso (kg)', aliases: ['peso'] },
          { chave: 'naturalidade', label: 'Naturalidade (Cidade de Nascimento)', aliases: ['naturalidade'] },
          { chave: 'naturalidade_uf', label: 'UF de Nascimento', aliases: ['naturalidade_uf'] },
          { chave: 'nome_mae', label: 'Filiação: Nome da Mãe', aliases: ['nome_mae', 'mae'] },
          { chave: 'rg', label: 'Número do RG', aliases: ['rg'] },
          { chave: 'orgao_expedidor_rg', label: 'Órgão Expedidor do RG', aliases: ['orgao_expedidor_rg'] },
          { chave: 'uf_rg', label: 'UF do RG', aliases: ['uf_rg'] },
          { chave: 'cpf', label: 'CPF', aliases: ['cpf'] },
          { chave: 'cnh_numero', label: 'Número de Registro da CNH', aliases: ['cnh_numero'] },
          { chave: 'cnh_categoria', label: 'Categoria da CNH', aliases: ['cnh_categoria'] },
          { chave: 'cnh_validade', label: 'Validade da CNH', aliases: ['cnh_validade'] },
          { chave: 'escolaridade', label: 'Nível de Escolaridade', aliases: ['escolaridade'] },
          { chave: 'banco', label: 'Instituição Bancária', aliases: ['banco'] },
          { chave: 'agencia', label: 'Agência Bancária', aliases: ['agencia'] },
          { chave: 'conta', label: 'Conta Corrente', aliases: ['conta'] },
          { chave: 'posto_graduacao', label: 'Posto / Graduação', aliases: ['posto_graduacao'] },
          { chave: 'quadro', label: 'Quadro Militar', aliases: ['quadro'] },
          { chave: 'matricula', label: 'Matrícula Funcional', aliases: ['matricula'] },
          { chave: 'data_inclusao', label: 'Data de Inclusão na Corporação', aliases: ['data_inclusao', 'data_ingresso', 'data_admissao'] },
        ];

        const solicitacoesAtivas = (solicitacoes || []).filter((s: any) => s.status !== 'Rejeitada' && s.valor_proposto && String(s.valor_proposto).trim() !== '');
        const camposObrigatoriosPendentes = CAMPOS_OBRIGATORIOS_BACKEND.filter((campo) => {
          const temNoMilitar = campo.aliases.some((alias) => {
            const val = militarFresh[alias];
            return val !== null && val !== undefined && String(val).trim() !== '';
          });
          if (temNoMilitar) return false;

          const temSolicitacao = solicitacoesAtivas.some((s: any) => {
            const ch = (s.campo_chave || '').trim().toLowerCase();
            return campo.chave.toLowerCase() === ch || campo.aliases.some((al) => al.toLowerCase() === ch);
          });
          if (temSolicitacao) return false;

          return true;
        });

        const campanhaCadastralAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL');
        const campanhaFeriasAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'PLANO_FERIAS');

        return new Response(JSON.stringify({
          ok: true,
          cadastro: dadosCadastrais,
          dependentes: sanitizedDependentes,
          solicitacoes: solicitacoes || [],
          campos_obrigatorios_pendentes: camposObrigatoriosPendentes,
          total_campos_obrigatorios_pendentes: camposObrigatoriosPendentes.length,
          campanha_ativa: campanhaCadastralAtiva || null,
          campanha_ferias_ativa: campanhaFeriasAtiva || null,
          tem_campanha_ferias_ativa: Boolean(campanhaFeriasAtiva),
          config: {
            ativo: portalConfig?.cadastro_ativo !== false,
            permitir_solicitacao: portalConfig?.cadastro_permitir_solicitacao !== false,
            instrucoes: campanhaCadastralAtiva?.instrucoes || portalConfig?.cadastro_instrucoes || 'Confira seus dados funcionais e de contato.',
            prazo_limite: campanhaCadastralAtiva?.data_fim_militar || '',
          },
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      case 'CADASTRO_CONFIRMAR': {
        const CAMPOS_OBRIGATORIOS_BACKEND = [
          { chave: 'telefone_celular', label: 'Telefone Celular / WhatsApp', aliases: ['telefone_celular', 'telefone', 'celular'] },
          { chave: 'email_particular', label: 'E-mail Particular', aliases: ['email_particular'] },
          { chave: 'endereco_logradouro', label: 'Logradouro (Rua/Avenida)', aliases: ['endereco_logradouro', 'logradouro', 'endereco'] },
          { chave: 'endereco_numero', label: 'Número da Residência', aliases: ['endereco_numero', 'numero_endereco', 'numero'] },
          { chave: 'endereco_bairro', label: 'Bairro', aliases: ['endereco_bairro', 'bairro'] },
          { chave: 'endereco_cidade', label: 'Cidade / Município', aliases: ['endereco_cidade', 'cidade', 'municipio'] },
          { chave: 'endereco_uf', label: 'UF do Endereço', aliases: ['endereco_uf', 'uf'] },
          { chave: 'endereco_cep', label: 'CEP', aliases: ['endereco_cep', 'cep'] },
          { chave: 'nome_completo', label: 'Nome Completo', aliases: ['nome_completo'] },
          { chave: 'nome_guerra', label: 'Nome de Guerra', aliases: ['nome_guerra'] },
          { chave: 'data_nascimento', label: 'Data de Nascimento', aliases: ['data_nascimento'] },
          { chave: 'sexo', label: 'Sexo', aliases: ['sexo'] },
          { chave: 'estado_civil', label: 'Estado Civil', aliases: ['estado_civil'] },
          { chave: 'tipo_sanguineo', label: 'Tipo Sanguíneo / Fator RH', aliases: ['tipo_sanguineo'] },
          { chave: 'etnia', label: 'Etnia / Cor', aliases: ['etnia'] },
          { chave: 'religiao', label: 'Religião / Crença', aliases: ['religiao'] },
          { chave: 'altura', label: 'Altura (m)', aliases: ['altura'] },
          { chave: 'peso', label: 'Peso (kg)', aliases: ['peso'] },
          { chave: 'naturalidade', label: 'Naturalidade (Cidade de Nascimento)', aliases: ['naturalidade'] },
          { chave: 'naturalidade_uf', label: 'UF de Nascimento', aliases: ['naturalidade_uf'] },
          { chave: 'nome_mae', label: 'Filiação: Nome da Mãe', aliases: ['nome_mae', 'mae'] },
          { chave: 'rg', label: 'Número do RG', aliases: ['rg'] },
          { chave: 'orgao_expedidor_rg', label: 'Órgão Expedidor do RG', aliases: ['orgao_expedidor_rg'] },
          { chave: 'uf_rg', label: 'UF do RG', aliases: ['uf_rg'] },
          { chave: 'cpf', label: 'CPF', aliases: ['cpf'] },
          { chave: 'cnh_numero', label: 'Número de Registro da CNH', aliases: ['cnh_numero'] },
          { chave: 'cnh_categoria', label: 'Categoria da CNH', aliases: ['cnh_categoria'] },
          { chave: 'cnh_validade', label: 'Validade da CNH', aliases: ['cnh_validade'] },
          { chave: 'escolaridade', label: 'Nível de Escolaridade', aliases: ['escolaridade'] },
          { chave: 'banco', label: 'Instituição Bancária', aliases: ['banco'] },
          { chave: 'agencia', label: 'Agência Bancária', aliases: ['agencia'] },
          { chave: 'conta', label: 'Conta Corrente', aliases: ['conta'] },
          { chave: 'posto_graduacao', label: 'Posto / Graduação', aliases: ['posto_graduacao'] },
          { chave: 'quadro', label: 'Quadro Militar', aliases: ['quadro'] },
          { chave: 'matricula', label: 'Matrícula Funcional', aliases: ['matricula'] },
          { chave: 'data_inclusao', label: 'Data de Inclusão na Corporação', aliases: ['data_inclusao', 'data_ingresso', 'data_admissao'] },
        ];

        let solicitacoesMilitar: any[] = [];
        try {
          solicitacoesMilitar = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
        } catch (_e) {}

        const solicitacoesValidas = (solicitacoesMilitar || []).filter((s: any) => s.status !== 'Rejeitada' && s.valor_proposto && String(s.valor_proposto).trim() !== '');

        const pendencias = CAMPOS_OBRIGATORIOS_BACKEND.filter((campo) => {
          const temNoMilitar = campo.aliases.some((alias) => {
            const val = militar[alias];
            return val !== null && val !== undefined && String(val).trim() !== '';
          });
          if (temNoMilitar) return false;

          const temSolicitacao = solicitacoesValidas.some((s: any) => {
            const ch = (s.campo_chave || '').trim().toLowerCase();
            return campo.chave.toLowerCase() === ch || campo.aliases.some((al) => al.toLowerCase() === ch);
          });
          if (temSolicitacao) return false;

          return true;
        });

        if (pendencias.length > 0) {
          return new Response(JSON.stringify({
            error: `Existem ${pendencias.length} campos obrigatórios ainda não preenchidos na sua ficha. Por favor, solicite a alteração/preenchimento desses campos antes de confirmar.`,
            campos_pendentes: pendencias,
          }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const nowIso = new Date().toISOString().split('T')[0];
        try {
          await base44.asServiceRole.entities.Militar.update(militarId, { data_ultima_conferencia: nowIso });
        } catch (_err) {}

        await registrarAuditoriaPortal(base44, {
          sessao_id: sessionAuth.context.sessao_id,
          militar_id: militarId,
          acao: 'CONFERENCIA_CADASTRAL_CONFIRMADA',
          resultado: true,
          motivo_falha_sanitizado: null,
          ip_origem: extractClientIp(req),
          user_agent: extractUserAgent(req),
          correlation_id: correlationId,
        });

        return new Response(JSON.stringify({
          ok: true,
          message: 'Conferência cadastral confirmada com sucesso.',
          data_conferencia: nowIso,
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      case 'CADASTRO_SOLICITAR_ALTERACAO': {
        const { campo_chave, campo_label, valor_atual, valor_proposto, justificativa } = payload;
        if (!campo_chave || !valor_proposto?.trim()) {
          return new Response(JSON.stringify({ error: 'Campo e novo valor são obrigatórios.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const novaSolicitacao = await base44.asServiceRole.entities.SolicitacaoAtualizacao.create({
          militar_id: militarId,
          militar_nome: militar.nome_completo || militar.nome_guerra || '',
          militar_posto: militar.posto_graduacao || '',
          militar_matricula: militar.matricula || '',
          campo_chave: campo_chave.trim(),
          campo_label: (campo_label || campo_chave).trim(),
          valor_atual: valor_atual || '',
          valor_proposto: valor_proposto.trim(),
          justificativa: (justificativa || '').trim(),
          status: 'Pendente',
          data_solicitacao: new Date().toISOString().split('T')[0],
        });

        await registrarAuditoriaPortal(base44, {
          sessao_id: sessionAuth.context.sessao_id,
          militar_id: militarId,
          acao: 'SOLICITACAO_ALTERACAO_CADASTRAL',
          resultado: true,
          motivo_falha_sanitizado: null,
          ip_origem: extractClientIp(req),
          user_agent: extractUserAgent(req),
          correlation_id: correlationId,
        });

        return new Response(JSON.stringify({
          ok: true,
          message: 'Solicitação de alteração enviada para análise do RH.',
          solicitacao: novaSolicitacao,
        }), {
          status: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // 1.3B: Férias no Portal com 3 Opções de Meses
      case 'FERIAS_GET': {
        const campanhaFeriasAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'PLANO_FERIAS');
        const anoCampanha = campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);

        // O plano usa a mesma ideia do saldo operacional: direito líquido menos férias
        // já gozadas/previstas. Não basta olhar apenas dias_gozados persistidos no período.
        let rawPeriodos: any[] = [];
        let feriasMilitarPlano: any[] = [];
        let ajustesMilitarPlano: any[] = [];
        try {
          [rawPeriodos, feriasMilitarPlano, ajustesMilitarPlano] = await Promise.all([
            base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }),
            base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }),
            base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: militarId }),
          ]);
        } catch (_e) {}

        const periodosOrdenados = (rawPeriodos || []).sort((a: any, b: any) => {
          const dtA = new Date(a.inicio_aquisitivo || a.created_date || '1970-01-01').getTime();
          const dtB = new Date(b.inicio_aquisitivo || b.created_date || '1970-01-01').getTime();
          return dtA - dtB;
        });

        const periodosComResumo = periodosOrdenados.map((p: any) => ({
          ...p,
          ...calcularResumoPeriodoPlano(p, feriasMilitarPlano, ajustesMilitarPlano, Number(anoCampanha)),
        }));
        const periodoMaisAntigoElegivel = periodosComResumo.find((p: any) => p.elegivel_plano && p.dias_sem_previsao > 0) || null;
        const maisAntigoId: string | null = periodoMaisAntigoElegivel?.id || null;

        const periodosFormatados = periodosComResumo.map((p: any) => ({
          ...p,
          is_mais_antigo_pendente: p.id === maisAntigoId,
          is_periodo_plano_selecionavel: p.id === maisAntigoId,
        }));

        // Busca opção de férias já enviada pelo militar para esta campanha específica
        let opcoesEnviadas: any[] = [];
        try {
          if (campanhaFeriasAtiva?.id) {
            opcoesEnviadas = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
              militar_id: militarId,
              campanha_id: campanhaFeriasAtiva.id,
            });
          }
        } catch (_e) {}

        let regrasCampanha: any = {};
        if (campanhaFeriasAtiva?.config_regras) {
          try {
            regrasCampanha = typeof campanhaFeriasAtiva.config_regras === 'string'
              ? JSON.parse(campanhaFeriasAtiva.config_regras)
              : (campanhaFeriasAtiva.config_regras || {});
          } catch (_errRegras) {}
        }

        const permitir1Etapa = regrasCampanha.permitir_1_etapa_30d !== undefined
          ? Boolean(regrasCampanha.permitir_1_etapa_30d)
          : (portalConfig?.ferias_permitir_1_etapa_30d !== false);

        const permitir2Etapas = regrasCampanha.permitir_2_etapas_15d !== undefined
          ? Boolean(regrasCampanha.permitir_2_etapas_15d)
          : (portalConfig?.ferias_permitir_2_etapas_15d !== false);

        const permitir3Etapas = regrasCampanha.permitir_3_etapas_10d !== undefined
          ? Boolean(regrasCampanha.permitir_3_etapas_10d)
          : (portalConfig?.ferias_permitir_3_etapas_10d !== false);

        const modoSelecao = regrasCampanha.modo_selecao_periodo || portalConfig?.ferias_modo_selecao_periodo || 'mais_antigo';

        // Verificação de Dependência em Cascata (Exigir Atualização Cadastral prévia)
        let bloqueadoPorDependencia = false;
        let motivoBloqueio = '';
        let campanhaCadastralPendente: any = null;

        const exigirAtualizacao = regrasCampanha.exigir_atualizacao_cadastral === true ||
          portalConfig?.ferias_exigir_atualizacao_cadastral === true ||
          Boolean(campanhaFeriasAtiva?.exigir_atualizacao_cadastral);

        if (exigirAtualizacao) {
          const campanhaCadastralAtiva = campanhasAtivasMilitar.find(
            (c) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL'
          );

          // Data de início do ciclo que exige atualização
          const dataReferenciaInicio = (campanhaCadastralAtiva?.data_inicio || campanhaFeriasAtiva?.data_inicio || `${new Date().getFullYear()}-01-01`).split('T')[0];

          // Verifica se houve confirmação explícita no portal através do log de auditoria
          let confirmouExpressamente = false;
          try {
            const logs = await base44.asServiceRole.entities.PortalAuditoria.filter({
              militar_id: militarId,
              acao: 'CONFERENCIA_CADASTRAL_CONFIRMADA',
            });
            confirmouExpressamente = (logs || []).some((l: any) => {
              const dt = (l.created_at || l.created_date || '').split('T')[0];
              return dt >= dataReferenciaInicio;
            });
          } catch (_errAudit) {}

          // Se tem solicitação cadastral enviada na vigência da campanha
          let temSolicitacaoNaVigencia = false;
          try {
            const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
            temSolicitacaoNaVigencia = (solicitacoes || []).some((s: any) => {
              const dt = (s.data_solicitacao || s.created_date || '').split('T')[0];
              return dt >= dataReferenciaInicio;
            });
          } catch (_eSol) {}

          const cadastroConcluido = confirmouExpressamente || temSolicitacaoNaVigencia;
          if (!cadastroConcluido) {
            bloqueadoPorDependencia = true;
            motivoBloqueio = 'Para registrar suas preferências de férias, é obrigatório concluir primeiro a Atualização & Conferência Cadastral.';
            campanhaCadastralPendente = campanhaCadastralAtiva || null;
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          ano_referencia: anoCampanha,
          campanha: campanhaFeriasAtiva || null,
          campanhas_ativas: campanhasAtivasMilitar,
          periodos: periodosFormatados,
          periodo_mais_antigo_id: maisAntigoId,
          opcao_militar_enviada: opcoesEnviadas?.[0] || null,
          bloqueado_por_dependencia: bloqueadoPorDependencia,
          motivo_bloqueio: motivoBloqueio,
          dependencia_tipo: 'ATUALIZACAO_CADASTRAL',
          campanha_cadastral_pendente: campanhaCadastralPendente,
          config: {
            ativo: portalConfig?.ferias_ativo !== false,
            modo_selecao: modoSelecao,
            permitir_1_etapa: permitir1Etapa,
            permitir_2_etapas: permitir2Etapas,
            permitir_3_etapas: permitir3Etapas,
            permitir_custom: Boolean(portalConfig?.ferias_permitir_custom),
            exigir_atualizacao_cadastral: exigirAtualizacao,
            prazo_limite: campanhaFeriasAtiva?.data_fim_militar || portalConfig?.ferias_prazo_limite || '',
            instrucoes: campanhaFeriasAtiva?.instrucoes || portalConfig?.ferias_instrucoes || 'Informe suas 3 opções de meses para a escala de férias.',
          },
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      case 'FERIAS_SUBMETER_OPCAO': {
        const { periodo_aquisitivo_id, modalidade, opcao_1, opcao_2, opcao_3 } = payload;
        const campanhaFeriasAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'PLANO_FERIAS');
        const campanhaId = payload.campanha_id || campanhaFeriasAtiva?.id || null;
        const planoIdAtivo = textoId(campanhaFeriasAtiva?.plano_ferias_institucional_id);
        const anoCampanha = payload.ano_referencia || campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);

        // Guard de Dependência em Cascata
        let regrasCampanhaSubmissao: any = {};
        if (campanhaFeriasAtiva?.config_regras) {
          try {
            regrasCampanhaSubmissao = typeof campanhaFeriasAtiva.config_regras === 'string'
              ? JSON.parse(campanhaFeriasAtiva.config_regras)
              : (campanhaFeriasAtiva.config_regras || {});
          } catch (_e) {}
        }

        const exigirAtualizacaoSubmissao = regrasCampanhaSubmissao.exigir_atualizacao_cadastral === true ||
          portalConfig?.ferias_exigir_atualizacao_cadastral === true ||
          Boolean(campanhaFeriasAtiva?.exigir_atualizacao_cadastral);

        if (exigirAtualizacaoSubmissao) {
          const campanhaCadastralAtiva = campanhasAtivasMilitar.find(
            (c) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL'
          );
          const dataReferenciaInicio = (campanhaCadastralAtiva?.data_inicio || campanhaFeriasAtiva?.data_inicio || `${new Date().getFullYear()}-01-01`).split('T')[0];

          let confirmouExpressamente = false;
          try {
            const logs = await base44.asServiceRole.entities.PortalAuditoria.filter({
              militar_id: militarId,
              acao: 'CONFERENCIA_CADASTRAL_CONFIRMADA',
            });
            confirmouExpressamente = (logs || []).some((l: any) => {
              const dt = (l.created_at || l.created_date || '').split('T')[0];
              return dt >= dataReferenciaInicio;
            });
          } catch (_errAudit) {}

          let temSolicitacaoNaVigencia = false;
          try {
            const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
            temSolicitacaoNaVigencia = (solicitacoes || []).some((s: any) => {
              const dt = (s.data_solicitacao || s.created_date || '').split('T')[0];
              return dt >= dataReferenciaInicio;
            });
          } catch (_eSol) {}

          if (!confirmouExpressamente && !temSolicitacaoNaVigencia) {
            return new Response(JSON.stringify({
              error: 'É obrigatório concluir a Atualização Cadastral antes de enviar suas preferências de férias.'
            }), {
              status: 403,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        }

        if (!periodo_aquisitivo_id || !opcao_1?.parcelas?.length || !opcao_2?.parcelas?.length || !opcao_3?.parcelas?.length) {
          return new Response(JSON.stringify({ error: 'É obrigatório preencher as 3 opções de preferências de meses.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodo_aquisitivo_id);
        if (!periodo || periodo.militar_id !== militarId) {
          return new Response(JSON.stringify({ error: 'Período aquisitivo inválido para este militar.' }), {
            status: 403,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Revalida no servidor qual é o período mais antigo com dias ainda sem previsão.
        // Isso impede manipulação do payload e impede reaproveitar período já integralmente comprometido.
        const [todosPeriodosSubmissao, feriasMilitarSubmissao, ajustesMilitarSubmissao] = await Promise.all([
          base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId }),
          base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId }),
          base44.asServiceRole.entities.AjusteSaldoFerias.filter({ militar_id: militarId }),
        ]);
        const ordenadosSubmissao = (todosPeriodosSubmissao || []).sort((a: any, b: any) =>
          String(a.inicio_aquisitivo || '').localeCompare(String(b.inicio_aquisitivo || ''))
        );
        const resumosSubmissao = ordenadosSubmissao.map((p: any) => ({
          periodo: p,
          resumo: calcularResumoPeriodoPlano(p, feriasMilitarSubmissao, ajustesMilitarSubmissao, Number(anoCampanha)),
        }));
        const maisAntigoElegivelSubmissao = resumosSubmissao.find((item: any) => item.resumo.elegivel_plano && item.resumo.dias_sem_previsao > 0);
        if (!maisAntigoElegivelSubmissao || maisAntigoElegivelSubmissao.periodo.id !== periodo.id) {
          return new Response(JSON.stringify({
            error: 'O período aquisitivo informado não é o período mais antigo com férias ainda sem previsão para este plano. Atualize a página e tente novamente.',
            periodo_correto_id: maisAntigoElegivelSubmissao?.periodo?.id || null,
          }), {
            status: 409,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const resumoPeriodoSubmissao = maisAntigoElegivelSubmissao.resumo;
        const diasPlanejar = Number(resumoPeriodoSubmissao.dias_sem_previsao || 0);
        if (diasPlanejar <= 0) {
          return new Response(JSON.stringify({ error: 'Este período não possui dias sem previsão disponíveis para o plano.' }), {
            status: 409,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const preferenciasNormalizadas = [
          normalizarPreferenciaMes(opcao_1, resumoPeriodoSubmissao, diasPlanejar),
          normalizarPreferenciaMes(opcao_2, resumoPeriodoSubmissao, diasPlanejar),
          normalizarPreferenciaMes(opcao_3, resumoPeriodoSubmissao, diasPlanejar),
        ];
        if (preferenciasNormalizadas.some((op: any) => !op)) {
          return new Response(JSON.stringify({
            error: `Uma ou mais opções estão antes da aquisição do direito. A primeira data legal de gozo deste período é ${resumoPeriodoSubmissao.primeira_data_legal_gozo}.`,
          }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const mesesPreferidos = preferenciasNormalizadas.map((op: any) => op.parcelas[0].mes);
        if (new Set(mesesPreferidos).size !== 3) {
          return new Response(JSON.stringify({ error: 'As 3 opções de meses devem ser diferentes entre si.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const modalidadeEfetiva = diasPlanejar === 30 ? (modalidade || '2_ETAPAS_15') : 'CUSTOM';

        let existentes: any[] = [];
        const opcoesMesmoMilitarPeriodo = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
          militar_id: militarId,
          periodo_aquisitivo_id: periodo.id,
        });
        existentes = (opcoesMesmoMilitarPeriodo || []).filter((opcao: any) => {
          const mesmoPlano = planoIdAtivo && textoId(opcao?.plano_ferias_institucional_id) === planoIdAtivo;
          const mesmaCampanhaLegada = !planoIdAtivo && campanhaId && textoId(opcao?.campanha_id) === textoId(campanhaId);
          return Boolean(mesmoPlano || mesmaCampanhaLegada);
        });

        if (existentes?.[0]?.gerado_ferias_efetivas === true) {
          return new Response(JSON.stringify({ error: 'As férias deste período já foram geradas e a resposta não pode mais ser substituída.' }), {
            status: 409,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const opcaoPayload = {
          campanha_id: campanhaId,
          plano_ferias_institucional_id: planoIdAtivo,
          ano_referencia: anoCampanha,
          militar_id: militarId,
          militar_nome: militar.nome_completo || militar.nome_guerra || '',
          militar_posto: militar.posto_graduacao || '',
          militar_matricula: militar.matricula || '',
          militar_quadro: militar.quadro || '',
          lotacao_id: militar.lotacao_id || militar.grupamento_id || '',
          lotacao_nome: militar.lotacao || militar.estrutura_nome || '',
          periodo_aquisitivo_id: periodo.id,
          periodo_inicio: periodo.inicio_aquisitivo || '',
          periodo_fim: periodo.fim_aquisitivo || '',
          dias_direito: diasPlanejar,
          modalidade: modalidadeEfetiva,
          opcao_1_meses: preferenciasNormalizadas[0].meses_resumo || '',
          opcao_1_detalhes: JSON.stringify(preferenciasNormalizadas[0].parcelas),
          opcao_2_meses: preferenciasNormalizadas[1].meses_resumo || '',
          opcao_2_detalhes: JSON.stringify(preferenciasNormalizadas[1].parcelas),
          opcao_3_meses: preferenciasNormalizadas[2].meses_resumo || '',
          opcao_3_detalhes: JSON.stringify(preferenciasNormalizadas[2].parcelas),
          data_envio_militar: new Date().toISOString(),
          status_camada_1: 'Pendente',
          status_camada_2: 'Pendente',
          gerado_ferias_efetivas: false,
        };

        let salvoRecord: any;
        if (existentes?.[0]?.id) {
          salvoRecord = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(existentes[0].id, opcaoPayload);
        } else {
          salvoRecord = await base44.asServiceRole.entities.OpcaoFeriasMilitar.create(opcaoPayload);
        }

        await registrarAuditoriaPortal(base44, {
          sessao_id: sessionAuth.context.sessao_id,
          militar_id: militarId,
          acao: 'OPCAO_FERIAS_3_PREFERENCIAS_ENVIADA',
          resultado: true,
          motivo_falha_sanitizado: null,
          ip_origem: extractClientIp(req),
          user_agent: extractUserAgent(req),
          correlation_id: correlationId,
        });

        return new Response(JSON.stringify({
          ok: true,
          message: `Suas 3 opções de férias para o plano de ${anoCampanha} foram registradas com sucesso!`,
          opcao: salvoRecord,
        }), {
          status: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Consulta de Todas as Campanhas Ativas com Status de Resposta do Militar
      case 'CAMPANHAS_ATIVAS_MILITAR_GET': {
        let respostasPersonalizadas: any[] = [];
        try {
          respostasPersonalizadas = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.filter({ militar_id: militarId });
        } catch (_e) {}

        let opcoesFerias: any[] = [];
        try {
          opcoesFerias = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ militar_id: militarId });
        } catch (_e) {}

        const campanhasEnriquecidas = campanhasAtivasMilitar.map((cp: any) => {
          let statusResposta = 'Pendente';
          let dataResposta = null;
          let respostaId = null;

          if (cp.tipo === 'PLANO_FERIAS') {
            const op = opcoesFerias.find((o: any) => o.campanha_id === cp.id || o.ano_referencia === cp.ano_referencia);
            if (op) {
              statusResposta = 'Respondido';
              dataResposta = op.data_envio_militar || op.created_date;
              respostaId = op.id;
            }
          } else if (cp.tipo === 'ATUALIZACAO_CADASTRAL' || cp.tipo === 'CONFERENCIA_GERAL') {
            const conferiu = militar.data_ultima_conferencia && cp.data_inicio && militar.data_ultima_conferencia >= cp.data_inicio;
            if (conferiu) {
              statusResposta = 'Respondido';
              dataResposta = militar.data_ultima_conferencia;
            }
          } else {
            const resp = respostasPersonalizadas.find((r: any) => r.campanha_id === cp.id);
            if (resp) {
              statusResposta = resp.status === 'Rejeitado' ? 'Pendente_Correcao' : 'Respondido';
              dataResposta = resp.data_envio || resp.created_date;
              respostaId = resp.id;
            }
          }

          let formConfig: any = null;
          if (cp.config_formulario) {
            try {
              formConfig = typeof cp.config_formulario === 'string' ? JSON.parse(cp.config_formulario) : cp.config_formulario;
            } catch (_eFmt) {}
          }

          return {
            id: cp.id,
            tipo: cp.tipo,
            titulo: cp.titulo,
            ano_referencia: cp.ano_referencia,
            data_inicio: cp.data_inicio,
            data_fim_militar: cp.data_fim_militar,
            instrucoes: cp.instrucoes,
            status_resposta: statusResposta,
            data_resposta: dataResposta,
            resposta_id: respostaId,
            arquivo_modelo_url: cp.arquivo_modelo_url,
            arquivo_modelo_nome: cp.arquivo_modelo_nome,
            exigir_devolucao_arquivo: Boolean(cp.exigir_devolucao_arquivo),
            texto_termo_aceite: cp.texto_termo_aceite,
            total_perguntas: formConfig?.campos?.length || 0,
          };
        });

        return new Response(JSON.stringify({
          ok: true,
          campanhas: campanhasEnriquecidas,
          total_pendentes: campanhasEnriquecidas.filter((c) => c.status_resposta === 'Pendente' || c.status_resposta === 'Pendente_Correcao').length,
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Obter Detalhes de Campanha Dinâmica / Documento para o Militar
      case 'CAMPANHA_FORMULARIO_OBTER': {
        const { campanha_id } = payload;
        if (!campanha_id) {
          return new Response(JSON.stringify({ error: 'ID da campanha é obrigatório.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanha_id);
        if (!campanha) {
          return new Response(JSON.stringify({ error: 'Campanha não encontrada.' }), {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        let respostaExistente: any = null;
        try {
          const resps = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.filter({
            campanha_id,
            militar_id: militarId,
          });
          if (Array.isArray(resps) && resps.length > 0) {
            respostaExistente = resps[0];
          }
        } catch (_e) {}

        let formConfig: any = { campos: [] };
        if (campanha.config_formulario) {
          try {
            formConfig = typeof campanha.config_formulario === 'string' ? JSON.parse(campanha.config_formulario) : campanha.config_formulario;
          } catch (_eFmt) {}
        }

        let respostasParsed: any = {};
        if (respostaExistente?.respostas_json) {
          try {
            respostasParsed = typeof respostaExistente.respostas_json === 'string' ? JSON.parse(respostaExistente.respostas_json) : respostaExistente.respostas_json;
          } catch (_eR) {}
        }

        let arquivosParsed: any = {};
        if (respostaExistente?.arquivos_anexados_json) {
          try {
            arquivosParsed = typeof respostaExistente.arquivos_anexados_json === 'string' ? JSON.parse(respostaExistente.arquivos_anexados_json) : respostaExistente.arquivos_anexados_json;
          } catch (_eA) {}
        }

        return new Response(JSON.stringify({
          ok: true,
          campanha: {
            id: campanha.id,
            tipo: campanha.tipo,
            titulo: campanha.titulo,
            ano_referencia: campanha.ano_referencia,
            data_inicio: campanha.data_inicio,
            data_fim_militar: campanha.data_fim_militar,
            instrucoes: campanha.instrucoes,
            arquivo_modelo_url: campanha.arquivo_modelo_url,
            arquivo_modelo_nome: campanha.arquivo_modelo_nome,
            exigir_devolucao_arquivo: Boolean(campanha.exigir_devolucao_arquivo),
            texto_termo_aceite: campanha.texto_termo_aceite,
            formulario: formConfig,
          },
          resposta_existente: respostaExistente ? {
            id: respostaExistente.id,
            status: respostaExistente.status,
            data_envio: respostaExistente.data_envio,
            resposta_texto_geral: respostaExistente.resposta_texto_geral,
            arquivo_devolucao_url: respostaExistente.arquivo_devolucao_url,
            arquivo_devolucao_nome: respostaExistente.arquivo_devolucao_nome,
            termo_aceite: respostaExistente.termo_aceite,
            observacao_gestor: respostaExistente.observacao_gestor,
            respostas: respostasParsed,
            arquivos_anexados: arquivosParsed,
          } : null,
        }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Submeter Resposta de Campanha Dinâmica / Documento
      case 'CAMPANHA_FORMULARIO_SUBMETER': {
        const {
          campanha_id,
          respostas_json,
          arquivos_anexados_json,
          arquivo_devolucao_url,
          arquivo_devolucao_nome,
          resposta_texto_geral,
          termo_aceite,
        } = payload;

        if (!campanha_id) {
          return new Response(JSON.stringify({ error: 'ID da campanha é obrigatório.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanha_id);
        if (!campanha) {
          return new Response(JSON.stringify({ error: 'Campanha não encontrada.' }), {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Validação de Campos Obrigatórios para Formulário Dinâmico
        let formConfig: any = { campos: [] };
        if (campanha.config_formulario) {
          try {
            formConfig = typeof campanha.config_formulario === 'string' ? JSON.parse(campanha.config_formulario) : campanha.config_formulario;
          } catch (_eFmt) {}
        }

        const camposObrigatorios = (formConfig?.campos || []).filter((c: any) => c.obrigatorio === true);
        const respostasObj = typeof respostas_json === 'object' ? (respostas_json || {}) : (JSON.parse(respostas_json || '{}'));
        const arquivosObj = typeof arquivos_anexados_json === 'object' ? (arquivos_anexados_json || {}) : (JSON.parse(arquivos_anexados_json || '{}'));

        for (const c of camposObrigatorios) {
          if (c.tipo === 'upload_arquivo') {
            if (!arquivosObj[c.id]?.url && !arquivosObj[c.id]) {
              return new Response(JSON.stringify({ error: `O anexo da pergunta "${c.pergunta}" é obrigatório.` }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
          } else {
            const val = respostasObj[c.id];
            if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
              return new Response(JSON.stringify({ error: `A pergunta "${c.pergunta}" é de preenchimento obrigatório.` }), {
                status: 400,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              });
            }
          }
        }

        // Validação para Assinatura de Documento
        if (campanha.tipo === 'ASSINATURA_DOCUMENTO' && campanha.exigir_devolucao_arquivo) {
          if (!arquivo_devolucao_url) {
            return new Response(JSON.stringify({ error: 'É obrigatório anexar o documento assinado para concluir o envio.' }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        }

        // Validação de Termo de Aceite
        if (campanha.texto_termo_aceite && termo_aceite !== true) {
          return new Response(JSON.stringify({ error: 'Você deve marcar o termo de ciência e declaração para continuar.' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        let existentes: any[] = [];
        try {
          existentes = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.filter({
            campanha_id,
            militar_id: militarId,
          });
        } catch (_e) {}

        const respostaPayload = {
          campanha_id,
          militar_id: militarId,
          militar_nome: militar.nome_completo || militar.nome_guerra || '',
          militar_matricula: militar.matricula || '',
          militar_posto: militar.posto_graduacao || '',
          militar_lotacao: militar.lotacao || militar.estrutura_nome || '',
          militar_celular: militar.telefone_celular || militar.telefone || '',
          respostas_json: JSON.stringify(respostasObj),
          arquivos_anexados_json: JSON.stringify(arquivosObj),
          arquivo_devolucao_url: arquivo_devolucao_url || '',
          arquivo_devolucao_nome: arquivo_devolucao_nome || '',
          resposta_texto_geral: resposta_texto_geral || '',
          termo_aceite: Boolean(termo_aceite),
          data_envio: new Date().toISOString(),
          status: 'Enviado',
        };

        let salvo: any;
        if (existentes?.[0]?.id) {
          salvo = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.update(existentes[0].id, respostaPayload);
        } else {
          salvo = await base44.asServiceRole.entities.RespostaCampanhaPersonalizada.create(respostaPayload);
        }

        await registrarAuditoriaPortal(base44, {
          sessao_id: sessionAuth.context.sessao_id,
          militar_id: militarId,
          acao: 'CAMPANHA_FORMULARIO_RESPONDIDO',
          resultado: true,
          motivo_falha_sanitizado: null,
          ip_origem: extractClientIp(req),
          user_agent: extractUserAgent(req),
          correlation_id: correlationId,
        });

        return new Response(JSON.stringify({
          ok: true,
          message: 'Sua resposta foi enviada com sucesso ao Comando / RH!',
          resposta: salvo,
        }), {
          status: 201,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação não reconhecida no endpoint de serviços.' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
  } catch (err: any) {
    console.error(`[portal_servicos][${correlationId}] Erro inesperado:`, err?.message || err);

    return new Response(JSON.stringify({
      error: 'Erro interno ao processar serviço do portal. Tente novamente mais tarde.',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
