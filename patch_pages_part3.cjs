const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

const queryClientInvalidateSearch = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} />}`;

// We already replaced this, so let's find the current one
const currentTableSearch = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} />}`;

const currentTableReplace = `{!query.isLoading && !query.error && aba !== GRATIFICACAO_TABS.COTAS && aba !== GRATIFICACAO_TABS.TIPOS && <GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} />}`;

// Nothing to do for the table...

// I missed adding the rascunho mutation logic in my previous patch? Let's verify.
