import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const ENTITIES: Record<string, string> = {
  quartel: 'QuartelPosto',
  ala: 'AlaGrupo',
  modelo: 'ModeloGuarnicao',
  empenho: 'EmpenhoOperacional',
};
const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};
const value = (v: unknown) => String(v ?? '').trim();
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

function sanitize(tipo: string, input: any) {
  const data = input || {};
  if (tipo === 'quartel') return {
    nome: required(data.nome, 'Nome'),
    sigla: value(data.sigla).toUpperCase(),
    tipo: oneOf(data.tipo, ['QUARTEL', 'POSTO'], 'Tipo'),
    estrutura_id: value(data.estrutura_id),
    estrutura_nome: value(data.estrutura_nome),
    observacoes: value(data.observacoes),
    ativo: active(data.ativo),
  };
  if (tipo === 'ala') return {
    nome: required(data.nome, 'Nome'),
    sigla: value(data.sigla).toUpperCase(),
    quartel_posto_id: required(data.quartel_posto_id, 'Quartel/posto'),
    quartel_posto_nome: value(data.quartel_posto_nome),
    ciclo: '24X72',
    hora_inicio: value(data.hora_inicio) || '07:00',
    hora_fim: value(data.hora_fim) || '07:00',
    observacoes: value(data.observacoes),
    ativo: active(data.ativo),
  };
  if (tipo === 'modelo') {
    const motorista = data.possui_motorista === true;
    const auxiliares = Number(data.auxiliares);
    if (!Number.isInteger(auxiliares) || auxiliares < 0 || auxiliares > 50) fail('Número de auxiliares inválido.');
    const quantitativo = auxiliares + Number(motorista);
    if (!quantitativo) fail('O modelo precisa de pelo menos uma vaga operacional.');
    return {
      nome: required(data.nome, 'Nome'),
      descricao: value(data.descricao),
      quantitativo,
      grupo_id: value(data.grupo_id),
      grupo_nome: value(data.grupo_nome),
      observacoes: value(data.observacoes),
      ativo: active(data.ativo),
    };
  }
  if (tipo === 'empenho') {
    const inicio = date(data.data_inicio, 'Data inicial');
    const fim = date(data.data_fim, 'Data final');
    if (fim < inicio) fail('Data final deve ser igual ou posterior à inicial.');
    return {
      nome: required(data.nome, 'Nome da missão'),
      tipo: oneOf(data.tipo, ['TIF_PANTANAL', 'MISSAO_DESLOCAMENTO', 'OUTRA'], 'Tipo'),
      ciclo: value(data.ciclo),
      data_inicio: inicio,
      data_fim: fim,
      destino: value(data.destino),
      descricao: value(data.descricao),
      status: oneOf(data.status, ['PLANEJADO', 'ATIVO', 'ENCERRADO', 'CANCELADO'], 'Status'),
      observacoes: value(data.observacoes),
    };
  }
  fail('Categoria inválida.');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = value(body.action).toUpperCase();
    const tipo = value(body.tipo);
    if (action !== 'LIST' && !ENTITIES[tipo]) fail('Categoria inválida.');
    if (!['LIST', 'SAVE', 'TOGGLE'].includes(action)) fail('Ação inválida.');
    const response = await base44.functions.invoke('getUserPermissions', {});
    const authz = response?.data ?? response ?? {};
    const isAdmin = authz?.isAdminByRole === true;
    const canView = isAdmin || (authz?.modules?.sargenteacao === true && authz?.actions?.visualizar_sargenteacao === true);
    const canManage = isAdmin || (authz?.modules?.sargenteacao === true && authz?.actions?.gerir_sargenteacao === true);
    if (!(action === 'LIST' ? canView : canManage)) fail('Sem permissão para esta operação.', 403);
    const entities = base44.asServiceRole.entities;

    if (action === 'LIST') {
      const [quartel, alas, modelos, vagas, empenhos] = await Promise.all([
        entities.QuartelPosto.list('-created_date', 500),
        entities.AlaGrupo.list('-created_date', 500),
        entities.ModeloGuarnicao.list('-created_date', 500),
        entities.ModeloGuarnicaoVaga.list('ordem', 2000),
        entities.EmpenhoOperacional.list('-data_inicio', 500),
      ]);
      return Response.json({ quartel, alas, modelos, vagas, empenhos });
    }

    const entity = entities[ENTITIES[tipo]];
    const id = value(body.id);
    if (action === 'TOGGLE') {
      if (tipo === 'empenho') fail('Use a edição para alterar o status da missão.');
      const current = await entity.get(required(id, 'Registro'));
      if (!current) fail('Registro não encontrado.', 404);
      const updated = await entity.update(id, { ativo: current.ativo === false });
      return Response.json({ record: updated });
    }

    const clean = sanitize(tipo, body.data);
    if (tipo === 'ala') {
      const quartel = await entities.QuartelPosto.get(clean.quartel_posto_id);
      if (!quartel || quartel.ativo === false) fail('Selecione um quartel/posto ativo.');
      clean.quartel_posto_nome = quartel.nome;
    }
    if (id) {
      const current = await entity.get(id);
      if (!current) fail('Registro não encontrado.', 404);
    }
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
