import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PromocoesTimeline from '@/components/antiguidade/PromocoesTimeline';
import RankIcon from '@/components/antiguidade/RankIcon';
import { POSTOS_GRADUACOES } from '@/components/antiguidade/promocaoHistoricaUtils';

const STATUS_ATIVO = 'ativo';
const STATUS_RETIFICADO = 'retificado';
const ACAO_CORRIGIR = 'corrigir';
const ACAO_RETIFICAR = 'retificar';

const valorTexto = (v) => String(v || '').trim();
const isOrdemPreenchida = (valor) => valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor));

const formFromRegistro = (registro = {}) => ({
  posto_graduacao_anterior: registro.posto_graduacao_anterior || '',
  quadro_anterior: registro.quadro_anterior || '',
  posto_graduacao_novo: registro.posto_graduacao_novo || '',
  quadro_novo: registro.quadro_novo || '',
  data_promocao: registro.data_promocao || '',
  data_publicacao: registro.data_publicacao || '',
  boletim_referencia: registro.boletim_referencia || '',
  ato_referencia: registro.ato_referencia || '',
  antiguidade_referencia_ordem: registro.antiguidade_referencia_ordem ?? '',
  observacoes: registro.observacoes || '',
});

const normalizarOrdem = (valor) => (valor === '' || valor === null || valor === undefined ? null : Number(valor));

const montarPayloadCadastroHistorico = (form, registroOriginal = {}) => ({
  militar_id: registroOriginal.militar_id || '',
  posto_graduacao_anterior: form.posto_graduacao_anterior || '',
  quadro_anterior: form.quadro_anterior || '',
  posto_graduacao_novo: form.posto_graduacao_novo || '',
  quadro_novo: form.quadro_novo || '',
  data_promocao: form.data_promocao || '',
  data_publicacao: form.data_publicacao || '',
  boletim_referencia: form.boletim_referencia || '',
  ato_referencia: form.ato_referencia || '',
  antiguidade_referencia_ordem: normalizarOrdem(form.antiguidade_referencia_ordem),
  observacoes: form.observacoes || '',
  origem_dado: registroOriginal.origem_dado || 'manual',
  antiguidade_referencia_id: registroOriginal.antiguidade_referencia_id || '',
});

export default function CarreiraAntiguidadePanel(props) {
  const { militar, historicoPromocoes, onOpenPromocaoAtualModal, onOpenPromocaoHistoricaModal, onHistoricoChanged, canManage } = props;
  const [acaoRegistro, setAcaoRegistro] = React.useState(null);
  const [formRegistro, setFormRegistro] = React.useState(formFromRegistro());
  const [motivo, setMotivo] = React.useState('');
  const [erroAcao, setErroAcao] = React.useState('');
  const [salvandoAcao, setSalvandoAcao] = React.useState(false);

  const historico = React.useMemo(() => [...(historicoPromocoes || [])].sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || ''))), [historicoPromocoes]);
  const ativos = React.useMemo(() => historico.filter((h) => valorTexto(h.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO && String(h.militar_id || '') === String(militar?.id || '')), [historico, militar?.id]);

  const promocaoAtual = React.useMemo(() => ativos.find((h) => valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao) && isOrdemPreenchida(h.antiguidade_referencia_ordem)) || null, [ativos, militar]);

  const haMultiplosRegistrosAtuais = ativos.filter((h) => valorTexto(h.posto_graduacao_novo) === valorTexto(militar?.posto_graduacao) && valorTexto(h.quadro_novo) === valorTexto(militar?.quadro) && valorTexto(h.data_promocao)).length > 1;

  const abrirAcaoRegistro = (tipo, registro) => {
    setAcaoRegistro({ tipo, registro });
    setFormRegistro(formFromRegistro(registro));
    setMotivo('');
    setErroAcao('');
    setSalvandoAcao(false);
  };

  const fecharAcaoRegistro = () => {
    setAcaoRegistro(null);
    setFormRegistro(formFromRegistro());
    setMotivo('');
    setErroAcao('');
    setSalvandoAcao(false);
  };

  const salvarAcaoRegistro = async () => {
    const registro = acaoRegistro?.registro;
    const tipo = acaoRegistro?.tipo;
    if (!registro?.id) return setErroAcao('Registro de promoção não encontrado.');
    if (!formRegistro.data_promocao) return setErroAcao('Data da promoção é obrigatória.');
    if (!valorTexto(formRegistro.posto_graduacao_novo)) return setErroAcao('Posto/graduação do registro é obrigatório.');
    if (tipo === ACAO_RETIFICAR && !motivo.trim()) return setErroAcao('Informe o motivo da retificação oficial.');

    const payloadCadastro = montarPayloadCadastroHistorico(formRegistro, registro);
    setSalvandoAcao(true);
    setErroAcao('');

    try {
      if (tipo === ACAO_CORRIGIR) {
        await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, {
          ...payloadCadastro,
          status_registro: registro.status_registro || STATUS_ATIVO,
          motivo_retificacao: registro.motivo_retificacao || '',
        });
      } else {
        await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, {
          status_registro: STATUS_RETIFICADO,
          motivo_retificacao: motivo,
          observacoes: `${registro.observacoes || ''} | Retificado: ${motivo}`.trim(),
        });

        if (valorTexto(registro.status_registro || STATUS_ATIVO).toLowerCase() === STATUS_ATIVO) {
          await base44.entities.HistoricoPromocaoMilitarV2.create({
            ...payloadCadastro,
            status_registro: STATUS_ATIVO,
            motivo_retificacao: motivo,
            observacoes: `${payloadCadastro.observacoes || ''} | Retificação: ${motivo}`.trim(),
          });
        }
      }

      fecharAcaoRegistro();
      await onHistoricoChanged?.();
    } catch {
      setErroAcao(tipo === ACAO_CORRIGIR
        ? 'Não foi possível corrigir o cadastro histórico. Tente novamente.'
        : 'Não foi possível retificar o ato. Tente novamente.');
    } finally {
      setSalvandoAcao(false);
    }
  };

  const acaoEhRetificacao = acaoRegistro?.tipo === ACAO_RETIFICAR;

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
          onRegistrarAtual={onOpenPromocaoAtualModal}
          onCorrigirPromocao={(registro) => abrirAcaoRegistro(ACAO_CORRIGIR, registro)}
          onRetificarPromocao={(registro) => abrirAcaoRegistro(ACAO_RETIFICAR, registro)}
        />
      </CardContent>
    </Card>

    <Dialog open={Boolean(acaoRegistro)} onOpenChange={(open) => { if (!open) fecharAcaoRegistro(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{acaoEhRetificacao ? 'Retificar ato' : 'Corrigir cadastro'}</DialogTitle>
          <DialogDescription>
            {acaoEhRetificacao
              ? 'Retificação oficial: exige motivo, marca o registro antigo como retificado e cria novo registro ativo quando o ato original estava ativo.'
              : 'Correção de saneamento histórico: atualiza o mesmo registro, mantém o status atual e não cria cadeia de retificação.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Posto/graduação anterior</Label>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={formRegistro.posto_graduacao_anterior} onChange={(e) => setFormRegistro((prev) => ({ ...prev, posto_graduacao_anterior: e.target.value }))}>
              <option value="">Não informado</option>
              {POSTOS_GRADUACOES.map((posto) => <option key={posto} value={posto}>{posto}</option>)}
            </select>
          </div>
          <div><Label>Quadro anterior</Label><Input value={formRegistro.quadro_anterior} onChange={(e) => setFormRegistro((prev) => ({ ...prev, quadro_anterior: e.target.value }))} /></div>
          <div>
            <Label>Posto/graduação do registro *</Label>
            <select className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={formRegistro.posto_graduacao_novo} onChange={(e) => setFormRegistro((prev) => ({ ...prev, posto_graduacao_novo: e.target.value }))}>
              <option value="">Selecione...</option>
              {POSTOS_GRADUACOES.map((posto) => <option key={posto} value={posto}>{posto}</option>)}
            </select>
          </div>
          <div><Label>Quadro do registro</Label><Input value={formRegistro.quadro_novo} onChange={(e) => setFormRegistro((prev) => ({ ...prev, quadro_novo: e.target.value }))} /></div>
          <div><Label>Data da promoção *</Label><Input type="date" value={formRegistro.data_promocao} onChange={(e) => setFormRegistro((prev) => ({ ...prev, data_promocao: e.target.value }))} /></div>
          <div><Label>Data da publicação</Label><Input type="date" value={formRegistro.data_publicacao} onChange={(e) => setFormRegistro((prev) => ({ ...prev, data_publicacao: e.target.value }))} /></div>
          <div><Label>DOEMS / boletim / referência</Label><Input value={formRegistro.boletim_referencia} onChange={(e) => setFormRegistro((prev) => ({ ...prev, boletim_referencia: e.target.value }))} /></div>
          <div><Label>Ato de referência</Label><Input value={formRegistro.ato_referencia} onChange={(e) => setFormRegistro((prev) => ({ ...prev, ato_referencia: e.target.value }))} /></div>
          <div><Label>Antiguidade (ordem)</Label><Input value={formRegistro.antiguidade_referencia_ordem} onChange={(e) => setFormRegistro((prev) => ({ ...prev, antiguidade_referencia_ordem: e.target.value }))} /></div>
          <div><Label>Status mantido no cadastro</Label><Input value={acaoRegistro?.registro?.status_registro || STATUS_ATIVO} readOnly /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={formRegistro.observacoes} onChange={(e) => setFormRegistro((prev) => ({ ...prev, observacoes: e.target.value }))} /></div>
          {acaoEhRetificacao && <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Label>Motivo da retificação oficial *</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Obrigatório para retificar o ato" />
          </div>}
        </div>

        {erroAcao && <p className="text-sm text-rose-700">{erroAcao}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={fecharAcaoRegistro}>Cancelar</Button>
          <Button onClick={salvarAcaoRegistro} disabled={salvandoAcao}>{salvandoAcao ? 'Salvando...' : (acaoEhRetificacao ? 'Retificar ato' : 'Corrigir cadastro')}</Button>
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
