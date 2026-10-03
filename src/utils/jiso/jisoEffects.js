// Operational copies only: the original medical documents remain unchanged.
export function aplicarEfeitosJiso(atestados = [], jisos = []) {
  const vistos = new Set();
  const resultado = [];
  for (const atestado of atestados || []) {
    let efeito = atestado.jiso_efeito;
    if (!efeito) {
      const jiso = (jisos || []).find(j => (j.atestado_ids || []).includes(atestado.id) || j.atestado_id === atestado.id);
      if (jiso && !jiso.efeito_suspenso && ['Resultado Registrado', 'Concluída'].includes(jiso.status)) {
        efeito = { id: jiso.id, data_inicio: jiso.data_inicio_efeito, data_termino: jiso.data_termino_efeito, data_retorno: jiso.data_retorno_efeito, dias: jiso.dias_jiso };
      }
    }
    if (!efeito || (!efeito.data_inicio || !efeito.data_termino) && !(efeito.dias != null && Number(efeito.dias) === 0)) {
      resultado.push(atestado);
      continue;
    }
    if (vistos.has(efeito.id)) continue;
    vistos.add(efeito.id);
    if (efeito.dias != null && Number(efeito.dias) === 0) continue;
    resultado.push({
      ...atestado, id: 'jiso:' + efeito.id, origem_atestado_id: atestado.id,
      jiso_id_derivado: efeito.id, origem_efeito: 'JISO',
      data_inicio: efeito.data_inicio, data_termino: efeito.data_termino,
      data_retorno: efeito.data_retorno, dias: efeito.dias,
      status: 'Ativo',
    });
  }
  return resultado;
}
