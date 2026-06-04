let clientOverride = null;
let runtimeClientPromise = null;

async function getClient() {
  if (clientOverride) return clientOverride;
  if (!runtimeClientPromise) {
    runtimeClientPromise = import('../api/base44Client.js').then((mod) => mod.base44);
  }
  return runtimeClientPromise;
}

const CONFIRMACAO_FORTE = 'CONFIRMO LIMPEZA OPERACIONAL';

const PRESERVAR_ENTIDADES = [
  'UsuarioAcesso',
  'PerfilPermissao',
  'Subgrupamento',
  'TemplateTexto',
  'TipoPublicacaoCustom',
  'Lotacao',
  'Funcao',
];

const MODULOS_LIMPEZA = [
  { chave: 'pendencias', label: 'Pendências e disciplina', entidades: ['PendenciaComportamento', 'PunicaoDisciplinar'] },
  { chave: 'ferias', label: 'Férias e créditos extraordinários', entidades: ['CreditoExtraFerias', 'Ferias', 'PeriodoAquisitivo', 'PlanoFerias'] },
  { chave: 'publicacoes', label: 'Livro e publicações/RP', entidades: ['PublicacaoExOfficio', 'RegistroLivro'] },
  { chave: 'atestados', label: 'Atestados e JISO', entidades: ['JISO', 'Atestado'] },
  { chave: 'medalhas', label: 'Medalhas e impedimentos', entidades: ['ImpedimentoMedalha', 'Medalha'] },
  { chave: 'operacional', label: 'Quadro operacional e auxiliares', entidades: ['CardComentario', 'CardChecklistItem', 'CardVinculo', 'CardOperacional', 'Armamento', 'SolicitacaoAtualizacao', 'ContratoConvocacao'] },
  { chave: 'legado', label: 'Migração, legado e duplicidades', entidades: ['MergeMilitarLog', 'PossivelDuplicidadeMilitar', 'ImportacaoAlteracoesLegado', 'ImportacaoMilitares'] },
  { chave: 'matriculas', label: 'Matrículas', entidades: ['MatriculaMilitar'] },
  { chave: 'militares', label: 'Militares', entidades: ['Militar'] },
];

const ORFAOS_RULES = [
  { entidade: 'Ferias', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'PeriodoAquisitivo', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'CreditoExtraFerias', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'RegistroLivro', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'PublicacaoExOfficio', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'Atestado', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'JISO', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'JISO', campo: 'atestado_id', referencia: 'Atestado' },
  { entidade: 'Medalha', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'ImpedimentoMedalha', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'PunicaoDisciplinar', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'PendenciaComportamento', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'MatriculaMilitar', campo: 'militar_id', referencia: 'Militar' },
  { entidade: 'CardComentario', campo: 'card_id', referencia: 'CardOperacional' },
  { entidade: 'CardChecklistItem', campo: 'card_id', referencia: 'CardOperacional' },
  { entidade: 'CardVinculo', campo: 'card_id', referencia: 'CardOperacional' },
];

async function getEntity(nome) {
  const client = await getClient();
  return client?.entities?.[nome] || null;
}

async function listSafe(nome) {
  const entity = await getEntity(nome);
  if (!entity?.list) return [];
  try {
    return await entity.list('-created_date', 10000);
  } catch {
    return [];
  }
}

async function listAllSafe(nomes) {
  const uniqueNomes = [...new Set(nomes)];
  const results = await Promise.all(uniqueNomes.map((nome) => listSafe(nome)));
  const cache = new Map();
  uniqueNomes.forEach((nome, i) => cache.set(nome, results[i]));
  return cache;
}

async function deleteSafe(nome, id) {
  const entity = await getEntity(nome);
  if (!entity?.delete) return false;
  try {
    await entity.delete(id);
    return true;
  } catch {
    return false;
  }
}

async function gerarResumoOperacional(cache = null) {
  const moduloPromises = MODULOS_LIMPEZA.map(async (modulo) => {
    const entidadesPromises = modulo.entidades.map(async (nome) => {
      const rows = cache?.has(nome) ? cache.get(nome) : await listSafe(nome);
      const count = rows.length;
      return { entidade: nome, quantidade: count };
    });

    const entidades = await Promise.all(entidadesPromises);
    const subtotal = entidades.reduce((acc, e) => acc + e.quantidade, 0);

    return {
      chave: modulo.chave,
      label: modulo.label,
      subtotal,
      entidades,
    };
  });

  const [itens, orfaos] = await Promise.all([
    Promise.all(moduloPromises),
    diagnosticarOrfaos(cache),
  ]);

  const totalOperacional = itens.reduce((acc, item) => acc + item.subtotal, 0);

  return {
    confirmadoNecessario: CONFIRMACAO_FORTE,
    modulos: itens,
    totalOperacional,
    orfaos,
    totalOrfaos: orfaos.total,
    totalGeral: totalOperacional + orfaos.total,
    preservar: PRESERVAR_ENTIDADES,
    ordemExecucao: MODULOS_LIMPEZA.map((m) => ({ chave: m.chave, label: m.label, entidades: m.entidades })),
  };
}

async function diagnosticarOrfaos(cache = null) {
  const cacheIdsPromises = new Map();

  const getIds = (entidade) => {
    if (cacheIdsPromises.has(entidade)) return cacheIdsPromises.get(entidade);
    const promise = (async () => {
      const rows = cache?.has(entidade) ? cache.get(entidade) : await listSafe(entidade);
      return new Set(rows.map((r) => r.id).filter(Boolean));
    })();
    cacheIdsPromises.set(entidade, promise);
    return promise;
  };

  const results = await Promise.all(
    ORFAOS_RULES.map(async (rule) => {
      const rows = cache?.has(rule.entidade) ? cache.get(rule.entidade) : await listSafe(rule.entidade);
      if (!rows || rows.length === 0) return null;

      const validos = await getIds(rule.referencia);

      const orfaos = rows.filter((row) => {
        const refId = row?.[rule.campo];
        return refId && !validos.has(refId);
      });

      if (orfaos.length > 0) {
        return {
          entidade: rule.entidade,
          campo: rule.campo,
          referencia: rule.referencia,
          quantidade: orfaos.length,
          ids: orfaos.map((o) => o.id).filter(Boolean),
        };
      }
      return null;
    }),
  );

  const detalhes = results.filter(Boolean);
  const total = detalhes.reduce((acc, d) => acc + d.quantidade, 0);

  return { total, detalhes };
}

async function registrarLog({ tipo, executadoPor, resumo, removidos }) {
  const entity = await getEntity('ResetOperacionalLog');
  if (!entity?.create) return null;

  const payload = {
    tipo,
    executado_por: executadoPor || 'desconhecido',
    data_execucao: new Date().toISOString(),
    total_previsto: resumo?.totalGeral || 0,
    total_removido: removidos || 0,
    resumo_json: JSON.stringify(resumo || {}),
  };

  try {
    return await entity.create(payload);
  } catch {
    return null;
  }
}

export async function previewLimpezaPrePublicacao({ executadoPor } = {}) {
  const todasEntidades = [
    ...new Set([
      ...MODULOS_LIMPEZA.flatMap((m) => m.entidades),
      ...ORFAOS_RULES.map((r) => r.entidade),
      ...ORFAOS_RULES.map((r) => r.referencia),
    ]),
  ];
  const cache = await listAllSafe(todasEntidades);
  const resumo = await gerarResumoOperacional(cache);
  await registrarLog({ tipo: 'preview', executadoPor, resumo, removidos: 0 });
  return resumo;
}

export async function executarLimpezaPrePublicacao({ confirmacao, executadoPor } = {}) {
  if (confirmacao !== CONFIRMACAO_FORTE) {
    throw new Error(`Confirmação inválida. Use exatamente: ${CONFIRMACAO_FORTE}`);
  }

  const todasEntidades = [
    ...new Set([
      ...MODULOS_LIMPEZA.flatMap((m) => m.entidades),
      ...ORFAOS_RULES.map((r) => r.entidade),
      ...ORFAOS_RULES.map((r) => r.referencia),
    ]),
  ];
  const cache = await listAllSafe(todasEntidades);
  const resumo = await gerarResumoOperacional(cache);

  let removidos = 0;
  const removidosPorEntidade = {};

  for (const modulo of MODULOS_LIMPEZA) {
    const moduloEntidadesPromises = modulo.entidades.map(async (nome) => {
      const rows = cache.get(nome) || [];
      const ids = rows.map((r) => r?.id).filter(Boolean);
      if (!ids.length) return { nome, count: 0 };

      const results = await Promise.allSettled(ids.map((id) => deleteSafe(nome, id)));
      const count = results.filter((r) => r.status === 'fulfilled' && !!r.value).length;
      return { nome, count };
    });

    const moduleResults = await Promise.all(moduloEntidadesPromises);
    for (const res of moduleResults) {
      if (res.count > 0) {
        removidos += res.count;
        removidosPorEntidade[res.nome] = (removidosPorEntidade[res.nome] || 0) + res.count;
      }
    }
  }

  const todasEntidadesOrfaos = [
    ...new Set([
      ...ORFAOS_RULES.map((r) => r.entidade),
      ...ORFAOS_RULES.map((r) => r.referencia),
    ]),
  ];
  const cacheOrfaos = await listAllSafe(todasEntidadesOrfaos);
  const orfaosRestantes = await diagnosticarOrfaos(cacheOrfaos);
  const orfaosPromises = orfaosRestantes.detalhes.map(async (item) => {
    const results = await Promise.allSettled(item.ids.map((id) => deleteSafe(item.entidade, id)));
    const count = results.filter((r) => r.status === 'fulfilled' && !!r.value).length;
    return { entidade: item.entidade, count };
  });

  const orfaosResults = await Promise.all(orfaosPromises);
  for (const res of orfaosResults) {
    if (res.count > 0) {
      removidos += res.count;
      removidosPorEntidade[res.entidade] = (removidosPorEntidade[res.entidade] || 0) + res.count;
    }
  }

  const resultado = {
    ...resumo,
    modo: 'execucao',
    removidos,
    removidosPorEntidade,
    orfaosRemovidosNaVarreduraFinal: orfaosRestantes.total,
  };

  await registrarLog({ tipo: 'execucao', executadoPor, resumo: resultado, removidos });
  return resultado;
}

export function __setResetOperacionalClientForTests(mockClient) {
  clientOverride = mockClient || null;
}

export function __resetResetOperacionalClientForTests() {
  clientOverride = null;
  runtimeClientPromise = null;
}

export const resetOperacionalConstants = {
  CONFIRMACAO_FORTE,
  PRESERVAR_ENTIDADES,
};
