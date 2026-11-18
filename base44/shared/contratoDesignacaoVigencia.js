export function lerDataCivilContrato(valor) {
  const texto = String(valor || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const data = new Date(`${texto}T00:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === texto ? data : null;
}

const diaIso = (data) => data.toISOString().slice(0, 10);

export function contratoDesignacaoDeterminado(contrato) {
  return String(contrato?.tipo_prazo_contrato || '').trim().toLowerCase() === 'determinado';
}

export function periodoAnualContrato(inicio) {
  const fim = lerDataCivilContrato(inicio);
  if (!fim) return null;
  fim.setUTCFullYear(fim.getUTCFullYear() + 1);
  const proximoInicio = diaIso(fim);
  fim.setUTCDate(fim.getUTCDate() - 1);
  return { inicio, fim: diaIso(fim), proximoInicio };
}

export function calcularRenovacaoContrato(fimAnterior) {
  const inicio = lerDataCivilContrato(fimAnterior);
  if (!inicio) return null;
  inicio.setUTCDate(inicio.getUTCDate() + 1);
  return periodoAnualContrato(diaIso(inicio));
}

export function periodoCobertoPeloContratoDeterminado(contrato, inicio, fim) {
  if (!lerDataCivilContrato(contrato.data_inicio_contrato) || !lerDataCivilContrato(contrato.data_fim_contrato)
    || !lerDataCivilContrato(inicio) || !lerDataCivilContrato(fim) || fim > contrato.data_fim_contrato) return false;
  let inicioEsperado = contrato.data_inicio_contrato;
  for (let ano = 0; ano < 120 && inicioEsperado <= inicio; ano += 1) {
    const periodo = periodoAnualContrato(inicioEsperado);
    if (periodo.inicio === inicio) return periodo.fim === fim;
    inicioEsperado = periodo.proximoInicio;
  }
  return false;
}
