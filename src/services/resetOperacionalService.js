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

async function gerarResumoOperacional() {
  const itens = [];
  let total = 0;

  for (const modulo of MODULOS_LIMPEZA) {
    let subtotal = 0;
    const entidades = [];

    for (const nome of modulo.entidades) {
      const rows = await listSafe(nome);
      const count = rows.length;
      subtotal += count;
      total += count;
      entidades.push({ entidade: nome, quantidade: count });
    }

    itens.push({ chave: modulo.chave, label: modulo.label, subtotal, entidades });
  }

  const orfaos = await diagnosticarOrfaos();

  return {
    confirmadoNecessario: CONFIRMACAO_FORTE,
    modulos: itens,
    totalOperacional: total,
    orfaos,
    totalOrfaos: orfaos.total,
    totalGeral: total + orfaos.total,
    preservar: PRESERVAR_ENTIDADES,
    ordemExecucao: MODULOS_LIMPEZA.map((m) => ({ chave: m.chave, label: m.label, entidades: m.entidades })),
  };
}

async function diagnosticarOrfaos() {
  const cacheIds = new Map();
  const detalhes = [];
  let total = 0;

  const getIds = async (entidade) => {
    if (cacheIds.has(entidade)) return cacheIds.get(entidade);
    const rows = await listSafe(entidade);
    const ids = new Set(rows.map((r) => r.id).filter(Boolean));
    cacheIds.set(entidade, ids);
    return ids;
  };

  for (const rule of ORFAOS_RULES) {
    const rows = await listSafe(rule.entidade);
    if (!rows.length) continue;
    const validos = await getIds(rule.referencia);

    const orfaos = rows.filter((row) => {
      const refId = row?.[rule.campo];
      return refId && !validos.has(refId);
    });

    if (orfaos.length) {
      detalhes.push({ entidade: rule.entidade, campo: rule.campo, referencia: rule.referencia, quantidade: orfaos.length, ids: orfaos.map((o) => o.id).filter(Boolean) });
      total += orfaos.length;
    }
  }

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
  const resumo = await gerarResumoOperacional();
  await registrarLog({ tipo: 'preview', executadoPor, resumo, removidos: 0 });
  return resumo;
}

export async function executarLimpezaPrePublicacao({ confirmacao, executadoPor } = {}) {
  if (confirmacao !== CONFIRMACAO_FORTE) {
    throw new Error(`Confirmação inválida. Use exatamente: ${CONFIRMACAO_FORTE}`);
  }

  const resumo = await gerarResumoOperacional();
  let removidos = 0;
  const removidosPorEntidade = {};

  for (const modulo of MODULOS_LIMPEZA) {
    for (const nome of modulo.entidades) {
      const rows = await listSafe(nome);
      for (const row of rows) {
        if (!row?.id) continue;
        if (await deleteSafe(nome, row.id)) {
          removidos += 1;
          removidosPorEntidade[nome] = (removidosPorEntidade[nome] || 0) + 1;
        }
      }
    }
  }

  const orfaosRestantes = await diagnosticarOrfaos();
  for (const item of orfaosRestantes.detalhes) {
    for (const id of item.ids) {
      if (await deleteSafe(item.entidade, id)) {
        removidos += 1;
        removidosPorEntidade[item.entidade] = (removidosPorEntidade[item.entidade] || 0) + 1;
      }
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
