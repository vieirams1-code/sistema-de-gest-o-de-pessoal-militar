function textoId(value: unknown): string { return String(value ?? '').trim(); }
function tipoAcesso(value: unknown): string { return textoId(value).toLowerCase(); }

async function filtrarEscopo(base44: any, user: any, militares: any[]): Promise<any[]> {
  if (tipoAcesso(user?.role) === 'admin') return militares;
  const acessos = await base44.asServiceRole.entities.UsuarioAcesso.filter({ user_email: user?.email, ativo: true }).catch(() => []);
  if (acessos.some((a: any) => tipoAcesso(a?.tipo_acesso) === 'admin')) return militares;
  const pais = new Set(acessos.filter((a: any) => tipoAcesso(a?.tipo_acesso) === 'subsetor').map((a: any) => textoId(a?.subgrupamento_id)).filter(Boolean));
  const estruturas = pais.size ? await base44.asServiceRole.entities.Subgrupamento.list().catch(() => []) : [];
  const filhos = new Map<string, Set<string>>();
  for (const item of estruturas) {
    const pai = textoId(item?.parent_id);
    if (!pais.has(pai)) continue;
    if (!filhos.has(pai)) filhos.set(pai, new Set());
    filhos.get(pai)!.add(textoId(item?.id));
  }
  return militares.filter((m: any) => acessos.some((a: any) => {
    const tipo = tipoAcesso(a?.tipo_acesso);
    const estrutura = textoId(m?.estrutura_id);
    const sub = textoId(m?.subgrupamento_id);
    if (tipo === 'proprio') return textoId(a?.militar_id) === textoId(m?.id);
    if (tipo === 'setor') return [estrutura, textoId(m?.grupamento_id), textoId(m?.grupamento_raiz_id)].includes(textoId(a?.grupamento_id));
    if (tipo === 'unidade') return [estrutura, sub].includes(textoId(a?.subgrupamento_id));
    if (tipo === 'subsetor') {
      const id = textoId(a?.subgrupamento_id);
      return [estrutura, sub].includes(id) || Boolean(filhos.get(id)?.has(estrutura) || filhos.get(id)?.has(sub));
    }
    return false;
  }));
}

export function validarEscopoCampanhaFerias(cp: any): string {
  const tipo = textoId(cp?.tipo_escopo || 'TODOS');
  const grupos = Array.isArray(cp?.escopo_grupos_ids) ? cp.escopo_grupos_ids.filter(Boolean) : [];
  const unidades = Array.isArray(cp?.escopo_unidades_ids) ? cp.escopo_unidades_ids.filter(Boolean) : [];
  const militares = Array.isArray(cp?.escopo_militares_ids) ? cp.escopo_militares_ids.filter(Boolean) : [];
  if (!new Set(['TODOS', 'UNIDADES', 'SEM_ESCOPO', 'UNIDADES_E_GRUPOS', 'SELECAO_MILITARES']).has(tipo)) return 'Modo de escopo inválido para a campanha.';
  if (tipo === 'TODOS' && (grupos.length || unidades.length || militares.length)) return 'O modo Toda a Corporação não pode conter seleções.';
  if (tipo === 'SELECAO_MILITARES' && !militares.length) return 'Selecione ao menos um militar para a campanha.';
  if (tipo !== 'SELECAO_MILITARES' && militares.length) return 'A seleção nominal exige o modo Seleção de militares.';
  if (tipo === 'SEM_ESCOPO' && (!grupos.length || unidades.length)) return 'Selecione ao menos um grupo e nenhuma unidade.';
  if (tipo === 'UNIDADES' && (!unidades.length || grupos.length)) return 'Selecione ao menos uma unidade e nenhum grupo.';
  if (tipo === 'UNIDADES_E_GRUPOS' && (!unidades.length || !grupos.length)) return 'Selecione ao menos uma unidade e um grupo.';
  if (grupos.length && !['SEM_ESCOPO', 'UNIDADES_E_GRUPOS'].includes(tipo)) return 'O modo escolhido não aceita grupos.';
  if (unidades.length && !['UNIDADES', 'UNIDADES_E_GRUPOS'].includes(tipo)) return 'O modo escolhido não aceita unidades.';
  return '';
}

export async function listarEscalaPlano(args: any): Promise<Response> {
  const { base44, user, payload, calcularResumoPeriodoPlano, feriasVinculadasAoPlano, consolidarOpcoesPlano, carregarMembrosPorGrupo, matchMilitarCampanha, corsHeaders } = args;
  const todasCampanhas = await base44.asServiceRole.entities.CampanhaPortal.list().catch(() => []);
  const campanhas = todasCampanhas.filter((c: any) => c.tipo === 'PLANO_FERIAS');
  const primeira = campanhas.find((c: any) => ['Aberta_Coleta', 'Ativa'].includes(c.status)) || campanhas[0] || null;
  const planoId = !payload.campanha_id ? (textoId(payload.plano_id) || textoId(primeira?.plano_ferias_institucional_id)) : '';
  const campanhasConsulta = payload.campanha_id ? campanhas.filter((c: any) => c.id === payload.campanha_id) : planoId ? campanhas.filter((c: any) => textoId(c.plano_ferias_institucional_id) === planoId) : primeira ? [primeira] : [];
  const idsCampanhas = new Set(campanhasConsulta.map((c: any) => c.id));
  const todosMilitares = await base44.asServiceRole.entities.Militar.list().catch(() => []);
  const ativos = todosMilitares.filter((m: any) => !['inativo', 'falecido'].includes(tipoAcesso(m?.status_cadastro || m?.status)));
  const militares = await filtrarEscopo(base44, user, ativos);
  const idsEscopo = new Set(militares.map((m: any) => textoId(m?.id)).filter(Boolean));
  const todasOpcoes = await base44.asServiceRole.entities.OpcaoFeriasMilitar.list();
  let opcoes = todasOpcoes.filter((op: any) => idsEscopo.has(textoId(op?.militar_id)) && (idsCampanhas.has(op.campanha_id) || (!payload.campanha_id && planoId && textoId(op.plano_ferias_institucional_id) === planoId))).map((op: any) => ({ ...op, campanha_titulo: campanhas.find((c: any) => c.id === op.campanha_id)?.titulo || '' }));
  const consolidado = Boolean(planoId && !payload.campanha_id);
  if (consolidado) opcoes = consolidarOpcoesPlano(opcoes);
  const membros = await carregarMembrosPorGrupo(base44, campanhasConsulta);
  const publicoMap = new Map<string, any>();
  for (const militar of militares) {
    const alvos = campanhasConsulta.filter((c: any) => matchMilitarCampanha(c, militar, membros));
    if (!alvos.length) continue;
    const id = textoId(militar?.id);
    publicoMap.set(id, { militar_id: id, militar_nome: militar?.nome_completo || militar?.nome_guerra || '', militar_nome_guerra: militar?.nome_guerra || '', militar_posto: militar?.posto_graduacao || '', militar_matricula: militar?.matricula || '', militar_quadro: militar?.quadro || '', lotacao_id: militar?.estrutura_id || militar?.subgrupamento_id || militar?.lotacao_id || '', lotacao_nome: militar?.lotacao || militar?.estrutura_nome || 'Não informada', campanhas_alvo: alvos.map((c: any) => ({ campanha_id: c.id, titulo: c.titulo || '' })) });
  }
  const publico = Array.from(publicoMap.values());
  let cobertura: any[] | null = null;
  if (payload.incluir_cobertura === true && planoId) {
    const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId).catch(() => null);
    const ano = Number(plano?.ano_referencia || payload.ano_referencia || new Date().getFullYear() + 1);
    const [periodos, ferias, ajustes] = await Promise.all([base44.asServiceRole.entities.PeriodoAquisitivo.list().catch(() => []), base44.asServiceRole.entities.Ferias.list().catch(() => []), base44.asServiceRole.entities.AjusteSaldoFerias.list().catch(() => [])]);
    cobertura = militares.flatMap((m: any) => {
      const id = textoId(m?.id);
      if (!id || publicoMap.has(id)) return [];
      const feriasMilitar = feriasVinculadasAoPlano(ferias.filter((f: any) => textoId(f?.militar_id) === id), planoId);
      const ajustesMilitar = ajustes.filter((a: any) => textoId(a?.militar_id) === id);
      const elegiveis = periodos.filter((p: any) => textoId(p?.militar_id) === id).map((p: any) => ({ id: p.id, ano_referencia: p.ano_referencia || '', inicio_aquisitivo: p.inicio_aquisitivo || '', fim_aquisitivo: p.fim_aquisitivo || '', ...calcularResumoPeriodoPlano(p, feriasMilitar, ajustesMilitar, ano) })).filter((p: any) => p.elegivel_plano === true);
      return elegiveis.length ? [{ militar_id: id, militar_nome: m?.nome_completo || m?.nome_guerra || '', militar_posto: m?.posto_graduacao || '', militar_matricula: m?.matricula || '', lotacao_nome: m?.lotacao || m?.estrutura_nome || 'Não informada', periodos_elegiveis: elegiveis }] : [];
    }).sort((a: any, b: any) => a.militar_nome.localeCompare(b.militar_nome, 'pt-BR'));
  }
  return new Response(JSON.stringify({ ok: true, campanhas, opcoes, publico_alvo: publico, cobertura, total_elegiveis_nao_cobertos: cobertura?.length ?? null, total_publico_alvo_atual: publico.length, plano_id: planoId || null, modo_consolidado: consolidado }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}