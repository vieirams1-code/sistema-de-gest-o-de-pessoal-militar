import { differenceInYears } from 'date-fns';

/**
 * Sistema de pontuação:
 * - Repreensão: 0,25 pontos
 * - Detenção: 0,5 pontos
 * - Prisão: 1 ponto
 * 
 * Regras (em ordem):
 * 1. Último ano: > 2 pontos = MAU, exatamente 2 = Insuficiente
 * 2. Últimos 2 anos: até 2 pontos = BOM, > 2 = Insuficiente
 * 3. Últimos 4 anos: até 0,5 pontos = Ótimo
 * 4. Últimos 8 anos: 0 pontos = Excepcional
 * 
 * OBS: Só conta punições após a data de inclusão do militar
 */
export function calcularComportamento(punicoes, dataInclusao) {
  const hoje = new Date();
  
  // Data limite: punições só contam após a inclusão
  const dataLimite = dataInclusao ? new Date(dataInclusao + 'T00:00:00') : null;
  
  // Filtrar apenas punições válidas (após inclusão)
  const punicoesValidas = (punicoes || []).filter(p => {
    if (!dataLimite) return true;
    const dataPunicao = new Date(p.data_aplicacao + 'T00:00:00');
    return dataPunicao >= dataLimite;
  });
  
  // Calcular pontos de uma lista de punições
  const calcularPontos = (listaPunicoes) => {
    return listaPunicoes.reduce((total, p) => {
      if (p.tipo === 'Repreensão') return total + 0.25;
      if (p.tipo === 'Detenção') return total + 0.5;
      if (p.tipo === 'Prisão') return total + 1;
      return total; // Advertência Verbal não conta
    }, 0);
  };
  
  // Filtrar punições por período
  const punicoesUltimoAno = punicoesValidas.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 1;
  });

  const punicoesUltimos2Anos = punicoesValidas.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 2;
  });

  const punicoesUltimos4Anos = punicoesValidas.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 4;
  });

  const punicoesUltimos8Anos = punicoesValidas.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 8;
  });

  // Passo 1: Último ano
  const pontosUltimoAno = calcularPontos(punicoesUltimoAno);
  if (pontosUltimoAno > 2) {
    return { comportamento: 'MAU', motivo: `${pontosUltimoAno.toFixed(2)} pontos no último ano (> 2)` };
  }
  if (pontosUltimoAno === 2) {
    return { comportamento: 'Insuficiente', motivo: '2 pontos no último ano' };
  }
  
  // Passo 2: Últimos 2 anos
  const pontosUltimos2Anos = calcularPontos(punicoesUltimos2Anos);
  if (pontosUltimos2Anos <= 2) {
    return { comportamento: 'Bom', motivo: `${pontosUltimos2Anos.toFixed(2)} pontos nos últimos 2 anos (≤ 2)` };
  }
  if (pontosUltimos2Anos > 2) {
    return { comportamento: 'Insuficiente', motivo: `${pontosUltimos2Anos.toFixed(2)} pontos nos últimos 2 anos (> 2)` };
  }
  
  // Passo 3: Últimos 4 anos
  const pontosUltimos4Anos = calcularPontos(punicoesUltimos4Anos);
  if (pontosUltimos4Anos <= 0.5) {
    return { comportamento: 'Ótimo', motivo: `${pontosUltimos4Anos.toFixed(2)} pontos nos últimos 4 anos (≤ 0,5)` };
  }
  
  // Passo 4: Últimos 8 anos
  const pontosUltimos8Anos = calcularPontos(punicoesUltimos8Anos);
  if (pontosUltimos8Anos === 0) {
    return { comportamento: 'Excepcional', motivo: '0 pontos nos últimos 8 anos' };
  }
  
  // Default: Bom
  return { comportamento: 'Bom', motivo: 'Sem enquadramento específico - padrão Bom' };
}