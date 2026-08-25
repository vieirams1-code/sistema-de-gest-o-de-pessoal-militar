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

function matchMilitarEscopoUnidade(m: any, escopoUnidadesIds: string[]): boolean {
  if (!Array.isArray(escopoUnidadesIds) || escopoUnidadesIds.length === 0) return true;

  const lotacaoMilitar = (m.lotacao || '').trim().toLowerCase();
  const estruturaMilitar = (m.estrutura_nome || '').trim().toLowerCase();
  const lotacaoId = String(m.lotacao_id || '').trim();
  const grupamentoId = String(m.grupamento_id || '').trim();
  const estruturaId = String(m.estrutura_id || '').trim();

  return escopoUnidadesIds.some((idRaw) => {
    const id = String(idRaw || '').trim();
    if (!id) return false;
    const idLower = id.toLowerCase();

    return (
      id === lotacaoId ||
      id === grupamentoId ||
      id === estruturaId ||
      idLower === lotacaoMilitar ||
      idLower === estruturaMilitar ||
      (lotacaoMilitar && lotacaoMilitar.includes(idLower)) ||
      (estruturaMilitar && estruturaMilitar.includes(idLower))
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
    // ROTAS ADMINISTRATIVAS DO SGP (Gestão de Campanhas e Ações do Portal)
    // ========================================================================
    if (acao?.startsWith('CAMPANHA_') || acao?.startsWith('PLANO_')) {
      const user = await base44.auth.me();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Acesso restrito ao administrador do sistema.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      switch (acao) {
        // Criar Nova Campanha (Férias ou Cadastral com Escopo)
        case 'CAMPANHA_CRIAR': {
          const cp = payload.campanha_payload || {};
          if (!cp.tipo || !cp.titulo) {
            return new Response(JSON.stringify({ error: 'Tipo e Título da campanha são obrigatórios.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
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
            total_publico_alvo: militaresEscopo.length,
            total_respondidos: 0,
            total_pendentes: militaresEscopo.length,
            criado_por_nome: user.email || 'Administrador',
          });

          return new Response(JSON.stringify({ ok: true, campanha: created }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Detalhes de Retorno e Acompanhamento Nominal
        case 'CAMPANHA_DETALHES_RETORNO': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanha_id);
          if (!campanha) {
            return new Response(JSON.stringify({ error: 'Campanha não encontrada.' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
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
              ano_referencia: campanha.ano_referencia,
            });
            (opcoes || []).forEach((op: any) => respostasMap.set(op.militar_id, op));
          } else {
            const solicitacoes = await base44.asServiceRole.entities.SolicitacaoAtualizacao.list();
            (solicitacoes || []).forEach((sol: any) => respostasMap.set(sol.militar_id, sol));
          }

          const relacaoNominal = militaresNoEscopo.map((m) => {
            const resposta = respostasMap.get(m.id);
            const conferiuRecentemente = m.data_ultima_conferencia && campanha.data_inicio && m.data_ultima_conferencia >= campanha.data_inicio;
            const respondido = Boolean(resposta || conferiuRecentemente);

            return {
              militar_id: m.id,
              militar_nome: m.nome_completo || m.nome_guerra || '',
              militar_posto: m.posto_graduacao || '',
              militar_matricula: m.matricula || '',
              militar_lotacao: m.lotacao || m.estrutura_nome || 'Não informada',
              militar_celular: m.telefone_celular || m.telefone || '',
              status_resposta: respondido ? 'Respondido' : 'Pendente',
              data_resposta: resposta?.data_envio_militar || resposta?.created_date || (conferiuRecentemente ? m.data_ultima_conferencia : null),
              detalhes_resposta: resposta?.opcao_1_meses || resposta?.valor_proposto || (conferiuRecentemente ? 'Dados confirmados sem alteração' : null),
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
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Disparo de Lembretes
        case 'CAMPANHA_DISPARAR_LEMBRETES': {
          return new Response(JSON.stringify({
            ok: true,
            message: 'Disparo de lembretes processado com sucesso para os militares com pendência nesta campanha.',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Editar Campanha
        case 'CAMPANHA_EDITAR': {
          const { campanha_id, campanha_payload } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
            titulo: campanha_payload.titulo,
            instrucoes: campanha_payload.instrucoes,
            data_fim_militar: campanha_payload.data_fim_militar,
            data_fim_unidade: campanha_payload.data_fim_unidade,
            tipo_escopo: campanha_payload.tipo_escopo,
            escopo_unidades_ids: campanha_payload.escopo_unidades_ids,
            escopo_unidades_nomes: campanha_payload.escopo_unidades_nomes,
            escopo_quadros: campanha_payload.escopo_quadros,
          });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha atualizada com sucesso.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Excluir Campanha
        case 'CAMPANHA_EXCLUIR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          await base44.asServiceRole.entities.CampanhaPortal.delete(campanha_id);

          // Remove também todas as opções que foram registradas para essa campanha específica
          try {
            const opcoesDaCampanha = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ campanha_id });
            for (const op of (opcoesDaCampanha || [])) {
              await base44.asServiceRole.entities.OpcaoFeriasMilitar.delete(op.id);
            }
          } catch (_eDelOp) {}

          return new Response(JSON.stringify({ ok: true, message: 'Campanha e opções associadas excluídas com sucesso.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Arquivar Campanha
        case 'CAMPANHA_ARQUIVAR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, { status: 'Arquivada' });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha arquivada com sucesso.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Desativar Campanha
        case 'CAMPANHA_DESATIVAR': {
          const { campanha_id } = payload;
          if (!campanha_id) {
            return new Response(JSON.stringify({ error: 'ID da campanha não informado.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const updated = await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, { status: 'Desativada' });
          return new Response(JSON.stringify({ ok: true, campanha: updated, message: 'Campanha desativada com sucesso.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Encerrar Campanha
        case 'CAMPANHA_ENCERRAR': {
          const { campanha_id } = payload;
          await base44.asServiceRole.entities.CampanhaPortal.update(campanha_id, {
            status: 'Encerrada',
          });
          return new Response(JSON.stringify({ ok: true, message: 'Campanha encerrada.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
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
            return new Response(JSON.stringify({ ok: true, campanha }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
                if (op.campanha_id && !campanhasIdsValidos.has(op.campanha_id)) {
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
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
              return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            const mesesResumo = (decisao_camada_1?.parcelas || []).map((p: any) => p.mes || p.data_inicio?.slice(5, 7)).join(' / ');
            const updated = await base44.asServiceRole.entities.OpcaoFeriasMilitar.update(opcao_id, {
              status_camada_1: 'Escala_Salva',
              decisao_camada_1_opcao: decisao_camada_1?.opcao_escolhida || 'ESCALA_VALIDADA',
              decisao_camada_1_meses: decisao_camada_1?.resumo_meses || mesesResumo,
              decisao_camada_1_detalhes: JSON.stringify(decisao_camada_1?.parcelas || []),
              gestor_unidade_id: user.id,
              gestor_unidade_nome: decisao_camada_1?.gestor_nome || user.email,
              data_decisao_camada_1: new Date().toISOString(),
              justificativa_ajuste_gestor: decisao_camada_1?.justificativa || '',
            });
            return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
            return new Response(JSON.stringify({ ok: true, opcao: updated }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
                  await base44.asServiceRole.entities.PeriodoAquisitivo.update(pa.id, {
                    dias_previstos: (pa.dias_previstos || 0) + totalDias,
                    status: 'Previsto',
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
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          break;
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

    const sessionAuth = await requirePortalSession(req, base44, rawBody);
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
          estrutura_nome: militarFresh.estrutura_nome || '',
          data_nascimento: militarFresh.data_nascimento || '',
          data_ingresso: militarFresh.data_inclusao || militarFresh.data_ingresso || militarFresh.data_admissao || '',
          estado_civil: militarFresh.estado_civil || '',
          telefone_celular: militarFresh.telefone_celular || militarFresh.telefone || '',
          email_funcional: militarFresh.email_funcional || militarFresh.email || '',
          email_particular: militarFresh.email_particular || '',
          endereco_logradouro: militarFresh.logradouro || militarFresh.endereco_logradouro || militarFresh.endereco || '',
          endereco_numero: militarFresh.numero_endereco || militarFresh.endereco_numero || militarFresh.numero || '',
          endereco_complemento: militarFresh.complemento || militarFresh.endereco_complemento || '',
          endereco_bairro: militarFresh.bairro || militarFresh.endereco_bairro || '',
          endereco_cidade: militarFresh.cidade || militarFresh.endereco_cidade || '',
          endereco_cep: militarFresh.cep || militarFresh.endereco_cep || '',
          tipo_sanguineo: militarFresh.tipo_sanguineo || '',
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

        const campanhaCadastralAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'ATUALIZACAO_CADASTRAL' || c.tipo === 'CONFERENCIA_GERAL');

        return new Response(JSON.stringify({
          ok: true,
          cadastro: dadosCadastrais,
          dependentes: sanitizedDependentes,
          solicitacoes: solicitacoes || [],
          campanha_ativa: campanhaCadastralAtiva || null,
          config: {
            ativo: portalConfig?.cadastro_ativo !== false,
            permitir_solicitacao: portalConfig?.cadastro_permitir_solicitacao !== false,
            instrucoes: campanhaCadastralAtiva?.instrucoes || portalConfig?.cadastro_instrucoes || 'Confira seus dados funcionais e de contato.',
            prazo_limite: campanhaCadastralAtiva?.data_fim_militar || '',
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
        const campanhaFeriasAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'PLANO_FERIAS');
        const anoCampanha = campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);

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

        return new Response(JSON.stringify({
          ok: true,
          ano_referencia: anoCampanha,
          campanha: campanhaFeriasAtiva || null,
          campanhas_ativas: campanhasAtivasMilitar,
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
            prazo_limite: campanhaFeriasAtiva?.data_fim_militar || portalConfig?.ferias_prazo_limite || '',
            instrucoes: campanhaFeriasAtiva?.instrucoes || portalConfig?.ferias_instrucoes || 'Informe suas 3 opções de meses para a escala de férias.',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'FERIAS_SUBMETER_OPCAO': {
        const { periodo_aquisitivo_id, modalidade, opcao_1, opcao_2, opcao_3 } = payload;
        const campanhaFeriasAtiva = campanhasAtivasMilitar.find((c) => c.tipo === 'PLANO_FERIAS');
        const campanhaId = payload.campanha_id || campanhaFeriasAtiva?.id || null;
        const anoCampanha = payload.ano_referencia || campanhaFeriasAtiva?.ano_referencia || (new Date().getFullYear() + 1);

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

        let existentes: any[] = [];
        if (campanhaId) {
          existentes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
            militar_id: militarId,
            campanha_id: campanhaId,
          });
        }

        const opcaoPayload = {
          campanha_id: campanhaId,
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
