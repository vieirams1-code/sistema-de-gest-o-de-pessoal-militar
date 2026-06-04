const fs = require('fs');

const filepath = 'base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts';
let content = fs.readFileSync(filepath, 'utf8');

// We need to inject duplicidade check in validarReferencias.
const checkDuplicidade = `
  const gratificacoesDoMilitar = await fetchWithRetry(
    () => base44.asServiceRole.entities.GratificacaoFuncao.filter({ militar_id: data.militar_id, tipo_gratificacao_funcao_id: data.tipo_gratificacao_funcao_id, cota_gratificacao_funcao_id: data.cota_gratificacao_funcao_id, funcao_gratificada: data.funcao_gratificada }, undefined, 100, 0, ['id', 'status']),
    \`GratificacaoFuncao.militar:\${data.militar_id}\`,
  );
  const ativasDoMilitar = (gratificacoesDoMilitar || []).filter((item: any) => normalizeTipo(item?.status) === STATUS_GRATIFICACAO_ATIVA && item.id !== data.id);
  if (ativasDoMilitar.length > 0) throw withStatus('Militar já possui uma gratificação ativa para este tipo/cota/função.', 400);

  const gratificacoesDaCota = await fetchWithRetry(
`;

content = content.replace(
  "  const gratificacoesDaCota = await fetchWithRetry(",
  checkDuplicidade
);

fs.writeFileSync(filepath, content);
