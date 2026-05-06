import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Sparkles, ShieldCheck, ArrowUpRight, History, CalendarPlus } from 'lucide-react';
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
import RankIcon from '@/components/antiguidade/RankIcon';

const STATUS_BADGE = { ativo: 'bg-emerald-100 text-emerald-800', pendente: 'bg-amber-100 text-amber-800', retificado: 'bg-blue-100 text-blue-800', cancelado: 'bg-rose-100 text-rose-800', previsto: 'bg-indigo-100 text-indigo-800' };
const MOTIVOS_LABEL = { [MOTIVOS.SEM_DATA]: 'Sem data de promoção', [MOTIVOS.SEM_ANTERIOR]: 'Sem número de antiguidade', [MOTIVOS.EMPATE]: 'Empate não resolvido', [MOTIVOS.SEM_QUADRO]: 'Quadro incompatível' };
const STATUS_ATIVO = 'ativo';
const STATUS_PREVISTO = 'previsto';
const valorTexto = (v) => String(v || '').trim();
const isOrdemPreenchida = (valor) => valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor));
const formatarDataLocalISO = (date) => {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

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
    if (!registro?.id) return setErroAcao('Registro de promoção previsto não encontrado para efetivação.');
    if (valorTexto(registro.status_registro).toLowerCase() !== STATUS_PREVISTO) return setErroAcao('Somente promoções previstas podem ser efetivadas.');
    if (!registro?.data_promocao) return setErroAcao('A promoção prevista não possui data de promoção informada e não pode ser efetivada.');
    if (!militar?.id) return setErroAcao('Não foi possível identificar o militar para efetivar a promoção.');

    const hojeIso = formatarDataLocalISO(new Date());
    if (registro.data_promocao > hojeIso) return setErroAcao('Esta promoção possui data futura e ainda não pode ser efetivada. Aguarde a data prevista ou mantenha-a como promoção prevista.');

    const statusRegistroAnterior = registro.status_registro;
    const origemDadoAnterior = registro.origem_dado;

    try {
      await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: STATUS_ATIVO, origem_dado: 'efetivacao' });
    } catch {
      return setErroAcao('Não foi possível atualizar o histórico de promoção para efetivação. Tente novamente.');
    }

    try {
      await base44.entities.Militar.update(militar.id, { posto_graduacao: registro.posto_graduacao_novo, quadro: registro.quadro_novo });
    } catch {
      try {
        await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: statusRegistroAnterior, origem_dado: origemDadoAnterior });
        await queryClientInstance.invalidateQueries({ queryKey: ['historico-promocoes', militar.id] });
        await queryClientInstance.invalidateQueries({ queryKey: ['ver-historico-promocoes', militar.id] });
        await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
        return setErroAcao('Não foi possível atualizar o posto/quadro do militar. A efetivação foi desfeita no histórico. Tente novamente.');
      } catch {
        await queryClientInstance.invalidateQueries({ queryKey: ['historico-promocoes', militar.id] });
        await queryClientInstance.invalidateQueries({ queryKey: ['ver-historico-promocoes', militar.id] });
        await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
        return setErroAcao('A promoção foi marcada como efetivada no histórico, mas não foi possível atualizar o posto/quadro do militar nem desfazer a efetivação. Verifique o registro antes de tentar novamente.');
      }
    }

    try {
      await queryClientInstance.invalidateQueries({ queryKey: ['militar', militar.id] });
      await queryClientInstance.invalidateQueries({ queryKey: ['historico-promocoes', militar.id] });
      await queryClientInstance.invalidateQueries({ queryKey: ['ver-historico-promocoes', militar.id] });
      await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
      setEfetivar(null); setConfirmacaoEfetivar(''); setErroAcao('');
      await onHistoricoChanged?.();
    } catch {
      return setErroAcao('A promoção foi efetivada, mas ocorreu um erro ao atualizar os dados exibidos. Recarregue a página.');
    }
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

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-stretch">
      <Card className="overflow-hidden rounded-2xl border-blue-500/30 bg-gradient-to-br from-blue-950 via-blue-800 to-sky-700 text-white shadow-lg">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Badge className="w-fit border border-white/20 bg-white/15 text-white backdrop-blur">Promoção atual válida</Badge>
              <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                <Sparkles className="w-5 h-5 text-sky-200" />
                Referência Funcional Atual
              </CardTitle>
              <p className="max-w-2xl text-sm text-blue-100/90">
                Este registro ativo é a base de cálculo da antiguidade e a referência funcional usada para validação das promoções futuras.
              </p>
            </div>
            <div className="flex h-20 min-w-20 items-center justify-center rounded-2xl border border-white/20 bg-white shadow-md">
              <RankIcon postoGraduacao={promocaoAtual?.posto_graduacao_novo || militar?.posto_graduacao} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5 text-sm">
          {!promocaoAtual && <div className="flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-100 p-3 text-amber-950"><AlertTriangle className="w-4 h-4 mt-0.5" />Sem promoção atual cadastrada.</div>}
          {haMultiplosRegistros && <div className="flex items-start gap-2 rounded-md border border-amber-200/70 bg-amber-100 p-3 text-amber-950"><AlertTriangle className="w-4 h-4 mt-0.5" />Há múltiplos registros de promoção para este militar. Revise/cancele os incorretos.</div>}

          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-blue-100/80">Posto/graduação atual</p>
              <h3 className="text-3xl font-bold leading-tight">{promocaoAtual?.posto_graduacao_novo || militar?.posto_graduacao || '—'}</h3>
              <p className="mt-1 text-blue-100">Quadro {promocaoAtual?.quadro_novo || militar?.quadro || '—'}</p>
            </div>
            <Badge className={`${STATUS_BADGE[promocaoAtual?.status_registro || STATUS_ATIVO]} border capitalize`}>{promocaoAtual?.status_registro || STATUS_ATIVO}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <HeroInfo label="Data da promoção" value={promocaoAtual?.data_promocao || '—'} />
            <HeroInfo label="Nº / ordem de antiguidade" value={promocaoAtual?.antiguidade_referencia_ordem ?? '—'} />
            <HeroInfo label="Data da publicação" value={promocaoAtual?.data_publicacao || '—'} />
            <HeroInfo label="Docs / boletim / ato" value={promocaoAtual?.boletim_referencia || promocaoAtual?.ato_referencia || '—'} />
            <HeroInfo label="Origem do dado" value={promocaoAtual?.origem_dado || '—'} />
            <HeroInfo label="Validade operacional" value="Base vigente de cálculo" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-slate-600" />Ações operacionais</CardTitle>
          <p className="text-sm text-slate-500">Ações separadas da linha cronológica para manter a progressão limpa.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {canManage ? <>
            <Button className="w-full justify-start gap-2" onClick={onOpenPromocaoAtualModal}><Sparkles className="w-4 h-4" />Registrar / Retificar Promoção Atual</Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-amber-300 text-amber-900 hover:bg-amber-50" onClick={onOpenPromocaoFuturaModal}><CalendarPlus className="w-4 h-4" />Nova promoção futura</Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-slate-300 text-slate-700" onClick={onOpenPromocaoHistoricaModal}><History className="w-4 h-4" />Adicionar promoção anterior</Button>
          </> : <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Você possui acesso somente leitura para as ações operacionais.</div>}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-900">
            <p className="font-semibold">Referência de cálculo e validação</p>
            <p>A promoção atual permanece como base funcional; previsões futuras e histórico anterior apenas contextualizam a progressão.</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-lg">Linha de Progressão Funcional</CardTitle>
        <p className="text-sm text-slate-500">Visão cronológica das promoções do militar: histórico anterior → posto atual → promoções futuras previstas.</p>
      </CardHeader>
      <CardContent className="pt-5">
        <PromocoesTimeline
          historico={historico}
          promocaoAtual={promocaoAtual}
          militar={militar}
          canManage={canManage}
          isRegistroIncompativel={isRegistroIncompativel}
          isRegistroIncompleto={isRegistroIncompleto}
          onDetalhe={setDetalhe}
          onRetificar={(h) => { setRetificar(h); setErroAcao(''); }}
          onEditarPrevisao={(h) => onOpenPromocaoFuturaModal?.(h)}
          onCancelar={(h) => { setCancelar(h); setErroAcao(''); }}
          onEfetivar={(h) => { setEfetivar(h); setErroAcao(''); }}
        />
      </CardContent>
    </Card>

    <Dialog open={Boolean(detalhe)} onOpenChange={(o) => !o && setDetalhe(null)}><DialogContent><DialogHeader><DialogTitle>Detalhes do registro</DialogTitle></DialogHeader><div className="text-sm space-y-1">{detalhe && Object.entries(detalhe).map(([k, v]) => <p key={k}><strong>{k}:</strong> {String(v ?? '—')}</p>)}</div></DialogContent></Dialog>
    <Dialog open={Boolean(retificar)} onOpenChange={(o) => !o && setRetificar(null)}><DialogContent><DialogHeader><DialogTitle>Retificar promoção</DialogTitle></DialogHeader><Label>Motivo da retificação *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setRetificar(null)}>Fechar</Button><Button onClick={() => onRetificar(retificar)}>Confirmar retificação</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(cancelar)} onOpenChange={(o) => !o && setCancelar(null)}><DialogContent><DialogHeader><DialogTitle>Cancelar registro/previsão</DialogTitle></DialogHeader><Label>Motivo do cancelamento *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setCancelar(null)}>Fechar</Button><Button variant="destructive" onClick={() => onCancelar(cancelar)}>Confirmar cancelamento</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(efetivar)} onOpenChange={(o) => !o && setEfetivar(null)}><DialogContent><DialogHeader><DialogTitle>Efetivar promoção futura</DialogTitle><DialogDescription>Esta ação atualizará o posto/graduação do militar no cadastro funcional. Deseja continuar?</DialogDescription></DialogHeader><Label>Digite EFETIVAR para confirmar</Label><Input value={confirmacaoEfetivar} onChange={(e) => setConfirmacaoEfetivar(e.target.value)} />{erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}<DialogFooter><Button variant="outline" onClick={() => setEfetivar(null)}>Fechar</Button><Button onClick={() => onEfetivar(efetivar)}>Efetivar promoção</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Info({ label, value }) { return <div className="space-y-1"><p className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</p><p className="font-semibold text-slate-800 leading-5">{value}</p></div>; }

function HeroInfo({ label, value }) { return <div className="rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur"><p className="text-[11px] uppercase tracking-wide text-blue-100/80">{label}</p><p className="mt-1 font-semibold leading-5 text-white">{value}</p></div>; }
