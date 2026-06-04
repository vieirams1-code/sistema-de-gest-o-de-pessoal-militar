const fs = require('fs');

const filepath = 'base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts';
let content = fs.readFileSync(filepath, 'utf8');

const newLogic = `
    if (operacao === 'registrar_publicacao_nomeacao') {
      if (statusAtual !== STATUS_AGUARDANDO_PUBLICACAO) throw withStatus('Apenas registros aguardando publicação podem ser ativados.', 400);

      const dataPub = trimString(data.data_publicacao_nomeacao);
      const dataEfeitos = trimString(data.data_inicio_efeitos);
      const doemsNum = trimString(data.doems_nomeacao_numero);
      const doemsEd = trimString(data.doems_nomeacao_edicao);

      if (!dataPub) throw withStatus('data_publicacao_nomeacao é obrigatória para esta operação.', 400);
      if (!dataEfeitos) throw withStatus('data_inicio_efeitos é obrigatória para esta operação.', 400);
      if (!doemsNum && !doemsEd) throw withStatus('doems_nomeacao_numero ou doems_nomeacao_edicao é obrigatório para esta operação.', 400);

      const refs = await validarReferencias(base44, existente);

      // validarReferencias will ensure cota has availability considering active nominations.

      const payloadUpdate = {
        status: STATUS_GRATIFICACAO_ATIVA,
        data_publicacao_nomeacao: dataPub,
        data_inicio_efeitos: dataEfeitos,
        doems_nomeacao_numero: doemsNum || existente.doems_nomeacao_numero || '',
        doems_nomeacao_edicao: doemsEd || existente.doems_nomeacao_edicao || '',
        doems_nomeacao_link: trimString(data.doems_nomeacao_link) || existente.doems_nomeacao_link || '',
        ato_nomeacao_numero: trimString(data.ato_nomeacao_numero) || existente.ato_nomeacao_numero || '',
        observacoes: trimString(data.observacoes) || existente.observacoes || '',
        status_alterado_em: new Date().toISOString(),
        status_alterado_por: authUser.email || ''
      };

      const resultado = await fetchWithRetry(() => base44.asServiceRole.entities.GratificacaoFuncao.update(id, payloadUpdate), \`GratificacaoFuncao.registrar_publicacao_nomeacao:\${id}\`);
      return Response.json({ ok: true, operacao, entityName: 'GratificacaoFuncao', data: sanitizeResponse(resultado), meta: { statusRestrito: STATUS_GRATIFICACAO_ATIVA } });
    }
`;

content = content.replace(
  "    if (operacao === 'marcar_aguardando_publicacao') {",
  newLogic + "\n    if (operacao === 'marcar_aguardando_publicacao') {"
);

fs.writeFileSync(filepath, content);
