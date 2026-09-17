// Cálculo canônico do saldo e dos meses elegíveis de um período aquisitivo
// dentro de um Plano de Férias. Compartilhado entre o portal do militar,
// o painel administrativo e os registros administrativos.

export const STATUS_FERIAS_IMPACTO_PLANO = new Set(['Gozada', 'Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);
export const STATUS_FERIAS_PREVISAO_PLANO = new Set(['Prevista', 'Autorizada', 'Em Curso', 'Interrompida']);

export function numeroSeguro(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function textoId(value: unknown): string {
  return String(value ?? '').trim();
}

export function adicionarDiasData(data: string, dias: number): string {
  if (!data) return '';
  const dt = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

export function ultimoDiaMes(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export function feriasVinculadasAoPlano(ferias: any[] = [], planoId: unknown): any[] {
  // AVISO: Esta função filtra férias por vínculo de plano (plano_ferias_id).
  // NÃO deve ser usada para pré-filtrar férias antes de calcular saldo de
  // período aquisitivo — TODAS as férias com status de impacto que pertencem
  // ao período abatem o saldo, independentemente de vínculo com plano.
  // Passe o array completo de férias do militar diretamente para
  // calcularResumoPeriodoPlano; ela filtra por período internamente.
  // Esta função permanece apenas para listagens/exibições que precisam
  // mostrar férias geradas por um plano específico.
  const id = textoId(planoId);
  return id ? ferias.filter((f: any) => textoId(f?.plano_ferias_id) === id) : ferias;
}

export function feriasPertencePeriodoPlano(ferias: any, periodo: any): boolean {
  const feriasPeriodoId = textoId(ferias?.periodo_aquisitivo_id);
  const periodoId = textoId(periodo?.id);
  if (feriasPeriodoId) return Boolean(periodoId && feriasPeriodoId === periodoId);
  const feriasRef = textoId(ferias?.periodo_aquisitivo_ref);
  const periodoRef = textoId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
  return Boolean(feriasRef && periodoRef && feriasRef === periodoRef);
}

export function ajustePertencePeriodoPlano(ajuste: any, periodo: any): boolean {
  const ajustePeriodoId = textoId(ajuste?.periodo_aquisitivo_id);
  const periodoId = textoId(periodo?.id);
  if (ajustePeriodoId) return Boolean(periodoId && ajustePeriodoId === periodoId);
  const ajusteRef = textoId(ajuste?.periodo_aquisitivo_ref || ajuste?.ano_referencia);
  const periodoRef = textoId(periodo?.ano_referencia || periodo?.referencia || periodo?.periodo_aquisitivo_ref);
  return Boolean(ajusteRef && periodoRef && ajusteRef === periodoRef);
}

export function calcularResumoPeriodoPlano(periodo: any, feriasMilitar: any[] = [], ajustesMilitar: any[] = [], anoCampanha: number) {
  const diasBase = numeroSeguro(periodo?.dias_direito ?? periodo?.dias_adquiridos ?? periodo?.dias_base, 30);
  const ajustesAtivos = (ajustesMilitar || []).filter((a: any) =>
    a && String(a.status || '').toLowerCase() === 'ativo' && ajustePertencePeriodoPlano(a, periodo)
  );
  const creditos = ajustesAtivos.filter((a: any) => String(a.tipo || '').toLowerCase() === 'credito')
    .reduce((acc: number, a: any) => acc + Math.max(0, numeroSeguro(a.dias, 0)), 0);
  const debitos = ajustesAtivos.filter((a: any) => String(a.tipo || '').toLowerCase() === 'debito')
    .reduce((acc: number, a: any) => acc + Math.max(0, numeroSeguro(a.dias, 0)), 0);
  const direitoLiquido = Math.max(0, diasBase + creditos - debitos);

  const feriasPeriodo = (feriasMilitar || []).filter((f: any) => f && feriasPertencePeriodoPlano(f, periodo));
  const diasGozados = feriasPeriodo.filter((f: any) => String(f.status || '') === 'Gozada')
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasPrevistos = feriasPeriodo.filter((f: any) => STATUS_FERIAS_PREVISAO_PLANO.has(String(f.status || '')))
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasComprometidos = feriasPeriodo.filter((f: any) => STATUS_FERIAS_IMPACTO_PLANO.has(String(f.status || '')))
    .reduce((acc: number, f: any) => acc + Math.max(0, numeroSeguro(f.dias, 0)), 0);
  const diasSemPrevisao = Math.max(0, direitoLiquido - diasComprometidos);

  const primeiraDataLegal = adicionarDiasData(periodo?.fim_aquisitivo || '', 1);
  const limiteGozo = periodo?.data_limite_gozo || '';
  const hoje = new Date().toISOString().slice(0, 10);
  const periodoInativo = Boolean(periodo?.inativo || periodo?.status === 'Inativo');
  const situacaoAquisitiva = periodoInativo ? 'Inativo'
    : diasSemPrevisao <= 0 && diasPrevistos <= 0 ? 'Gozado'
    : (periodo?.fim_aquisitivo && periodo.fim_aquisitivo >= hoje ? 'Aberto' : 'Adquirido');
  const situacaoPrevisao = diasSemPrevisao <= 0
    ? (diasPrevistos > 0 ? 'Previsto' : 'Sem saldo')
    : (diasPrevistos > 0 ? 'Parcialmente Previsto' : 'Não Previsto');

  const ultimoDiaAno = `${anoCampanha}-12-31`;
  const elegivelPlano = Boolean(!periodoInativo && diasSemPrevisao > 0 && primeiraDataLegal &&
    primeiraDataLegal <= ultimoDiaAno && (!limiteGozo || primeiraDataLegal <= limiteGozo));

  const mesesElegiveis = Array.from({ length: 12 }, (_, idx) => {
    const mesNumero = idx + 1;
    const mes = String(mesNumero).padStart(2, '0');
    const inicioMes = `${anoCampanha}-${mes}-01`;
    const fimMes = ultimoDiaMes(anoCampanha, mesNumero);
    let dataInicio = inicioMes;
    if (primeiraDataLegal && primeiraDataLegal > dataInicio) dataInicio = primeiraDataLegal;
    const permitido = Boolean(elegivelPlano && dataInicio >= inicioMes && dataInicio <= fimMes && (!limiteGozo || dataInicio <= limiteGozo));
    let motivo = '';
    if (!elegivelPlano) motivo = 'Período sem saldo elegível para este plano.';
    else if (primeiraDataLegal > fimMes) motivo = `Direito disponível somente a partir de ${primeiraDataLegal}.`;
    else if (limiteGozo && dataInicio > limiteGozo) motivo = `Data posterior ao limite de gozo (${limiteGozo}).`;
    return { mes, permitido, data_inicio: permitido ? dataInicio : '', inicio_ajustado: permitido && dataInicio !== inicioMes, motivo };
  });

  return {
    dias_base: diasBase,
    creditos_ativos: creditos,
    debitos_ativos: debitos,
    direito_liquido: direitoLiquido,
    dias_gozados_calculados: diasGozados,
    dias_previstos_calculados: diasPrevistos,
    dias_comprometidos: diasComprometidos,
    dias_sem_previsao: diasSemPrevisao,
    saldo_disponivel: diasSemPrevisao,
    situacao_aquisitiva: situacaoAquisitiva,
    situacao_previsao: situacaoPrevisao,
    primeira_data_legal_gozo: primeiraDataLegal,
    limite_fruicao: limiteGozo,
    elegivel_plano: elegivelPlano,
    meses_elegiveis: mesesElegiveis,
  };
}

export function obterMesPreferencia(opcao: any): string {
  const parcelas = Array.isArray(opcao?.parcelas) ? opcao.parcelas : [];
  const mes = textoId(parcelas?.[0]?.mes || parcelas?.[0]?.data_inicio?.slice?.(5, 7));
  return /^\d{2}$/.test(mes) ? mes : '';
}

export function normalizarPreferenciaMes(opcao: any, resumoPeriodo: any, diasPlanejar: number) {
  const mes = obterMesPreferencia(opcao);
  const regraMes = (resumoPeriodo?.meses_elegiveis || []).find((m: any) => m.mes === mes);
  if (!mes || !regraMes?.permitido || !regraMes?.data_inicio) return null;
  return {
    meses_resumo: opcao?.meses_resumo || mes,
    parcelas: [{ etapa: 1, dias: diasPlanejar, mes, data_inicio: regraMes.data_inicio }],
  };
}

export function intervalosSobrepostos(inicioA: string, fimA: string, inicioB: string, fimB: string): boolean {
  if (!inicioA || !fimA || !inicioB || !fimB) return false;
  return inicioA <= fimB && inicioB <= fimA;
}

export function calcularFimParcela(dataInicio: string, dias: number): string {
  return adicionarDiasData(dataInicio, Math.max(0, dias - 1));
}

export function periodoMaisAntigoElegivel(periodos: any[] = [], ferias: any[] = [], ajustes: any[] = [], ano: number) {
  const ordenados = [...(periodos || [])].sort((a: any, b: any) =>
    String(a?.inicio_aquisitivo || '').localeCompare(String(b?.inicio_aquisitivo || ''))
  );
  for (const periodo of ordenados) {
    const resumo = calcularResumoPeriodoPlano(periodo, ferias, ajustes, ano);
    if (resumo.elegivel_plano && resumo.dias_sem_previsao > 0) return { periodo, resumo };
  }
  return null;
}