import { format, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Tipos de eventos que representam operações na cadeia de férias.
 */
export const TIPOS_EVENTO_FERIAS = {
  SAIDA: 'Saída Férias',
  RETORNO: 'Retorno Férias',
  INTERRUPCAO: 'Interrupção de Férias',
  ADICAO: 'Adição de Dias',
  DESCONTO: 'Desconto em Férias',
  NOVA_SAIDA: 'Nova Saída / Retomada',
};

/**
 * Mapeia a cadeia de eventos de uma férias, ordenados cronologicamente.
 * Ordena por data_registro (data do evento), depois por created_date.
 */
export function montarCadeia(ferias, registrosLivro) {
  return registrosLivro
    .filter(r => r.ferias_id === ferias.id)
    .sort((a, b) => {
      // Comparar por data_registro primeiro (mais preciso)
      const da = new Date((a.data_registro || a.created_date || '2000-01-01') + 'T00:00:00');
      const db = new Date((b.data_registro || b.created_date || '2000-01-01') + 'T00:00:00');
      if (da - db !== 0) return da - db;
      // Empate: created_date como desempate
      return new Date(a.created_date || 0) - new Date(b.created_date || 0);
    });
}

/**
 * Retorna quais eventos são "descendentes" de um evento alvo (posteriores na cadeia).
 */
export function identificarDescendentes(eventoAlvo, cadeia) {
  const idx = cadeia.findIndex(e => e.id === eventoAlvo.id);
  if (idx === -1) return [];
  return cadeia.slice(idx + 1);
}

/**
 * Recalcula o estado completo da férias com base nos eventos sobreviventes.
 * Reconstrói dias, datas, observações derivadas e status.
 * NÃO usa observações como fonte de verdade — usa os eventos reais.
 */
export function recalcularEstadoFerias(ferias, eventosSobreviventes) {
  if (eventosSobreviventes.length === 0) {
    return { status: 'Prevista', observacoes: '' };
  }

  const tipos = eventosSobreviventes.map(e => e.tipo_registro);
  const temSaida = tipos.includes(TIPOS_EVENTO_FERIAS.SAIDA) || tipos.includes(TIPOS_EVENTO_FERIAS.NOVA_SAIDA);
  const temRetorno = tipos.includes(TIPOS_EVENTO_FERIAS.RETORNO);
  const temInterrupcao = tipos.includes(TIPOS_EVENTO_FERIAS.INTERRUPCAO);

  // Determinar status
  let novoStatus;
  if (!temSaida) {
    novoStatus = 'Prevista';
  } else if (temRetorno) {
    novoStatus = 'Gozada';
  } else if (temInterrupcao) {
    // Verificar se depois da interrupção há nova saída
    const idxInterrupcao = [...eventosSobreviventes].map((e,i) => e.tipo_registro === TIPOS_EVENTO_FERIAS.INTERRUPCAO ? i : -1).filter(i => i >= 0).pop() ?? -1;
    const idxNovaSaida = [...eventosSobreviventes].map((e,i) => e.tipo_registro === TIPOS_EVENTO_FERIAS.NOVA_SAIDA ? i : -1).filter(i => i >= 0).pop() ?? -1;
    if (idxNovaSaida > idxInterrupcao) {
      novoStatus = 'Em Curso';
    } else {
      novoStatus = 'Interrompida';
    }
  } else {
    novoStatus = 'Em Curso';
  }

  // dias_base é a fonte de verdade imutável. Fallbacks para compatibilidade com registros antigos.
  const diasBase = ferias.dias_base || ferias.dias_originais || ferias.dias || 30;
  const eventosAdicao = eventosSobreviventes.filter(e => e.tipo_registro === TIPOS_EVENTO_FERIAS.ADICAO);
  const eventosDesconto = eventosSobreviventes.filter(e => e.tipo_registro === TIPOS_EVENTO_FERIAS.DESCONTO);

  // dias_evento armazena sempre o valor positivo do impacto individual
  const totalAdicoes = eventosAdicao.reduce((sum, e) => sum + (e.dias_evento || 0), 0);
  const totalDescontos = eventosDesconto.reduce((sum, e) => sum + (e.dias_evento || 0), 0);
  const novosDias = Math.max(0, diasBase + totalAdicoes - totalDescontos);

  // Recalcular datas com base nos dias calculados e na data de início original
  let novaDataFim = ferias.data_fim;
  let novaDataRetorno = ferias.data_retorno;
  if (ferias.data_inicio && novosDias > 0) {
    novaDataFim = format(addDays(new Date(ferias.data_inicio + 'T00:00:00'), novosDias - 1), 'yyyy-MM-dd');
    novaDataRetorno = format(addDays(new Date(ferias.data_inicio + 'T00:00:00'), novosDias), 'yyyy-MM-dd');
  }

  // Reconstruir observações derivadas apenas dos eventos sobreviventes
  // Apenas linhas de ajuste — nunca linhas residuais de observacoes antigas
  const linhasObs = [];
  eventosSobreviventes.forEach(e => {
    if (e.tipo_registro === TIPOS_EVENTO_FERIAS.ADICAO && e.dias_evento) {
      linhasObs.push(`+${e.dias_evento}d: ${e.motivo_dispensa || 'Adição de dias'}`);
    } else if (e.tipo_registro === TIPOS_EVENTO_FERIAS.DESCONTO && e.dias_evento) {
      linhasObs.push(`-${e.dias_evento}d: ${e.motivo_dispensa || 'Desconto em férias'}`);
    }
  });

  // Calcular saldo de interrupção se necessário
  if (novoStatus === 'Interrompida') {
    const primeiroSaida = eventosSobreviventes.find(e =>
      e.tipo_registro === TIPOS_EVENTO_FERIAS.SAIDA || e.tipo_registro === TIPOS_EVENTO_FERIAS.NOVA_SAIDA
    );
    const ultimaInterrupcao = [...eventosSobreviventes].reverse().find(e =>
      e.tipo_registro === TIPOS_EVENTO_FERIAS.INTERRUPCAO
    );

    if (primeiroSaida?.data_inicio && ultimaInterrupcao?.data_inicio) {
      const diasGozados = Math.round(
        (new Date(ultimaInterrupcao.data_inicio + 'T00:00:00') - new Date(primeiroSaida.data_inicio + 'T00:00:00')) /
        (1000 * 60 * 60 * 24)
      );
      const saldo = novosDias - diasGozados;
      linhasObs.push(`Saldo: ${Math.max(0, saldo)} dias`);
    }
  }

  return {
    status: novoStatus,
    dias: novosDias,
    data_fim: novaDataFim,
    data_retorno: novaDataRetorno,
    observacoes: linhasObs.join('\n'),
  };
}

/**
 * Executa a exclusão administrativa assistida:
 * - Exclui os eventos selecionados (alvo + descendentes se solicitado)
 * - Recalcula o estado da férias
 * - Recalcula o período aquisitivo se necessário
 */
export async function executarExclusaoAdminCadeia({
  ferias,
  eventoAlvo,
  incluirDescendentes,
  cadeia,
  queryClient,
}) {
  const descendentes = identificarDescendentes(eventoAlvo, cadeia);
  const idsParaExcluir = incluirDescendentes
    ? [eventoAlvo.id, ...descendentes.map(d => d.id)]
    : [eventoAlvo.id];

  // Excluir eventos selecionados
  for (const id of idsParaExcluir) {
    await base44.entities.RegistroLivro.delete(id);
  }

  // Calcular eventos sobreviventes (excluindo os removidos)
  const sobreviventes = cadeia.filter(e => !idsParaExcluir.includes(e.id));

  // Reler a férias do banco para garantir dias_base atualizado
  // (evita usar objeto React stale que pode ter dias_base ausente)
  let feriasFresh = ferias;
  try {
    const lista = await base44.entities.Ferias.filter({ id: ferias.id });
    if (lista[0]) feriasFresh = lista[0];
  } catch (_) { /* fallback para ferias da prop */ }

  // Recalcular estado da férias usando dados frescos
  const atualizacaoFerias = recalcularEstadoFerias(feriasFresh, sobreviventes);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);

  // Recalcular período aquisitivo se vinculado
  // IMPORTANTE: usar atualizacaoFerias.dias (recalculado) — nunca ferias.dias (stale)
  if (ferias.periodo_aquisitivo_id) {
    const novoStatus = atualizacaoFerias.status;
    const novosDias = atualizacaoFerias.dias ?? feriasFresh.dias_base ?? feriasFresh.dias ?? 0;
    let periodoUpdate = {};

    if (novoStatus === 'Prevista') {
      periodoUpdate = { status: 'Disponível', dias_gozados: 0, dias_previstos: novosDias };
    } else if (novoStatus === 'Em Curso') {
      periodoUpdate = { status: 'Previsto', dias_gozados: 0, dias_previstos: novosDias };
    } else if (novoStatus === 'Gozada') {
      periodoUpdate = { status: 'Gozado', dias_gozados: novosDias, dias_previstos: 0 };
    } else if (novoStatus === 'Interrompida') {
      periodoUpdate = { status: 'Parcialmente Gozado' };
    }

    if (Object.keys(periodoUpdate).length > 0) {
      await base44.entities.PeriodoAquisitivo.update(ferias.periodo_aquisitivo_id, periodoUpdate);
    }
  }

  queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
  queryClient.invalidateQueries({ queryKey: ['ferias'] });
  queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
}

/**
 * Recalcula o estado da cadeia sem excluir nada (apenas corrige inconsistências).
 * Reconstrói dias, datas, status e observações derivadas.
 * Relê a férias do banco para garantir dias_base atualizado.
 */
export async function recalcularCadeiaCompleta({ ferias, cadeia, queryClient }) {
  let feriasFresh = ferias;
  try {
    const lista = await base44.entities.Ferias.filter({ id: ferias.id });
    if (lista[0]) feriasFresh = lista[0];
  } catch (_) { /* fallback */ }
  const atualizacaoFerias = recalcularEstadoFerias(feriasFresh, cadeia);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);

  if (ferias.periodo_aquisitivo_id) {
    const novoStatus = atualizacaoFerias.status;
    const novosDias = atualizacaoFerias.dias ?? feriasFresh.dias_base ?? feriasFresh.dias ?? 0;
    let periodoUpdate = {};

    if (novoStatus === 'Prevista') {
      periodoUpdate = { status: 'Disponível', dias_gozados: 0, dias_previstos: novosDias };
    } else if (novoStatus === 'Em Curso') {
      periodoUpdate = { status: 'Previsto', dias_gozados: 0, dias_previstos: novosDias };
    } else if (novoStatus === 'Gozada') {
      periodoUpdate = { status: 'Gozado', dias_gozados: novosDias, dias_previstos: 0 };
    } else if (novoStatus === 'Interrompida') {
      periodoUpdate = { status: 'Parcialmente Gozado' };
    }

    if (Object.keys(periodoUpdate).length > 0) {
      await base44.entities.PeriodoAquisitivo.update(ferias.periodo_aquisitivo_id, periodoUpdate);
    }
  }

  queryClient.invalidateQueries({ queryKey: ['ferias'] });
  queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });

  return atualizacaoFerias;
}