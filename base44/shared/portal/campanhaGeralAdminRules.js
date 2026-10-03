function falhar(message, status = 400) {
  throw Object.assign(new Error(message), { status, code: 'CAMPANHA_GERAL_VALIDATION' });
}
export function validarNomeCampanhaGeral(valor) {
  const titulo = String(valor || '').trim();
  if (!titulo) falhar('Informe o nome da campanha.');
  return titulo;
}
export function validarProrrogacaoCampanhaGeral(campanha, payload, agora = Date.now()) {
  if (!['Aberta_Coleta', 'Encerrada'].includes(campanha.status)) {
    falhar('Somente campanhas abertas ou encerradas podem ser prorrogadas.', 409);
  }
  const data = String(payload.nova_data_fim_militar || '');
  const dt = new Date(data + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== data) {
    falhar('Informe uma nova data limite válida.');
  }
  const hoje = new Date(agora - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (data < hoje) falhar('O novo prazo não pode estar no passado.');
  if (campanha.data_fim_militar && data <= String(campanha.data_fim_militar).slice(0, 10)) {
    falhar('O novo prazo precisa ser posterior ao prazo atual.');
  }
  if (campanha.data_inicio && data < String(campanha.data_inicio).slice(0, 10)) {
    falhar('O prazo não pode ser anterior ao início da campanha.');
  }
  const justificativa = String(payload.justificativa || '').trim();
  if (justificativa.length < 5) falhar('Informe uma justificativa para a prorrogação.');
  return { data, justificativa };
}
