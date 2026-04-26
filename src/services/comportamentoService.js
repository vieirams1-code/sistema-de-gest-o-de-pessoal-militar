const ACAO_APROVAR_MUDANCA_COMPORTAMENTO = 'aprovar_mudanca_comportamento';

let comportamentoClientOverride = null;
let runtimeClientPromise = null;
let comportamentoDeps = null;

async function getComportamentoClient() {
  if (comportamentoClientOverride) return comportamentoClientOverride;
  if (!runtimeClientPromise) {
    runtimeClientPromise = import('../api/base44Client.js').then((mod) => mod.base44);
  }
  return runtimeClientPromise;
}

async function getComportamentoDeps() {
  if (comportamentoDeps) return comportamentoDeps;
  const modulo = await import('./justicaDisciplinaService.js');
  comportamentoDeps = {
    garantirImplantacaoHistoricoComportamento: modulo.garantirImplantacaoHistoricoComportamento,
    registrarMarcoHistoricoComportamento: modulo.registrarMarcoHistoricoComportamento,
  };
  return comportamentoDeps;
}

function normalizarId(id) {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}

function obterStatusPendencia(pendencia = {}) {
  return String(pendencia?.status_pendencia || '').trim();
}

function temPermissaoAprovarMudanca(usuarioAtual = {}) {
  if (!usuarioAtual || typeof usuarioAtual !== 'object') return false;

  if (typeof usuarioAtual.canAccessAction === 'function') {
    return Boolean(usuarioAtual.canAccessAction(ACAO_APROVAR_MUDANCA_COMPORTAMENTO));
  }

  if (usuarioAtual.permissions === 'ALL' || usuarioAtual.permissoes === 'ALL') return true;

  const matrizes = [
    usuarioAtual.permissions,
    usuarioAtual.permissoes,
    usuarioAtual.permission_matrix,
    usuarioAtual.matriz_permissoes,
  ].filter((item) => item && typeof item === 'object');

  return matrizes.some((matriz) => Boolean(matriz?.perm_aprovar_mudanca_comportamento));
}

async function buscarPendenciaPorId(pendenciaEntity, id) {
  if (!id || !pendenciaEntity || typeof pendenciaEntity.filter !== 'function') return null;
  const [registro] = await pendenciaEntity.filter({ id });
  return registro || null;
}

async function resolverPendenciasEntrada(pendenciasEntrada = [], pendenciaEntity) {
  if (!Array.isArray(pendenciasEntrada) || pendenciasEntrada.length === 0) return [];

  const resolvidas = [];
  for (const item of pendenciasEntrada) {
    if (typeof item === 'string' || typeof item === 'number') {
      const pendencia = await buscarPendenciaPorId(pendenciaEntity, normalizarId(item));
      resolvidas.push(pendencia || { id: normalizarId(item), __nao_encontrada: true });
      // eslint-disable-next-line no-continue
      continue;
    }

    if (item && typeof item === 'object') {
      const id = normalizarId(item.id);
      if (!id) {
        resolvidas.push(item);
        // eslint-disable-next-line no-continue
        continue;
      }

      const pendenciaAtualizada = await buscarPendenciaPorId(pendenciaEntity, id);
      resolvidas.push(pendenciaAtualizada || item);
      // eslint-disable-next-line no-continue
      continue;
    }

    resolvidas.push({ id: '', __entrada_invalida: true });
  }

  return resolvidas;
}

function montarItemRelatorio({ pendencia, motivo, erro, militar }) {
  return {
    pendenciaId: normalizarId(pendencia?.id),
    militarId: normalizarId(pendencia?.militar_id || militar?.id),
    nomeMilitar: String(pendencia?.militar_nome || militar?.nome_completo || '').trim(),
    motivo,
    erro: erro ? String(erro?.message || erro) : '',
  };
}

async function buscarMilitarPorId(militarEntity, militarId) {
  if (!militarId || typeof militarEntity?.filter !== 'function') return null;
  const [militar] = await militarEntity.filter({ id: militarId });
  return militar || null;
}

export async function aplicarPendenciasComportamentoEmLote({
  pendencias = [],
  usuarioAtual = null,
  options = {},
} = {}) {
  const resultado = {
    totalRecebidas: Array.isArray(pendencias) ? pendencias.length : 0,
    totalAplicadas: 0,
    totalIgnoradas: 0,
    totalFalhas: 0,
    aplicadas: [],
    ignoradas: [],
    falhas: [],
  };

  if (!Array.isArray(pendencias) || pendencias.length === 0) {
    return resultado;
  }

  if (!options?.ignorarValidacaoPermissao && !temPermissaoAprovarMudanca(usuarioAtual)) {
    throw new Error('Usuário sem permissão para aprovar mudança de comportamento.');
  }

  const client = await getComportamentoClient();
  const pendenciaEntity = client?.entities?.PendenciaComportamento;
  const militarEntity = client?.entities?.Militar;
  const deps = await getComportamentoDeps();

  const pendenciasResolvidas = await resolverPendenciasEntrada(pendencias, pendenciaEntity);

  for (const pendencia of pendenciasResolvidas) {
    try {
      const pendenciaId = normalizarId(pendencia?.id);
      if (!pendenciaId) {
        resultado.falhas.push(montarItemRelatorio({ pendencia, motivo: 'pendencia_sem_id' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      if (pendencia?.__nao_encontrada) {
        resultado.falhas.push(montarItemRelatorio({ pendencia, motivo: 'pendencia_nao_encontrada' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      if (obterStatusPendencia(pendencia) !== 'Pendente') {
        resultado.ignoradas.push(montarItemRelatorio({ pendencia, motivo: 'pendencia_nao_pendente' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      const militarId = normalizarId(pendencia?.militar_id);
      if (!militarId) {
        resultado.falhas.push(montarItemRelatorio({ pendencia, motivo: 'militar_id_ausente' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      const comportamentoSugerido = String(pendencia?.comportamento_sugerido || '').trim();
      if (!comportamentoSugerido) {
        resultado.falhas.push(montarItemRelatorio({ pendencia, motivo: 'comportamento_sugerido_ausente' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      const militar = await buscarMilitarPorId(militarEntity, militarId);
      if (!militar) {
        resultado.falhas.push(montarItemRelatorio({ pendencia, motivo: 'militar_nao_encontrado' }));
        // eslint-disable-next-line no-continue
        continue;
      }

      const comportamentoAtual = String(militar?.comportamento || 'Bom').trim();
      if (comportamentoAtual === comportamentoSugerido && !options?.permitirComportamentoIgual) {
        resultado.ignoradas.push(montarItemRelatorio({
          pendencia,
          militar,
          motivo: 'comportamento_ja_igual_ao_sugerido',
        }));
        // eslint-disable-next-line no-continue
        continue;
      }

      await militarEntity.update(militarId, {
        comportamento: comportamentoSugerido,
      });

      await deps.garantirImplantacaoHistoricoComportamento({
        militarId,
        comportamentoAtual,
        origemTipo: 'Militar',
        origemId: militarId,
      });

      const dataReferencia = options?.dataReferencia || new Date().toISOString().slice(0, 10);
      await deps.registrarMarcoHistoricoComportamento({
        militarId,
        dataVigencia: dataReferencia,
        comportamentoAnterior: comportamentoAtual,
        comportamento: comportamentoSugerido,
        motivoMudanca: 'Mudança efetiva de comportamento aprovada na Avaliação de Comportamento.',
        fundamentoLegal: pendencia?.fundamento_legal || '',
        origemTipo: 'PendenciaComportamento',
        origemId: pendenciaId,
        observacoes: 'Mudança aprovada manualmente na Avaliação de Comportamento.',
      });

      await pendenciaEntity.update(pendenciaId, {
        status_pendencia: 'Aplicada',
        data_confirmacao: new Date().toISOString().slice(0, 10),
        confirmado_por: String(usuarioAtual?.email || usuarioAtual?.login || '').trim() || null,
      });

      resultado.aplicadas.push(montarItemRelatorio({ pendencia, militar, motivo: 'aplicada' }));
    } catch (erro) {
      resultado.falhas.push(montarItemRelatorio({
        pendencia,
        motivo: 'falha_na_aplicacao',
        erro: erro,
      }));
    }
  }

  resultado.totalAplicadas = resultado.aplicadas.length;
  resultado.totalIgnoradas = resultado.ignoradas.length;
  resultado.totalFalhas = resultado.falhas.length;

  return resultado;
}

export function __setComportamentoServiceClientForTests(client) {
  comportamentoClientOverride = client || null;
}

export function __setComportamentoServiceDepsForTests(deps = {}) {
  comportamentoDeps = { ...(comportamentoDeps || {}), ...deps };
}

export function __resetComportamentoServiceForTests() {
  comportamentoClientOverride = null;
  runtimeClientPromise = null;
  comportamentoDeps = null;
}
