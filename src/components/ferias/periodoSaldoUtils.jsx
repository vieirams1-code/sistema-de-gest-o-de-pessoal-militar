// Re-exporta tudo de periodoSaldoService para compatibilidade
export {
  DIAS_BASE_PADRAO,
  filtrarFeriasDoPeriodo,
  obterDiasBase,
  obterDiasAjuste,
  calcularDiasTotal,
  calcularDiasGozados,
  calcularDiasPrevistos,
  calcularDiasSaldo,
  recalcularSaldoPeriodo,
  getSaldoConsolidadoPeriodo,
  validarDiasNoSaldoPeriodo,
} from './periodoSaldoService';