// Regras compartilhadas da administração de campanhas de férias.
function falhar(mensagem, status = 400) {
  throw Object.assign(new Error(mensagem), { status, code: 'CAMPANHA_VALIDATION' });
}

export function validarNomeCampanha(valor) {
  const titulo = String(valor || '').trim();
  if (!titulo) falhar('Informe o nome da campanha.');
  return titulo;
}

export function validarProrrogacaoCampanha(campanha, payload, agora = Date.now()) {
  const status = String(campanha.status || '').trim().toLowerCase();
  if (!['aberta_coleta', 'aberta', 'ativa', 'em_andamento', 'encerrada'].includes(status)) {
    falhar('Somente campanhas abertas ou encerradas podem ser prorrogadas.', 409);
  }
  const data = String(payload.nova_data_fim_militar || '');
  const hora = String(payload.nova_hora_fim_militar || '');
  const instante = new Date(data + 'T' + hora + ':00-04:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
      || Number.isNaN(instante.getTime())
      || new Date(instante.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10) !== data) {
    falhar('Informe uma data e hora limite válidas.');
  }
  if (instante.getTime() <= agora) falhar('O novo prazo precisa estar no futuro (horário de Campo Grande).');
  const anterior = String(campanha.data_fim_militar || '').slice(0, 10);
  const horaAnterior = String(campanha.hora_fim_militar || '23:59').slice(0, 5);
  if (anterior && data + 'T' + hora <= anterior + 'T' + horaAnterior) {
    falhar('O novo prazo precisa ser posterior ao prazo atual.');
  }
  const justificativa = String(payload.justificativa || '').trim();
  if (justificativa.length < 5) falhar('Informe uma justificativa para a prorrogação.');
  return { novaDataFim: data, novaHoraFim: hora, justificativa };
}
