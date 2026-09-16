function textoId(value: unknown): string { return String(value ?? '').trim(); }
function tipoAcesso(value: unknown): string { return textoId(value).toLowerCase(); }

export async function listarTodos(entity: any, query: any = {}): Promise<any[]> {
  const registros: any[] = [];
  for (let skip = 0; ; skip += 500) {
    const pagina = await entity.filter(query, 'id', 500, skip);
    registros.push(...pagina);
    if (pagina.length < 500) return registros;
  }
}

export async function filtrarEscopo(base44: any, user: any, militares: any[]): Promise<any[]> {
  if (!user?.email) return [];
  if (tipoAcesso(user.role) === 'admin') return militares;
  const acessos = await listarTodos(base44.asServiceRole.entities.UsuarioAcesso, { user_email: user.email, ativo: true });
  if (acessos.some((a: any) => tipoAcesso(a?.tipo_acesso) === 'admin')) return militares;
  const pais = new Set(acessos.filter((a: any) => tipoAcesso(a?.tipo_acesso) === 'subsetor').map((a: any) => textoId(a?.subgrupamento_id)).filter(Boolean));
  const estruturas = pais.size ? await listarTodos(base44.asServiceRole.entities.Subgrupamento, { parent_id: { $in: [...pais] } }) : [];
  return militares.filter((m: any) => acessos.some((a: any) => {
    const tipo = tipoAcesso(a?.tipo_acesso);
    const estrutura = textoId(m?.estrutura_id), sub = textoId(m?.subgrupamento_id);
    const setor = textoId(a?.grupamento_id), unidade = textoId(a?.subgrupamento_id);
    if (tipo === 'proprio') return Boolean(a?.militar_id && textoId(a.militar_id) === textoId(m?.id));
    if (tipo === 'setor') return Boolean(setor && [estrutura, textoId(m?.grupamento_id), textoId(m?.grupamento_raiz_id)].includes(setor));
    if (tipo === 'unidade') return Boolean(unidade && [estrutura, sub].includes(unidade));
    if (tipo === 'subsetor') return Boolean(unidade && ([estrutura, sub].includes(unidade) || estruturas.some((e: any) => textoId(e.parent_id) === unidade && [estrutura, sub].includes(textoId(e.id)))));
    return false;
  }));
}

export async function validarSelecaoNominal(base44: any, user: any, cp: any) {
  const ids = [...new Set(cp.escopo_militares_ids.map(textoId).filter(Boolean))];
  const militares = await listarTodos(base44.asServiceRole.entities.Militar, { id: { $in: ids } });
  const permitidos = await filtrarEscopo(base44, user, militares.filter((m: any) => !['inativo', 'falecido'].includes(tipoAcesso(m.status_cadastro || m.status))));
  if (permitidos.length !== ids.length) return 'Há militar inexistente, inativo ou fora do seu escopo. Atualize a seleção.';
  cp.escopo_militares_ids = ids;
  return '';
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
  if (payload.incluir_cobertura === true && tipoAcesso(user.role) !== 'admin') {
    const authz = (await base44.functions.invoke('getUserPermissions', {})).data;
    if (!authz?.actions?.visualizar_respostas_ferias && !authz?.actions?.aprovar_ferias) return Response.json({ error: 'Sem permissão para consultar cobertura.' }, { status: 403, headers: corsHeaders });
  }
  const todasCampanhas = await listarTodos(base44.asServiceRole.entities.CampanhaPortal, { tipo: 'PLANO_FERIAS' });
  const campanhas = todasCampanhas.filter((c: any) => c.tipo === 'PLANO_FERIAS');
  // Campanhas cujo prazo terminou são encerradas automaticamente ao abrir o painel.
  const { encerrarCampanhasFeriasVencidas } = await import('./encerrarCampanhasVencidas.ts');
  await encerrarCampanhasFeriasVencidas(base44, campanhas);
  const primeira = campanhas.find((c: any) => ['Aberta_Coleta', 'Ativa'].includes(c.status)) || campanhas[0] || null;
  const planoId = !payload.campanha_id ? (textoId(payload.plano_id) || textoId(primeira?.plano_ferias_institucional_id)) : '';
  const campanhasConsulta = payload.campanha_id ? campanhas.filter((c: any) => c.id === payload.campanha_id) : planoId ? campanhas.filter((c: any) => textoId(c.plano_ferias_institucional_id) === planoId) : primeira ? [primeira] : [];
  const idsCampanhas = new Set(campanhasConsulta.map((c: any) => c.id));
  const todosMilitares = await listarTodos(base44.asServiceRole.entities.Militar);
  const militaresVisiveis = await filtrarEscopo(base44, user, todosMilitares);
  const militares = militaresVisiveis.filter((m: any) => !['inativo', 'falecido'].includes(tipoAcesso(m?.status_cadastro || m?.status)));
  const idsEscopo = new Set(militaresVisiveis.map((m: any) => textoId(m?.id)).filter(Boolean));
  const todasOpcoes = await listarTodos(base44.asServiceRole.entities.OpcaoFeriasMilitar, { $or: [{ campanha_id: { $in: [...idsCampanhas] } }, { plano_ferias_institucional_id: planoId || '__nenhum__' }] });
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
    const plano = await base44.asServiceRole.entities.PlanoFeriasInstitucional.get(planoId);
    if (!plano) return Response.json({ error: 'Plano não encontrado.' }, { status: 404, headers: corsHeaders });
    const ano = Number(plano.ano_referencia);
    const consultaMilitares = { militar_id: { $in: militares.filter((m: any) => !publicoMap.has(textoId(m.id))).map((m: any) => m.id) } };
    const [periodos, ferias, ajustes] = await Promise.all([
      listarTodos(base44.asServiceRole.entities.PeriodoAquisitivo, consultaMilitares),
      listarTodos(base44.asServiceRole.entities.Ferias, { ...consultaMilitares, plano_ferias_id: planoId }),
      listarTodos(base44.asServiceRole.entities.AjusteSaldoFerias, { ...consultaMilitares, status: 'ativo' }),
    ]);
    cobertura = militares.flatMap((m: any) => {
      const id = textoId(m?.id);
      if (!id || publicoMap.has(id)) return [];
      const feriasMilitar = feriasVinculadasAoPlano(ferias.filter((f: any) => textoId(f?.militar_id) === id), planoId);
      const ajustesMilitar = ajustes.filter((a: any) => textoId(a?.militar_id) === id);
      const elegiveis = periodos.filter((p: any) => textoId(p?.militar_id) === id).map((p: any) => ({ id: p.id, ano_referencia: p.ano_referencia || '', inicio_aquisitivo: p.inicio_aquisitivo || '', fim_aquisitivo: p.fim_aquisitivo || '', ...calcularResumoPeriodoPlano(p, feriasMilitar, ajustesMilitar, ano) })).filter((p: any) => p.elegivel_plano === true);
      return elegiveis.length ? [{ militar_id: id, militar_nome: m?.nome_completo || m?.nome_guerra || '', militar_posto: m?.posto_graduacao || '', militar_matricula: m?.matricula || '', lotacao_nome: m?.lotacao || m?.estrutura_nome || 'Não informada', periodos_elegiveis: elegiveis }] : [];
    }).sort((a: any, b: any) => a.militar_nome.localeCompare(b.militar_nome, 'pt-BR'));
  }
  const campanhasSeguras = campanhas.map((c: any) => ({ id: c.id, titulo: c.titulo, status: c.status, ano_referencia: c.ano_referencia, plano_ferias_institucional_id: c.plano_ferias_institucional_id, data_inicio: c.data_inicio, data_fim_militar: c.data_fim_militar }));
  return new Response(JSON.stringify({ ok: true, campanhas: campanhasSeguras, opcoes, publico_alvo: publico, cobertura, total_elegiveis_nao_cobertos: cobertura?.length ?? null, total_publico_alvo_atual: publico.length, plano_id: planoId || null, modo_consolidado: consolidado }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}