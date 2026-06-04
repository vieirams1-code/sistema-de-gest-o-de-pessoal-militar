const fs = require('fs');
const filepath = 'src/pages/GratificacoesFuncao.jsx';
let code = fs.readFileSync(filepath, 'utf8');

const enviarDPModalStr = `
function EnviarDPModal({ open, onOpenChange, item, saving, onSubmit }) {
  const [form, setForm] = React.useState({ data_solicitacao: '', documento_solicitacao: '', numero_processo: '' });

  React.useEffect(() => {
    if (open) {
      setForm({
        data_solicitacao: item?.data_solicitacao || new Date().toISOString().split('T')[0],
        documento_solicitacao: item?.documento_solicitacao || '',
        numero_processo: item?.numero_processo || '',
      });
    }
  }, [open, item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ id: item.id, ...form });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enviar à DP</DialogTitle>
            <DialogDescription>
              Confirme os dados da solicitação para avançar o status deste rascunho.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Data da Solicitação</Label>
              <Input type="date" value={form.data_solicitacao} onChange={(e) => setForm({ ...form, data_solicitacao: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Documento da Solicitação</Label>
              <Input value={form.documento_solicitacao} onChange={(e) => setForm({ ...form, documento_solicitacao: e.target.value })} placeholder="Ex: Ofício nº 123/2023" />
            </div>
            <div className="space-y-2">
              <Label>Número do Processo (opcional)</Label>
              <Input value={form.numero_processo} onChange={(e) => setForm({ ...form, numero_processo: e.target.value })} placeholder="Ex: E-09/123/1000/2023" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Envio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmarPublicacaoModal({ open, onOpenChange, item, saving, onSubmit }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aguardando Publicação</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja marcar esta gratificação como aguardando publicação da nomeação?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => onSubmit({ id: item.id })} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GratificacoesFuncao() {`;

code = code.replace('export default function GratificacoesFuncao() {', enviarDPModalStr);
fs.writeFileSync(filepath, code);
