import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import validarDadosAntiguidade, { MOTIVOS } from '@/utils/antiguidade/validarDadosAntiguidade';

const STATUS_BADGE = {
  ativo: 'bg-emerald-100 text-emerald-800',
  pendente: 'bg-amber-100 text-amber-800',
  retificado: 'bg-blue-100 text-blue-800',
  cancelado: 'bg-rose-100 text-rose-800',
};

const MOTIVOS_LABEL = {
  [MOTIVOS.SEM_DATA]: 'Sem data de promoção',
  [MOTIVOS.SEM_ANTERIOR]: 'Sem número de antiguidade',
  [MOTIVOS.EMPATE]: 'Empate não resolvido',
  [MOTIVOS.SEM_QUADRO]: 'Quadro incompatível',
};

export default function CarreiraAntiguidadePanel({ militar, historicoPromocoes, onOpenPromocaoAtualModal, onHistoricoChanged, canManage }) {
  const [detalhe, setDetalhe] = React.useState(null);
  const [retificar, setRetificar] = React.useState(null);
  const [cancelar, setCancelar] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  const [erroAcao, setErroAcao] = React.useState('');
  const historico = React.useMemo(() => [...(historicoPromocoes || [])].sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || ''))), [historicoPromocoes]);

  const promocaoAtual = React.useMemo(() => {
    const posto = String(militar?.posto_graduacao || '').trim();
    const quadro = String(militar?.quadro || '').trim();
    const ativosOuSemStatus = historico.filter((h) => {
      const status = String(h.status_registro || '').trim().toLowerCase();
      return (!status || status === 'ativo') && String(h.militar_id || '') === String(militar?.id || '') && String(h.data_promocao || '').trim();
    });
    const completo = ativosOuSemStatus.find((h) =>
      String(h.posto_graduacao_novo || '').trim() === posto
      && String(h.quadro_novo || '').trim() === quadro,
    );
    if (completo) return completo;
    if (ativosOuSemStatus.length === 1) return ativosOuSemStatus[0];
    return null;
  }, [historico, militar]);

  const promocaoAtualIncompleta = Boolean(promocaoAtual?.data_promocao)
    && (!promocaoAtual?.posto_graduacao_novo || !promocaoAtual?.quadro_novo || !promocaoAtual?.status_registro);

  const onRetificar = async (registro) => {
    if (!motivo.trim()) return setErroAcao('Informe o motivo da retificação.');
    setErroAcao('');
    await base44.entities.HistoricoPromocaoMilitar.update(registro.id, {
      status_registro: 'retificado',
      motivo_retificacao: motivo,
      observacoes: `${registro.observacoes || ''} | Retificado: ${motivo}`.trim(),
    });
    await base44.entities.HistoricoPromocaoMilitar.create({
      ...registro,
      id: undefined,
      status_registro: 'ativo',
      origem_dado: registro.origem_dado || 'manual',
      motivo_retificacao: motivo,
      observacoes: `${registro.observacoes || ''} | Novo registro por retificação: ${motivo}`.trim(),
    });
    setRetificar(null);
    setMotivo('');
    await onHistoricoChanged?.();
  };

  const onCancelar = async (registro) => {
    if (!motivo.trim()) return setErroAcao('Informe o motivo do cancelamento.');
    setErroAcao('');
    await base44.entities.HistoricoPromocaoMilitar.update(registro.id, {
      status_registro: 'cancelado',
      motivo_retificacao: motivo,
      observacoes: `${registro.observacoes || ''} | Cancelado: ${motivo}`.trim(),
    });
    setCancelar(null);
    setMotivo('');
    await onHistoricoChanged?.();
  };

  const diagnostico = validarDadosAntiguidade(militar || {}, historico || [], { exigeAntiguidadeAnterior: true });
  const pendencias = diagnostico.motivos.map((m) => MOTIVOS_LABEL[m]).filter(Boolean);

  const criterios = [
    { label: 'Posto/graduação válido', ok: Boolean(militar?.posto_graduacao) },
    { label: 'Quadro compatível', ok: Boolean(militar?.quadro) },
    { label: 'Data de promoção preenchida', ok: Boolean(promocaoAtual?.data_promocao) },
    { label: 'Número de antiguidade definido', ok: Number.isFinite(Number(promocaoAtual?.antiguidade_referencia_ordem)) },
  ];

  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle>Situação Atual</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
        <Info label="Nome de guerra" value={militar?.nome_guerra || '—'} />
        <Info label="Nome completo" value={militar?.nome_completo || '—'} />
        <Info label="Matrícula" value={militar?.matricula || '—'} />
        <Info label="Posto/graduação atual" value={militar?.posto_graduacao || '—'} />
        <Info label="Quadro atual" value={militar?.quadro || '—'} />
        <Info label="Lotação atual" value={militar?.lotacao_atual || militar?.lotacao || '—'} />
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row justify-between items-start gap-3">
        <CardTitle>Dados da Promoção Atual</CardTitle>
        {canManage && <Button onClick={onOpenPromocaoAtualModal}>Registrar / Retificar Promoção Atual</Button>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!promocaoAtual && <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="w-4 h-4 mt-0.5" />Promoção atual sem data registrada. Este militar ficará pendente na listagem de antiguidade.</div>}
        {promocaoAtualIncompleta && <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="w-4 h-4 mt-0.5" />Registro histórico com campos incompletos. Recomenda-se retificar.</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Info label="Data da promoção atual" value={promocaoAtual?.data_promocao || '—'} />
          <Info label="Nº/ordem de antiguidade" value={promocaoAtual?.antiguidade_referencia_ordem ?? '—'} />
          <Info label="DOEMS / Boletim / Ato" value={promocaoAtual?.boletim_referencia || promocaoAtual?.ato_referencia || '—'} />
          <Info label="Data da publicação" value={promocaoAtual?.data_publicacao || '—'} />
          <Info label="Status do registro" value={<Badge className={STATUS_BADGE[promocaoAtual?.status_registro || 'pendente']}>{promocaoAtual?.status_registro || 'pendente'}</Badge>} />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Impacto na Listagem</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Badge className={diagnostico.status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>{diagnostico.status === 'ok' ? 'Apto' : 'Pendente'}</Badge>
        <ul className="space-y-1">{criterios.map((c) => <li key={c.label} className="flex items-center gap-2">{c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock3 className="w-4 h-4 text-amber-600" />}{c.label}</li>)}</ul>
        {pendencias.length > 0 && <div><p className="font-medium">Pendências:</p><ul className="list-disc ml-5">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul></div>}
        <p className="text-slate-600">Aguardando snapshot rascunho.</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Histórico de Promoções</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {historico.map((h) => <div key={h.id} className="border rounded-md p-3 space-y-2">
          <div className="flex gap-2 items-center"><Badge className={STATUS_BADGE[h.status_registro] || STATUS_BADGE.pendente}>{h.status_registro || 'pendente'}</Badge>{promocaoAtual?.id === h.id && <Badge variant="outline">Registro atual</Badge>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <Info label="Posto/graduação anterior" value={h.posto_graduacao_anterior || '—'} />
            <Info label="Posto/graduação novo" value={h.posto_graduacao_novo || '—'} />
            <Info label="Quadro" value={h.quadro_novo || '—'} />
            <Info label="Data da promoção" value={h.data_promocao || '—'} />
            <Info label="Nº/ordem de antiguidade" value={h.antiguidade_referencia_ordem ?? '—'} />
            <Info label="DOEMS / boletim / ato" value={h.boletim_referencia || h.ato_referencia || '—'} />
            <Info label="Observações" value={h.observacoes || '—'} />
            <Info label="Origem do dado" value={h.origem_dado || '—'} />
          </div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setDetalhe(h)}><FileText className="w-4 h-4 mr-1" />Ver detalhes</Button><Button size="sm" variant="outline" disabled={!canManage || h.status_registro !== 'ativo'} onClick={() => { setRetificar(h); setErroAcao(''); }}>Retificar</Button><Button size="sm" variant="destructive" disabled={!canManage || h.status_registro !== 'ativo'} onClick={() => { setCancelar(h); setErroAcao(''); }}>Cancelar</Button></div>
        </div>)}
      </CardContent>
    </Card>
    <Dialog open={Boolean(detalhe)} onOpenChange={(o) => !o && setDetalhe(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Detalhes do registro</DialogTitle></DialogHeader>
        <div className="text-sm space-y-1">{detalhe && Object.entries(detalhe).map(([k, v]) => <p key={k}><strong>{k}:</strong> {String(v ?? '—')}</p>)}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(retificar)} onOpenChange={(o) => !o && setRetificar(null)}>
      <DialogContent><DialogHeader><DialogTitle>Retificar promoção</DialogTitle><DialogDescription>O registro atual será marcado como retificado e um novo registro ativo será criado.</DialogDescription></DialogHeader><Label>Motivo da retificação *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setRetificar(null)}>Fechar</Button><Button onClick={() => onRetificar(retificar)}>Confirmar retificação</Button></DialogFooter></DialogContent>
    </Dialog>
    <Dialog open={Boolean(cancelar)} onOpenChange={(o) => !o && setCancelar(null)}>
      <DialogContent><DialogHeader><DialogTitle>Cancelar registro</DialogTitle><DialogDescription>O registro será mantido no histórico com status cancelado.</DialogDescription></DialogHeader><Label>Motivo do cancelamento *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setCancelar(null)}>Fechar</Button><Button variant="destructive" onClick={() => onCancelar(cancelar)}>Confirmar cancelamento</Button></DialogFooter></DialogContent>
    </Dialog>
  </div>;
}

function Info({ label, value }) {
  return <div><p className="text-xs text-slate-500 uppercase">{label}</p><p className="font-medium text-slate-800">{value}</p></div>;
}
