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
  // Campos administrativos
  ano_referencia?: number;
  campanha_data?: any;
  opcao_id?: string;
  decisao_camada_1?: {
    opcao_escolhida: string; // 'OPCAO_1' | 'OPCAO_2' | 'OPCAO_3' | 'AJUSTE_GESTOR'
    parcelas: ParcelaItem[];
    justificativa?: string;
    gestor_nome?: string;
  };
  homologacao_camada_2?: {
    status: string; // 'Homologado_Superior' | 'Rejeitado_Para_Revisao'
    superior_nome?: string;
    observacao?: string;
  };
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

    const payload = (rawBody || {}) as PortalServicosPayload;
    const acao = payload.acao;
    const base44 = createClientFromRequest(req);

    // ========================================================================
    // ROTAS ADMINISTRATIVAS DO SGP (Gestão do Plano Anual de Férias)
    // ========================================================================
    if (acao?.startsWith('PLANO_')) {
      const user = await base44.auth.me();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Acesso restrito ao administrador do sistema.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      switch (acao) {
        case 'PLANO_CAMPANHA_OBTER_OU_CRIAR': {
          const ano = payload.ano_referencia || (new Date().getFullYear() + 1);
          let campanhas = await base44.asServiceRole.entities.CampanhaPlanoFerias.filter({ ano_referencia: ano });
          let campanha = campanhas?.[0];

          if (!campanha) {
            campanha = await base44.asServiceRole.entities.CampanhaPlanoFerias.create({
              ano_referencia: ano,
              titulo: `Plano Anual de Férias ${ano}`,
              status: 'Aberta_Coleta',
              prazo_limite_militar: `${ano - 1}-10-31`,
              prazo_limite_unidade: `${ano - 1}-11-30`,
              instrucoes: `Prezados militares, registrem suas 3 opções de meses/períodos de férias para o ano de ${ano}.`,
            });
          }

          return new Response(JSON.stringify({ ok: true, campanha }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_CAMPANHA_SALVAR': {
          const { campanha_data } = payload;
          if (!campanha_data?.id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const updated = await base44.asServiceRole.entities.CampanhaPlanoFerias.update(campanha_data.id, {
            status: campanha_data.status,
            prazo_limite_militar: campanha_data.prazo_limite_militar,
            prazo_limite_unidade: campanha_data.prazo_limite_unidade,
            instrucoes: campanha_data.instrucoes,
            titulo: campanha_data.titulo,
          });

          return new Response(JSON.stringify({ ok: true, campanha: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_ESCALA_LISTAR': {
          const ano = payload.ano_referencia || (new Date().getFullYear() + 1);
          const opcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ ano_referencia: ano });
          return new Response(JSON.stringify({ ok: true, opcoes: opcoes || [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_DECISAO_CAMADA_1': {
          const { opcao_id, decisao_camada_1 } = payload;
          if (!opcao_id || !decisao_camada_1) {
            return new Response(JSON.stringify({ error: 'Dados da decisão não informados.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const mesesResumo = (decisao_camada_1.parcelas || []).map((p: any) => p.mes || p.data_inicio?.slice(5, 7)).join(' / ');

          const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
            status_camada_1: decisao_camada_1.opcao_escolhida === 'OPCAO_1' ? 'Opcao_1_Aprovada'
              : decisao_camada_1.opcao_escolhida === 'OPCAO_2' ? 'Opcao_2_Aprovada'
              : decisao_camada_1.opcao_escolhida === 'OPCAO_3' ? 'Opcao_3_Aprovada'
              : 'Ajustado_Pelo_Gestor',
            decisao_camada_1_opcao: decisao_camada_1.opcao_escolhida,
            decisao_camada_1_meses: mesesResumo,
            decisao_camada_1_detalhes: JSON.stringify(decisao_camada_1.parcelas || []),
            gestor_unidade_id: user.id,
            gestor_unidade_nome: decisao_camada_1.gestor_nome || user.email,
            data_decisao_camada_1: new Date().toISOString(),
            justificativa_ajuste_gestor: decisao_camada_1.justificativa || '',
          });

          return new Response(JSON.stringify({ ok: true, opcao: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_HOMOLOGACAO_CAMADA_2': {
          const { opcao_id, homologacao_camada_2 } = payload;
          if (!opcao_id || !homologacao_camada_2) {
            return new Response(JSON.stringify({ error: 'Dados da homologação não informados.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
            status_camada_2: homologacao_camada_2.status === 'Homologado_Superior' ? 'Homologado_Superior' : 'Rejeitado_Para_Revisao',
            superior_homologador_id: user.id,
            superior_homologador_nome: homologacao_camada_2.superior_nome || user.email,
            data_homologacao_superior: new Date().toISOString(),
            observacao_superior: homologacao_camada_2.observacao || '',
          });

          return new Response(JSON.stringify({ ok: true, opcao: updated }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case 'PLANO_GERAR_LOTE_FERIAS': {
          const ano = payload.ano_referencia || (new Date().getFullYear() + 1);
          const opcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
            ano_referencia: ano,
            status_camada_2: 'Homologado_Superior',
            gerado_ferias_efetivas: false,
          });

          let geradasCount = 0;
          for (const op of (opcoes || [])) {
            let parcelas: ParcelaItem[] = [];
            try {
              parcelas = JSON.parse(op.decisao_camada_1_detalhes || '[]');
            } catch (_e) {
              parcelas = [];
            }

            if (parcelas.length === 0) continue;

            const feriasIds: string[] = [];
            let totalDias = 0;

            for (const p of parcelas) {
              const dtInicio = new Date(p.data_inicio || `${ano}-01-01`);
              const dias = Number(p.dias) || 30;
              totalDias += dias;

              const dtFim = new Date(dtInicio);
              dtFim.setDate(dtFim.getDate() + dias - 1);

              const dtRetorno = new Date(dtFim);
              dtRetorno.setDate(dtRetorno.getDate() + 1);

              const fCreated = await base44.asServiceRole.entities.Ferias.create({
                militar_id: op.militar_id,
                militar_nome: op.militar_nome,
                militar_posto: op.militar_posto,
                militar_matricula: op.militar_matricula,
                periodo_aquisitivo_id: op.periodo_aquisitivo_id,
                periodo_aquisitivo_ref: `${op.periodo_inicio || ''} a ${op.periodo_fim || ''}`,
                tipo: 'Férias Regulares',
                data_inicio: dtInicio.toISOString().split('T')[0],
                data_fim: dtFim.toISOString().split('T')[0],
                data_retorno: dtRetorno.toISOString().split('T')[0],
                dias: dias,
                status: 'Previsto',
              });

              if (fCreated?.id) feriasIds.push(fCreated.id);
            }

            // Atualiza PeriodoAquisitivo com dias previstos
            try {
              const pa = await base44.asServiceRole.entities.PeriodoAquisitivo.get(op.periodo_aquisitivo_id);
              if (pa) {
                await base44.asServiceRole.entities.PeriodoAquisitivo.update(pa.id, {
                  dias_previstos: (pa.dias_previstos || 0) + totalDias,
                  status: 'Previsto',
                });
              }
            } catch (_err) {}

            // Marca OpcaoFeriasMilitar como gerada
            await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(op.id, {
              gerado_ferias_efetivas: true,
              data_geracao_ferias: new Date().toISOString(),
              ferias_ids_geradas: feriasIds,
            });

            geradasCount++;
          }

          return new Response(JSON.stringify({
            ok: true,
            message: `Geração automática em lote concluída com sucesso! ${geradasCount} escalas de férias geradas.`,
            total_geradas: geradasCount,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        default:
          return new Response(JSON.stringify({ error: 'Ação administrativa não reconhecida.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
      }
    }

    // ========================================================================
    // ROTAS DO MILITAR NO PORTAL (Autenticação via X-Portal-Token)
    // ========================================================================
    assertNoClientSuppliedMilitarId(rawBody);

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

    const portalConfig = await loadAuthConfig(base44);

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

      // 1.3B: Férias no Portal com 3 Opções de Meses
      case 'FERIAS_GET': {
        const anoCampanha = new Date().getFullYear() + 1; // Padrão: 2027

        // Busca campanha ativa
        let campanhas = await base44.asServiceRole.entities.CampanhaPlanoFerias.filter({ ano_referencia: anoCampanha });
        const campanha = campanhas?.[0] || null;

        // Busca períodos aquisitivos do militar
        let rawPeriodos: any[] = [];
        try {
          rawPeriodos = await base44.asServiceRole.entities.PeriodoAquisitivo.filter({ militar_id: militarId });
        } catch (_e) {}

        const periodosOrdenados = (rawPeriodos || []).sort((a: any, b: any) => {
          const dtA = new Date(a.inicio_aquisitivo || a.created_date || '1970-01-01').getTime();
          const dtB = new Date(b.inicio_aquisitivo || b.created_date || '1970-01-01').getTime();
          return dtA - dtB;
        });

        let maisAntigoId: string | null = null;
        for (const p of periodosOrdenados) {
          const saldo = (p.dias_direito || 30) - (p.dias_gozados || 0);
          if (saldo > 0 && p.status !== 'Inativo') {
            maisAntigoId = p.id;
            break;
          }
        }

        const periodosFormatados = periodosOrdenados.map((p: any) => ({
          ...p,
          is_mais_antigo_pendente: p.id === maisAntigoId,
          saldo_disponivel: Math.max(0, (p.dias_direito || 30) - (p.dias_gozados || 0)),
        }));

        // Busca opção de férias já enviada pelo militar para esta campanha
        let opcoesEnviadas: any[] = [];
        try {
          opcoesEnviadas = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
            militar_id: militarId,
            ano_referencia: anoCampanha,
          });
        } catch (_e) {}

        return new Response(JSON.stringify({
          ok: true,
          ano_referencia: anoCampanha,
          campanha: campanha,
          periodos: periodosFormatados,
          periodo_mais_antigo_id: maisAntigoId,
          opcao_militar_enviada: opcoesEnviadas?.[0] || null,
          config: {
            ativo: portalConfig?.ferias_ativo !== false,
            modo_selecao: portalConfig?.ferias_modo_selecao_periodo || 'mais_antigo',
            permitir_1_etapa: portalConfig?.ferias_permitir_1_etapa_30d !== false,
            permitir_2_etapas: portalConfig?.ferias_permitir_2_etapas_15d !== false,
            permitir_3_etapas: portalConfig?.ferias_permitir_3_etapas_10d !== false,
            permitir_custom: Boolean(portalConfig?.ferias_permitir_custom),
            prazo_limite: campanha?.prazo_limite_militar || portalConfig?.ferias_prazo_limite || '',
            instrucoes: campanha?.instrucoes || portalConfig?.ferias_instrucoes || 'Informe suas 3 opções de meses para a escala de férias.',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'FERIAS_SUBMETER_OPCAO': {
        const { periodo_aquisitivo_id, modalidade, opcao_1, opcao_2, opcao_3 } = payload;
        const anoCampanha = payload.ano_referencia || (new Date().getFullYear() + 1);

        if (!periodo_aquisitivo_id || !opcao_1?.parcelas?.length || !opcao_2?.parcelas?.length || !opcao_3?.parcelas?.length) {
          return new Response(JSON.stringify({ error: 'É obrigatório preencher as 3 opções de preferências de meses.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const periodo = await base44.asServiceRole.entities.PeriodoAquisitivo.get(periodo_aquisitivo_id);
        if (!periodo || periodo.militar_id !== militarId) {
          return new Response(JSON.stringify({ error: 'Período aquisitivo inválido para este militar.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Verifica se já existia opção para atualizar ou criar nova
        const existentes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
          militar_id: militarId,
          ano_referencia: anoCampanha,
        });

        const opcaoPayload = {
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
          dias_direito: periodo.dias_direito || 30,
          modalidade: modalidade || '2_ETAPAS_15',
          opcao_1_meses: opcao_1.meses_resumo || '',
          opcao_1_detalhes: JSON.stringify(opcao_1.parcelas),
          opcao_2_meses: opcao_2.meses_resumo || '',
          opcao_2_detalhes: JSON.stringify(opcao_2.parcelas),
          opcao_3_meses: opcao_3.meses_resumo || '',
          opcao_3_detalhes: JSON.stringify(opcao_3.parcelas),
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

        // Auditoria
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
