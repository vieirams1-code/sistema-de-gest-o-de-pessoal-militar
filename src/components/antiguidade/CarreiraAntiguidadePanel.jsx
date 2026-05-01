import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

export default function CarreiraAntiguidadePanel({ militar, historicoPromocoes, onOpenPromocaoAtualModal, canManage }) {
  const historico = React.useMemo(() => [...(historicoPromocoes || [])].sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || ''))), [historicoPromocoes]);

  const promocaoAtual = React.useMemo(() => {
    const posto = String(militar?.posto_graduacao || '').trim();
    const quadro = String(militar?.quadro || '').trim();
    return historico.find((h) =>
      String(h.status_registro || '').trim().toLowerCase() === 'ativo'
      && String(h.militar_id || '') === String(militar?.id || '')
      && String(h.posto_graduacao_novo || '').trim() === posto
      && String(h.quadro_novo || '').trim() === quadro,
    ) || null;
  }, [historico, militar]);

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
          <div className="flex gap-2"><Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" />Ver detalhes</Button><Button size="sm" variant="outline" disabled={!canManage}>Retificar</Button><Button size="sm" variant="destructive" disabled={!canManage}>Cancelar</Button></div>
        </div>)}
      </CardContent>
    </Card>
  </div>;
}

function Info({ label, value }) {
  return <div><p className="text-xs text-slate-500 uppercase">{label}</p><p className="font-medium text-slate-800">{value}</p></div>;
}
