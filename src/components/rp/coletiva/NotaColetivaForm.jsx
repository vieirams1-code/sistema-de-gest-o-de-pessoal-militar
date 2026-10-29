import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import NotaColetivaCampos from '@/components/rp/coletiva/NotaColetivaCampos';
import MilitaresNotaSelector from '@/components/rp/coletiva/MilitaresNotaSelector';
import NotaColetivaVinculos from '@/components/rp/coletiva/NotaColetivaVinculos';
import useSalvarNotaColetiva from '@/components/rp/coletiva/useSalvarNotaColetiva';
import ExcluirNotaColetivaDialog from '@/components/rp/coletiva/ExcluirNotaColetivaDialog';
import NotaColetivaTexto from '@/components/rp/coletiva/NotaColetivaTexto';
import ModelosNotaColetivaManager from '@/components/rp/coletiva/ModelosNotaColetivaManager';
import useComposicaoNotaColetiva from '@/components/rp/coletiva/useComposicaoNotaColetiva';

export default function NotaColetivaForm({ registro, canAccessAction, tipos }) {
  const navigate = useNavigate();
  const [salvo, setSalvo] = useState(registro || null);
  const token = useRef(registro?.coletiva_token || crypto.randomUUID());
  const [dados, setDados] = useState(() => ({ tipo: registro?.tipo || 'Geral', data_publicacao: registro?.data_publicacao || new Date().toISOString().slice(0, 10), texto_publicacao: registro?.texto_publicacao || '', modo_texto_coletivo: registro?.modo_texto_coletivo || 'livre', cabecalho_coletiva: registro?.cabecalho_coletiva || '', modelo_coletivo_id: registro?.modelo_coletivo_id || '', nota_para_bg: registro?.nota_para_bg || '', numero_bg: registro?.numero_bg || '', data_bg: registro?.data_bg || '', observacoes: registro?.observacoes || '' }));
  const [militares, setMilitares] = useState(registro?.militares_vinculados || []);
  const [confirmado, setConfirmado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [regenerar, setRegenerar] = useState(false);
  const composicao = useComposicaoNotaColetiva(dados, militares, regenerar);
  const bloqueado = composicao.carregando || !!composicao.erro || !composicao.texto?.trim() || (dados.modo_texto_coletivo === 'lista' && (!dados.cabecalho_coletiva.trim() || /\{\{[\s\S]*?\}\}/.test(dados.cabecalho_coletiva)));
  const mutation = useSalvarNotaColetiva(result => {
    if (result?.deleted) { navigate('/RP'); return; }
    setSalvo(result); setDados(prev => ({ ...prev, ...result })); setMilitares(result.militares_vinculados || []); setRegenerar(false); setConfirmado(false); setMensagem('Nota coletiva salva. Uma única publicação está vinculada a todos os militares selecionados.');
  });
  const editavel = canAccessAction(salvo ? 'editar_publicacoes' : 'adicionar_publicacoes');
  const change = (key, value) => { setDados(prev => ({ ...prev, [key]: value, ...(key === 'tipo' ? { modelo_coletivo_id: '' } : {}), ...(key === 'modo_texto_coletivo' && value === 'livre' ? { texto_publicacao: composicao.texto || prev.texto_publicacao } : {}) })); if (['modo_texto_coletivo', 'cabecalho_coletiva'].includes(key)) setRegenerar(true); setConfirmado(false); setMensagem(''); };
  const submit = e => { e.preventDefault(); if (!bloqueado && !mutation.isPending && editavel && confirmado && militares.length) mutation.mutate({ id: salvo?.id, dados: { ...dados, texto_publicacao: composicao.texto }, militares: composicao.ids ? composicao.ids.map(id => militares.find(m => String(m.militar_id) === id)) : militares, token: token.current }); };
  return <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-5 text-foreground">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-semibold">{salvo ? 'Editar nota coletiva' : 'Nova nota coletiva'}</h1><Button asChild variant="outline"><Link to="/RP">Voltar ao RP</Link></Button></div>
    <p className="text-sm text-muted-foreground">Uma ata, uma nota e um BG para vários militares. O conteúdo completo, inclusive os dados dos demais participantes, aparece nos registros de cada militar vinculado.</p>
    <p role="note" className="rounded-md border bg-muted p-3 text-sm"><strong>Publicação apenas documental.</strong> Esta publicação não executa alterações automáticas nos cadastros, comportamentos, saldos de férias ou demais controles dos militares vinculados.</p>
    {canAccessAction('gerir_templates') && <ModelosNotaColetivaManager tipos={tipos} tipoInicial={dados.tipo} />}
    {mensagem && <p role="status" className="rounded-md border p-3" data-publicacao-id={salvo?.id}>{mensagem}</p>}
    {mutation.isError && <p role="alert" className="text-destructive">{mutation.error.message}</p>}
    <form onSubmit={submit} className="space-y-6 rounded-xl border bg-card p-4 md:p-6">
      <NotaColetivaCampos dados={dados} tipos={tipos} onChange={change} disabled={mutation.isPending || !editavel} podePublicar={canAccessAction('publicar_bg')} />
      <NotaColetivaTexto dados={dados} onChange={change} composicao={composicao} disabled={mutation.isPending || !editavel} />
      <MilitaresNotaSelector selecionados={militares} onChange={items => { setMilitares(items); setRegenerar(true); setConfirmado(false); setMensagem(''); }} disabled={mutation.isPending || !editavel} />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label="Confirmar conteúdo e militares da nota coletiva" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} disabled={!editavel} /><span>Conferi o texto integral e os {militares.length} militares selecionados. Uma única nota será exibida integralmente em todos os registros vinculados.</span></label>
      <div className="flex flex-wrap justify-end gap-3">
        {salvo && !salvo.numero_bg && !salvo.data_bg && canAccessAction('excluir_publicacoes') && <ExcluirNotaColetivaDialog disabled={mutation.isPending} onConfirm={() => mutation.mutate({ id: salvo.id, dados, militares, token: token.current, excluir: true })} />}
        <Button type="submit" disabled={!editavel || mutation.isPending || bloqueado || !confirmado || !militares.length}>{mutation.isPending ? 'Salvando…' : 'Salvar nota coletiva'}</Button>
      </div>
    </form>
    <NotaColetivaVinculos registro={salvo} />
  </div>;
}