const fail = (message: string, status = 403): never => { throw Object.assign(new Error(message), { status }); };
const id = (value: unknown) => String(value ?? '').trim();

export async function createSargenteacaoScope(base44: any, permissions: any) {
  if (permissions?.error || !permissions || permissions.scope?.tipo === 'erro') fail('Não foi possível validar o escopo.', 503);
  const entities = base44.asServiceRole.entities;
  const global = permissions.hasGlobalScope === true || permissions.isAdminByRole === true;
  const structures = new Set<string>();
  if (!global) {
    for (const access of permissions.acessos || []) {
      const type = id(access.tipo_acesso).toLowerCase();
      if (type === 'unidade' && access.subgrupamento_id) structures.add(id(access.subgrupamento_id));
      if (type === 'subsetor' && access.subgrupamento_id) {
        const root = id(access.subgrupamento_id); structures.add(root);
        const children = await entities.Subgrupamento.filter({ parent_id: root }, undefined, 1000);
        if (children.length >= 1000) fail('Escopo excede o limite de conferência.', 503);
        for (const child of children) if (child.id) structures.add(id(child.id));
      }
      if (type === 'setor' && access.grupamento_id) {
        const root = id(access.grupamento_id); structures.add(root);
        const children = await entities.Subgrupamento.filter({ grupamento_raiz_id: root }, undefined, 1000);
        if (children.length >= 1000) fail('Escopo excede o limite de conferência.', 503);
        for (const child of children) if (child.id) structures.add(id(child.id));
      }
    }
  }
  const stationAllowed = (record: any) => Boolean(record && (global || (id(record.estrutura_id) && structures.has(id(record.estrutura_id)))));
  const assertStation = async (stationId: string) => {
    const record = await entities.QuartelPosto.get(stationId);
    if (!stationAllowed(record)) fail('Quartel/posto fora do escopo autorizado.');
    return record;
  };
  const assertScale = async (record: any) => {
    if (!record) fail('Escala não encontrada.', 404);
    await assertStation(id(record.quartel_posto_id));
    const group = await entities.AlaGrupo.get(id(record.ala_grupo_id));
    if (!group || group.quartel_posto_id !== record.quartel_posto_id) fail('Vínculo de ala/grupo inválido.', 409);
    return record;
  };
  const allowedMilitaryIds = async (records: any[]) => {
    const ids = [...new Set(records.map(row => id(row.id)).filter(Boolean))];
    if (global) return new Set(ids);
    const allowed = new Set<string>();
    for (let offset = 0; offset < ids.length; offset += 500) {
      const batch = ids.slice(offset, offset + 500);
      const response = await base44.functions.invoke('getUserPermissions', { scopeMilitarIds: batch });
      const auth = response?.data ?? response;
      if (auth?.error || !Array.isArray(auth?.scopeCheck?.allowedIds)) fail('Não foi possível validar militares no escopo.', 503);
      for (const militaryId of auth.scopeCheck.allowedIds) if (batch.includes(id(militaryId))) allowed.add(id(militaryId));
    }
    return allowed;
  };
  const assertMilitary = async (militaryId: string) => {
    if (!(await allowedMilitaryIds([{ id: militaryId }])).has(militaryId)) fail('Militar fora do escopo autorizado.');
  };
  const assertCrew = async (crew: any) => {
    if (!crew) fail('Guarnição não encontrada.', 404);
    const scale = await assertScale(await entities.EscalaServico.get(crew.escala_servico_id));
    const assignments = await entities.EscalaMilitar.filter({ escala_guarnicao_id: crew.id });
    if (assignments.some((row: any) => row.escala_servico_id !== scale.id)) fail('Vínculo da guarnição inconsistente.', 409);
    const allowed = await allowedMilitaryIds(assignments.map((row: any) => ({ id: row.militar_id })));
    if (assignments.some((row: any) => !allowed.has(id(row.militar_id)))) fail('Guarnição contém militar fora do escopo autorizado.');
    return scale;
  };
  const assertGlobalCatalog = () => { if (!global) fail('A gestão dos modelos e missões compartilhados requer escopo global.'); };
  return { global, structures, stationAllowed, assertStation, assertScale, assertMilitary, assertCrew, allowedMilitaryIds, assertGlobalCatalog };
}

export function assertRealDate(value: string, label: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00Z') : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(label + ' inválida.', 400);
  return value;
}
