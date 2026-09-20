import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const ENTITIES: Record<string, string> = {
  quartel: 'QuartelPosto',
  ala: 'AlaGrupo',
  modelo: 'ModeloGuarnicao',
  empenho: 'EmpenhoOperacional',
};
const POSTOS = ['coronel','tenente coronel','major','capitao','1 tenente','2 tenente','aspirante','subtenente','1 sargento','2 sargento','3 sargento','cabo','soldado'];
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const value = (v: unknown) => String(v ?? '').trim();
const normalize = (v: unknown) => value(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[º°ª.\-]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const oneOf = (v: unknown, options: string[], label: string) => {
  const result = value(v);
  if (!options.includes(result)) fail(`${label} inválido.`);
  return result;
};
const required = (v: unknown, label: string) => {
  const result = value(v);
  if (!result) fail(`${label} é obrigatório.`);
  return result;
};
const date = (v: unknown, label: string) => {
  const result = required(v, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) fail(`${label} inválida.`);
  return result;
};
const active = (v: unknown) => v !== false;
const overlaps = (a: string, b: string, start: string, end: string) => Boolean(a && b && a <= end && b >= start);

function sanitize(tipo: string, input: any) {
  const data = input || {};
  if (tipo === 'quartel') return {
    nome: required(data.nome, 'Nome'), sigla: value(data.sigla).toUpperCase(),
    tipo: oneOf(data.tipo, ['QUARTEL', 'POSTO'], 'Tipo'), estrutura_id: value(data.estrutura_id),
    estrutura_nome: value(data.estrutura_nome), observacoes: value(data.observacoes), ativo: active(data.ativo),
  };
  if (tipo === 'ala') return {
    nome: required(data.nome, 'Nome'), sigla: value(data.sigla).toUpperCase(),
    quartel_posto_id: required(data.quartel_posto_id, 'Quartel/posto'),
    quartel_posto_nome: value(data.quartel_posto_nome), ciclo: '24X72',
    hora_inicio: value(data.hora_inicio) || '07:00', hora_fim: value(data.hora_fim) || '07:00',
    observacoes: value(data.observacoes), ativo: active(data.ativo),
  };
  if (tipo === 'modelo') {
    const motorista = data.possui_motorista === true;
    const auxiliares = Number(data.auxiliares);
    if (!Number.isInteger(auxiliares) || auxiliares < 0 || auxiliares > 50) fail('Número de auxiliares inválido.');
    const quantitativo = auxiliares + Number(motorista);
    if (!quantitativo) fail('O modelo precisa de pelo menos uma vaga operacional.');
    return {
      nome: required(data.nome, 'Nome'), descricao: value(data.descricao), quantitativo,
      grupo_id: value(data.grupo_id), grupo_nome: value(data.grupo_nome),
      observacoes: value(data.observacoes), ativo: active(data.ativo),
    };
  }
  if (tipo === 'empenho') {
    const inicio = date(data.data_inicio, 'Data inicial');
    const fim = date(data.data_fim, 'Data final');
    if (fim < inicio) fail('Data final deve ser igual ou posterior à inicial.');
    return {
      nome: required(data.nome, 'Nome da missão'),
      tipo: oneOf(data.tipo, ['TIF_PANTANAL', 'MISSAO_DESLOCAMENTO', 'OUTRA'], 'Tipo'),
      ciclo: value(data.ciclo), data_inicio: inicio, data_fim: fim, destino: value(data.destino),
      descricao: value(data.descricao),
      status: oneOf(data.status, ['PLANEJADO', 'ATIVO', 'ENCERRADO', 'CANCELADO'], 'Status'),
      observacoes: value(data.observacoes),
    };
  }
  fail('Categoria inválida.');
}

function compareMilitary(a: any, b: any) {
  const rankA = POSTOS.indexOf(normalize(a.posto_graduacao));
  const rankB = POSTOS.indexOf(normalize(b.posto_graduacao));
  const safeA = rankA < 0 ? 999 : rankA;
  const safeB = rankB < 0 ? 999 : rankB;
  if (safeA !== safeB) return safeA - safeB;
  for (const field of ['antiguidade_referencia_ordem','ordem_antiguidade','antiguidade_ordem','numero_antiguidade','antiguidade']) {
    const va = Number(a?.[field]);
    const vb = Number(b?.[field]);
    const na = Number.isFinite(va) && va > 0 ? va : Number.POSITIVE_INFINITY;
    const nb = Number.isFinite(vb) && vb > 0 ? vb : Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
  }
  const da = value(a.data_promocao || a.data_inclusao) || '9999-12-31';
  const db = value(b.data_promocao || b.data_inclusao) || '9999-12-31';
  if (da !== db) return da.localeCompare(db);
  return value(a.nome_guerra || a.nome_completo).localeCompare(value(b.nome_guerra || b.nome_completo), 'pt-BR');
}

async function recalculateCrew(entities: any, crewId: string) {
  const crew = await entities.EscalaGuarnicao.get(crewId);
  if (!crew) return;
  const assignments = (await entities.EscalaMilitar.filter({ escala_guarnicao_id: crewId }))
    .filter((item: any) => item.status === 'ESCALADO');
  const enriched = await Promise.all(assignments.map(async (item: any) => ({
    assignment: item,
    military: await entities.Militar.get(item.militar_id),
  })));
  enriched.sort((a: any, b: any) => compareMilitary(a.military || a.assignment, b.military || b.assignment));
  await Promise.all(enriched.map(({ assignment }: any, index: number) => entities.EscalaMilitar.update(assignment.id, {
    eh_comandante: index === 0,
    ordem_antiguidade: index + 1,
    origem_comandante: 'AUTOMATICA',
    motivo_override: '',
  })));
  const slots = await entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: crew.modelo_guarnicao_id });
  const expected = slots.reduce((acc: any, slot: any) => {
    acc[slot.funcao_operacional] = (acc[slot.funcao_operacional] || 0) + 1;
    return acc;
  }, {});
  const filled = assignments.reduce((acc: any, item: any) => {
    acc[item.funcao_operacional] = (acc[item.funcao_operacional] || 0) + 1;
    return acc;
  }, {});
  const complete = assignments.length === Number(crew.quantidade_prevista)
    && Object.keys(expected).every((role) => (filled[role] || 0) === expected[role]);
  await entities.EscalaGuarnicao.update(crewId, { status: complete ? 'COMPLETA' : 'INCOMPLETA' });
}

async function validateAvailability(entities: any, militaryId: string, scale: any) {
  const [custom, vacations, certificates, missions] = await Promise.all([
    entities.DisponibilidadeEscala.filter({ militar_id: militaryId }),
    entities.Ferias.filter({ militar_id: militaryId }),
    entities.Atestado.filter({ militar_id: militaryId }),
    entities.EmpenhoMilitar.filter({ militar_id: militaryId }),
  ]);
  const customBlock = custom.find((item: any) => item.status !== 'DISPONIVEL' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (customBlock) fail(`Militar indisponível no período: ${customBlock.tipo}${customBlock.observacoes ? ` — ${customBlock.observacoes}` : ''}.`);
  const vacation = vacations.find((item: any) => item.status !== 'Cancelada' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (vacation) fail(`Militar em férias no período (${vacation.data_inicio} a ${vacation.data_fim}).`);
  const certificate = certificates.find((item: any) => item.status !== 'Encerrado' && overlaps(item.data_inicio, item.data_termino || item.data_inicio, scale.data_inicio, scale.data_fim));
  if (certificate) fail(`Militar possui atestado no período (${certificate.tipo_afastamento || 'afastamento'}).`);
  const mission = missions.find((item: any) => item.status === 'EMPENHADO' && overlaps(item.data_inicio, item.data_fim, scale.data_inicio, scale.data_fim));
  if (mission) fail('Militar já está empenhado em missão no período.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = value(body.action).toUpperCase();
    const response = await base44.functions.invoke('getUserPermissions', {});
    const authz = response?.data ?? response ?? {};
    const isAdmin = authz?.isAdminByRole === true;
    const canView = isAdmin || (authz?.modules?.sargenteacao === true && authz?.actions?.visualizar_sargenteacao === true);
    const canManage = isAdmin || (authz?.modules?.sargenteacao === true && authz?.actions?.gerir_sargenteacao === true);
    if (!(action === 'LIST' ? canView : canManage)) fail('Sem permissão para esta operação.', 403);
    const entities = base44.asServiceRole.entities;

    if (action === 'LIST') {
      const [quartel, alas, modelos, vagas, empenhos, escalas, guarnicoes, escalados, militaryRecords] = await Promise.all([
        entities.QuartelPosto.list('-created_date', 500),
        entities.AlaGrupo.list('-created_date', 500),
        entities.ModeloGuarnicao.list('-created_date', 500),
        entities.ModeloGuarnicaoVaga.list('ordem', 2000),
        entities.EmpenhoOperacional.list('-data_inicio', 500),
        entities.EscalaServico.list('-data_inicio', 1000),
        entities.EscalaGuarnicao.list('-created_date', 2000),
        entities.EscalaMilitar.list('ordem_antiguidade', 5000),
        entities.Militar.list('nome_guerra', 5000),
      ]);
      const militares = militaryRecords
        .filter((m: any) => m.status_cadastro !== 'Inativo' && m.situacao_militar !== 'Reserva Remunerada' && m.situacao_militar !== 'Reformado')
        .map((m: any) => ({
          id: m.id, nome_completo: m.nome_completo, nome_guerra: m.nome_guerra,
          matricula: m.matricula, posto_graduacao: m.posto_graduacao, quadro: m.quadro,
          lotacao: m.lotacao, estrutura_id: m.estrutura_id, estrutura_nome: m.estrutura_nome,
          cnh_categoria: m.cnh_categoria,
        }));
      return Response.json({ quartel, alas, modelos, vagas, empenhos, escalas, guarnicoes, escalados, militares });
    }

    if (action === 'SAVE_SCALE') {
      const inicio = date(body.data?.data_inicio, 'Data inicial');
      const fim = date(body.data?.data_fim || body.data?.data_inicio, 'Data final');
      if (fim < inicio) fail('A data final deve ser igual ou posterior à inicial.');
      const quartelId = required(body.data?.quartel_posto_id, 'Quartel/posto');
      const alaId = required(body.data?.ala_grupo_id, 'Ala/grupo');
      const [quartel, ala] = await Promise.all([entities.QuartelPosto.get(quartelId), entities.AlaGrupo.get(alaId)]);
      if (!quartel || quartel.ativo === false) fail('Quartel/posto inválido ou inativo.');
      if (!ala || ala.ativo === false || ala.quartel_posto_id !== quartelId) fail('Ala/grupo inválido para o quartel selecionado.');
      const record = await entities.EscalaServico.create({
        data_inicio: inicio, data_fim: fim, ciclo: '24X72', status: 'RASCUNHO',
        quartel_posto_id: quartelId, ala_grupo_id: alaId, observacoes: value(body.data?.observacoes),
      });
      return Response.json({ record });
    }

    if (action === 'ADD_CREW') {
      const scale = await entities.EscalaServico.get(required(body.escalaId, 'Escala'));
      const model = await entities.ModeloGuarnicao.get(required(body.modeloId, 'Modelo de guarnição'));
      if (!scale || scale.status !== 'RASCUNHO') fail('A escala precisa estar em rascunho.');
      if (!model || model.ativo === false) fail('Modelo de guarnição inválido ou inativo.');
      const record = await entities.EscalaGuarnicao.create({
        escala_servico_id: scale.id, modelo_guarnicao_id: model.id,
        nome: value(body.nome) || model.nome, quantidade_prevista: Number(model.quantitativo),
        status: 'INCOMPLETA', observacoes: value(body.observacoes),
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
      const role = oneOf(body.funcao_operacional, ['MOTORISTA', 'AUXILIAR'], 'Função operacional');
      const [sameScale, crewAssignments, slots] = await Promise.all([
        entities.EscalaMilitar.filter({ escala_servico_id: scale.id, militar_id: military.id }),
        entities.EscalaMilitar.filter({ escala_guarnicao_id: crew.id }),
        entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: crew.modelo_guarnicao_id }),
      ]);
      if (sameScale.some((item: any) => item.status === 'ESCALADO')) fail('Este militar já está escalado neste serviço.');
      const expectedRole = slots.filter((item: any) => item.funcao_operacional === role).length;
      const filledRole = crewAssignments.filter((item: any) => item.status === 'ESCALADO' && item.funcao_operacional === role).length;
      if (!expectedRole || filledRole >= expectedRole) fail(`Não há vaga disponível para ${role === 'MOTORISTA' ? 'motorista' : 'auxiliar'}.`);
      await validateAvailability(entities, military.id, scale);
      const record = await entities.EscalaMilitar.create({
        escala_servico_id: scale.id, escala_guarnicao_id: crew.id, militar_id: military.id,
        militar_nome: military.nome_guerra || military.nome_completo,
        militar_posto: military.posto_graduacao || '', funcao_operacional: role,
        eh_comandante: false, origem_comandante: 'AUTOMATICA', status: 'ESCALADO',
      });
      await recalculateCrew(entities, crew.id);
      return Response.json({ record });
    }

    if (action === 'REMOVE_ASSIGNMENT') {
      const assignment = await entities.EscalaMilitar.get(required(body.id, 'Militar escalado'));
      if (!assignment) fail('Registro não encontrado.', 404);
      const scale = await entities.EscalaServico.get(assignment.escala_servico_id);
      if (!scale || scale.status !== 'RASCUNHO') fail('Somente escalas em rascunho podem ser alteradas.');
      await entities.EscalaMilitar.delete(assignment.id);
      await recalculateCrew(entities, assignment.escala_guarnicao_id);
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
      await Promise.all(crews.map((crew: any) => entities.EscalaGuarnicao.update(crew.id, { status: 'PUBLICADA' })));
      return Response.json({ ok: true });
    }

    if (action === 'CANCEL_SCALE') {
      const scale = await entities.EscalaServico.get(required(body.id, 'Escala'));
      if (!scale) fail('Escala não encontrada.', 404);
      if (scale.status === 'ENCERRADA') fail('Escala encerrada não pode ser cancelada.');
      await entities.EscalaServico.update(scale.id, { status: 'CANCELADA' });
      return Response.json({ ok: true });
    }

    if (!['SAVE', 'TOGGLE'].includes(action)) fail('Ação inválida.');
    const tipo = value(body.tipo);
    if (!ENTITIES[tipo]) fail('Categoria inválida.');
    const entity = entities[ENTITIES[tipo]];
    const id = value(body.id);
    if (action === 'TOGGLE') {
      if (tipo === 'empenho') fail('Use a edição para alterar o status da missão.');
      const current = await entity.get(required(id, 'Registro'));
      if (!current) fail('Registro não encontrado.', 404);
      const updated = await entity.update(id, { ativo: current.ativo === false });
      return Response.json({ record: updated });
    }

    const clean: any = sanitize(tipo, body.data);
    if (tipo === 'ala') {
      const quartel = await entities.QuartelPosto.get(clean.quartel_posto_id);
      if (!quartel || quartel.ativo === false) fail('Selecione um quartel/posto ativo.');
      clean.quartel_posto_nome = quartel.nome;
    }
    if (id && !(await entity.get(id))) fail('Registro não encontrado.', 404);
    const record = id ? await entity.update(id, clean) : await entity.create(clean);
    if (tipo === 'modelo') {
      const modeloId = record?.id || id;
      const existing = await entities.ModeloGuarnicaoVaga.filter({ modelo_guarnicao_id: modeloId });
      const desired: string[] = [
        ...(body.data?.possui_motorista === true ? ['MOTORISTA'] : []),
        ...Array(Number(body.data?.auxiliares)).fill('AUXILIAR'),
      ];
      for (let i = 0; i < desired.length; i += 1) {
        const fields = { modelo_guarnicao_id: modeloId, funcao_operacional: desired[i], ordem: i + 1, obrigatoria: true };
        if (existing?.[i]) await entities.ModeloGuarnicaoVaga.update(existing[i].id, fields);
        else await entities.ModeloGuarnicaoVaga.create(fields);
      }
      for (const old of (existing || []).slice(desired.length)) await entities.ModeloGuarnicaoVaga.delete(old.id);
    }
    return Response.json({ record });
  } catch (error: any) {
    const status = Number(error?.status || error?.response?.status || 500);
    console.error('[sargenteacaoGateway]', error?.message || error);
    return Response.json({ error: error?.message || 'Erro na Sargenteação.' }, { status });
  }
});
