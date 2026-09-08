import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS = {
  PENDENTE: 'PENDENTE',
  CONFIRMADO_DUPLICADO: 'CONFIRMADO_DUPLICADO',
  DESCARTADO: 'DESCARTADO',
  MESCLADO: 'MESCLADO',
};

const VINCULOS_MERGE = ['HistoricoComportamento', 'PendenciaComportamento', 'PunicaoDisciplinar'];
const onlyDigits = (v = '') => String(v || '').replace(/\D/g, '');
const normMat = (v = '') => onlyDigits(v).slice(0, 9);
const fmtMat = (v = '') => {
  const d = normMat(v);
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}-${d.slice(6)}`;
};
const normCpf = (v = '') => {
  const d = onlyDigits(v);
  return d.length === 11 ? d : '';
};
const normNome = (v = '') => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toISOString();

function minimalSnapshot(m) {
  if (!m) return null;
  return {
    id: m.id || '',
    nome_completo: m.nome_completo || '',
    nome_guerra: m.nome_guerra || '',
    matricula: m.matricula || '',
    posto_graduacao: m.posto_graduacao || '',
    quadro: m.quadro || '',
    status_cadastro: m.status_cadastro || '',
    merged_into_id: m.merged_into_id || '',
  };
}

function minimalPayloadCadastro(p = {}) {
  return {
    nome_completo: p.nome_completo || '',
    nome_guerra: p.nome_guerra || '',
    matricula: fmtMat(p.matricula),
    posto_graduacao: p.posto_graduacao || '',
    quadro: p.quadro || '',
    status_cadastro: p.status_cadastro || '',
    estrutura_id: p.estrutura_id || p.subgrupamento_id || '',
  };
}

async function authz(base44, effectiveEmail, scopeMilitarIds = []) {
  const payload = {};
  if (effectiveEmail) payload.effectiveEmail = effectiveEmail;
  if (Array.isArray(scopeMilitarIds) && scopeMilitarIds.length) payload.scopeMilitarIds = scopeMilitarIds;
  const response = await base44.functions.invoke('getUserPermissions', payload);
  const data = response?.data ?? response ?? {};
  if (data?.error) throw Object.assign(new Error(data.error), { status: 403 });
  return data;
}

function hasModuleAction(a, moduleKey, actionKey) {
  return a?.isAdmin === true || (a?.modules?.[moduleKey] === true && a?.actions?.[actionKey] === true);
}

function requireModuleAction(a, moduleKey, actionKey, message) {
  if (!hasModuleAction(a, moduleKey, actionKey)) throw Object.assign(new Error(message || `Permissão necessária: ${actionKey}`), { status: 403 });
}

function requireScopeAll(a, ids) {
  if (a?.isAdmin === true || a?.hasGlobalScope === true) return;
  const allowed = new Set((a?.allowedMilitarIds || []).map(String));
  if (!ids.every((id) => allowed.has(String(id)))) throw Object.assign(new Error('Militar fora do escopo organizacional autorizado.'), { status: 403 });
}

async function findMilitarById(base44, id) {
  const rows = await base44.asServiceRole.entities.Militar.filter({ id });
  return rows?.[0] || null;
}

async function findMatriculaConflict(base44, matricula, excludeMilitarId = '') {
  const normalized = normMat(matricula);
  if (!normalized) return null;
  const mats = await base44.asServiceRole.entities.MatriculaMilitar.filter({ matricula_normalizada: normalized });
  const mat = (mats || []).find((m) => String(m?.militar_id || '') !== String(excludeMilitarId || ''));
  if (mat?.militar_id) return findMilitarById(base44, mat.militar_id);
  const militares = await base44.asServiceRole.entities.Militar.filter({ matricula: fmtMat(normalized) });
  return (militares || []).find((m) => String(m?.id || '') !== String(excludeMilitarId || '')) || null;
}

async function findStrongDuplicate(base44, { cpf, nomeCanonico, dataNascimento, excludeMilitarId = '' }) {
  const cpfNorm = normCpf(cpf);
  const nomeNorm = normNome(nomeCanonico);
  const dataNorm = String(dataNascimento || '').trim();
  const lists = [];
  if (cpfNorm) lists.push(await base44.asServiceRole.entities.Militar.filter({ cpf: cpfNorm }));
  if (nomeNorm && dataNorm) lists.push(await base44.asServiceRole.entities.Militar.filter({ nome_canonico: nomeNorm, data_nascimento: dataNorm }));
  for (const list of lists) {
    const found = (list || []).find((m) => String(m?.id || '') !== String(excludeMilitarId || ''));
    if (found) return found;
  }
  return null;
}

async function createDuplicateQueue(base44, { existing, candidateId = '', payload = {}, reason, confidence, actor, origin, match = {} }) {
  const data = {
    militar_existente_id: existing?.id || '',
    militar_candidato_id: candidateId || '',
    payload_novo_cadastro: JSON.stringify(minimalPayloadCadastro(payload)),
    snapshot_comparativo: JSON.stringify({
      militar_existente: minimalSnapshot(existing),
      militar_candidato_id: candidateId || '',
      criterios: match,
    }),
    motivo: reason || 'Possível duplicidade.',
    nivel_confianca: Number(confidence || 0),
    status: STATUS.PENDENTE,
    criado_por: actor || '',
    resolvido_por: '',
    created_at: agora(),
    resolved_at: '',
    origem_fluxo: origin || 'manual',
  };
  return base44.asServiceRole.entities.PossivelDuplicidadeMilitar.create(data);
}

function prepareMilitar(payload = {}) {
  return {
    ...payload,
    matricula: fmtMat(payload.matricula),
    nome_canonico: normNome(payload.nome_completo || payload.nome_canonico),
    cpf: normCpf(payload.cpf) || payload.cpf || '',
    merged_into_id: payload.merged_into_id || '',
  };
}

async function validateCreate(base44, payload, actor, origin) {
  const conflict = await findMatriculaConflict(base44, payload.matricula);
  if (conflict) {
    await createDuplicateQueue(base44, {
      existing: conflict, payload, actor, origin,
      reason: 'Matrícula já cadastrada durante tentativa de criação.', confidence: 1,
      match: { matricula: true },
    });
    throw Object.assign(new Error('Matrícula já cadastrada. Pendência enviada para revisão humana.'), { status: 409 });
  }
  const duplicate = await findStrongDuplicate(base44, {
    cpf: payload.cpf,
    nomeCanonico: payload.nome_completo || payload.nome_canonico,
    dataNascimento: payload.data_nascimento,
  });
  if (duplicate) {
    const cpfMatch = Boolean(normCpf(payload.cpf) && normCpf(duplicate.cpf) === normCpf(payload.cpf));
    const nomeDataMatch = Boolean(normNome(payload.nome_completo) && normNome(duplicate.nome_completo) === normNome(payload.nome_completo) && String(duplicate.data_nascimento || '') === String(payload.data_nascimento || ''));
    const pendencia = await createDuplicateQueue(base44, {
      existing: duplicate, payload, actor, origin,
      reason: 'Possível duplicidade por CPF e/ou nome + data de nascimento.', confidence: 0.95,
      match: { cpf: cpfMatch, nome_data_nascimento: nomeDataMatch },
    });
    throw Object.assign(new Error(`Possível duplicidade identificada. Pendência #${pendencia?.id || 'N/D'} criada para revisão.`), { status: 409 });
  }
}

async function createMilitar(base44, payload, actor, origin) {
  await validateCreate(base44, payload, actor, origin);
  const normalized = normMat(payload.matricula);
  if (!normalized) throw Object.assign(new Error('Matrícula obrigatória para cadastro.'), { status: 400 });
  const created = await base44.asServiceRole.entities.Militar.create(prepareMilitar(payload));
  await base44.asServiceRole.entities.MatriculaMilitar.create({
    militar_id: created.id,
    matricula: fmtMat(normalized),
    matricula_normalizada: normalized,
    tipo_matricula: 'Principal',
    situacao: 'Ativa',
    is_atual: true,
    data_inicio: hoje(),
    data_fim: '',
    motivo: 'Cadastro inicial',
    origem_registro: origin || 'manual',
  });
  return created;
}

async function updateMilitar(base44, militarId, payload, actor) {
  const current = await findMilitarById(base44, militarId);
  if (!current) throw Object.assign(new Error('Militar não encontrado para atualização.'), { status: 404 });
  const atual = normMat(current.matricula);
  const nova = normMat(payload.matricula || current.matricula);
  if (atual && nova && atual !== nova) throw Object.assign(new Error('Troca de matrícula não permitida por edição direta. Use o fluxo de adicionar nova matrícula.'), { status: 400 });
  const conflict = await findMatriculaConflict(base44, nova || atual, militarId);
  if (conflict) throw Object.assign(new Error('Matrícula já cadastrada.'), { status: 409 });
  const duplicate = await findStrongDuplicate(base44, {
    cpf: payload.cpf || current.cpf,
    nomeCanonico: payload.nome_completo || current.nome_completo,
    dataNascimento: payload.data_nascimento || current.data_nascimento,
    excludeMilitarId: militarId,
  });
  if (duplicate) {
    await createDuplicateQueue(base44, {
      existing: duplicate,
      candidateId: militarId,
      payload: { ...current, ...payload },
      actor,
      origin: 'edicao_manual',
      reason: 'Possível duplicidade identificada durante atualização de cadastro.',
      confidence: 0.95,
      match: { cadastro_atualizado: true },
    });
    throw Object.assign(new Error('Possível duplicidade identificada. Revise antes de atualizar o cadastro.'), { status: 409 });
  }
  return base44.asServiceRole.entities.Militar.update(militarId, prepareMilitar({ ...current, ...payload, matricula: current.matricula }));
}

async function addMatricula(base44, { militarId, matricula, tipoMatricula, motivo, origemRegistro, dataInicio }) {
  const normalized = normMat(matricula);
  if (!normalized) throw Object.assign(new Error('Matrícula obrigatória.'), { status: 400 });
  const conflict = await findMatriculaConflict(base44, normalized, militarId);
  if (conflict) throw Object.assign(new Error('Matrícula já cadastrada.'), { status: 409 });
  const current = await base44.asServiceRole.entities.MatriculaMilitar.filter({ militar_id: militarId, is_atual: true });
  for (const item of current || []) {
    await base44.asServiceRole.entities.MatriculaMilitar.update(item.id, {
      is_atual: false,
      data_fim: dataInicio || hoje(),
      motivo: item.motivo || 'Encerrada por inclusão de nova matrícula.',
    });
  }
  const created = await base44.asServiceRole.entities.MatriculaMilitar.create({
    militar_id: militarId,
    matricula: fmtMat(normalized),
    matricula_normalizada: normalized,
    tipo_matricula: tipoMatricula || 'Secundária',
    situacao: 'Ativa',
    is_atual: true,
    data_inicio: dataInicio || hoje(),
    data_fim: '',
    motivo: motivo || 'Nova matrícula vinculada',
    origem_registro: origemRegistro || 'manual',
  });
  await base44.asServiceRole.entities.Militar.update(militarId, { matricula: fmtMat(normalized) });
  return created;
}

async function listDuplicates(base44, status = STATUS.PENDENTE) {
  const rows = await base44.asServiceRole.entities.PossivelDuplicidadeMilitar.list('-created_date');
  return status ? (rows || []).filter((r) => String(r?.status || '').toUpperCase() === String(status).toUpperCase()) : (rows || []);
}

async function resolveDuplicate(base44, pendenciaId, status, actor) {
  return base44.asServiceRole.entities.PossivelDuplicidadeMilitar.update(pendenciaId, {
    status,
    resolvido_por: actor,
    resolved_at: agora(),
  });
}

async function getMatriculas(base44, militarId) {
  return base44.asServiceRole.entities.MatriculaMilitar.filter({ militar_id: militarId });
}

async function merge(base44, { militarOrigemId, militarDestinoId, pendenciaId, motivo }, actor) {
  if (!militarOrigemId || !militarDestinoId) throw Object.assign(new Error('Militar de origem e destino são obrigatórios.'), { status: 400 });
  if (String(militarOrigemId) === String(militarDestinoId)) throw Object.assign(new Error('Não é permitido mesclar o mesmo militar nele próprio.'), { status: 400 });
  const [origem, destino, matsOrigem, matsDestino] = await Promise.all([
    findMilitarById(base44, militarOrigemId), findMilitarById(base44, militarDestinoId),
    getMatriculas(base44, militarOrigemId), getMatriculas(base44, militarDestinoId),
  ]);
  if (!origem || !destino) throw Object.assign(new Error('Militar de origem/destino não encontrado.'), { status: 404 });
  if (origem.merged_into_id) throw Object.assign(new Error('Militar de origem já está mesclado.'), { status: 409 });

  const destinoNorms = new Set((matsDestino || []).map((m) => normMat(m.matricula_normalizada || m.matricula)).filter(Boolean));
  for (const mat of matsOrigem || []) {
    const norm = normMat(mat.matricula_normalizada || mat.matricula);
    if (norm && destinoNorms.has(norm)) {
      await base44.asServiceRole.entities.MatriculaMilitar.update(mat.id, { is_atual: false, situacao: 'Mesclada', data_fim: hoje(), motivo: `${mat.motivo || ''} Encerrada por merge manual.`.trim() });
    } else {
      await base44.asServiceRole.entities.MatriculaMilitar.update(mat.id, { militar_id: militarDestinoId, is_atual: false, motivo: `${mat.motivo || ''} Reatribuída por merge manual.`.trim() });
    }
  }

  for (const entityName of VINCULOS_MERGE) {
    const rows = await base44.asServiceRole.entities[entityName].filter({ militar_id: militarOrigemId });
    for (const row of rows || []) await base44.asServiceRole.entities[entityName].update(row.id, { militar_id: militarDestinoId });
  }

  const matsDepois = await getMatriculas(base44, militarDestinoId);
  const principal = (matsDepois || []).find((m) => m.is_atual === true) || (matsDepois || [])[0];
  if (!principal) throw Object.assign(new Error('Merge bloqueado: destino sem matrícula.'), { status: 409 });
  for (const mat of matsDepois || []) {
    const shouldCurrent = String(mat.id) === String(principal.id);
    if (Boolean(mat.is_atual) !== shouldCurrent) await base44.asServiceRole.entities.MatriculaMilitar.update(mat.id, { is_atual: shouldCurrent, data_fim: shouldCurrent ? '' : (mat.data_fim || hoje()) });
  }
  await base44.asServiceRole.entities.Militar.update(militarDestinoId, { matricula: principal.matricula || fmtMat(principal.matricula_normalizada) });
  await base44.asServiceRole.entities.Militar.update(militarOrigemId, { status_cadastro: 'Mesclado', situacao_militar: 'Mesclado', merged_into_id: militarDestinoId });
  if (pendenciaId) await base44.asServiceRole.entities.PossivelDuplicidadeMilitar.update(pendenciaId, { status: STATUS.MESCLADO, militar_existente_id: militarDestinoId, militar_candidato_id: militarOrigemId, resolvido_por: actor, resolved_at: agora() });

  const log = await base44.asServiceRole.entities.MergeMilitarLog.create({
    militar_origem_id: militarOrigemId,
    militar_destino_id: militarDestinoId,
    snapshot_origem: JSON.stringify(minimalSnapshot(origem)),
    snapshot_destino_antes: JSON.stringify(minimalSnapshot(destino)),
    snapshot_destino_depois: JSON.stringify(minimalSnapshot(await findMilitarById(base44, militarDestinoId))),
    motivo: motivo || 'Merge manual de saneamento cadastral.',
    executado_por: actor,
    created_at: agora(),
  });
  return { logId: log?.id, militarOrigemId, militarDestinoId, matriculasReatribuídas: (matsOrigem || []).length };
}

async function migrateLegacyMatriculas(base44, dryRun) {
  const [militares, matriculas] = await Promise.all([
    base44.asServiceRole.entities.Militar.list(),
    base44.asServiceRole.entities.MatriculaMilitar.list(),
  ]);
  const existing = new Map((matriculas || []).map((m) => [normMat(m.matricula_normalizada || m.matricula), m]));
  const batch = new Map();
  const diag = { totalMilitares: (militares || []).length, criadas: 0, conflitos: [], ignoradas: 0 };
  for (const militar of militares || []) {
    const n = normMat(militar?.matricula);
    if (!n) { diag.ignoradas += 1; continue; }
    const ex = existing.get(n);
    if (ex) {
      if (String(ex.militar_id || '') !== String(militar.id || '')) diag.conflitos.push({ tipo: 'matricula_duplicada', matricula: fmtMat(n), militar_origem_id: militar.id, militar_destino_id: ex.militar_id });
      continue;
    }
    if (batch.has(n)) { diag.conflitos.push({ tipo: 'matricula_duplicada', matricula: fmtMat(n), militar_origem_id: militar.id, militar_destino_id: batch.get(n) }); continue; }
    diag.criadas += 1; batch.set(n, militar.id);
    if (!dryRun) await base44.asServiceRole.entities.MatriculaMilitar.create({ militar_id: militar.id, matricula: fmtMat(n), matricula_normalizada: n, tipo_matricula: 'Principal', situacao: 'Ativa', is_atual: true, data_inicio: militar.data_inclusao || hoje(), data_fim: '', motivo: 'Migração de legado da matrícula principal.', origem_registro: 'migracao_legado' });
  }
  return diag;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase();
    const payload = body?.payload || {};
    const actor = String(user.email || '').toLowerCase();

    const scopeIds = ['UPDATE_MILITAR', 'ADD_MATRICULA'].includes(action) ? [payload.militarId].filter(Boolean)
      : action === 'MERGE' ? [payload.militarOrigemId, payload.militarDestinoId].filter(Boolean)
      : [];
    const a = await authz(base44, body?.effectiveEmail, scopeIds);

    if (action === 'CREATE_MILITAR') {
      requireModuleAction(a, 'militares', 'adicionar_militares', 'Sem permissão para adicionar militares.');
      return Response.json({ result: await createMilitar(base44, payload.data || {}, actor, payload.origemRegistro || 'manual') });
    }
    if (action === 'GET_MILITAR_FOR_EDIT') {
      requireModuleAction(a, 'militares', 'editar_militares', 'Sem permissão para editar militares.');
      requireScopeAll(a, [payload.militarId]);
      const [militar, matriculas] = await Promise.all([
        findMilitarById(base44, payload.militarId),
        base44.asServiceRole.entities.MatriculaMilitar.filter({ militar_id: payload.militarId }, '-data_inicio'),
      ]);
      if (!militar) throw Object.assign(new Error('Militar não encontrado para edição.'), { status: 404 });
      return Response.json({ result: { militar, matriculas: matriculas || [] } });
    }
    if (action === 'UPDATE_MILITAR') {
      requireModuleAction(a, 'militares', 'editar_militares', 'Sem permissão para editar militares.');
      requireScopeAll(a, [payload.militarId]);
      return Response.json({ result: await updateMilitar(base44, payload.militarId, payload.data || {}, actor) });
    }
    if (action === 'ADD_MATRICULA') {
      requireModuleAction(a, 'militares', 'editar_militares', 'Sem permissão para alterar matrícula de militar.');
      requireScopeAll(a, [payload.militarId]);
      return Response.json({ result: await addMatricula(base44, payload) });
    }
    if (action === 'VALIDATE_MATRICULA') {
      const allowed = hasModuleAction(a, 'militares', 'adicionar_militares') || hasModuleAction(a, 'migracao_militares', 'importar_militares');
      if (!allowed) throw Object.assign(new Error('Sem permissão para validar matrícula para cadastro/importação.'), { status: 403 });
      const conflict = await findMatriculaConflict(base44, payload.matricula, payload.excludeMilitarId || '');
      if (conflict) throw Object.assign(new Error('Matrícula já cadastrada.'), { status: 409 });
      return Response.json({ result: normMat(payload.matricula) });
    }
    if (action === 'FIND_DUPLICATE') {
      const allowed = hasModuleAction(a, 'militares', 'adicionar_militares') || hasModuleAction(a, 'migracao_militares', 'importar_militares');
      if (!allowed) throw Object.assign(new Error('Sem permissão para verificar duplicidade.'), { status: 403 });
      const found = await findStrongDuplicate(base44, payload);
      return Response.json({ result: found ? minimalSnapshot(found) : null });
    }
    if (['LIST_DUPLICATES', 'RESOLVE_DUPLICATE', 'MERGE'].includes(action)) {
      requireModuleAction(a, 'migracao_alteracoes_legado', 'revisar_duplicidades', 'Sem permissão para revisar duplicidades.');
      if (action === 'LIST_DUPLICATES') return Response.json({ result: await listDuplicates(base44, payload.status) });
      if (action === 'RESOLVE_DUPLICATE') return Response.json({ result: await resolveDuplicate(base44, payload.pendenciaId, payload.status, actor) });
      requireScopeAll(a, [payload.militarOrigemId, payload.militarDestinoId]);
      return Response.json({ result: await merge(base44, payload, actor) });
    }
    if (action === 'MIGRATE_LEGACY_MATRICULAS') {
      requireModuleAction(a, 'migracao_militares', 'importar_militares', 'Sem permissão para migrar matrículas legadas.');
      return Response.json({ result: await migrateLegacyMatriculas(base44, payload.dryRun !== false) });
    }
    return Response.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[militarIdentidadeGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro no gateway de identidade militar.' }, { status });
  }
});
