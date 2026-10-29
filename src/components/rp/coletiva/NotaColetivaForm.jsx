import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import NotaColetivaCampos from '@/components/rp/coletiva/NotaColetivaCampos';
import MilitaresNotaSelector from '@/components/rp/coletiva/MilitaresNotaSelector';
import NotaColetivaVinculos from '@/components/rp/coletiva/NotaColetivaVinculos';
import useSalvarNotaColetiva from '@/components/rp/coletiva/useSalvarNotaColetiva';
import ExcluirNotaColetivaDialog from '@/components/rp/coletiva/ExcluirNotaColetivaDialog';

export default function NotaColetivaForm({ registro, canAccessAction }) {
  const navigate = useNavigate();
  const [salvo, setSalvo] = useState(registro || null);
  const token = useRef(registro?.coletiva_token || crypto.randomUUID());
  const [dados, setDados] = useState(() => ({ tipo: registro?.tipo || 'Geral', data_publicacao: registro?.data_publicacao || new Date().toISOString().slice(0, 10), texto_publicacao: registro?.texto_publicacao || '', nota_para_bg: registro?.nota_para_bg || '', numero_bg: registro?.numero_bg || '', data_bg: registro?.data_bg || '', observacoes: registro?.observacoes || '' }));
  const [militares, setMilitares] = useState(registro?.militares_vinculados || []);
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const mutation = useSalvarNotaColetiva(result => {
    if (result?.deleted) { navigate('/RP'); return; }
    setSalvo(result); setConfirmado(false); setMensagem('Nota coletiva salva. Uma única publicação está vinculada a todos os militares selecionados.');
  });
  const editavel = canAccessAction(salvo ? 'editar_publicacoes' : 'adicionar_publicacoes');
  const change = (key, value) => { setDados(prev => ({ ...prev, [key]: value })); setConfirmado(false); setMensagem(''); };
  const submit = e => { e.preventDefault(); if (!mutation.isPending && editavel && confirmado && militares.length) mutation.mutate({ id: salvo?.id, dados, militares, token: token.current }); };
  return <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-5 text-foreground">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-semibold">{salvo ? 'Editar nota coletiva' : 'Nova nota coletiva'}</h1><Button asChild variant="outline"><Link to="/RP">Voltar ao RP</Link></Button></div>
    <p className="text-sm text-muted-foreground">Uma ata, uma nota e um BG para vários militares. O conteúdo completo, inclusive os dados dos demais participantes, aparece nos registros de cada militar vinculado.</p>
    {mensagem && <p role="status" className="rounded-md border p-3" data-publicacao-id={salvo?.id}>{mensagem}</p>}
    {mutation.isError && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
    <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
      <NotaColetivaCampos dados={dados} onChange={change} disabled={mutation.isPending || !editavel} podePublicar={canAccessAction('publicar_bg')} />
      <MilitaresNotaSelector selecionados={militares} onChange={items => { setMilitares(items); setConfirmado(false); setMensagem(''); }} disabled={mutation.isPending || !editavel} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label="Confirmar conteúdo e militares da nota coletiva" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} disabled={!editavel} /><span>Conferi o texto integral e os {militares.length} militares selecionados. Uma única nota será exibida integralmente em todos os registros vinculados.</span></label>
      <div className="flex flex-wrap justify-end gap-3">
        {salvo && !salvo.numero_bg && !salvo.data_bg && canAccessAction('excluir_publicacoes') && <ExcluirNotaColetivaDialog disabled={mutation.isPending} onConfirm={() => mutation.mutate({ id: salvo.id, dados, militares, token: token.current, excluir: true })} />}
        <Button type="submit" disabled={!editavel || mutation.isPending || !confirmado || !militares.length}>{mutation.isPending ? 'Salvando…' : 'Salvar nota coletiva'}</Button>
      </div>
    </form>
    <NotaColetivaVinculos registro={salvo} />
  </div>;
}