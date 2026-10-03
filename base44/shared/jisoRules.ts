// Shared rules for the independent JISO workflow. No medical document is mutated here.
export const CLOSED_JISO = new Set(['Concluída', 'Cancelada']);
export const DECISION_FIELDS = new Set(['numero_ata', 'resultado_jiso', 'dias_jiso', 'data_inicio_efeito', 'data_termino_efeito', 'data_retorno_efeito', 'parecer_jiso', 'arquivo_ata_jiso']);
export const MANAGEMENT_FIELDS = new Set(['data_jiso', 'hora_jiso', 'local_jiso', 'secao_jiso', 'finalidade_jiso', 'nup', 'observacoes', 'tags']);
export const SENSITIVE_JISO = new Set(['parecer_jiso', 'parecer', 'resultado_jiso', 'observacoes', 'arquivo_ata_jiso', 'texto_publicacao', 'whatsapp_mensagem', 'render_metadata', 'diagnostico', 'cid_10']);
export const OPERATIONAL_JISO = ['id','codigo','atestado_id','militar_id','militar_nome','militar_posto','militar_matricula','militar_matricula_atual','data_jiso','hora_jiso','local_jiso','secao_jiso','finalidade_jiso','nup','numero_ata','dias_jiso','data_inicio_efeito','data_termino_efeito','data_retorno_efeito','status','status_publicacao','publicacao_id','whatsapp_status','whatsapp_enviado_em','whatsapp_enviado_por','origem','versao','tags','created_date','updated_date','agendada_em','realizada_em','resultado_registrado_em','concluida_em','cancelada_em','efeito_suspenso'];
export function fail(code, message, status = 422) {
  throw Object.assign(new Error(message), { status, code });
}
export function projectJiso(jiso, sensitive) {
  const fields = sensitive ? [...OPERATIONAL_JISO, ...SENSITIVE_JISO] : OPERATIONAL_JISO;
  return Object.fromEntries(fields.filter(key => Object.hasOwn(jiso || {}, key)).map(key => [key, jiso[key]]));
}
export function assertEditable(jiso, structural = false) {
  if (CLOSED_JISO.has(jiso?.status)) fail('JISO_ENCERRADA', 'JISO concluída ou cancelada não pode ser alterada.', 409);
  if (jiso?.publicacao_id && structural) fail('JISO_EM_PUBLICACAO', 'A ata está no fluxo de publicações. Revogue ou exclua a publicação antes de alterar a JISO.', 409);
}
export function publicationActive(pub) {
  return Boolean(pub && !pub.tornada_sem_efeito_por_id && !pub.foi_tornada_sem_efeito && pub.status !== 'Excluída');
}
export function publicationStatus(pub) {
  if (pub.numero_bg && pub.data_bg) return 'Publicado';
  if (pub.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}
export function validatePublication(pub) {
  if (Boolean(pub.numero_bg) !== Boolean(pub.data_bg)) fail('BG_INCOMPLETO', 'Informe o número e a data do BG juntos.');
  if (pub.data_bg && !validDate(pub.data_bg)) fail('DATA_INVALIDA', 'Data do BG inválida.');
}
export function publicationPatch(jiso, pub) {
  if (jiso.status === 'Cancelada') return {};
  const active = publicationActive(pub);
  const state = active ? publicationStatus(pub) : 'Aguardando Nota';
  return {
    publicacao_id: active ? pub.id : '',
    status_publicacao: state,
    status: active && state === 'Publicado' ? 'Concluída' : (jiso.resultado_jiso || jiso.resultado_registrado_em ? 'Resultado Registrado' : (jiso.realizada_em ? 'Realizada' : 'Aguardando Agendamento')),
    concluida_em: active && state === 'Publicado' ? (jiso.concluida_em || new Date().toISOString()) : '',
    efeito_suspenso: !active && Boolean(jiso.publicacao_id),
  };
}
export function validDate(value) {
  const s = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
}
export function validateJiso(record, previous = null) {
  const status = record.status;
  if (!['Rascunho','Aguardando Agendamento','Agendada','Realizada','Resultado Registrado','Concluída','Cancelada'].includes(status)) fail('STATUS_INVALIDO', 'Status JISO inválido.');
  for (const field of ['data_jiso','data_inicio_efeito','data_termino_efeito','data_retorno_efeito']) {
    if (record[field] && !validDate(record[field])) fail('DATA_INVALIDA', 'Data inválida: ' + field);
  }
  if (record.hora_jiso && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.hora_jiso)) fail('HORA_INVALIDA', 'Horário inválido.');
  if (status === 'Agendada' && (!record.data_jiso || !record.hora_jiso)) fail('AGENDAMENTO_INCOMPLETO', 'Informe a data e o horário da JISO.');
  if (record.dias_jiso != null && record.dias_jiso !== '' && (!Number.isInteger(Number(record.dias_jiso)) || Number(record.dias_jiso) < 0)) fail('DIAS_INVALIDOS', 'Os dias reconhecidos devem ser um número inteiro não negativo.');
  const { data_inicio_efeito: start, data_termino_efeito: end, data_retorno_efeito: back } = record;
  if (start && end && end < start) fail('PERIODO_INVALIDO', 'O término não pode anteceder o início.');
  if (back && end && back <= end) fail('RETORNO_INVALIDO', 'O retorno deve ocorrer depois do término.');
  if (back && start && back < start) fail('RETORNO_INVALIDO', 'O retorno não pode anteceder o início.');
  if (start && end && Number(record.dias_jiso) > 0) {
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    if (days !== Number(record.dias_jiso)) fail('DIAS_DIVERGENTES', 'Os dias reconhecidos não correspondem ao período informado.');
  }
  if (status === 'Resultado Registrado' && !String(record.resultado_jiso || '').trim()) fail('RESULTADO_REQUIRED', 'Informe o resultado da Junta.');
  if (status === 'Resultado Registrado' && ['Diminuído','Prorrogado'].includes(record.resultado_jiso) && (!start || !end || !back || !(Number(record.dias_jiso) > 0))) fail('EFEITOS_REQUIRED', 'Informe os dias e as datas de efeito e retorno para a alteração do afastamento.');
  if (previous) {
    const rank = { Rascunho: 0, 'Aguardando Agendamento': 0, Agendada: 1, Realizada: 2, 'Resultado Registrado': 3 };
    if (rank[status] < rank[previous.status] && rank[previous.status] >= 2) fail('STATUS_REGRESSIVO', 'Não é possível regredir uma JISO já realizada.', 409);
  }
}
// Reconcile only the publication associated with this operation, never guess legacy links.
export async function syncJisoPublication(base44, pub, removed = false) {
  if (!pub?.jiso_id || pub.tipo !== 'Ata JISO') return;
  const rows = await base44.asServiceRole.entities.JISO.filter({ id: pub.jiso_id }, undefined, 1, 0);
  const jiso = rows?.[0];
  if (!jiso) fail('JISO_NOT_FOUND', 'JISO da publicação não encontrada.', 409);
  const publications = await base44.asServiceRole.entities.PublicacaoExOfficio.filter({ jiso_id: jiso.id, tipo: 'Ata JISO' }, '-created_date', 500, 0);
  const active = publications.find(p => (!removed || p.id !== pub.id) && publicationActive(p));
  const patch = publicationPatch(jiso, active || null);
  await base44.asServiceRole.entities.JISO.update(jiso.id, { ...patch, versao: Number(jiso.versao || 0) + 1 });
  const updated = { ...jiso, ...patch };
  const links = await base44.asServiceRole.entities.JISOAtestado.filter({ jiso_id: jiso.id, status: 'Ativo' }, 'ordem', 500, 0);
  const cards = await base44.asServiceRole.entities.CardOperacional.filter({ origem_registro_id: jiso.id, tipo_automacao: 'JISO_INDEPENDENTE' }, undefined, 100, 0);
  for (const card of cards || []) {
    await base44.asServiceRole.entities.CardOperacional.update(card.id, { status: CLOSED_JISO.has(patch.status || jiso.status) ? 'Concluído' : 'Ativo' });
    await syncJisoChecklist(base44, card.id, updated, links.length);
  }
}

export async function syncJisoChecklist(base44, cardId, jiso, totalAtestados) {
  const states = [
    ['Conferir atestados vinculados', totalAtestados > 0],
    ['Agendar JISO', Boolean(jiso.data_jiso && jiso.hora_jiso)],
    ['Notificar militar', jiso.whatsapp_status === 'enviado'],
    ['Registrar resultado', Boolean(jiso.resultado_jiso || jiso.resultado_registrado_em)],
    ['Publicar Ata JISO', jiso.status_publicacao === 'Publicado' && jiso.status === 'Concluída'],
  ];
  const items = await base44.asServiceRole.entities.CardChecklistItem.filter({ card_id: cardId }, 'ordem', 500, 0);
  for (let index = 0; index < states.length; index++) {
    const [title, done] = states[index];
    const item = items.find(item => item.titulo === title);
    if (item) await base44.asServiceRole.entities.CardChecklistItem.update(item.id, { concluido: done });
    else await base44.asServiceRole.entities.CardChecklistItem.create({ card_id: cardId, titulo: title, concluido: done, ordem: index + 1 });
  }
  await base44.asServiceRole.entities.CardOperacional.update(cardId, { checklist_resumo: states.filter(([, done]) => done).length + '/' + states.length });
}
