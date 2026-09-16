import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ShieldCheck, CalendarPlus } from 'lucide-react';
import PreviaGeracaoFeriasModal from '@/components/ferias/PreviaGeracaoFeriasModal';

export default function GeracaoFeriasPlanoV2({ plano, podeAdmin, podeGerar, onGerado }) {
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queries = useQueryClient();
  const request = async preview => {
    if (!admin || !podeAdmin || !podeGerar || busy || plano?.status !== 'ATIVO') return;
    setBusy(true); setError(''); setOpen(true);
    try {
      const res = await base44.functions.invoke('portal_servicos', { acao:'PLANO_INSTITUCIONAL_GERAR_FERIAS', plano_id:plano.id, origem_painel_v2:true, modo_admin:true, somente_previa:preview, previa_assinatura:preview ? undefined : previa?.assinatura });
      if (!res.data?.ok) throw new Error(res.data?.error || 'Não foi possível concluir a operação.');
      if (preview) { setPrevia(res.data); setResultado(null); }
      else { setResultado(res.data); await queries.invalidateQueries(); }
    } catch (err) { setError(err?.response?.data?.error || err.message || 'Falha na geração de férias.'); }
    finally { setBusy(false); }
  };
  const close = () => { if (busy) return; setOpen(false); if (resultado) onGerado(resultado.message); setPrevia(null); setResultado(null); setError(''); };
  if (!podeAdmin) return null;
  return <div className="mt-4 flex flex-wrap items-center gap-3">
    <Button variant={admin ? 'secondary' : 'outline'} aria-pressed={admin} disabled={busy} onClick={() => setAdmin(!admin)}><ShieldCheck className="h-4 w-4" />{admin ? 'Modo Admin ativo' : 'Ativar Modo Admin'}</Button>
    {admin && podeGerar && <Button disabled={busy || !plano || plano.status !== 'ATIVO'} onClick={() => { setPrevia(null); setResultado(null); request(true); }}><CalendarPlus className="h-4 w-4" />Conferir e gerar férias</Button>}
    {admin && !podeGerar && <p className="text-xs text-muted-foreground">É necessária a permissão específica para gerar férias.</p>}
    <PreviaGeracaoFeriasModal open={open} onClose={close} plano={plano} previa={previa} resultado={resultado} busy={busy} error={error} onRefresh={() => request(true)} onConfirm={() => request(false)} />
  </div>;
}