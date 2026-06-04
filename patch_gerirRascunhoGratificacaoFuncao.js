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

// 4. Update sanitizePayload status check to permit these new operations to ignore status block for now, or just remove the strict block inside sanitizePayload, and handle it in the operation logic
code = code.replace(
  "  if (input.status !== undefined && trimString(input.status) && normalizeTipo(input.status) !== STATUS_RASCUNHO) {\n    throw withStatus('Status não pode ser alterado neste lote; somente rascunho é permitido.', 400);\n  }",
  "  // Removed strict block on status here. Handled downstream."
);

// We need to bypass `validarReferencias` for `enviar_dp` and `marcar_aguardando_publicacao` ? Actually, no, if we only receive `id`, we might not have `data.militar_id` etc. Wait, the frontend will just send the operacao and id, and maybe the specific data for enviar_dp.
// So let's write a replacement logic around line 204.

// Just write search and replace blocks.
