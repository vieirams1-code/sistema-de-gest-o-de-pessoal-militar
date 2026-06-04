const fs = require('fs');

const filepath = 'base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  "const OPERACOES = new Set(['criar_rascunho', 'atualizar_rascunho', 'enviar_dp', 'marcar_aguardando_publicacao']);",
  "const OPERACOES = new Set(['criar_rascunho', 'atualizar_rascunho', 'enviar_dp', 'marcar_aguardando_publicacao', 'registrar_publicacao_nomeacao']);"
);

fs.writeFileSync(filepath, content);
