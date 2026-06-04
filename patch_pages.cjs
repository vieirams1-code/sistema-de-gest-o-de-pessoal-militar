const fs = require('fs');

const filepath = 'src/pages/GratificacoesFuncao.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const modalTemplate = `
function RegistrarPublicacaoModal({ open, onOpenChange, item, saving, onSubmit }) {
  const [form, setForm] = useState({
    data_publicacao_nomeacao: '',
    doems_nomeacao_numero: '',
    doems_nomeacao_edicao: '',
    data_inicio_efeitos: '',
    doems_nomeacao_link: '',
    ato_nomeacao_numero: '',
    observacoes: '',
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        data_publicacao_nomeacao: item?.data_publicacao_nomeacao || '',
        doems_nomeacao_numero: item?.doems_nomeacao_numero || '',
        doems_nomeacao_edicao: item?.doems_nomeacao_edicao || '',
        data_inicio_efeitos: item?.data_inicio_efeitos || '',
        doems_nomeacao_link: item?.doems_nomeacao_link || '',
        ato_nomeacao_numero: item?.ato_nomeacao_numero || '',
        observacoes: item?.observacoes || '',
      });
    }
  }, [open, item]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Publicação (DOEMS)</DialogTitle>
          <DialogDescription>
            Informe os dados da publicação da nomeação em DOEMS.
            <div className="mt-2 rounded bg-amber-50 p-2 text-amber-800 border border-amber-200">
              <span className="font-semibold">Aviso:</span> Esta ação tornará a gratificação ativa e ocupará uma cota.
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
          <Field label="Data da publicação *">
            <Input type="date" value={form.data_publicacao_nomeacao} onChange={(e) => update('data_publicacao_nomeacao', e.target.value)} />
          </Field>
          <Field label="Início dos efeitos *">
            <Input type="date" value={form.data_inicio_efeitos} onChange={(e) => update('data_inicio_efeitos', e.target.value)} />
          </Field>
          <Field label="DOEMS número">
            <Input value={form.doems_nomeacao_numero} onChange={(e) => update('doems_nomeacao_numero', e.target.value)} placeholder="Ex: 11000" />
          </Field>
          <Field label="DOEMS edição">
            <Input value={form.doems_nomeacao_edicao} onChange={(e) => update('doems_nomeacao_edicao', e.target.value)} placeholder="Ex: Suplemento I" />
          </Field>
          <Field label="DOEMS link" className="md:col-span-2">
            <Input value={form.doems_nomeacao_link} onChange={(e) => update('doems_nomeacao_link', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Ato de nomeação (Opcional)" className="md:col-span-2">
            <Input value={form.ato_nomeacao_numero} onChange={(e) => update('ato_nomeacao_numero', e.target.value)} placeholder="Número do ato, se houver" />
          </Field>
          <Field label="Observações (Opcional)" className="md:col-span-2">
            <Textarea value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ id: item.id, ...form })} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ativar Nomeação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

content = content.replace('function ConfirmarPublicacaoModal', modalTemplate + '\nfunction ConfirmarPublicacaoModal');

// Now update the GratificacoesTable signature and usage
content = content.replace(
  'function GratificacoesTable({ gratificacoes, tipos, canManageRascunhos = false, onEditRascunho, onEnviarDP, onAguardandoPublicacao }) {',
  'function GratificacoesTable({ gratificacoes, tipos, canManageRascunhos = false, onEditRascunho, onEnviarDP, onAguardandoPublicacao, onRegistrarPublicacao }) {'
);

const actionAguardando = `  ) : item.status === GRATIFICACAO_STATUS.AGUARDANDO_PUBLICACAO_NOMEACAO ? (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700" onClick={() => onRegistrarPublicacao(item)}>Registrar Publicação</Button>
    </div>
  ) : (
    <span className="text-xs text-slate-400">Somente rascunho/DP</span>
  )}
</td>}</tr>)}</tbody></table></div></div>
  );
}`;

content = content.replace(
`  ) : (
    <span className="text-xs text-slate-400">Somente rascunho/DP</span>
  )}
</td>}</tr>)}</tbody></table></div></div>
  );
}`, actionAguardando);

fs.writeFileSync(filepath, content);
