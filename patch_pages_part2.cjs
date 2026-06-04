const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Pass down action props to GratificacoesTable
// Change: <GratificacoesTable ... onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} />
// To include onEnviarDP and onAguardandoPublicacao

const tableSearch = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} />}`;

const tableReplace = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} />}`;

code = code.replace(tableSearch, tableReplace);

// 2. Add submit handlers for new modals in GratificacoesFuncao
const handlersSearch = `  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_rascunho', id: form.id, data: { ...form, status: GRATIFICACAO_STATUS.RASCUNHO } });`;

const handlersReplace = `  const salvarGratificacao = (form) => rascunhoMutation.mutate({ operacao: form.id ? 'atualizar_rascunho' : 'criar_rascunho', id: form.id, data: { ...form, status: GRATIFICACAO_STATUS.RASCUNHO } });
  const enviarDP = (form) => { rascunhoMutation.mutate({ operacao: 'enviar_dp', id: form.id, data: form }); setEnviarDPModal({ open: false, data: null }); };
  const marcarAguardandoPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'marcar_aguardando_publicacao', id: form.id }); setAguardandoPublicacaoModal({ open: false, data: null }); };`;

code = code.replace(handlersSearch, handlersReplace);

// 3. Render the modals at the bottom of the page
const modalsRenderSearch = `      <CotaModal open={cotaModal.open} initialData={cotaModal.data} tipos={tipos} saving={saveMutation.isPending} onOpenChange={(open) => setCotaModal({ open, data: open ? cotaModal.data : null })} onSubmit={salvarCota} />
    </div></div>
  );
}`;

const modalsRenderReplace = `      <CotaModal open={cotaModal.open} initialData={cotaModal.data} tipos={tipos} saving={saveMutation.isPending} onOpenChange={(open) => setCotaModal({ open, data: open ? cotaModal.data : null })} onSubmit={salvarCota} />
      <EnviarDPModal open={enviarDPModal.open} item={enviarDPModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setEnviarDPModal({ open, data: open ? enviarDPModal.data : null })} onSubmit={enviarDP} />
      <ConfirmarPublicacaoModal open={aguardandoPublicacaoModal.open} item={aguardandoPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setAguardandoPublicacaoModal({ open, data: open ? aguardandoPublicacaoModal.data : null })} onSubmit={marcarAguardandoPublicacao} />
    </div></div>
  );
}`;

code = code.replace(modalsRenderSearch, modalsRenderReplace);

// 4. Update GratificacoesTable component to receive the new props and render the buttons
// We need to find the definition of GratificacoesTable.
