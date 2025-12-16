import { differenceInYears } from 'date-fns';

/**
 * Calcula o comportamento automático baseado nas punições
 * Regras:
 * - Excepcional: 8 anos sem punição
 * - Ótimo: 4 anos com até 1 detenção (2 repreensões = 1 detenção)
 * - Bom: 2 anos com até 2 prisões (4 repreensões = 1 prisão, 2 detenções = 1 prisão)
 * - Insuficiente: 1 ano com até 2 prisões
 * - MAU: 1 ano com mais de 2 prisões
 */
export function calcularComportamento(punicoes, dataInclusao) {
  const hoje = new Date();
  
  // Se não tem punições
  if (!punicoes || punicoes.length === 0) {
    if (dataInclusao) {
      const anosServico = differenceInYears(hoje, new Date(dataInclusao + 'T00:00:00'));
      if (anosServico >= 8) {
        return { comportamento: 'Excepcional', motivo: '8 anos de serviço sem punições' };
      }
    }
    return { comportamento: 'Bom', motivo: 'Sem punições' };
  }

  // Filtrar punições por período
  const punicoesUltimoAno = punicoes.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 1;
  });

  const punicoesUltimos2Anos = punicoes.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 2;
  });

  const punicoesUltimos4Anos = punicoes.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 4;
  });

  const punicoesUltimos8Anos = punicoes.filter(p => {
    const diff = differenceInYears(hoje, new Date(p.data_aplicacao + 'T00:00:00'));
    return diff < 8;
  });

  // Converter punições em equivalente
  const converterParaPrisoes = (listaPunicoes) => {
    let repreensoes = 0;
    let detencoes = 0;
    let prisoes = 0;

    listaPunicoes.forEach(p => {
      if (p.tipo === 'Repreensão' || p.tipo === 'Advertência Verbal') repreensoes++;
      else if (p.tipo === 'Detenção') detencoes++;
      else if (p.tipo === 'Prisão') prisoes++;
    });

    // Converter: 4 repreensões = 1 prisão
    prisoes += Math.floor(repreensoes / 4);
    repreensoes = repreensoes % 4;

    // Converter: 2 repreensões = 1 detenção
    detencoes += Math.floor(repreensoes / 2);
    
    // Converter: 2 detenções = 1 prisão
    prisoes += Math.floor(detencoes / 2);
    detencoes = detencoes % 2;

    return { repreensoes, detencoes, prisoes };
  };

  // Regra MAU: mais de 2 prisões no último ano
  const equivalenteUltimoAno = converterParaPrisoes(punicoesUltimoAno);
  if (equivalenteUltimoAno.prisoes > 2) {
    return { comportamento: 'MAU', motivo: 'Mais de 2 prisões (equivalentes) no último ano' };
  }

  // Regra Insuficiente: até 2 prisões no último ano
  if (equivalenteUltimoAno.prisoes >= 1 && equivalenteUltimoAno.prisoes <= 2) {
    return { comportamento: 'Insuficiente', motivo: `${equivalenteUltimoAno.prisoes} prisão(ões) no último ano` };
  }

  // Regra Bom: até 2 prisões nos últimos 2 anos
  const equivalenteUltimos2Anos = converterParaPrisoes(punicoesUltimos2Anos);
  if (equivalenteUltimos2Anos.prisoes <= 2) {
    return { comportamento: 'Bom', motivo: 'Até 2 prisões nos últimos 2 anos' };
  }

  // Regra Ótimo: até 1 detenção nos últimos 4 anos (sem prisões)
  const equivalenteUltimos4Anos = converterParaPrisoes(punicoesUltimos4Anos);
  if (equivalenteUltimos4Anos.prisoes === 0 && equivalenteUltimos4Anos.detencoes <= 1) {
    return { comportamento: 'Ótimo', motivo: 'Até 1 detenção nos últimos 4 anos' };
  }

  // Regra Excepcional: sem punições nos últimos 8 anos
  if (punicoesUltimos8Anos.length === 0) {
    return { comportamento: 'Excepcional', motivo: '8 anos sem punições' };
  }

  // Default
  return { comportamento: 'Bom', motivo: 'Análise padrão' };
}