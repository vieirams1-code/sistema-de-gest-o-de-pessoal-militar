import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PromocoesTimeline from '@/components/antiguidade/PromocoesTimeline';
import RankIcon from '@/components/antiguidade/RankIcon';

const STATUS_ATIVO = 'ativo';
const valorTexto = (v) => String(v || '').trim();
const isOrdemPreenchida = (valor) => valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor));

export default function CarreiraAntiguidadePanel(props) {
  const { militar, historicoPromocoes, onOpenPromocaoAtualModal, onOpenPromocaoHistoricaModal, onHistoricoChanged, canManage } = props;
  const [retificar, setRetificar] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  const [erroAcao, setErroAcao] = React.useState('');

  const historico = React.useMemo(() => [...(historicoPromocoes || [])].sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || ''))), [historicoPromocoes]);
  const ativos = React.useMemo(() => historico.filter((h) => valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO && String(h.militar_id || '') === String(militar?.id || '')), [historico, militar?.id]);

  const promocaoAtual = React.useMemo(() => ativos.find((h) => valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao) && isOrdemPreenchida(h.antiguidade_referencia_ordem)) || null, [ativos, militar]);

  const haMultiplosRegistrosAtuais = ativos.filter((h) => valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao)).length > 1;

  const abrirEdicaoPromocaoAnterior = (registro) => {
    setRetificar(registro);
    setMotivo('');
    setErroAcao('');
  };

  const onRetificar = async () => {
    if (!retificar?.id) return setErroAcao('Registro de promoção não encontrado.');
    if (!motivo.trim()) return setErroAcao('Informe o motivo da edição/retificação.');

    try {
      await base44.entities.HistoricoPromocaoMilitarV2.update(retificar.id, { status_registro: 'retificado', motivo_retificacao: motivo });
      setRetificar(null);
      setMotivo('');
      setErroAcao('');
      await onHistoricoChanged?.();
    } catch {
      setErroAcao('Não foi possível editar/retificar a promoção. Tente novamente.');
    }
  };

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">Carreira e Promoções</h2>
        <p className="mt-1 text-sm text-slate-500">Visualização resumida da promoção atual e do histórico anterior do militar.</p>
      </div>
      {canManage && <Button className="gap-2" onClick={onOpenPromocaoHistoricaModal}>
        <Plus className="h-4 w-4" />Adicionar promoção
      </Button>}
    </header>

    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-5">
            <Info label="Nome" value={militar?.nome_completo || militar?.nome_guerra || '—'} />
            <Info label="Matrícula" value={militar?.matricula || '—'} />
            <Info label="Posto/graduação atual" value={militar?.posto_graduacao || '—'} />
            <Info label="Quadro" value={militar?.quadro || '—'} />
            <Info label="Lotação" value={militar?.lotacao_atual || militar?.lotacao || '—'} />
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            <RankIcon postoGraduacao={militar?.posto_graduacao} />
          </div>
        </div>
      </CardContent>
    </Card>

    {haMultiplosRegistrosAtuais && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      Há múltiplos registros de promoção para o posto/quadro atual deste militar. Revise os dados cadastrados.
    </div>}

    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <PromocoesTimeline
          historico={historico}
          promocaoAtual={promocaoAtual}
          militar={militar}
          canManage={canManage}
          onEditarAtual={onOpenPromocaoAtualModal}
          onEditarPromocao={abrirEdicaoPromocaoAnterior}
        />
      </CardContent>
    </Card>

    <Dialog open={Boolean(retificar)} onOpenChange={(open) => { if (!open) { setRetificar(null); setMotivo(''); setErroAcao(''); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar promoção</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">A edição mantém o fluxo existente de retificação do registro selecionado.</p>
          <Label>Motivo da edição/retificação *</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setRetificar(null); setMotivo(''); setErroAcao(''); }}>Fechar</Button>
          <Button onClick={onRetificar}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Info({ label, value }) {
  return <div className="space-y-1">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="font-semibold leading-5 text-slate-800">{value}</p>
  </div>;
}
