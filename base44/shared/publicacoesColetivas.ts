export function idsPublicacao(registro = {}) {
  return registro.coletiva === true ? [...new Set((registro.militares_ids || []).map(String))] : [String(registro.militar_id || '')].filter(Boolean);
}
export function filtroMilitaresPublicacao(ids) {
  return { $or: [{ militar_id: { $in: ids } }, { $and: [{ coletiva: true }, { militares_ids: { $in: ids } }] }] };
}

export async function operarPublicacaoColetiva({ base44, operation, data, registro, authz, admin, email, userId, listarEscopo }) {
  const erro = (error, status = 400) => Response.json({ error }, { status });
  const merged = { ...(registro || {}), ...data };
  if (registro && registro.coletiva !== true) return erro('Não é permitido converter um registro individual por este fluxo.');
  if (registro && data.coletiva === false) return erro('Uma nota coletiva não pode ser convertida em individual.');
  if (!['create', 'update', 'delete'].includes(operation)) return erro('Operação coletiva inválida.');
  const tipos = ['Geral', 'Transcrição de Documentos'];
  if (!tipos.includes(merged.tipo)) return erro('O modo coletivo está disponível para Geral e Transcrição de Documentos.');
  const ids = idsPublicacao({ ...merged, coletiva: true });
  if (ids.length < 1 || ids.length > 500 || ids.some(id => !id.trim())) return erro('Selecione de 1 a 500 militares.');
  const antigos = idsPublicacao(registro || {});
  const idsEscopo = [...new Set([...ids, ...antigos])];
  if (!admin) {
    const modulo = ['rp', 'controle_publicacoes', 'publicacoes'].some(k => authz.modules?.[k] === true);
    if (!modulo) return erro('Sem acesso ao módulo de publicações.', 403);
    const campos = Object.keys(data);
    const soApostila = campos.length > 0 && campos.every(k => ['apostilada_por_id', 'foi_apostilada'].includes(k));
    const soSemEfeito = campos.length > 0 && campos.every(k => ['tornada_sem_efeito_por_id', 'foi_tornada_sem_efeito'].includes(k));
    const apenasBg = campos.length > 0 && campos.every(k => ['numero_bg', 'data_bg', 'nota_para_bg', 'nota_conciliada_boletim', 'status'].includes(k));
    const acao = operation === 'create' ? 'adicionar_publicacoes' : operation === 'delete' ? 'excluir_publicacoes' : soApostila ? 'apostilar_publicacao' : soSemEfeito ? 'tornar_sem_efeito_publicacao' : apenasBg ? 'publicar_bg' : 'editar_publicacoes';
    if (authz.actions?.[acao] !== true) return erro('Sem permissão: ' + acao, 403);
    const alteraBg = ['nota_para_bg', 'numero_bg', 'data_bg'].some(k => Object.hasOwn(data, k) && String(data[k] || '') !== String(registro?.[k] || ''));
    if (alteraBg && authz.actions?.publicar_bg !== true) return erro('Sem permissão para informar nota/BG.', 403);
    const permitidos = await listarEscopo(base44, authz.acessos || []);
    if (permitidos !== null && idsEscopo.some(id => !permitidos.map(String).includes(id))) return erro('Há militares fora do escopo autorizado. Nenhuma alteração foi gravada.', 403);
  }
  if (operation === 'delete') {
    if (registro.numero_bg || registro.data_bg || registro.status === 'Publicado') return erro('Nota publicada não pode ser excluída. Use Tornar sem Efeito.', 409);
    await base44.asServiceRole.entities.PublicacaoExOfficio.delete(registro.id);
    return Response.json({ ok: true, data: { id: registro.id, deleted: true } });
  }
  if (!String(merged.texto_publicacao || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(merged.data_publicacao || '')) return erro('Informe a data e o texto integral da publicação.');
  if (Boolean(merged.numero_bg) !== Boolean(merged.data_bg)) return erro('Informe conjuntamente o número e a data do BG.');
  if (merged.numero_bg && !String(merged.nota_para_bg || '').trim()) return erro('Informe a nota para publicar no BG.');
  const militares = await base44.asServiceRole.entities.Militar.filter({ id: { $in: ids } }, undefined, 500, 0, ['id', 'nome_completo', 'posto_graduacao', 'matricula']);
  if (militares.length !== ids.length) return erro('Um ou mais militares não foram encontrados. Nenhuma alteração foi gravada.');
  const camposPermitidos = ['tipo', 'data_publicacao', 'texto_publicacao', 'nota_para_bg', 'numero_bg', 'data_bg', 'observacoes', 'nota_conciliada_boletim', 'apostilada_por_id', 'tornada_sem_efeito_por_id'];
  const seguro = Object.fromEntries(camposPermitidos.filter(k => Object.hasOwn(data, k)).map(k => [k, data[k]]));
  const vinculos = ids.map(id => {
    const m = militares.find(v => String(v.id) === id);
    return { militar_id: id, militar_nome: m.nome_completo || '', militar_posto: m.posto_graduacao || '', militar_matricula: m.matricula || '' };
  });
  const status = merged.numero_bg && merged.data_bg ? 'Publicado' : merged.nota_para_bg ? 'Aguardando Publicação' : 'Aguardando Nota';
  const historico = [...(registro?.historico_coletiva || []), { acao: operation, usuario_id: userId, usuario_email: email, data: new Date().toISOString(), militares_antes: antigos, militares_depois: ids, status_antes: registro?.status || '', status_depois: status, campos_alterados: Object.keys(seguro) }];
  const final = { ...seguro, coletiva: true, militares_ids: ids, militares_vinculados: vinculos, militar_id: '', militar_nome: 'Nota coletiva · ' + ids.length + ' militares', militar_posto: '', militar_matricula: '', status, historico_coletiva: historico };
  const entity = base44.asServiceRole.entities.PublicacaoExOfficio;
  if (operation === 'create') {
    const token = String(data.coletiva_token || '');
    if (!/^[a-f0-9-]{36}$/i.test(token)) return erro('Identificador da operação coletiva inválido.');
    const existentes = await entity.filter({ coletiva_token: token, criado_por_email: email }, undefined, 1, 0);
    if (existentes.length) return Response.json({ ok: true, data: existentes[0] });
    const salvo = await entity.create({ ...final, coletiva_token: token, criado_por_email: email });
    return Response.json({ ok: true, data: salvo });
  }
  const salvo = await entity.update(registro.id, final);
  return Response.json({ ok: true, data: salvo });
}