function normalizePeriodoRef(periodoRef) {
  if (!periodoRef) return { startYear: 9999, endYear: 9999, raw: '' };

  const match = String(periodoRef).match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!match) {
    return { startYear: 9999, endYear: 9999, raw: String(periodoRef) };
  }

  return {
    startYear: Number(match[1]),
    endYear: Number(match[2]),
    raw: String(periodoRef),
  };
}

export function comparePeriodoRef(a, b) {
  const pa = normalizePeriodoRef(a);
  const pb = normalizePeriodoRef(b);

  if (pa.startYear !== pb.startYear) return pa.startYear - pb.startYear;
  if (pa.endYear !== pb.endYear) return pa.endYear - pb.endYear;
  return pa.raw.localeCompare(pb.raw);
}

export function getBlockingReasonForInicio(feriasAtual, todasFerias) {
  if (!feriasAtual?.id) return null;

  const outrasDoMilitar = (todasFerias || []).filter((item) => {
    if (!item || item.id === feriasAtual.id) return false;

    if (feriasAtual.militar_id) {
      return item.militar_id === feriasAtual.militar_id;
    }

    return true;
  });

  const emCurso = outrasDoMilitar.find((f) => f.status === 'Em Curso');
  if (emCurso) {
    return `Existe férias em curso do período ${emCurso.periodo_aquisitivo_ref || '-'} para este militar. Não é permitido iniciar nova férias enquanto houver outra em curso.`;
  }

  const interrompida = outrasDoMilitar.find((f) => f.status === 'Interrompida');
  if (interrompida) {
    return `Existe férias interrompida do período ${interrompida.periodo_aquisitivo_ref || '-'} para este militar. É necessário concluir a cadeia interrompida antes de iniciar nova férias.`;
  }

  const periodoAtual = feriasAtual.periodo_aquisitivo_ref || '';

  const previstasOuAutorizadasDePeriodosDiferentes = [feriasAtual, ...outrasDoMilitar]
    .filter(
      (f) =>
        (f.status === 'Prevista' || f.status === 'Autorizada') &&
        (f.periodo_aquisitivo_ref || '') !== periodoAtual
    )
    .sort((a, b) => comparePeriodoRef(a.periodo_aquisitivo_ref, b.periodo_aquisitivo_ref));

  const periodoMaisAntigoDiferente = previstasOuAutorizadasDePeriodosDiferentes[0];

  if (
    periodoMaisAntigoDiferente &&
    comparePeriodoRef(periodoMaisAntigoDiferente.periodo_aquisitivo_ref, periodoAtual) < 0
  ) {
    return `Existe período aquisitivo mais antigo pendente de início (${periodoMaisAntigoDiferente.periodo_aquisitivo_ref || '-'}). O início deve respeitar a ordem cronológica dos períodos.`;
  }

  return null;
}
