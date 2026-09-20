import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const RANKS = ['coronel','tenente coronel','major','capitao','1 tenente','2 tenente','aspirante','subtenente','1 sargento','2 sargento','3 sargento','cabo','soldado'];
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const text = (value: unknown) => String(value ?? '').trim();
const required = (value: unknown, label: string) => {
  const result = text(value);
  if (!result) fail(`${label} é obrigatório.`);
  return result;
};
const validDate = (value: unknown, label: string) => {
  const result = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail(`${label} inválida.`);
  return result;
};
const normalize = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[º°ª.\-]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const overlaps = (a: string, b: string, start: string, end: string) => Boolean(a && b && a <= end && b >= start);

function compareMilitary(a: any, b: any) {
  const indexA = RANKS.indexOf(normalize(a.posto_graduacao || a.militar_posto));
  const indexB = RANKS.indexOf(normalize(b.posto_graduacao || b.militar_posto));
  const rankA = indexA < 0 ? 999 : indexA;
  const rankB = indexB < 0 ? 999 : indexB;
  if (rankA !== rankB) return rankA - rankB;
  const dateA = text(a.data_promocao || a.data_inclusao) || '9999-12-31';
  const dateB = text(b.data_promocao || b.data_inclusao) || '9999-12-31';
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return text(a.nome_guerra || a.nome_completo || a.militar_nome).localeCompare(text(b.nome_guerra || b.nome_completo || b.militar_nome), 'pt-BR');
}

async function recalculateCrew(entities: any, crewId: string) {
  const crew = await entities.EscalaGuarnicao.get(crewId);
  if (!crew) return;
  const assignments = (await entities.EscalaMilitar.filter({ escala_guarnicao_id: crewId }))
    .filter((item: any) => item.status === 'ESCALADO');
  const ordered = await Promise.all(assignments.map(async (assignment: any) => ({
    assignment,
    military: await entities.Militar.get(assignment.militar_id),
  })));
  ordered.sort((a: any, b: any) => compareMilitary(a.military || a.assignment, b.military || b.assignment));
  for (let index = 0; index < ordered.length; index += 1) {
    await entities.EscalaMilitar.update(ordered[index].assignment.id, {
      eh_comandante: index === 0,
      ordem_antiguidade: index + 1,
      origem_comandante: 'AUTOMATICA',
      motivo_override: '',
    });
  }
  const slots = await entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: crew.modelo_guarnicao_id });
  const expected: Record<string, number> = {};
  const filled: Record<string, number> = {};
  for (const slot of slots) expected[slot.funcao_operacional] = (expected[slot.funcao_operacional] || 0) + 1;
  for (const item of assignments) filled[item.funcao_operacional] = (filled[item.funcao_operacional] || 0) + 1;
  const complete = assignments.length === Number(crew.quantidade_prevista)
    && Object.keys(expected).every((role) => (filled[role] || 0) === expected[role]);
  await entities.EscalaGuarnicao.update(crewId, { status: complete ? 'COMPLETA' : 'INCOMPLETA' });
}

async function assertAvailable(entities: any, militaryId: string, scale: any) {
  const custom = await entities.DisponibilidadeEscala.filter({ militar_id: militaryId });
  const customBlock = custom.find((item: any) => item.status !== 'DISPONIVEL' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (customBlock) fail(`Militar indisponível no período: ${customBlock.tipo}.`);

  const vacations = await entities.Ferias.filter({ militar_id: militaryId });
  const vacation = vacations.find((item: any) => item.status !== 'Cancelada' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (vacation) fail(`Militar em férias no período (${vacation.data_inicio} a ${vacation.data_fim}).`);

  const certificates = await entities.Atestado.filter({ militar_id: militaryId });
  const certificate = certificates.find((item: any) => item.status !== 'Encerrado' && overlaps(item.data_inicio, item.data_termino || item.data_inicio, scale.data_inicio, scale.data_fim));
  if (certificate) fail(`Militar possui atestado no período (${certificate.tipo_afastamento || 'afastamento'}).`);

  const missions = await entities.EmpenhoMilitar.filter({ militar_id: militaryId });
  const mission = missions.find((item: any) => item.status === 'EMPENHADO' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (mission) fail('Militar já está empenhado em missão no período.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = text(body.action).toUpperCase();
    const permissionResponse = await base44.functions.invoke('getUserPermissions', {});
    const permissions = permissionResponse?.data ?? permissionResponse ?? {};
    const isAdmin = permissions?.isAdminByRole === true;
    const canView = isAdmin || (permissions?.modules?.sargenteacao === true && permissions?.actions?.visualizar_sargenteacao === true);
    const canManage = isAdmin || (permissions?.modules?.sargenteacao === true && permissions?.actions?.gerir_sargenteacao === true);
    if (!(action === 'LIST' ? canView : canManage)) fail('Sem permissão para esta operação.', 403);
    const entities = base44.asServiceRole.entities;

    if (action === 'LIST') {
      const [escalas, guarnicoes, escalados, records] = await Promise.all([
        entities.EscalaServico.list('-data_inicio', 1000),
        entities.EscalaGuarnicao.list('-created_date', 2000),
        entities.EscalaMilitar.list('ordem_antiguidade', 5000),
        entities.Militar.list('nome_guerra', 5000),
      ]);
      const militares = records
        .filter((item: any) => item.status_cadastro !== 'Inativo' && !['Reserva Remunerada', 'Reformado'].includes(item.situacao_militar))
        .map((item: any) => ({
          id: item.id,
          nome_completo: item.nome_completo,
          nome_guerra: item.nome_guerra,
          matricula: item.matricula,
          posto_graduacao: item.posto_graduacao,
          quadro: item.quadro,
          lotacao: item.lotacao,
          estrutura_id: item.estrutura_id,
          estrutura_nome: item.estrutura_nome,
          cnh_categoria: item.cnh_categoria,
        }));
      return Response.json({ escalas, guarnicoes, escalados, militares });
    }

    if (action === 'CREATE_SCALE') {
      const start = validDate(body.data?.data_inicio, 'Data inicial');
      const end = validDate(body.data?.data_fim || body.data?.data_inicio, 'Data final');
      if (end < start) fail('A data final deve ser igual ou posterior à inicial.');
      const stationId = required(body.data?.quartel_posto_id, 'Quartel/posto');
      const groupId = required(body.data?.ala_grupo_id, 'Ala/grupo');
      const station = await entities.QuartelPosto.get(stationId);
      const group = await entities.AlaGrupo.get(groupId);
      if (!station || station.ativo === false) fail('Quartel/posto inválido ou inativo.');
      if (!group || group.ativo === false || group.quartel_posto_id !== stationId) fail('Ala/grupo inválido para o quartel selecionado.');
      const record = await entities.EscalaServico.create({
        data_inicio: start,
        data_fim: end,
        ciclo: '24X72',
        status: 'RASCUNHO',
        quartel_posto_id: stationId,
        ala_grupo_id: groupId,
        observacoes: text(body.data?.observacoes),
      });
      return Response.json({ record });
    }

    if (action === 'ADD_CREW') {
      const scale = await entities.EscalaServico.get(required(body.escalaId, 'Escala'));
      const model = await entities.ModeloGuarnicao.get(required(body.modeloId, 'Modelo de guarnição'));
      if (!scale || scale.status !== 'RASCUNHO') fail('A escala precisa estar em rascunho.');
      if (!model || model.ativo === false) fail('Modelo de guarnição inválido ou inativo.');
      const record = await entities.EscalaGuarnicao.create({
        escala_servico_id: scale.id,
        modelo_guarnicao_id: model.id,
        nome: text(body.nome) || model.nome,
        quantidade_prevista: Number(model.quantitativo),
        status: 'INCOMPLETA',
        observacoes: text(body.observacoes),
      });
      return Response.json({ record });
    }

    if (action === 'ASSIGN_MILITARY') {
      const crew = await entities.EscalaGuarnicao.get(required(body.guarnicaoId, 'Guarnição'));
      if (!crew) fail('Guarnição não encontrada.', 404);
      const scale = await entities.EscalaServico.get(crew.escala_servico_id);
      if (!scale || scale.status !== 'RASCUNHO') fail('A escala precisa estar em rascunho.');
      const military = await entities.Militar.get(required(body.militarId, 'Militar'));
      if (!military || military.status_cadastro === 'Inativo') fail('Militar inválido ou inativo.');
      const role = text(body.funcao_operacional);
      if (!['MOTORISTA', 'AUXILIAR'].includes(role)) fail('Função operacional inválida.');
      const duplicates = await entities.EscalaMilitar.filter({ escala_servico_id: scale.id, militar_id: military.id });
      if (duplicates.some((item: any) => item.status === 'ESCALADO')) fail('Este militar já está escalado neste serviço.');
      const assignments = await entities.EscalaMilitar.filter({ escala_guarnicao_id: crew.id });
      const slots = await entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: crew.modelo_guarnicao_id });
      const expected = slots.filter((item: any) => item.funcao_operacional === role).length;
      const filled = assignments.filter((item: any) => item.status === 'ESCALADO' && item.funcao_operacional === role).length;
      if (!expected || filled >= expected) fail(`Não há vaga disponível para ${role === 'MOTORISTA' ? 'motorista' : 'auxiliar'}.`);
      await assertAvailable(entities, military.id, scale);
      const record = await entities.EscalaMilitar.create({
        escala_servico_id: scale.id,
        escala_guarnicao_id: crew.id,
        militar_id: military.id,
        militar_nome: military.nome_guerra || military.nome_completo,
        militar_posto: military.posto_graduacao || '',
        funcao_operacional: role,
        eh_comandante: false,
        origem_comandante: 'AUTOMATICA',
        status: 'ESCALADO',
      });
      await recalculateCrew(entities, crew.id);
      return Response.json({ record });
    }

    if (action === 'REMOVE_ASSIGNMENT') {
      const record = await entities.EscalaMilitar.get(required(body.id, 'Militar escalado'));
      if (!record) fail('Registro não encontrado.', 404);
      const scale = await entities.EscalaServico.get(record.escala_servico_id);
      if (!scale || scale.status !== 'RASCUNHO') fail('Somente escalas em rascunho podem ser alteradas.');
      await entities.EscalaMilitar.delete(record.id);
      await recalculateCrew(entities, record.escala_guarnicao_id);
      return Response.json({ ok: true });
    }

    if (action === 'REMOVE_CREW') {
      const crew = await entities.EscalaGuarnicao.get(required(body.id, 'Guarnição'));
      if (!crew) fail('Guarnição não encontrada.', 404);
      const scale = await entities.EscalaServico.get(crew.escala_servico_id);
      if (!scale || scale.status !== 'RASCUNHO') fail('Somente escalas em rascunho podem ser alteradas.');
      const assignments = await entities.EscalaMilitar.filter({ escala_guarnicao_id: crew.id });
      for (const assignment of assignments) await entities.EscalaMilitar.delete(assignment.id);
      await entities.EscalaGuarnicao.delete(crew.id);
      return Response.json({ ok: true });
    }

    if (action === 'PUBLISH_SCALE') {
      const scale = await entities.EscalaServico.get(required(body.id, 'Escala'));
      if (!scale || scale.status !== 'RASCUNHO') fail('A escala precisa estar em rascunho.');
      const crews = await entities.EscalaGuarnicao.filter({ escala_servico_id: scale.id });
      if (!crews.length) fail('Adicione ao menos uma guarnição antes de publicar.');
      if (crews.some((crew: any) => crew.status !== 'COMPLETA')) fail('Complete todas as vagas das guarnições antes de publicar.');
      await entities.EscalaServico.update(scale.id, { status: 'PUBLICADA' });
      for (const crew of crews) await entities.EscalaGuarnicao.update(crew.id, { status: 'PUBLICADA' });
      return Response.json({ ok: true });
    }

    if (action === 'CANCEL_SCALE') {
      const scale = await entities.EscalaServico.get(required(body.id, 'Escala'));
      if (!scale) fail('Escala não encontrada.', 404);
      if (scale.status === 'ENCERRADA') fail('Escala encerrada não pode ser cancelada.');
      await entities.EscalaServico.update(scale.id, { status: 'CANCELADA' });
      return Response.json({ ok: true });
    }

    fail('Ação inválida.');
  } catch (error: any) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[sargenteacaoEscalasGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro na montagem da escala.' }, { status });
  }
});
