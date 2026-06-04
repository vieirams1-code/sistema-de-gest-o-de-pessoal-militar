const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Re-add handlers. The previous replacement didn't work because it couldn't find the exact string. Let's find it first.
// The rascunhoMutation is what we need to find, but we actually just need to add the handlers right after it.
const handlersSearch = `  const rascunhoMutation = useMutation({
    mutationFn: gerirRascunhoGratificacaoFuncao,
    onSuccess: async (_, variables) => {`;

const insertHandlers = `  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_rascunho', id: form.id, data: { ...form, status: GRATIFICACAO_STATUS.RASCUNHO } });
  const enviarDP = (form) => { rascunhoMutation.mutate({ operacao: 'enviar_dp', id: form.id, data: form }); };
  const marcarAguardandoPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'marcar_aguardando_publicacao', id: form.id }); };`;

code = code.replace(
  "  const gratificacoes = query.data?.gratificacoes || [];",
  insertHandlers + "\n\n  const gratificacoes = query.data?.gratificacoes || [];"
);

// 2. Add the modal components to the JSX return.
// We will look for <GratificacaoModal and append there.
const renderModalsSearch = `<GratificacaoModal open={gratificacaoModal.open} initialData={gratificacaoModal.data} tipos={tipos} cotas={cotas} saving={rascunhoMutation.isPending} onOpenChange={(open) => setGratificacaoModal({ open, data: open ? gratificacaoModal.data : null })} onSubmit={salvarGratificacao} />`;

const renderModalsReplace = `<GratificacaoModal open={gratificacaoModal.open} initialData={gratificacaoModal.data} tipos={tipos} cotas={cotas} saving={rascunhoMutation.isPending} onOpenChange={(open) => setGratificacaoModal({ open, data: open ? gratificacaoModal.data : null })} onSubmit={salvarGratificacao} />
      <EnviarDPModal open={enviarDPModal.open} item={enviarDPModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setEnviarDPModal({ open, data: open ? enviarDPModal.data : null })} onSubmit={enviarDP} />
      <ConfirmarPublicacaoModal open={aguardandoPublicacaoModal.open} item={aguardandoPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setAguardandoPublicacaoModal({ open, data: open ? aguardandoPublicacaoModal.data : null })} onSubmit={marcarAguardandoPublicacao} />`;

code = code.replace(renderModalsSearch, renderModalsReplace);

// 3. Ensure the props are passed to the table.
const tableSearch = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} />}`;

const tableReplace = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} />}`;

code = code.replace(tableSearch, tableReplace);

// Note: I also noticed there was an older duplicate of 'salvarGratificacao'. Let's remove the first one if it exists.
const duplicateSalvar = `  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_rascunho', id: form.id, data: { ...form, status: GRATIFICACAO_STATUS.RASCUNHO } });`;

// Replace all except the newly added one. We can just replace the old string entirely and let the new one live where we inserted it.
code = code.replace(
  `  const salvarTipo = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_tipo' : 'criar_tipo', id: form.id, data: form });
  const salvarCota = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_cota' : 'criar_cota', id: form.id, data: form });
  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_rascunho', id: form.id, data: { ...form, status: GRATIFICACAO_STATUS.RASCUNHO } });`,
  `  const salvarTipo = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_tipo' : 'criar_tipo', id: form.id, data: form });
  const salvarCota = (form) => saveMutation.mutate({ operacao: form.id ? 'atualizar_cota' : 'criar_cota', id: form.id, data: form });`
);


fs.writeFileSync(filepath, code);
