export async function operarModeloNotaColetiva({ base44, operation, registroId, data, permitido }) {
  if (!permitido) return Response.json({ error: 'Sem permissão para gerir templates.' }, { status: 403 });
  if (!['create', 'update', 'delete'].includes(operation)) return Response.json({ error: 'Operação inválida.' }, { status: 400 });
  const entity = base44.asServiceRole.entities.ModeloNotaColetiva;
  const existente = operation === 'create' ? null : await entity.get(registroId).catch(e => e.status === 404 ? null : Promise.reject(e));
  if (operation !== 'create' && !existente) return Response.json({ error: 'Modelo não encontrado.' }, { status: 404 });
  if (operation === 'delete') { await entity.delete(registroId); return Response.json({ ok: true, data: { id: registroId, deleted: true } }); }
  const merged = { ...existente, ...data };
  const seguro = { nome: String(merged.nome || '').trim(), tipo: String(merged.tipo || '').trim(), cabecalho: String(merged.cabecalho || '').trim(), ativo: merged.ativo !== false };
  if (!seguro.nome || !seguro.tipo || !seguro.cabecalho || seguro.nome.length > 150 || seguro.tipo.length > 150 || seguro.cabecalho.length > 12000) return Response.json({ error: 'Informe nome, tipo e cabeçalho válidos.' }, { status: 400 });
  if (/\{\{[\s\S]*?\}\}/.test(seguro.cabecalho)) return Response.json({ error: 'O cabeçalho coletivo deve ser texto livre, sem variáveis.' }, { status: 400 });
  const salvo = operation === 'create' ? await entity.create(seguro) : await entity.update(registroId, seguro);
  return Response.json({ ok: true, data: salvo });
}