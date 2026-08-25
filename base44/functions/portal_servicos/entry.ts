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

interface PortalServicosPayload {
  acao: 'CADASTRO_GET' | 'CADASTRO_CONFIRMAR' | 'CADASTRO_SOLICITAR_ALTERACAO' | 'FERIAS_GET' | 'FERIAS_SUBMETER_OPCAO';
  campo_chave?: string;
  campo_label?: string;
  valor_atual?: string;
  valor_proposto?: string;
  justificativa?: string;
  periodo_aquisitivo_id?: string;
  parcelas?: Array<{
    etapa: number;
    dias: number;
    data_inicio: string;
  }>;
}

export default async function (req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch (_e) {
      return new Response(JSON.stringify({ error: 'Payload JSON inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Defesa em Profundidade contra IDOR
    assertNoClientSuppliedMilitarId(rawBody);

    const base44 = createClientFromRequest(req);

    // Validação e Derivação de Identidade Segura
    const sessionAuth = await requirePortalSession(req, base44, correlationId);
    if (!sessionAuth.ok || !sessionAuth.context) {
      return new Response(JSON.stringify({ error: sessionAuth.error || 'Sessão inválida ou expirada.' }), {
        status: sessionAuth.status || 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const militarId = sessionAuth.context.militar_id;
    const militar = await base44.asServiceRole.entities.Militar.get(militarId);
    if (!militar) {
      return new Response(JSON.stringify({ error: 'Militar não encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Carrega configurações administrativas do Portal
    const portalConfig = await loadAuthConfig(base44);

    const payload = (rawBody || {}) as PortalServicosPayload;
    const acao = payload.acao;

    switch (acao) {
      // ======================================================================
      // 1.3A: CONFERÊNCIA E ATUALIZAÇÃO CADASTRAL
      // ======================================================================
      case 'CADASTRO_GET': {
        // Busca dependentes/familiares vinculados
        let dependentes: unknown[] = [];
        try {
          dependentes = await base44.asServiceRole.entities.Familiar.filter({ militar_id: militarId });
        } catch (_e) {
          dependentes = [];
        }

        // Busca solicitações de alteração pendentes ou recentes do próprio militar
        let solicitacoes: unknown[] = [];
        try {
          solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.filter({ militar_id: militarId });
        } catch (_e) {
          solicitacoes = [];
        }

        const dadosCadastrais = {
          id: militar.id,
          nome_completo: militar.nome_completo || '',
          nome_guerra: militar.nome_guerra || '',
          posto_graduacao: militar.posto_graduacao || '',
          matricula: militar.matricula || '',
          quadro: militar.quadro || '',
          lotacao: militar.lotacao || '',
          estrutura_nome: militar.estrutura_nome || '',
          data_nascimento: militar.data_nascimento || '',
          data_ingresso: militar.data_ingresso || '',
          estado_civil: militar.estado_civil || '',
          telefone_celular: militar.telefone_celular || militar.telefone || '',
          email_funcional: militar.email_funcional || '',
          email_particular: militar.email_particular || '',
          endereco_logradouro: militar.endereco_logradouro || militar.endereco || '',
          endereco_numero: militar.endereco_numero || '',
          endereco_complemento: militar.endereco_complemento || '',
          endereco_bairro: militar.endereco_bairro || '',
          endereco_cidade: militar.endereco_cidade || '',
          endereco_cep: militar.endereco_cep || '',
          tipo_sanguineo: militar.tipo_sanguineo || '',
          foto_url: militar.foto_url || '',
          data_ultima_conferencia: militar.data_ultima_conferencia || null,
        };

        const sanitizedDependentes = (dependentes || []).map((dep: any) => ({
          id: dep.id,
          nome_completo: dep.nome_completo || dep.nome || '',
          grau_parentesco: dep.grau_parentesco || dep.parentesco || '',
          data_nascimento: dep.data_nascimento || '',
          dependente_ir: Boolean(dep.dependente_ir),
        }));

        return new Response(JSON.stringify({
          ok: true,
          cadastro: dadosCadastrais,
          dependentes: sanitizedDependentes,
          solicitacoes: solicitacoes || [],
          config: {
            ativo: portalConfig?.cadastro_ativo !== false,
            permitir_solicitacao: portalConfig?.cadastro_permitir_solicitacao !== false,
            instrucoes: portalConfig?.cadastro_instrucoes || 'Confira seus dados funcionais e de contato.',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'CADASTRO_CONFIRMAR': {
        const nowIso = new Date().toISOString();

        // Atualiza a data da última conferência no cadastro do militar
        try {
          await base44.asServiceRole.entities.Militar.update(militarId, {
            data_ultima_conferencia: nowIso,
          });
        } catch (_err) {}

        // Registra carimbo na auditoria do portal
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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'CADASTRO_SOLICITAR_ALTERACAO': {
        const { campo_chave, campo_label, valor_atual, valor_proposto, justificativa } = payload;

        if (!campo_chave || !valor_proposto?.trim()) {
          return new Response(JSON.stringify({ error: 'Campo e novo valor são obrigatórios.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
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

        // Auditoria
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
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // ======================================================================
      // 1.3B: OPÇÃO E FRACIONAMENTO DE FÉRIAS (COM REGRA DO MAIS ANTIGO)
      // ======================================================================
      case 'FERIAS_GET': {
        // Busca períodos aquisitivos do militar
        let rawPeriodos: any[] = [];
        try {
          rawPeriodos = await base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId });
        } catch (_e) {
          rawPeriodos = [];
        }

        // Ordena cronologicamente por inicio_aquisitivo ASC (mais antigo primeiro)
        const periodosOrdenados = (rawPeriodos || []).sort((a: any, b: any) => {
          const dtA = new Date(a.inicio_aquisitivo || a.created_date || '1970-01-01').getTime();
          const dtB = new Date(b.inicio_aquisitivo || b.created_date || '1970-01-01').getTime();
          return dtA - dtB;
        });

        // Localiza o período mais antigo que ainda possui saldo a gozar
        let maisAntigoId: string | null = null;
        for (const p of periodosOrdenados) {
          const saldo = (p.dias_direito || 30) - (p.dias_gozados || 0);
          if (saldo > 0 && p.status !== 'Inativo') {
            maisAntigoId = p.id;
            break;
          }
        }

        // Mapeia adicionando a flag is_mais_antigo_pendente
        const periodosFormatados = periodosOrdenados.map((p: any) => ({
          ...p,
          is_mais_antigo_pendente: p.id === maisAntigoId,
          saldo_disponivel: Math.max(0, (p.dias_direito || 30) - (p.dias_gozados || 0)),
        }));

        // Busca histórico de férias cadastradas
        let feriasRegistradas: unknown[] = [];
        try {
          feriasRegistradas = await base44.asServiceRole.entities.Ferias.filter({ militar_id: militarId });
        } catch (_e) {
          feriasRegistradas = [];
        }

        return new Response(JSON.stringify({
          ok: true,
          periodos: periodosFormatados,
          periodo_mais_antigo_id: maisAntigoId,
          ferias: feriasRegistradas || [],
          config: {
            ativo: portalConfig?.ferias_ativo !== false,
            modo_selecao: portalConfig?.ferias_modo_selecao_periodo || 'mais_antigo',
            permitir_1_etapa: portalConfig?.ferias_permitir_1_etapa_30d !== false,
            permitir_2_etapas: portalConfig?.ferias_permitir_2_etapas_15d !== false,
            permitir_3_etapas: portalConfig?.ferias_permitir_3_etapas_10d !== false,
            permitir_custom: Boolean(portalConfig?.ferias_permitir_custom),
            prazo_limite: portalConfig?.ferias_prazo_limite || '',
            instrucoes: portalConfig?.ferias_instrucoes || 'Prezados militares, registrem a opção de férias para o plano da unidade.',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'FERIAS_SUBMETER_OPCAO': {
        const { periodo_aquisitivo_id, parcelas } = payload;

        if (!periodo_aquisitivo_id || !Array.isArray(parcelas) || parcelas.length === 0) {
          return new Response(JSON.stringify({ error: 'Período aquisitivo e parcelas são obrigatórios.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Valida se o período pertence ao militar
        const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodo_aquisitivo_id);
        if (!periodo || periodo.militar_id !== militarId) {
          return new Response(JSON.stringify({ error: 'Período aquisitivo inválido para este militar.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Valida soma total dos dias (ex: 30 dias)
        const totalDias = parcelas.reduce((acc, p) => acc + (Number(p.dias) || 0), 0);
        const diasDireito = periodo.dias_direito || 30;
        const saldoDisponivel = diasDireito - (periodo.dias_gozados || 0);

        if (totalDias > saldoDisponivel) {
          return new Response(JSON.stringify({
            error: `Total de dias solicitados (${totalDias}) excede o saldo disponível (${saldoDisponivel} dias).`,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Registra solicitação no formato de proposta para o RH
        const justificativaOpcao = parcelas.map((p, idx) =>
          `Etapa ${idx + 1}: ${p.dias} dias a partir de ${p.data_inicio}`
        ).join(' | ');

        const solicitacao = await base44.asServiceRole.entities.SolicitacaoAtualizacao.create({
          militar_id: militarId,
          militar_nome: militar.nome_completo || militar.nome_guerra || '',
          militar_posto: militar.posto_graduacao || '',
          militar_matricula: militar.matricula || '',
          campo_chave: 'opcao_fracionamento_ferias',
          campo_label: `Opção de Férias (${periodo.inicio_aquisitivo || ''} a ${periodo.fim_aquisitivo || ''})`,
          valor_atual: `${periodo.status || 'Pendente'} (Saldo: ${saldoDisponivel} dias)`,
          valor_proposto: justificativaOpcao,
          justificativa: `Opção de fracionamento de férias submetida pelo militar via Portal. Total: ${totalDias} dias.`,
          status: 'Pendente',
          data_solicitacao: new Date().toISOString().split('T')[0],
        });

        // Auditoria
        await registrarAuditoriaPortal(base44, {
          sessao_id: sessionAuth.context.sessao_id,
          militar_id: militarId,
          acao: 'OPCAO_FERIAS_SUBMETIDA',
          resultado: true,
          motivo_falha_sanitizado: null,
          ip_origem: extractClientIp(req),
          user_agent: extractUserAgent(req),
          correlation_id: correlationId,
        });

        return new Response(JSON.stringify({
          ok: true,
          message: 'Opção de parcelamento de férias enviada com sucesso para homologação do plano da unidade.',
          solicitacao: solicitacao,
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação não reconhecida no endpoint de serviços.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (err: any) {
    console.error(`[portal_servicos][${correlationId}] Erro inesperado:`, err?.message || err);

    return new Response(JSON.stringify({
      error: 'Erro interno ao processar serviço do portal. Tente novamente mais tarde.',
      correlation_id: correlationId,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
