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
  if (acao === 'EXCLUIR') return ['perm_excluir_planos_ferias', 'perm_admin_campanhas_ferias'];
  return [];
}

async function usuarioPodeGerirPlanos(base44: any, user: any, acao: string): Promise<boolean> {
  if (!user?.email) return false;
  if (normalizar(user.role) === 'admin') return true;

  const authzResponse = await base44.functions.invoke('getUserPermissions', {});
  const authz = authzResponse?.data ?? authzResponse ?? {};
  const necessarias = permissoesNecessariasPlano(acao);
  const exigeTodas = ['ARQUIVAR', 'DESARQUIVAR', 'EXCLUIR'].includes(acao);
  return necessarias.length > 0 && (exigeTodas
    ? necessarias.every((permissao) => authz?.actions?.[permissao.replace(/^perm_/, '')] === true)
    : necessarias.some((permissao) => authz?.actions?.[permissao.replace(/^perm_/, '')] === true));
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

function militarNoEscopo(militar: any, campanha: any, membrosPorGrupo = new Map<string, Set<string>>()): boolean {
  if (!militar || militar.status === 'Inativo' || militar.status === 'Falecido') return false;

  const tipoEscopo = campanha?.tipo_escopo || 'TODOS';
  let baseEscopo = tipoEscopo === 'TODOS' || tipoEscopo === 'SEM_ESCOPO';

  if (tipoEscopo === 'SELECAO_MILITARES') {
    baseEscopo = (campanha.escopo_militares_ids || []).includes(militar.id);
  } else if (tipoEscopo === 'QUADROS') {
    baseEscopo = (campanha.escopo_quadros || []).includes(militar.quadro);
  } else if (tipoEscopo === 'UNIDADES') {
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
  } else if (!['TODOS', 'SEM_ESCOPO'].includes(tipoEscopo)) {
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
    const payload = await req.json();
    const acao = texto(payload?.acao);
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
      return json({ ok: true, planos: planos || [], campanhas: campanhas || [] });
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
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
        status: 'ARQUIVADO',
        data_encerramento: planoAtual.data_encerramento || new Date().toISOString().slice(0, 10),
      });
      return json({ ok: true, plano });
    }

    if (acao === 'DESARQUIVAR') {
      const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.update(planoId, {
        status: 'ATIVO',
        data_encerramento: '',
      });
      return json({ ok: true, plano });
    }

    if (acao === 'EXCLUIR') {
      if (payload?.confirmacao_dupla !== true) {
        return json({ error: 'A exclusão do plano exige confirmação dupla.' }, 400);
      }
      const campanhas = await base44.asServiceRole.entities.CampanhaPortal.filter({
        plano_ferias_institucional_id: planoId,
      });
      if ((campanhas || []).length > 0) {
        return json({ error: 'O plano possui campanhas. Arquive-o para preservar o histórico.' }, 409);
      }
      await base44.asServiceRole.entities.PlanoFeriasInstitucional.delete(planoId);
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
