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

async function usuarioPodeGerirPlanos(base44: any, user: any): Promise<boolean> {
  if (!user?.email) return false;
  if (normalizar(user.role) === 'admin') return true;

  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter({
    user_email: user.email,
    ativo: true,
  });
  const perfilIds = Array.from(new Set((acessos || []).map((a: any) => a?.perfil_id).filter(Boolean)));
  const perfis = perfilIds.length
    ? await base44.asServiceRole.entities.PerfilPermissao.filter({ id: { $in: perfilIds }, ativo: true })
    : [];

  const permitidas = new Set<string>();
  const coletar = (fonte: any) => {
    if (!fonte || typeof fonte !== 'object') return;
    for (const [chave, valor] of Object.entries(fonte)) {
      if (valor === true && (chave.startsWith('perm_') || chave.startsWith('acesso_'))) {
        permitidas.add(chave);
      }
    }
  };
  for (const acesso of acessos || []) coletar(acesso);
  for (const perfil of perfis || []) {
    coletar(perfil);
    coletar(permissoesDaDescricao(perfil?.descricao));
  }

  return ['perm_gerir_campanhas', 'perm_gerir_respostas', 'perm_configurar_portal']
    .some((permissao) => permitidas.has(permissao));
}

function militarNoEscopo(militar: any, campanha: any): boolean {
  if (!militar || militar.status === 'Inativo' || militar.status === 'Falecido') return false;
  if (!campanha?.tipo_escopo || campanha.tipo_escopo === 'TODOS') return true;
  if (campanha.tipo_escopo === 'SELECAO_MILITARES') {
    return (campanha.escopo_militares_ids || []).includes(militar.id);
  }
  if (campanha.tipo_escopo === 'QUADROS') {
    return (campanha.escopo_quadros || []).includes(militar.quadro);
  }
  if (campanha.tipo_escopo !== 'UNIDADES') return false;

  const alvos = (campanha.escopo_unidades_ids || []).map((id: unknown) => normalizar(id)).filter(Boolean);
  const valores = [
    militar.lotacao_id,
    militar.grupamento_id,
    militar.estrutura_id,
    militar.lotacao,
    militar.estrutura_nome,
  ].map((item) => normalizar(item)).filter(Boolean);

  return alvos.some((alvo: string) =>
    valores.some((valor: string) => valor === alvo || valor.includes(alvo) || alvo.includes(valor))
  );
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
      autorizado = await usuarioPodeGerirPlanos(base44, user);
    } catch {
      autorizado = false;
    }
    if (!autorizado) return json({ error: 'Usuário sem permissão para gerir Planos de Férias.' }, 403);

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

    if (acao === 'EXCLUIR') {
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

      const publicoIds = new Set<string>();
      for (const campanha of campanhas) {
        for (const militar of militares || []) {
          if (militarNoEscopo(militar, campanha) && militar.id) publicoIds.add(militar.id);
        }
      }
      const respondidos = new Set(
        (opcoes || []).map((opcao: any) => texto(opcao.militar_id)).filter(Boolean)
      );
      const gerados = new Set(
        (opcoes || [])
          .filter((opcao: any) => opcao.gerado_ferias_efetivas)
          .map((opcao: any) => texto(opcao.militar_id))
          .filter(Boolean)
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
