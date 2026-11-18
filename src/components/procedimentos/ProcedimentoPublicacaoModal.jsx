import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import MilitarSelector from '@/components/atestado/MilitarSelector';
import { useUsuarioPodeAgirSobreMilitar } from '@/hooks/useUsuarioPodeAgirSobreMilitar';
import { criarPublicacaoProcedimento, enviarAnexoPublicacao } from '@/services/publicacaoProcedimentoService';
import { formatarData } from './procedimentoConfig';
import { ROTULOS_PUBLICACAO_PROCEDIMENTO, montarTextoProcedimento } from './procedimentoPublicacao';

export default function ProcedimentoPublicacaoModal({ procedimento, tipo, prazo, onClose, onSaved }) {
  const { canAccessAction, user } = useCurrentUser();
  const podeSalvar = canAccessAction('adicionar_publicacoes');
  const podeInformarBoletim = canAccessAction('publicar_bg');
  const { validar } = useUsuarioPodeAgirSobreMilitar();
  const { toast } = useToast();

  const [form, setForm] = useState(() => ({
    data_publicacao: format(new Date(), 'yyyy-MM-dd'),
    militar_id: '',
    nota_para_bg: '',
    numero_bg: '',
    data_bg: '',
    doems_edicao_numero: '',
    observacoes: '',
  }));
  const [arquivo, setArquivo] = useState(null);
  const anexoEnviado = useRef(null);
  const inputAnexo = useRef(null);
  const [textoEditado, setTextoEditado] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const bloqueioEnvio = useRef(false);
  const [erro, setErro] = useState('');
  const texto = textoEditado ?? montarTextoProcedimento(procedimento, tipo, prazo, Boolean(arquivo), form);

  const alterar = (campo, valor) => setForm((anterior) => ({ ...anterior, [campo]: valor }));

  async function salvar(evento) {
    evento.preventDefault();
    if (bloqueioEnvio.current || !podeSalvar) return;

    setErro('');
    if (form.militar_id) {
      const escopo = validar(form.militar_id);
      if (!escopo.permitido) {
        setErro(escopo.motivo);
        return;
      }
    }

    bloqueioEnvio.current = true;
    setSalvando(true);
    try {
      const registro = await criarPublicacaoProcedimento({
        ...form,
        tipo,
        procedimento_id: procedimento.id,
        ...(prazo ? { procedimento_prazo_id: prazo.id } : {}),
        texto_publicacao: texto,
      }, user, async () => {
        if (!arquivo) return {};
        if (!anexoEnviado.current) anexoEnviado.current = await enviarAnexoPublicacao(arquivo);
        return anexoEnviado.current;
      });
      toast({ title: 'Publicação salva', description: registro.status });
      await onSaved();
    } catch (error) {
      setErro(error.message || 'Não foi possível salvar a publicação.');
    } finally {
      bloqueioEnvio.current = false;
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !bloqueioEnvio.current) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-6">
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <FileText className="h-5 w-5 shrink-0" />
            {ROTULOS_PUBLICACAO_PROCEDIMENTO[tipo]}
          </DialogTitle>
          <DialogDescription>
            {procedimento.tipo_procedimento} · Portaria nº {procedimento.numero_portaria}
            {prazo && ` · Novo prazo até ${formatarData(prazo.data_fim)}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="space-y-4">
          <fieldset disabled={salvando} className="space-y-4">
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="procedimento-publicacao-data">Data da publicação</Label>
                <Input id="procedimento-publicacao-data" className="mt-1" type="date" required value={form.data_publicacao} onChange={(e) => alterar('data_publicacao', e.target.value)} />
              </div>
              <MilitarSelector
                opcional
                value={form.militar_id}
                onChange={alterar}
                onMilitarSelect={(militar) => setForm((anterior) => ({
                  ...anterior,
                  militar_nome: militar.militar_nome,
                  militar_posto: militar.militar_posto,
                  militar_matricula: militar.militar_matricula,
                }))}
              />
            </div>

            {podeInformarBoletim && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="procedimento-publicacao-nota">Nota para BG</Label>
                  <Input id="procedimento-publicacao-nota" className="mt-1" value={form.nota_para_bg} onChange={(e) => alterar('nota_para_bg', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="procedimento-publicacao-bg">Número do BG</Label>
                  <Input id="procedimento-publicacao-bg" className="mt-1" value={form.numero_bg} onChange={(e) => alterar('numero_bg', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="procedimento-publicacao-bg-data">Data do BG</Label>
                  <Input id="procedimento-publicacao-bg-data" className="mt-1" type="date" value={form.data_bg} onChange={(e) => alterar('data_bg', e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <Label htmlFor="procedimento-publicacao-texto">Texto da publicação</Label>
                {textoEditado !== null && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTextoEditado(null)}>Restaurar texto sugerido</Button>
                )}
              </div>
              <Textarea id="procedimento-publicacao-texto" className="mt-1" rows={6} required value={texto} onChange={(e) => setTextoEditado(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="procedimento-publicacao-anexo">Anexo do ato (opcional)</Label>
              <Input
                id="procedimento-publicacao-anexo"
                className="mt-1"
                type="file"
                ref={inputAnexo}
                accept="application/pdf,image/*"
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] || null);
                  anexoEnviado.current = null;
                }}
              />
              {arquivo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  if (inputAnexo.current) inputAnexo.current.value = '';
                  setArquivo(null);
                  anexoEnviado.current = null;
                }}>Remover anexo</Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="procedimento-publicacao-observacoes">Observações</Label>
                <Textarea id="procedimento-publicacao-observacoes" className="mt-1" rows={2} value={form.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="procedimento-publicacao-edicao">Edição de publicação externa (opcional)</Label>
                <Input id="procedimento-publicacao-edicao" className="mt-1" value={form.doems_edicao_numero} onChange={(e) => alterar('doems_edicao_numero', e.target.value)} />
              </div>
            </div>
          </fieldset>

          {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={salvando} onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" disabled={!podeSalvar || salvando}>
              {salvando ? 'Salvando...' : 'Salvar publicação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
