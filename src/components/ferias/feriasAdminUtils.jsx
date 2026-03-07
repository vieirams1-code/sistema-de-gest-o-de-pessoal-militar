import { format, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';

/**
 * Mapeia a cadeia de eventos de uma férias, ordenados cronologicamente.
 */
export function montarCadeia(ferias, registrosLivro) {
  return registrosLivro
    .filter(r => r.ferias_id === ferias.id)
    .sort((a, b) => {
      const da = new Date(a.data_registro || a.created_date || 0);
      const db = new Date(b.data_registro || b.created_date || 0);
      return da - db;
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
 * Recalcula o estado da férias com base nos eventos restantes após remoção.
 * Retorna o objeto de atualização para base44.entities.Ferias.update()
 */
export function recalcularEstadoFerias(ferias, eventosSobreviventes) {
  if (eventosSobreviventes.length === 0) {
    // Sem eventos → volta para Prevista, mantém dados originais
    return {
      status: 'Prevista',
    };
  }

  const tipos = eventosSobreviventes.map(e => e.tipo_registro);
  const temSaida = tipos.some(t => t === 'Saída Férias');
  const temRetorno = tipos.some(t => t === 'Retorno Férias');
  const temInterrupcao = tipos.some(t => t === 'Interrupção de Férias');

  let novoStatus = ferias.status;
  let novaObs = ferias.observacoes || '';

  if (!temSaida) {
    novoStatus = 'Prevista';
  } else if (temRetorno) {
    novoStatus = 'Gozada';
  } else if (temInterrupcao) {
    novoStatus = 'Interrompida';
  } else if (temSaida) {
    novoStatus = 'Em Curso';
  }

  // Recalcular dias a partir dos eventos de desconto/adição restantes
  let diasBase = ferias.dias || 30;
  let linhasObs = [];

  // Filtrar linhas de obs que correspondem a eventos ainda existentes
  if (ferias.observacoes) {
    const linhasExistentes = ferias.observacoes.split('\n').filter(l => l.match(/^[+-]\d+d:/));
    // Manter apenas as linhas que correspondem a eventos de desconto/adição sobreviventes
    const tiposDesconto = eventosSobreviventes
      .filter(e => e.tipo_registro === 'Dispensa Desconto Férias')
      .map(e => e.motivo_dispensa || '');
    linhasObs = linhasExistentes; // conservamos as linhas dos sobreviventes
  }

  // Recalcular saldo de interrupção se houver interrupção
  if (novoStatus === 'Interrompida') {
    const ultimaInterrupcao = [...eventosSobreviventes]
      .reverse()
      .find(e => e.tipo_registro === 'Interrupção de Férias');
    if (ultimaInterrupcao) {
      const saida = eventosSobreviventes.find(e => e.tipo_registro === 'Saída Férias');
      if (saida?.data_inicio && ultimaInterrupcao.data_inicio) {
        const diasGozados = Math.round(
          (new Date(ultimaInterrupcao.data_inicio + 'T00:00:00') - new Date(saida.data_inicio + 'T00:00:00')) / (1000 * 60 * 60 * 24)
        );
        const saldo = diasBase - diasGozados;
        const semSaldoLinha = novaObs.replace(/Saldo: \d+ dias/g, '').trim();
        novaObs = semSaldoLinha ? `${semSaldoLinha}\nSaldo: ${saldo} dias` : `Saldo: ${saldo} dias`;
      }
    }
  } else if (novoStatus !== 'Interrompida') {
    // Limpar linha de saldo se não for mais interrompida
    novaObs = novaObs.replace(/\nSaldo: \d+ dias/g, '').replace(/^Saldo: \d+ dias\n?/g, '').trim();
  }

  return { status: novoStatus, observacoes: novaObs };
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

  // Calcular eventos sobreviventes
  const sobreviventes = cadeia.filter(e => !idsParaExcluir.includes(e.id));

  // Recalcular estado da férias
  const atualizacaoFerias = recalcularEstadoFerias(ferias, sobreviventes);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);

  // Recalcular período aquisitivo se vinculado
  if (ferias.periodo_aquisitivo_id) {
    const novoStatus = atualizacaoFerias.status;
    let periodoUpdate = {};

    if (novoStatus === 'Prevista') {
      periodoUpdate = { status: 'Disponível', dias_gozados: 0, dias_previstos: ferias.dias || 0 };
    } else if (novoStatus === 'Em Curso') {
      periodoUpdate = { status: 'Previsto', dias_gozados: 0, dias_previstos: ferias.dias || 0 };
    } else if (novoStatus === 'Gozada') {
      periodoUpdate = { status: 'Gozado', dias_gozados: ferias.dias || 0, dias_previstos: 0 };
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
 */
export async function recalcularCadeiaCompleta({ ferias, cadeia, queryClient }) {
  const atualizacaoFerias = recalcularEstadoFerias(ferias, cadeia);
  await base44.entities.Ferias.update(ferias.id, atualizacaoFerias);

  if (ferias.periodo_aquisitivo_id) {
    const novoStatus = atualizacaoFerias.status;
    let periodoUpdate = {};

    if (novoStatus === 'Prevista') {
      periodoUpdate = { status: 'Disponível', dias_gozados: 0, dias_previstos: ferias.dias || 0 };
    } else if (novoStatus === 'Em Curso') {
      periodoUpdate = { status: 'Previsto', dias_gozados: 0, dias_previstos: ferias.dias || 0 };
    } else if (novoStatus === 'Gozada') {
      periodoUpdate = { status: 'Gozado', dias_gozados: ferias.dias || 0, dias_previstos: 0 };
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