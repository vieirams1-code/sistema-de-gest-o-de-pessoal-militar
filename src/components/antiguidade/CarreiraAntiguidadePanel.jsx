import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Sparkles, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import validarDadosAntiguidade, { MOTIVOS } from '@/utils/antiguidade/validarDadosAntiguidade';
import { isPromocaoIgualOuAcimaDoPostoAtual } from '@/components/antiguidade/promocaoHistoricaUtils';
import PromocoesTimeline from '@/components/antiguidade/PromocoesTimeline';

const STATUS_BADGE = { ativo: 'bg-emerald-100 text-emerald-800', pendente: 'bg-amber-100 text-amber-800', retificado: 'bg-blue-100 text-blue-800', cancelado: 'bg-rose-100 text-rose-800', previsto: 'bg-indigo-100 text-indigo-800' };
const MOTIVOS_LABEL = { [MOTIVOS.SEM_DATA]: 'Sem data de promoção', [MOTIVOS.SEM_ANTERIOR]: 'Sem número de antiguidade', [MOTIVOS.EMPATE]: 'Empate não resolvido', [MOTIVOS.SEM_QUADRO]: 'Quadro incompatível' };
const STATUS_ATIVO = 'ativo';
const STATUS_PREVISTO = 'previsto';
const valorTexto = (v) => String(v || '').trim();
const isOrdemPreenchida = (valor) => valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor));

export default function CarreiraAntiguidadePanel(props) {
  const { militar, historicoPromocoes, onOpenPromocaoAtualModal, onOpenPromocaoHistoricaModal, onOpenPromocaoFuturaModal, onHistoricoChanged, canManage } = props;
  const [detalhe, setDetalhe] = React.useState(null);
  const [retificar, setRetificar] = React.useState(null);
  const [cancelar, setCancelar] = React.useState(null);
  const [efetivar, setEfetivar] = React.useState(null);
  const [motivo, setMotivo] = React.useState('');
  const [confirmacaoEfetivar, setConfirmacaoEfetivar] = React.useState('');
  const [erroAcao, setErroAcao] = React.useState('');

  const historico = React.useMemo(() => [...(historicoPromocoes || [])].sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || ''))), [historicoPromocoes]);
  const ativos = React.useMemo(() => historico.filter((h) => valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO && String(h.militar_id || '') === String(militar?.id || '')), [historico, militar?.id]);
  const previstos = React.useMemo(() => historico.filter((h) => valorTexto(h.status_registro).toLowerCase() === STATUS_PREVISTO && String(h.militar_id || '') === String(militar?.id || '')), [historico, militar?.id]);

  const promocaoAtual = React.useMemo(() => ativos.find((h) => valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao) && isOrdemPreenchida(h.antiguidade_referencia_ordem)) || null, [ativos, militar]);

  const isRegistroIncompativel = React.useCallback((h) => {
    if (valorTexto(h?.status_registro || STATUS_ATIVO).toLowerCase() !== STATUS_ATIVO) return false;
    const postoNovo = valorTexto(h?.posto_graduacao_novo);
    const ehAtual = postoNovo === valorTexto(militar?.posto_graduacao) && valorTexto(h?.quadro_novo) === valorTexto(militar?.quadro);
    if (ehAtual || !postoNovo) return false;
    return isPromocaoIgualOuAcimaDoPostoAtual({ postoAtual: militar?.posto_graduacao, postoNovo });
  }, [militar]);

  const isRegistroIncompleto = React.useCallback((h) => {
    const status = valorTexto(h?.status_registro).toLowerCase();
    if (status === 'cancelado' || status === 'retificado') return false;
    return !valorTexto(h?.posto_graduacao_novo) || !valorTexto(h?.quadro_novo) || !valorTexto(h?.origem_dado);
  }, []);

  const onEfetivar = async (registro) => {
    if (confirmacaoEfetivar !== 'EFETIVAR') return setErroAcao('Digite EFETIVAR para confirmar.');
    const hoje = new Date();
    const dataPromocao = registro?.data_promocao ? new Date(`${registro.data_promocao}T00:00:00`) : null;
    if (dataPromocao && dataPromocao > hoje) return setErroAcao('Esta promoção possui data futura e ainda não pode ser efetivada. Aguarde a data prevista ou mantenha-a como promoção prevista.');
    await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: STATUS_ATIVO, origem_dado: 'efetivacao' });
    await base44.entities.Militar.update(militar.id, { posto_graduacao: registro.posto_graduacao_novo, quadro: registro.quadro_novo });
    await queryClientInstance.invalidateQueries({ queryKey: ['militar', militar.id] });
    await queryClientInstance.invalidateQueries({ queryKey: ['historico-promocoes', militar.id] });
    await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
    setEfetivar(null); setConfirmacaoEfetivar(''); setErroAcao('');
    await onHistoricoChanged?.();
  };

  const onRetificar = async (registro) => { if (!motivo.trim()) return setErroAcao('Informe o motivo da retificação.'); await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: 'retificado', motivo_retificacao: motivo }); setRetificar(null); setMotivo(''); await onHistoricoChanged?.(); };
  const onCancelar = async (registro) => { if (!motivo.trim()) return setErroAcao('Informe o motivo do cancelamento.'); await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: 'cancelado', motivo_retificacao: motivo }); setCancelar(null); setMotivo(''); await onHistoricoChanged?.(); };

  const diagnostico = validarDadosAntiguidade(militar || {}, historico || [], { exigeAntiguidadeAnterior: true });
  const criterios = [{ label: 'Posto/graduação válido', ok: Boolean(militar?.posto_graduacao) }, { label: 'Quadro compatível', ok: Boolean(militar?.quadro) }, { label: 'Data de promoção preenchida', ok: Boolean(promocaoAtual?.data_promocao) }, { label: 'Número de antiguidade definido', ok: isOrdemPreenchida(promocaoAtual?.antiguidade_referencia_ordem) }];
  const haMultiplosRegistros = ativos.filter((h) => !isRegistroIncompativel(h) && valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao)).length > 1;
  const pendencias = diagnostico.motivos.filter((m) => !(m === MOTIVOS.SEM_DATA && criterios[2]?.ok) && !(m === MOTIVOS.SEM_ANTERIOR && criterios[3]?.ok)).map((m) => MOTIVOS_LABEL[m]).filter(Boolean);

  return <div className="space-y-5">
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2 overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <div className="h-10 bg-slate-900 flex items-center px-4 text-slate-100 text-sm font-semibold tracking-wide">Situação Atual do Militar</div>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5 pb-5 text-sm">
          <Info label="Nome de guerra" value={militar?.nome_guerra || '—'} />
          <Info label="Nome completo" value={militar?.nome_completo || '—'} />
          <Info label="Matrícula" value={militar?.matricula || '—'} />
          <Info label="Posto/graduação atual" value={<span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-slate-700 text-xs font-semibold">{militar?.posto_graduacao || '—'}</span>} />
          <Info label="Quadro atual" value={militar?.quadro || '—'} />
          <Info label="Lotação atual" value={militar?.lotacao_atual || militar?.lotacao || '—'} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-slate-600" />Impacto na Antiguidade</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Badge className={`${diagnostico.status === 'ok' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'} border`}>{diagnostico.status === 'ok' ? 'Apto' : 'Pendente'}</Badge>
          <ul className="space-y-2.5">{criterios.map((c) => <li key={c.label} className="flex items-center gap-2.5 text-slate-700">{c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock3 className="w-4 h-4 text-amber-600" />}<span>{c.label}</span></li>)}</ul>
          {pendencias.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5"><p className="font-medium text-amber-900">Pendências</p><ul className="list-disc ml-5 mt-1.5 text-amber-900/90 space-y-1">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul></div>}
        </CardContent>
      </Card>
    </div>

    <Card className="bg-blue-50/70 border-blue-200 shadow-sm rounded-xl">
      <CardHeader className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 border-b border-blue-100/70">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-700" />Dados da Promoção Atual</CardTitle>
          <p className="text-sm text-blue-800/80 mt-1">Referência usada para cálculo e validação da antiguidade funcional.</p>
        </div>
        {canManage && <Button className="md:self-start gap-1.5" onClick={onOpenPromocaoAtualModal}>Registrar / Retificar Promoção Atual <ArrowUpRight className="w-4 h-4" /></Button>}
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm">{!promocaoAtual && <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="w-4 h-4 mt-0.5" />Sem promoção atual cadastrada.</div>}{haMultiplosRegistros && <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle className="w-4 h-4 mt-0.5" />Há múltiplos registros de promoção para este militar. Revise/cancele os incorretos.</div>}<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"><Info label="Data da promoção atual" value={promocaoAtual?.data_promocao || '—'} /><Info label="Nº/ordem de antiguidade" value={promocaoAtual?.antiguidade_referencia_ordem ?? '—'} /><Info label="DOEMS / Boletim / Ato" value={promocaoAtual?.boletim_referencia || promocaoAtual?.ato_referencia || '—'} /><Info label="Data da publicação" value={promocaoAtual?.data_publicacao || '—'} /><Info label="Status do registro" value={<Badge className={`${STATUS_BADGE[promocaoAtual?.status_registro || STATUS_ATIVO]} border`}>{promocaoAtual?.status_registro || STATUS_ATIVO}</Badge>} /></div></CardContent>
    </Card>

    <Card className="rounded-xl border-slate-200 shadow-sm"><CardHeader className="flex flex-col md:flex-row md:justify-between md:items-start gap-3"><CardTitle className="text-base">Promoções Futuras / Previstas</CardTitle>{canManage && <Button variant="outline" className="border-slate-300" onClick={onOpenPromocaoFuturaModal}>Nova promoção futura</Button>}</CardHeader><CardContent className="space-y-3">{previstos.length === 0 ? <div className="text-sm text-slate-500 rounded-lg border border-dashed border-slate-300 p-4">Nenhuma promoção futura prevista.</div> : <div className="overflow-hidden rounded-lg border border-slate-200">{previstos.map((h) => <div key={h.id} className="border-b border-slate-100 last:border-b-0 bg-white"><div className="grid grid-cols-1 lg:grid-cols-6 gap-3 text-sm p-3 items-center"><Info label="Posto" value={h.posto_graduacao_novo || '—'} /><Info label="Quadro" value={h.quadro_novo || '—'} /><Info label="Data prevista" value={h.data_promocao || '—'} /><Info label="Publicação" value={h.data_publicacao || '—'} /><Info label="Ato" value={h.boletim_referencia || h.ato_referencia || '—'} /><div><p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1">Status</p><Badge className={`${STATUS_BADGE[h.status_registro] || STATUS_BADGE.previsto} border`}>{h.status_registro || 'previsto'}</Badge></div></div>{canManage && <div className="flex gap-2 px-3 pb-3"><Button size="sm" variant="outline" className="border-slate-300" onClick={() => onOpenPromocaoFuturaModal?.(h)}>Editar</Button><Button size="sm" variant="destructive" onClick={() => { setCancelar(h); setErroAcao(''); }}>Cancelar</Button><Button size="sm" className="bg-slate-900 hover:bg-slate-800" onClick={() => { setEfetivar(h); setErroAcao(''); }}>Efetivar Promoção</Button></div>}</div>)}</div>}</CardContent></Card>

    <Card className="rounded-xl border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-base">Linha do Tempo de Promoções</CardTitle></CardHeader><CardContent><PromocoesTimeline historico={historico} promocaoAtual={promocaoAtual} canManage={canManage} isRegistroIncompativel={isRegistroIncompativel} isRegistroIncompleto={isRegistroIncompleto} onOpenPromocaoHistoricaModal={onOpenPromocaoHistoricaModal} onDetalhe={setDetalhe} onRetificar={(h) => { setRetificar(h); setErroAcao(''); }} onCancelar={(h) => { setCancelar(h); setErroAcao(''); }} /></CardContent></Card>

    <Dialog open={Boolean(detalhe)} onOpenChange={(o) => !o && setDetalhe(null)}><DialogContent><DialogHeader><DialogTitle>Detalhes do registro</DialogTitle></DialogHeader><div className="text-sm space-y-1">{detalhe && Object.entries(detalhe).map(([k, v]) => <p key={k}><strong>{k}:</strong> {String(v ?? '—')}</p>)}</div></DialogContent></Dialog>
    <Dialog open={Boolean(retificar)} onOpenChange={(o) => !o && setRetificar(null)}><DialogContent><DialogHeader><DialogTitle>Retificar promoção</DialogTitle></DialogHeader><Label>Motivo da retificação *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setRetificar(null)}>Fechar</Button><Button onClick={() => onRetificar(retificar)}>Confirmar retificação</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(cancelar)} onOpenChange={(o) => !o && setCancelar(null)}><DialogContent><DialogHeader><DialogTitle>Cancelar registro/previsão</DialogTitle></DialogHeader><Label>Motivo do cancelamento *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setCancelar(null)}>Fechar</Button><Button variant="destructive" onClick={() => onCancelar(cancelar)}>Confirmar cancelamento</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(efetivar)} onOpenChange={(o) => !o && setEfetivar(null)}><DialogContent><DialogHeader><DialogTitle>Efetivar promoção futura</DialogTitle><DialogDescription>Esta ação atualizará o posto/graduação do militar no cadastro funcional. Deseja continuar?</DialogDescription></DialogHeader><Label>Digite EFETIVAR para confirmar</Label><Input value={confirmacaoEfetivar} onChange={(e) => setConfirmacaoEfetivar(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setEfetivar(null)}>Fechar</Button><Button onClick={() => onEfetivar(efetivar)}>Efetivar promoção</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Info({ label, value }) { return <div className="space-y-1"><p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p><p className="font-semibold text-slate-800 leading-5">{value}</p></div>; }
