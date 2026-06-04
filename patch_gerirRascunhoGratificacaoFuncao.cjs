const fs = require('fs');
const filepath = 'base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Add new operations
code = code.replace(
  "const OPERACOES = new Set(['criar_rascunho', 'atualizar_rascunho']);",
  "const OPERACOES = new Set(['criar_rascunho', 'atualizar_rascunho', 'enviar_dp', 'marcar_aguardando_publicacao']);"
);

// 2. Add statuses
code = code.replace(
  "const STATUS_RASCUNHO = 'rascunho';",
  "const STATUS_RASCUNHO = 'rascunho';\nconst STATUS_SOLICITADO_DP = 'solicitado_dp';\nconst STATUS_AGUARDANDO_PUBLICACAO = 'aguardando_publicacao_nomeacao';"
);

// 3. Allow data_solicitacao and documento_solicitacao in GRATIFICACAO_FIELDS
code = code.replace(
  "  'numero_processo', 'observacoes',",
  "  'numero_processo', 'observacoes', 'data_solicitacao', 'documento_solicitacao',"
);

// 4. sanitizePayload modifications
// We will replace sanitizePayload entirely to be safe
const sanitizePayloadSearch = `function sanitizePayload(input: any = {}) {
  const out: Record<string, any> = {};
  for (const field of GRATIFICACAO_FIELDS) out[field] = trimString(input[field]);
  if (input.status !== undefined && trimString(input.status) && normalizeTipo(input.status) !== STATUS_RASCUNHO) {
    throw withStatus('Status não pode ser alterado neste lote; somente rascunho é permitido.', 400);
  }
  if (!out.militar_id) throw withStatus('militar_id é obrigatório.', 400);
  if (!out.tipo_gratificacao_funcao_id) throw withStatus('tipo_gratificacao_funcao_id é obrigatório.', 400);
  if (!out.cota_gratificacao_funcao_id) throw withStatus('cota_gratificacao_funcao_id é obrigatório.', 400);
  if (!out.funcao_gratificada) throw withStatus('funcao_gratificada é obrigatória.', 400);
  return out;
}`;

const sanitizePayloadReplace = `function sanitizePayload(input: any = {}, operacao: string) {
  const out: Record<string, any> = {};
  for (const field of GRATIFICACAO_FIELDS) out[field] = trimString(input[field]);

  if (operacao === 'criar_rascunho' || operacao === 'atualizar_rascunho') {
    if (!out.militar_id) throw withStatus('militar_id é obrigatório.', 400);
    if (!out.tipo_gratificacao_funcao_id) throw withStatus('tipo_gratificacao_funcao_id é obrigatório.', 400);
    if (!out.cota_gratificacao_funcao_id) throw withStatus('cota_gratificacao_funcao_id é obrigatório.', 400);
    if (!out.funcao_gratificada) throw withStatus('funcao_gratificada é obrigatória.', 400);
  }
  return out;
}`;
code = code.replace(sanitizePayloadSearch, sanitizePayloadReplace);

const mainLogicSearch = `    if (!OPERACOES.has(operacao)) return Response.json({ error: 'Operação não permitida neste lote. Use criar_rascunho ou atualizar_rascunho.' }, { status: 400 });

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    const canManage = authIsAdmin || authPerms.actions?.[REQUIRED_ACTION] === true;
    if (!canManage) return Response.json({ error: 'Acesso negado: requer gerir_gratificacoes_funcao ou admin/ALL.' }, { status: 403 });

    const data = sanitizePayload(payload?.data && typeof payload.data === 'object' ? payload.data : {});
    const refs = await validarReferencias(base44, data);
    const registro = montarRegistroRascunho(data, refs, authUser);

    if (operacao === 'criar_rascunho') {
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.create(registro), 'GratificacaoFuncao.create:rascunho');
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_RASCUNHO, semAtivacao: true, semNomeacao: true } });
    }

    const id = trimString(payload?.id || payload?.data?.id);
    if (!id) throw withStatus('id é obrigatório para atualizar_rascunho.', 400);
    const existente = await buscarUm(base44, 'GratificacaoFuncao', id);
    if (normalizeTipo(existente.status) !== STATUS_RASCUNHO) throw withStatus('Somente GratificacaoFuncao em rascunho pode ser atualizada neste lote.', 400);
    const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, { ...registro, status: STATUS_RASCUNHO }), \`GratificacaoFuncao.update:rascunho:\${id}\`);
    return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_RASCUNHO, semAtivacao: true, semNomeacao: true } });`;

const mainLogicReplace = `    if (!OPERACOES.has(operacao)) return Response.json({ error: 'Operação não permitida neste lote.' }, { status: 400 });

    const authPerms = await resolverPermissoes(base44, authUser.email);
    const authIsAdmin = String(authUser.role || '').toLowerCase() === 'admin' || authPerms.isAdminByAccess;
    const canManage = authIsAdmin || authPerms.actions?.[REQUIRED_ACTION] === true;
    if (!canManage) return Response.json({ error: 'Acesso negado: requer gerir_gratificacoes_funcao ou admin/ALL.' }, { status: 403 });

    const data = sanitizePayload(payload?.data && typeof payload.data === 'object' ? payload.data : {}, operacao);

    if (operacao === 'criar_rascunho' || operacao === 'atualizar_rascunho') {
      const refs = await validarReferencias(base44, data);
      const registro = montarRegistroRascunho(data, refs, authUser);

      if (operacao === 'criar_rascunho') {
        const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.create(registro), 'GratificacaoFuncao.create:rascunho');
        return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_RASCUNHO, semAtivacao: true, semNomeacao: true } });
      }

      const id = trimString(payload?.id || payload?.data?.id);
      if (!id) throw withStatus('id é obrigatório para atualizar_rascunho.', 400);
      const existente = await buscarUm(base44, 'GratificacaoFuncao', id);
      if (normalizeTipo(existente.status) !== STATUS_RASCUNHO) throw withStatus('Somente GratificacaoFuncao em rascunho pode ser atualizada neste lote.', 400);
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, { ...registro, status: STATUS_RASCUNHO }), \`GratificacaoFuncao.update:rascunho:\${id}\`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_RASCUNHO, semAtivacao: true, semNomeacao: true } });
    }

    const id = trimString(payload?.id || payload?.data?.id);
    if (!id) throw withStatus('id é obrigatório para esta operação.', 400);
    const existente = await buscarUm(base44, 'GratificacaoFuncao', id);
    const statusAtual = normalizeTipo(existente.status);

    if (operacao === 'enviar_dp') {
      if (statusAtual !== STATUS_RASCUNHO) throw withStatus('Apenas registros em rascunho podem ser enviados à DP.', 400);

      const payloadUpdate = {
        status: STATUS_SOLICITADO_DP,
        data_solicitacao: data.data_solicitacao || null,
        documento_solicitacao: data.documento_solicitacao || '',
        numero_processo: data.numero_processo || existente.numero_processo || '',
        solicitado_por: authUser.email || '',
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), \`GratificacaoFuncao.enviar_dp:\${id}\`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_SOLICITADO_DP, semAtivacao: true, semNomeacao: true } });
    }

    if (operacao === 'marcar_aguardando_publicacao') {
      if (statusAtual !== STATUS_RASCUNHO && statusAtual !== STATUS_SOLICITADO_DP) throw withStatus('Registro deve estar em rascunho ou solicitado_dp.', 400);

      const payloadUpdate = {
        status: STATUS_AGUARDANDO_PUBLICACAO,
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };
      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), \`GratificacaoFuncao.marcar_aguardando_publicacao:\${id}\`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_AGUARDANDO_PUBLICACAO, semAtivacao: true, semNomeacao: true } });
    }`;

code = code.replace(mainLogicSearch, mainLogicReplace);
fs.writeFileSync(filepath, code);
