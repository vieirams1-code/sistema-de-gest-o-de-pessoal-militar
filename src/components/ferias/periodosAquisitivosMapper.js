import { getAlertaPeriodoConcessivo, hasPrevisaoValidaPeriodo } from './feriasRules';

const nomeFallback = (periodo) => {
  const nome = periodo?.militar_nome || periodo?.militar?.nome_completo || periodo?.militar?.nome;
  return nome?.trim() || 'Militar não identificado';
};

const postoFallback = (periodo) => (
  periodo?.militar_posto || periodo?.militar?.posto_graduacao || ''
);

const buildAlerta = (periodo) => {
  const alerta = getAlertaPeriodoConcessivo({
    dataLimiteGozo: periodo.data_limite_gozo,
    hasPrevisaoValida: hasPrevisaoValidaPeriodo(periodo),
  });

  if (!alerta) {
    return {
      alerta_codigo: 'ok',
      alerta_gerencial: 'Em dia',
      alerta_dias_restantes: null,
      alerta_nivel: null,
    };
  }

  return {
    alerta_codigo: alerta.nivel,
    alerta_gerencial: alerta.nivel === 'critico' ? 'Crítico' : 'Atenção',
    alerta_dias_restantes: alerta.diasRestantes,
    alerta_nivel: alerta.nivel,
  };
};

export function mapPeriodosAquisitivos(periodos = []) {
  const periodosFlat = periodos.map((periodo) => ({
    ...periodo,
    militar_nome: nomeFallback(periodo),
    militar_posto: postoFallback(periodo),
    ...buildAlerta(periodo),
  }));

  const militaresMap = new Map();

  periodosFlat.forEach((periodo) => {
    const militarId = periodo.militar_id || `sem-id-${periodo.militar_nome}`;

    if (!militaresMap.has(militarId)) {
      militaresMap.set(militarId, {
        militar_id: periodo.militar_id || null,
        militar_nome: periodo.militar_nome,
        militar_posto: periodo.militar_posto,
        militar_matricula: periodo.militar_matricula || '-',
        periodos: [],
      });
    }

    militaresMap.get(militarId).periodos.push(periodo);
  });

  const militares = [...militaresMap.values()]
    .map((militar) => ({
      ...militar,
      periodos: militar.periodos.sort((a, b) => (b.inicio_aquisitivo || '').localeCompare(a.inicio_aquisitivo || '')),
    }))
    .sort((a, b) => a.militar_nome.localeCompare(b.militar_nome));

  return {
    periodosFlat,
    militares,
  };
}

export default mapPeriodosAquisitivos;
