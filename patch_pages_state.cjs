const fs = require('fs');

const filepath = 'src/pages/GratificacoesFuncao.jsx';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  '  const [aguardandoPublicacaoModal, setAguardandoPublicacaoModal] = useState({ open: false, data: null });',
  '  const [aguardandoPublicacaoModal, setAguardandoPublicacaoModal] = useState({ open: false, data: null });\n  const [registrarPublicacaoModal, setRegistrarPublicacaoModal] = useState({ open: false, data: null });'
);

content = content.replace(
  "  const marcarAguardandoPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'marcar_aguardando_publicacao', id: form.id }); };",
  "  const marcarAguardandoPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'marcar_aguardando_publicacao', id: form.id }); };\n  const registrarPublicacao = (form) => { rascunhoMutation.mutate({ operacao: 'registrar_publicacao_nomeacao', id: form.id, data: form }); };"
);

content = content.replace(
  '<GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} />',
  '<GratificacoesTable gratificacoes={gratificacoesFiltradas} tipos={tipos} canManageRascunhos={canManageGratificacoes} onEditRascunho={(item) => setGratificacaoModal({ open: true, data: item })} onEnviarDP={(item) => setEnviarDPModal({ open: true, data: item })} onAguardandoPublicacao={(item) => setAguardandoPublicacaoModal({ open: true, data: item })} onRegistrarPublicacao={(item) => setRegistrarPublicacaoModal({ open: true, data: item })} />'
);

content = content.replace(
  '<ConfirmarPublicacaoModal open={aguardandoPublicacaoModal.open} item={aguardandoPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setAguardandoPublicacaoModal({ open, data: open ? aguardandoPublicacaoModal.data : null })} onSubmit={marcarAguardandoPublicacao} />',
  '<ConfirmarPublicacaoModal open={aguardandoPublicacaoModal.open} item={aguardandoPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setAguardandoPublicacaoModal({ open, data: open ? aguardandoPublicacaoModal.data : null })} onSubmit={marcarAguardandoPublicacao} />\n      <RegistrarPublicacaoModal open={registrarPublicacaoModal.open} item={registrarPublicacaoModal.data} saving={rascunhoMutation.isPending} onOpenChange={(open) => setRegistrarPublicacaoModal({ open, data: open ? registrarPublicacaoModal.data : null })} onSubmit={registrarPublicacao} />'
);

fs.writeFileSync(filepath, content);
