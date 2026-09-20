import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Id',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

const texto = (value: unknown) => String(value ?? '').trim();

const ALIASES_ACAO_PLANO: Record<string, string> = {
  // Ações legadas da tela de campanhas, quando encaminhadas ao serviço
  // exclusivo de Planos de Férias.
  CAMPANHA_REABRIR: 'PLANO_CAMPANHA_REABRIR',
  CAMPANHA_ATIVAR: 'PLANO_CAMPANHA_REABRIR',
  PLANO_CAMPANHA_ATIVAR: 'PLANO_CAMPANHA_REABRIR',
  PLANO_INSTITUCIONAL_LISTAR: 'LISTAR',
  PLANO_INSTITUCIONAL_DETALHES: 'DETALHES',
  PLANO_INSTITUCIONAL_CRIAR: 'CRIAR',
  PLANO_INSTITUCIONAL_ATUALIZAR: 'ATUALIZAR',
  PLANO_INSTITUCIONAL_ARQUIVAR: 'ARQUIVAR',
  PLANO_INSTITUCIONAL_DESARQUIVAR: 'DESARQUIVAR',
  PLANO_INSTITUCIONAL_EXCLUIR: 'EXCLUIR',
};

const CAMPOS_ENVELOPE_REQUISICAO = ['data', 'body', 'payload', 'args', 'input', 'params'] as const;

function comoObjeto(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * A função aceita o corpo direto do SDK e envelopes conhecidos de versões
 * intermediárias. Os campos do corpo direto têm prioridade sobre o envelope,
 * evitando que metadados de transporte alterem a intenção da tela.
 */
function dadosDaRequisicaoPlano(value: unknown): Record<string, unknown> {
  const raiz = comoObjeto(value);
  if (!raiz) return {};

  const partes: Record<string, unknown>[] = [raiz];
  for (const campo of CAMPOS_ENVELOPE_REQUISICAO) {
    const envelope = comoObjeto(raiz[campo]);
    if (envelope) partes.push(envelope);
  }

  return Object.assign({}, ...partes.reverse());
}

function normalizarAcaoPlano(payload: unknown): string {
  const dados = dadosDaRequisicaoPlano(payload);
  const acao = texto(dados.acao).toUpperCase();
  return Object.prototype.hasOwnProperty.call(ALIASES_ACAO_PLANO, acao)
    ? ALIASES_ACAO_PLANO[acao]
    : acao;
}

function normalizar(value: unknown): string {
  return texto(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function permissoesDaDescricao(descricao: unknown): Record<string, unknown> {
  if (typeof descricao !== 'string') return {};
  const inicio = descricao.indexOf('[SGP_PERMISSIONS_MATRIX]');
  const fim = descricao.indexOf('[/SGP_PERMISSIONS_MATRIX]');
  if (inicio < 0 || fim <= inicio) return {};
  try {
    const parsed = JSON.parse(descricao.slice(inicio + '[SGP_PERMISSIONS_MATRIX]'.length, fim).trim());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function permissoesNecessariasPlano(acao: string): string[] {
  // F8-L08: somente capacidades canônicas; aliases são resolvidos em getUserPermissions.
  if (acao === 'LISTAR' || acao === 'DETALHES') return ['perm_visualizar_planos_ferias'];
  if (acao === 'CRIAR') return ['perm_criar_planos_ferias'];
  if (acao === 'ATUALIZAR') return ['perm_editar_planos_ferias'];
  if (acao === 'ARQUIVAR' || acao === 'DESARQUIVAR') return ['perm_editar_planos_ferias', 'perm_admin_campanhas_ferias'];
  if (acao === 'PLANO_CAMPANHA_ARQUIVAR' || acao === 'PLANO_CAMPANHA_DESATIVAR' || acao === 'PLANO_CAMPANHA_REABRIR') return ['perm_visualizar_planos_ferias', 'perm_admin_campanhas_ferias'];
  if (acao === 'EXCLUIR') return ['perm_excluir_planos_ferias', 'perm_admin_campanhas_ferias'];
  return [];
}

async function usuarioPodeGerirPlanos(base44: any, user: any, acao: string): Promise<boolean> {
  if (!user?.email) return false;
  if (normalizar(user.role) === 'admin') return true;

  const authzResponse = await base44.functions.invoke('getUserPermissions', {});
  const authz = authzResponse?.data ?? authzResponse ?? {};
  const necessarias = permissoesNecessariasPlano(acao);
  const exigeTodas = ['ARQUIVAR', 'DESARQUIVAR', 'EXCLUIR', 'PLANO_CAMPANHA_ARQUIVAR', 'PLANO_CAMPANHA_DESATIVAR', 'PLANO_CAMPANHA_REABRIR'].includes(acao);
  return necessarias.length > 0 && (exigeTodas
    ? necessarias.every((permissao) => authz?.actions?.[permissao.replace(/^perm_/, '')] === true)
    : necessarias.some((permissao) => authz?.actions?.[permissao.replace(/^perm_/, '')] === true));
}

async function registrarAuditoriaStatusCampanha(base44: any, user: any, contexto: any, detalhes: any) {
  try {
    await base44.asServiceRole.entities.AuditoriaFerias.create({
      acao: contexto.acao,
      resultado: 'SUCESSO',
      usuario_id: String(user?.id || ''),
      usuario_email: user?.email || '',
      usuario_nome: user?.full_name || user?.name || user?.email || 'Usuário',
      plano_id: String(contexto.plano_id || ''),
      campanha_id: String(contexto.campanha_id || ''),
      detalhes: JSON.stringify(detalhes || {}),
      data_hora: new Date().toISOString(),
    });
  } catch {
    // O registro de auditoria não pode impedir a alteração de status.
  }
}

async function registrarAuditoriaPlano(base44: any, user: any, acao: string, planoId: string, detalhes: any = {}) {
  try {
    await base44.asServiceRole.entities.AuditoriaFerias.create({
      acao,
      resultado: 'SUCESSO',
      usuario_id: String(user?.id || ''),
      usuario_email: user?.email || '',
      usuario_nome: user?.full_name || user?.name || user?.email || 'Usuário',
      plano_id: String(planoId || ''),
      detalhes: JSON.stringify(detalhes || {}),
      data_hora: new Date().toISOString(),
    });
  } catch {
    // Auditoria não pode impedir a transição principal.
  }
}

function vinculoGrupoValidoHoje(vinculo: any): boolean {
  if (vinculo?.ativo === false) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = texto(vinculo?.data_inicio).slice(0, 10);
  const fim = texto(vinculo?.data_fim).slice(0, 10);
  if (inicio && inicio > hoje) return false;
  if (fim && fim < hoje) return false;
  return true;
}

async function carregarMembrosPorGrupo(base44: any, campanhas: any[]): Promise<Map<string, Set<string>>> {
  const ids = new Set<string>();
  for (const campanha of campanhas || []) {
    for (const id of [
      ...(campanha?.escopo_grupos_ids || []),
      ...(campanha?.escopo_grupos_excluidos_ids || []),
    ]) {
      if (id) ids.add(String(id));
    }
  }
  const resultado = new Map<string, Set<string>>();
  if (ids.size === 0) return resultado;
  let vinculos: any[] = [];
  try {
    vinculos = await base44.asServiceRole.entities.MembroGrupoEfetivo.list();
  } catch {
    vinculos = [];
  }
  for (const vinculo of vinculos || []) {
    if (!vinculoGrupoValidoHoje(vinculo) || !ids.has(String(vinculo.grupo_id)) || !vinculo.militar_id) continue;
    const grupoId = String(vinculo.grupo_id);
    if (!resultado.has(grupoId)) resultado.set(grupoId, new Set<string>());
    resultado.get(grupoId)!.add(String(vinculo.militar_id));
  }
  return resultado;
}

async function enriquecerContadoresCampanhas(base44: any, campanhas: any[] = []): Promise<any[]> {
  if (!campanhas.length) return campanhas;
  let opcoes: any[] = [];
  try {
    opcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.list();
  } catch {
    opcoes = [];
  }
  const idsCampanhas = new Set(campanhas.map((campanha: any) => String(campanha.id)));
  const porCampanha = new Map<string, Set<string>>();
  for (const opcao of opcoes || []) {
    const campanhaId = String(opcao?.campanha_id || '');
    const militarId = texto(opcao?.militar_id);
    if (!idsCampanhas.has(campanhaId) || !militarId) continue;
    if (!porCampanha.has(campanhaId)) porCampanha.set(campanhaId, new Set<string>());
    porCampanha.get(campanhaId)!.add(militarId);
  }
  return campanhas.map((campanha: any) => {
    const respondidos = porCampanha.get(String(campanha.id))?.size || 0;
    const alvo = Number(campanha.total_publico_alvo || 0);
    return {
      ...campanha,
      total_respondidos: respondidos,
      total_pendentes: Math.max(0, alvo - respondidos),
    };
  });
}

function militarNoEscopo(militar: any, campanha: any, membrosPorGrupo = new Map<string, Set<string>>()): boolean {
  if (!militar || militar.status === 'Inativo' || militar.status === 'Falecido') return false;

  const tipoEscopo = campanha?.tipo_escopo || 'TODOS';
  let baseEscopo = tipoEscopo === 'TODOS' || tipoEscopo === 'SEM_ESCOPO';

  if (tipoEscopo === 'SELECAO_MILITARES') {
    baseEscopo = (campanha.escopo_militares_ids || []).includes(militar.id);
  } else if (tipoEscopo === 'QUADROS') {
    baseEscopo = (campanha.escopo_quadros || []).includes(militar.quadro);
  } else if (tipoEscopo === 'UNIDADES' || tipoEscopo === 'UNIDADES_E_GRUPOS') {
    const alvos = (campanha.escopo_unidades_ids || []).map((id: unknown) => normalizar(id)).filter(Boolean);
    const valores = [
      militar.lotacao_id,
      militar.grupamento_id,
      militar.estrutura_id,
      militar.lotacao,
      militar.estrutura_nome,
    ].map((item) => normalizar(item)).filter(Boolean);
    baseEscopo = alvos.some((alvo: string) =>
      valores.some((valor: string) => valor === alvo || valor.includes(alvo) || alvo.includes(valor))
    );
  } else if (!['TODOS', 'SEM_ESCOPO', 'UNIDADES_E_GRUPOS'].includes(tipoEscopo)) {
    baseEscopo = false;
  }

  const grupos = (campanha?.escopo_grupos_ids || [])
    .map((id: unknown) => membrosPorGrupo.get(String(id)))
    .filter(Boolean);
  const pertenceGrupo = grupos.length === 0 || grupos.some((membros) => membros!.has(String(militar.id)));
  const excluidoPorMilitar = (campanha?.escopo_militares_excluidos_ids || [])
    .map((id: unknown) => String(id))
    .includes(String(militar.id));
  const excluidoPorGrupo = (campanha?.escopo_grupos_excluidos_ids || [])
    .some((id: unknown) => membrosPorGrupo.get(String(id))?.has(String(militar.id)));

  return baseEscopo && pertenceGrupo && !excluidoPorMilitar && !excluidoPorGrupo;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const requisicao = await req.json();
    const payload = dadosDaRequisicaoPlano(requisicao);
    const acao = normalizarAcaoPlano(payload);
    const base44 = createClientFromRequest(req);

    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) return json({ error: 'Usuário não autenticado.' }, 401);

    let autorizado = false;
    try {
      autorizado = await usuarioPodeGerirPlanos(base44, user, acao);
    } catch {
      autorizado = false;
    }
    if (!autorizado) return json({ error: 'Usuário sem permissão para esta ação em Planos de Férias.' }, 403);

    if (acao === 'LISTAR') {
      const [planos, campanhas] = await Promise.all([
        base44.asServiceRole.entities.PlanoFeriasInstitucional.list(),
        base44.asServiceRole.entities.CampanhaPortal.filter({ tipo: 'PLANO_FERIAS' }),
      ]);
      const { encerrarCampanhasFeriasVencidas } = await import('../../shared/ferias/encerrarCampanhasVencidas.ts');
      await encerrarCampanhasFeriasVencidas(base44, campanhas || []);
      // Mantém a lista originalmente carregada. O fechamento automático é
      // idempotente e não pode tornar a consulta do plano dependente de uma
      // segunda leitura da entidade.
      const campanhasComContadores = await enriquecerContadoresCampanhas(base44, campanhas || []);
      return json({ ok: true, planos: planos || [], campanhas: campanhasComContadores });
    }

    if (acao === 'CRIAR') {
      const dados = payload?.plano || {};
      const titulo = texto(dados.titulo);
      const ano = Number(dados.ano_referencia);
      if (!titulo || !Number.isInteger(ano) || ano < 2000 || ano > 2200) {
        return json({ error: 'Nome e ano de referência válidos são obrigatórios.' }, 400);
      }
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.create({
        titulo,
        ano_referencia: ano,
        descricao: texto(dados.descricao),
        data_abertura: texto(dados.data_abertura) || new Date().toISOString().slice(0, 10),
        data_encerramento: '',
        status: 'ATIVO',
        total_gerados_acumulado: 0,
        quantidade_geracoes: 0,
      });
      return json({ ok: true, plano }, 201);
    }

    const planoId = texto(payload?.plano_id);
    if (!planoId) return json({ error: 'Plano de Férias não informado.' }, 400);

    const planoAtual = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId);
    if (!planoAtual) return json({ error: 'Plano de Férias não encontrado.' }, 404);

    if (['PLANO_CAMPANHA_ARQUIVAR', 'PLANO_CAMPANHA_DESATIVAR', 'PLANO_CAMPANHA_REABRIR'].includes(acao)) {
      const campanhaId = texto(payload?.campanha_id);
      if (!campanhaId) return json({ error: 'ID da campanha não informado.' }, 400);
      const campanha = await base44.asServiceRole.entities.CampanhaPortal.get(campanhaId);
      if (!campanha || campanha.tipo !== 'PLANO_FERIAS') return json({ error: 'Campanha de férias não encontrada.' }, 404);
      if (texto(campanha.plano_ferias_institucional_id) !== planoId) {
        return json({ error: 'A campanha não pertence ao plano informado.' }, 409);
      }
      if (String(planoAtual.status || '').toUpperCase() !== 'ATIVO') {
        return json({ error: 'O plano precisa estar ativo para alterar o status da campanha.' }, 409);
      }
      const statusAtual = normalizar(campanha.status);
      if (acao === 'PLANO_CAMPANHA_REABRIR' && statusAtual !== 'arquivada') {
        return json({ error: 'A campanha precisa estar arquivada antes de ser reaberta.' }, 409);
      }
      if (acao === 'PLANO_CAMPANHA_ARQUIVAR' && statusAtual === 'arquivada') {
        return json({ error: 'A campanha já está arquivada.' }, 409);
      }
      const status = acao === 'PLANO_CAMPANHA_REABRIR'
        ? 'Aberta_Coleta'
        : acao === 'PLANO_CAMPANHA_ARQUIVAR' ? 'Arquivada' : 'Desativada';
      const campanhaAtualizada = await base44.asServiceRole.entities.CampanhaPortal.update(campanhaId, { status });
      await registrarAuditoriaStatusCampanha(base44, user, {
        acao,
        plano_id: planoId,
        campanha_id: campanhaId,
      }, {
        campanha_titulo: campanha.titulo || '',
        status_anterior: campanha.status || '',
        status_novo: status,
        respostas_preservadas: true,
      });
      return json({ ok: true, campanha: campanhaAtualizada, message: 'Campanha ' + status.toLowerCase() + ' com sucesso.' });
    }

    if (acao === 'ATUALIZAR') {
      if (String(planoAtual.status || '').toUpperCase() === 'ARQUIVADO') {
        return json({ error: 'Planos arquivados não podem ser alterados. Desarquive o plano antes de editá-lo.' }, 409);
      }
      const dados = payload?.plano || {};
      const titulo = texto(dados.titulo);
      const ano = Number(dados.ano_referencia);
      if (!titulo || !Number.isInteger(ano) || ano < 2000 || ano > 2200) {
        return json({ error: 'Nome e ano de referência válidos são obrigatórios.' }, 400);
      }
      const campanhas = await base44.asServiceRole.entities.CampanhaPortal.filter({
        plano_ferias_institucional_id: planoId,
      });
      if ((campanhas || []).length > 0 && Number(planoAtual.ano_referencia) !== ano) {
        return json({ error: 'O ano não pode ser alterado depois que o plano possui campanhas.' }, 409);
      }
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
        titulo,
        ano_referencia: ano,
        descricao: texto(dados.descricao),
        data_abertura: texto(dados.data_abertura) || planoAtual.data_abertura,
        data_encerramento: texto(dados.data_encerramento),
      });
      return json({ ok: true, plano });
    }

    if (acao === 'ARQUIVAR') {
      if (String(planoAtual.status || '').toUpperCase() === 'ARQUIVADO') {
        return json({ error: 'O plano já está arquivado.' }, 409);
      }
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
        status: 'ARQUIVADO',
        data_encerramento: planoAtual.data_encerramento || new Date().toISOString().slice(0, 10),
      });
      await registrarAuditoriaPlano(base44, user, 'PLANO_INSTITUCIONAL_ARQUIVAR', planoId, {
        plano_titulo: planoAtual.titulo || '',
        status_anterior: planoAtual.status || '',
        status_novo: 'ARQUIVADO',
      });
      return json({ ok: true, plano });
    }

    if (acao === 'DESARQUIVAR') {
      if (String(planoAtual.status || '').toUpperCase() !== 'ARQUIVADO') {
        return json({ error: 'O plano não está arquivado.' }, 409);
      }
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
        status: 'ATIVO',
        data_encerramento: '',
      });
      await registrarAuditoriaPlano(base44, user, 'PLANO_INSTITUCIONAL_DESARQUIVAR', planoId, {
        plano_titulo: planoAtual.titulo || '',
        status_anterior: planoAtual.status || '',
        status_novo: 'ATIVO',
      });
      return json({ ok: true, plano });
    }

    if (acao === 'EXCLUIR') {
      if (payload?.confirmacao_dupla !== true) {
        return json({ error: 'A exclusão do plano exige confirmação dupla.' }, 400);
      }
      if (String(planoAtual.status || '').toUpperCase() !== 'ARQUIVADO') {
        return json({ error: 'O plano precisa estar arquivado antes de ser excluído.' }, 409);
      }
      const campanhas = await base44.asServiceRole.entities.CampanhaPortal.filter({
        plano_ferias_institucional_id: planoId,
      });
      if ((campanhas || []).length > 0) {
        return json({ error: 'O plano possui campanhas vinculadas e não pode ser excluído. O histórico será preservado.' }, 409);
      }
      const [opcoes, ferias] = await Promise.all([
        base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({ plano_ferias_institucional_id: planoId }).catch(() => []),
        base44.asServiceRole.entities.Ferias.filter({ plano_ferias_id: planoId }).catch(() => []),
      ]);
      if ((opcoes || []).length > 0 || (ferias || []).length > 0) {
        return json({ error: 'O plano possui respostas ou férias vinculadas e não pode ser excluído. O histórico será preservado.' }, 409);
      }
      await base44.asServiceRole.entities.PlanoFeriasInstitucional.delete(planoId);
      await registrarAuditoriaPlano(base44, user, 'PLANO_INSTITUCIONAL_EXCLUIR', planoId, {
        plano_titulo: planoAtual.titulo || '',
        status_anterior: planoAtual.status || '',
      });
      return json({ ok: true });
    }

    if (acao === 'DETALHES') {
      const campanhas = (await base44.asServiceRole.entities.CampanhaPortal.filter({
        plano_ferias_institucional_id: planoId,
      })).filter((campanha: any) => campanha.tipo === 'PLANO_FERIAS');

      const [militares, opcoes] = await Promise.all([
        base44.asServiceRole.entities.Militar.list(),
        base44.asServiceRole.entities.OpcaoFeriasMilitar.filter({
          plano_ferias_institucional_id: planoId,
        }),
      ]);
      const membrosPorGrupo = await carregarMembrosPorGrupo(base44, campanhas);

      const publicoIds = new Set<string>();
      for (const campanha of campanhas) {
        for (const militar of militares || []) {
          if (militarNoEscopo(militar, campanha, membrosPorGrupo) && militar.id) publicoIds.add(militar.id);
        }
      }
      const respondidos = new Set(
        (opcoes || [])
          .map((opcao: any) => texto(opcao.militar_id))
          .filter((id: string) => id && publicoIds.has(id))
      );
      const gerados = new Set(
        (opcoes || [])
          .filter((opcao: any) => opcao.gerado_ferias_efetivas)
          .map((opcao: any) => texto(opcao.militar_id))
          .filter((id: string) => id && publicoIds.has(id))
      );

      return json({
        ok: true,
        plano: planoAtual,
        campanhas,
        metricas: {
          efetivo_unico: publicoIds.size,
          respondidos_unicos: respondidos.size,
          pendentes_unicos: Math.max(0, publicoIds.size - respondidos.size),
          ferias_geradas_unicas: gerados.size,
          percentual_adesao: publicoIds.size
            ? Math.round((respondidos.size / publicoIds.size) * 100)
            : 0,
        },
      });
    }

    return json({ error: 'Ação de Plano de Férias não reconhecida.' }, 400);
  } catch (error: any) {
    console.error('[planos_ferias_servicos]', error);
    return json({ error: error?.message || 'Falha interna ao processar o Plano de Férias.' }, 500);
  }
});