import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Link2,
  MessageCircle,
  Plus,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import JisoDecisionDialog from '@/components/jiso/JisoDecisionDialog';
import JisoWhatsAppDialog from '@/components/jiso/JisoWhatsAppDialog';
import { fetchScopedJisoBundle } from '@/services/getScopedJisoBundleClient';
import { criarJiso } from '@/services/jisoCudClient';
import { vincularAtestadoJiso } from '@/services/jisoAtestadoCudClient';
import { createPageUrl } from '@/utils';

const FINALIDADES = [
  'Homologação de Atestado',
  'Promoção',
  'Renovação de Contrato',
  'Inspeção Periódica',
  'Retorno ao Serviço',
  'Determinação Administrativa',
  'Outro',
];

const FORM_INICIAL = {
  militar_id: '',
  finalidade_jiso: '',
  motivo_jiso: '',
  data_jiso: '',
  hora_jiso: '',
  local_jiso: '',
  secao_jiso: '',
  nup: '',
  observacoes: '',
};

const STATUS_STYLE = {
  'Aguardando Agendamento': 'bg-amber-100 text-amber-800 border-amber-200',
  'Agendada': 'bg-blue-100 text-blue-800 border-blue-200',
  'Realizada': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Cancelada': 'bg-rose-100 text-rose-800 border-rose-200',
};

function formatDateBR(value) {
  const raw = String(value || '').slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (raw || '—');
}

function getStatusVisual(jiso) {
  const status = String(jiso?.status || '').trim();
  const normalizado = status.toLowerCase();
  if (normalizado.includes('cancel')) return 'Cancelada';
  if (normalizado.includes('realiz') || normalizado.includes('homolog')) return 'Realizada';
  if (jiso?.data_jiso) return 'Agendada';
  return status || 'Aguardando Agendamento';
}

export default function AgendarJISO() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef('');
  const queryClient = useQueryClient();
  const {
    canAccessModule,
    canAccessAction,
    isLoading: loadingUser,
    isAccessResolved,
    effectiveUserEmail,
  } = useCurrentUser();

  // Transição: a rota ainda herda o módulo Atestados para preservar todos os
  // perfis existentes; as ações internas já são exclusivamente as ações JISO.
  const hasAtestadosAccess = canAccessModule('atestados');
  const canGerirJiso = canAccessAction('gerir_jiso');
  const canRegistrarDecisao = canAccessAction('registrar_decisao_jiso');
  const canPublicarAta = canAccessAction('publicar_ata_jiso');
  const canViewJiso = canGerirJiso || canRegistrarDecisao || canPublicarAta;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dialogNovaOpen, setDialogNovaOpen] = useState(false);
  const [dialogVincularOpen, setDialogVincularOpen] = useState(false);
  const [dialogDetalheOpen, setDialogDetalheOpen] = useState(false);
  const [dialogWhatsAppOpen, setDialogWhatsAppOpen] = useState(false);
  const [dialogDecisionOpen, setDialogDecisionOpen] = useState(false);
  const [jisoSelecionada, setJisoSelecionada] = useState(null);
  const [atestadoParaVincular, setAtestadoParaVincular] = useState(null);
  const [jisoParaVincularId, setJisoParaVincularId] = useState('');
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [formError, setFormError] = useState('');

  const {
    data: bundle = { jisos: [], vinculos: [], atestados: [], militares: [], meta: {} },
    isLoading,
  } = useQuery({
    queryKey: ['jiso-independent-bundle', effectiveUserEmail || null],
    queryFn: () => fetchScopedJisoBundle(),
    enabled: hasAtestadosAccess && canViewJiso && isAccessResolved,
  });

  const militarById = useMemo(
    () => new Map((bundle.militares || []).map((m) => [String(m.id), m])),
    [bundle.militares],
  );
  const atestadoById = useMemo(
    () => new Map((bundle.atestados || []).map((a) => [String(a.id), a])),
    [bundle.atestados],
  );
  const vinculosAtivos = useMemo(
    () => (bundle.vinculos || []).filter((v) => v?.ativo !== false),
    [bundle.vinculos],
  );

  const vinculosPorJiso = useMemo(() => {
    const map = new Map();
    for (const vinculo of vinculosAtivos) {
      const key = String(vinculo.jiso_id || '');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(vinculo);
    }
    return map;
  }, [vinculosAtivos]);

  const atestadoIdsJaRelacionados = useMemo(() => {
    const ids = new Set(vinculosAtivos.map((v) => String(v.atestado_id || '')).filter(Boolean));
    for (const jiso of bundle.jisos || []) {
      if (jiso?.atestado_id) ids.add(String(jiso.atestado_id));
    }
    return ids;
  }, [vinculosAtivos, bundle.jisos]);

  const atestadosPendentes = useMemo(() => (
    (bundle.atestados || []).filter((atestado) => {
      const precisa = atestado?.necessita_jiso === true
        || String(atestado?.fluxo_homologacao || '').toLowerCase() === 'jiso';
      return precisa && !atestadoIdsJaRelacionados.has(String(atestado.id));
    })
  ), [bundle.atestados, atestadoIdsJaRelacionados]);

  const jisosFiltradas = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    return (bundle.jisos || [])
      .filter((jiso) => {
        const status = getStatusVisual(jiso);
        if (statusFilter !== 'todos' && status !== statusFilter) return false;
        if (!termo) return true;
        const militar = militarById.get(String(jiso.militar_id)) || {};
        return [
          jiso.militar_nome,
          jiso.militar_matricula_atual,
          jiso.militar_matricula,
          militar.nome_completo,
          militar.nome_guerra,
          militar.matricula,
          jiso.finalidade_jiso,
          jiso.motivo_jiso,
          jiso.nup,
        ].filter(Boolean).join(' ').toLowerCase().includes(termo);
      })
      .sort((a, b) => String(a.data_jiso || '9999-99-99').localeCompare(String(b.data_jiso || '9999-99-99')));
  }, [bundle.jisos, militarById, searchTerm, statusFilter]);

  const resumo = useMemo(() => {
    const result = { aguardando: 0, agendadas: 0, realizadas: 0, whatsapp: 0 };
    for (const jiso of bundle.jisos || []) {
      const status = getStatusVisual(jiso);
      if (status === 'Aguardando Agendamento') result.aguardando += 1;
      if (status === 'Agendada') result.agendadas += 1;
      if (status === 'Realizada') result.realizadas += 1;
      if (status === 'Agendada' && !jiso?.jiso_whatsapp_enviado_em) result.whatsapp += 1;
    }
    return result;
  }, [bundle.jisos]);

  const militaresOrdenados = useMemo(() => (
    [...(bundle.militares || [])].sort((a, b) => (
      String(a.nome_completo || a.nome_guerra || '').localeCompare(
        String(b.nome_completo || b.nome_guerra || ''),
        'pt-BR',
      )
    ))
  ), [bundle.militares]);

  const linkExistingMutation = useMutation({
    mutationFn: async ({ jiso, atestado }) => {
      await vincularAtestadoJiso({
        jiso_id: jiso.id,
        atestado_id: atestado.id,
        militar_id: atestado.militar_id,
        tipo_vinculo: 'Homologação',
        origem_vinculo: 'manual',
      });
      return jiso;
    },
    onSuccess: async (jiso) => {
      await queryClient.invalidateQueries({ queryKey: ['jiso-independent-bundle'] });
      setDialogVincularOpen(false);
      setJisoParaVincularId('');
      setAtestadoParaVincular(null);
      setFormError('');
      setJisoSelecionada(jiso);
      setDialogDetalheOpen(true);
    },
    onError: (error) => setFormError(error?.message || 'Não foi possível vincular o atestado à JISO.'),
  });

  const createMutation = useMutation({
    mutationFn: async ({ dados, atestado }) => {
      const createdResponse = await criarJiso(dados);
      const jiso = createdResponse?.data || createdResponse;
      if (!jiso?.id) throw new Error('A JISO foi criada, mas o identificador não foi retornado.');
      if (atestado?.id) {
        await vincularAtestadoJiso({
          jiso_id: jiso.id,
          atestado_id: atestado.id,
          militar_id: atestado.militar_id,
          tipo_vinculo: 'Homologação',
          origem_vinculo: 'gerado_atestado',
        });
      }
      return jiso;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['jiso-independent-bundle'] });
      setDialogNovaOpen(false);
      setAtestadoParaVincular(null);
      setFormData(FORM_INICIAL);
      setFormError('');
    },
    onError: (error) => setFormError(error?.message || 'Não foi possível criar a JISO.'),
  });

  const abrirNovaJiso = () => {
    setAtestadoParaVincular(null);
    setFormData(FORM_INICIAL);
    setFormError('');
    setDialogNovaOpen(true);
  };

  const abrirCriacaoJisoDoAtestado = (atestado) => {
    setDialogVincularOpen(false);
    setJisoParaVincularId('');
    setAtestadoParaVincular(atestado);
    setFormData({
      ...FORM_INICIAL,
      militar_id: String(atestado.militar_id || ''),
      finalidade_jiso: 'Homologação de Atestado',
      motivo_jiso: `Homologação do atestado iniciado em ${formatDateBR(atestado.data_inicio)}`,
    });
    setFormError('');
    setDialogNovaOpen(true);
  };

  const getJisosVinculaveis = (atestado) => (
    (bundle.jisos || [])
      .filter((jiso) => String(jiso?.militar_id || '') === String(atestado?.militar_id || ''))
      .filter((jiso) => !['Realizada', 'Cancelada'].includes(getStatusVisual(jiso)))
      .sort((a, b) => String(a.data_jiso || '9999-99-99').localeCompare(String(b.data_jiso || '9999-99-99')))
  );

  const abrirNovaJisoDoAtestado = (atestado) => {
    const candidatas = getJisosVinculaveis(atestado);
    if (candidatas.length > 0) {
      setAtestadoParaVincular(atestado);
      setJisoParaVincularId(String(candidatas[0].id));
      setFormError('');
      setDialogVincularOpen(true);
      return;
    }
    abrirCriacaoJisoDoAtestado(atestado);
  };

  const vincularJisoExistente = () => {
    if (!atestadoParaVincular?.id || !jisoParaVincularId) {
      setFormError('Selecione a JISO que receberá o atestado.');
      return;
    }
    const jiso = (bundle.jisos || []).find((item) => String(item?.id || '') === String(jisoParaVincularId));
    if (!jiso) {
      setFormError('A JISO selecionada não está mais disponível. Atualize a página e tente novamente.');
      return;
    }
    linkExistingMutation.mutate({ jiso, atestado: atestadoParaVincular });
  };

  const salvarNovaJiso = () => {
    if (!formData.militar_id) return setFormError('Selecione o militar.');
    if (!formData.finalidade_jiso) return setFormError('Informe a finalidade da JISO.');
    createMutation.mutate({ dados: formData, atestado: atestadoParaVincular });
  };

  const getAtestadosDaJiso = (jiso) => {
    const encontrados = [];
    const ids = new Set();
    for (const vinculo of vinculosPorJiso.get(String(jiso?.id)) || []) {
      const atestado = atestadoById.get(String(vinculo.atestado_id));
      if (atestado && !ids.has(String(atestado.id))) {
        ids.add(String(atestado.id));
        encontrados.push({ atestado, vinculo });
      }
    }
    if (jiso?.atestado_id && !ids.has(String(jiso.atestado_id))) {
      const legado = atestadoById.get(String(jiso.atestado_id));
      if (legado) encontrados.push({ atestado: legado, vinculo: { origem_vinculo: 'legado' } });
    }
    return encontrados;
  };

  const abrirDetalhe = (jiso) => {
    setJisoSelecionada(jiso);
    setDialogDetalheOpen(true);
  };

  useEffect(() => {
    const atestadoId = String(searchParams.get('atestado_id') || '').trim();
    if (!atestadoId || isLoading || deepLinkHandledRef.current === atestadoId) return;

    deepLinkHandledRef.current = atestadoId;
    const atestado = atestadoById.get(atestadoId);
    if (!atestado) {
      setSearchParams({}, { replace: true });
      return;
    }

    const vinculoAtivo = vinculosAtivos.find((vinculo) => String(vinculo?.atestado_id || '') === atestadoId);
    const jisoExistente = vinculoAtivo
      ? (bundle.jisos || []).find((jiso) => String(jiso?.id || '') === String(vinculoAtivo.jiso_id || ''))
      : (bundle.jisos || []).find((jiso) => String(jiso?.atestado_id || '') === atestadoId);

    if (jisoExistente) {
      setJisoSelecionada(jisoExistente);
      setDialogDetalheOpen(true);
    } else if (canGerirJiso) {
      const candidatas = (bundle.jisos || [])
        .filter((jiso) => String(jiso?.militar_id || '') === String(atestado?.militar_id || ''))
        .filter((jiso) => !['Realizada', 'Cancelada'].includes(getStatusVisual(jiso)))
        .sort((a, b) => String(a.data_jiso || '9999-99-99').localeCompare(String(b.data_jiso || '9999-99-99')));

      if (candidatas.length > 0) {
        setAtestadoParaVincular(atestado);
        setJisoParaVincularId(String(candidatas[0].id));
        setFormError('');
        setDialogVincularOpen(true);
      } else {
        setAtestadoParaVincular(atestado);
        setFormData({
          ...FORM_INICIAL,
          militar_id: String(atestado.militar_id || ''),
          finalidade_jiso: 'Homologação de Atestado',
          motivo_jiso: `Homologação do atestado iniciado em ${formatDateBR(atestado.data_inicio)}`,
        });
        setFormError('');
        setDialogNovaOpen(true);
      }
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, isLoading, atestadoById, vinculosAtivos, bundle.jisos, canGerirJiso]);

  const refreshBundle = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jiso-independent-bundle'] });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAtestadosAccess || !canViewJiso) return <AccessDenied modulo="JISO" />;

  const detalheAtestados = jisoSelecionada ? getAtestadosDaJiso(jisoSelecionada) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-7 space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1e3a5f] p-2.5 text-white">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">JISO</h1>
              <p className="text-slate-500">Juntas, agendamentos, vínculos com atestados e decisões de saúde</p>
            </div>
          </div>
          {canGerirJiso && (
            <Button onClick={abrirNovaJiso} className="bg-[#1e3a5f] hover:bg-[#294c75]">
              <Plus className="w-4 h-4 mr-2" /> Nova JISO
            </Button>
          )}
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ResumoCard label="Aguardando agendamento" value={resumo.aguardando} icon={Clock3} />
          <ResumoCard label="Agendadas" value={resumo.agendadas} icon={CalendarClock} />
          <ResumoCard label="Realizadas" value={resumo.realizadas} icon={CheckCircle2} />
          <ResumoCard label="WhatsApp pendente" value={resumo.whatsapp} icon={MessageCircle} />
          <ResumoCard label="Atestados sem JISO" value={atestadosPendentes.length} icon={AlertTriangle} />
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar militar, matrícula, finalidade ou NUP..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="Aguardando Agendamento">Aguardando agendamento</SelectItem>
                <SelectItem value="Agendada">Agendada</SelectItem>
                <SelectItem value="Realizada">Realizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {atestadosPendentes.length > 0 && canGerirJiso && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <div>
                <h2 className="font-semibold text-amber-900">Atestados aguardando criação de JISO</h2>
                <p className="text-xs text-amber-700">Gerar a JISO aqui já cria o vínculo automaticamente.</p>
              </div>
            </div>
            <div className="divide-y divide-amber-200">
              {atestadosPendentes.slice(0, 8).map((atestado) => {
                const militar = militarById.get(String(atestado.militar_id)) || {};
                return (
                  <div key={atestado.id} className="p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {militar.posto_graduacao || atestado.militar_posto || ''} {militar.nome_completo || atestado.militar_nome || 'Militar'}
                      </p>
                      <p className="text-sm text-slate-600">
                        Atestado de {formatDateBR(atestado.data_inicio)} · {atestado.dias || '—'} dias · {atestado.tipo_afastamento || 'Afastamento'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => abrirNovaJisoDoAtestado(atestado)}>
                      <Link2 className="w-4 h-4 mr-2" /> Gerar / Vincular JISO
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">JISOs</h2>
              <p className="text-sm text-slate-500">A JISO é o registro principal; atestados aparecem apenas como vínculos.</p>
            </div>
            <Badge variant="secondary">{jisosFiltradas.length}</Badge>
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jisosFiltradas.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">Nenhuma JISO encontrada</h3>
              <p className="text-sm text-slate-500 mt-1">Crie uma JISO ou ajuste os filtros.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jisosFiltradas.map((jiso) => {
                const militar = militarById.get(String(jiso.militar_id)) || {};
                const status = getStatusVisual(jiso);
                const atestadosDaJiso = getAtestadosDaJiso(jiso);
                return (
                  <button
                    type="button"
                    key={jiso.id}
                    onClick={() => abrirDetalhe(jiso)}
                    className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {militar.posto_graduacao || jiso.militar_posto || ''} {militar.nome_completo || jiso.militar_nome || 'Militar'}
                          </h3>
                          <Badge className={STATUS_STYLE[status] || 'bg-slate-100 text-slate-700'}>{status}</Badge>
                          <AtestadoCountBadge count={atestadosDaJiso.length} />
                        </div>
                        <p className="text-sm text-slate-700 font-medium">{jiso.finalidade_jiso || 'Finalidade não informada'}</p>
                        {jiso.motivo_jiso && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{jiso.motivo_jiso}</p>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-2 text-sm lg:min-w-[510px]">
                        <InfoMini label="Data" value={formatDateBR(jiso.data_jiso)} />
                        <InfoMini label="Horário" value={jiso.hora_jiso || '—'} />
                        <InfoMini label="Local" value={jiso.local_jiso || '—'} />
                        <InfoMini label="WhatsApp" value={jiso.jiso_whatsapp_enviado_em ? 'Enviado' : 'Pendente'} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={dialogVincularOpen} onOpenChange={setDialogVincularOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Vincular atestado a uma JISO existente</DialogTitle>
            <DialogDescription>
              Já existe JISO aberta para este militar. Vincule o atestado à mesma sessão ou crie uma nova JISO.
            </DialogDescription>
          </DialogHeader>

          {atestadoParaVincular && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">Atestado de {formatDateBR(atestadoParaVincular.data_inicio)}</p>
                <p className="text-slate-500">{atestadoParaVincular.dias || '—'} dias · {atestadoParaVincular.tipo_afastamento || 'Afastamento'}</p>
              </div>

              <div className="grid gap-2">
                <Label>JISO aberta *</Label>
                <Select value={jisoParaVincularId} onValueChange={setJisoParaVincularId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a JISO" /></SelectTrigger>
                  <SelectContent>
                    {getJisosVinculaveis(atestadoParaVincular).map((jiso) => (
                      <SelectItem key={jiso.id} value={String(jiso.id)}>
                        {formatDateBR(jiso.data_jiso)} · {jiso.hora_jiso || 'sem horário'} · {jiso.finalidade_jiso || 'JISO'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{formError}</div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => abrirCriacaoJisoDoAtestado(atestadoParaVincular)}
              disabled={linkExistingMutation.isPending}
            >
              Criar nova JISO
            </Button>
            <Button
              onClick={vincularJisoExistente}
              disabled={linkExistingMutation.isPending || !jisoParaVincularId}
              className="bg-[#1e3a5f] hover:bg-[#294c75]"
            >
              {linkExistingMutation.isPending ? 'Vinculando...' : 'Vincular à JISO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogNovaOpen} onOpenChange={setDialogNovaOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{atestadoParaVincular ? 'Gerar JISO para o atestado' : 'Nova JISO'}</DialogTitle>
            <DialogDescription>
              {atestadoParaVincular
                ? 'A JISO será criada e o atestado ficará vinculado automaticamente.'
                : 'A JISO pode ser criada sem qualquer atestado vinculado.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Militar *</Label>
              <Select
                value={formData.militar_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, militar_id: value }))}
                disabled={Boolean(atestadoParaVincular)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o militar" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {militaresOrdenados.map((militar) => (
                    <SelectItem key={militar.id} value={String(militar.id)}>
                      {militar.posto_graduacao || ''} {militar.nome_completo || militar.nome_guerra || 'Militar'} · {militar.matricula || 's/mat.'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Finalidade *</Label>
                <Select
                  value={formData.finalidade_jiso}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, finalidade_jiso: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FINALIDADES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>NUP</Label>
                <Input value={formData.nup} onChange={(e) => setFormData((prev) => ({ ...prev, nup: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Motivo / referência</Label>
              <Input
                value={formData.motivo_jiso}
                onChange={(e) => setFormData((prev) => ({ ...prev, motivo_jiso: e.target.value }))}
                placeholder="Ex.: promoção ao posto de..., renovação contratual..."
              />
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" value={formData.data_jiso} onChange={(e) => setFormData((prev) => ({ ...prev, data_jiso: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Horário</Label>
                <Input type="time" value={formData.hora_jiso} onChange={(e) => setFormData((prev) => ({ ...prev, hora_jiso: e.target.value }))} />
              </div>
              <div className="grid gap-2 sm:col-span-2 md:col-span-1">
                <Label>Seção</Label>
                <Input value={formData.secao_jiso} onChange={(e) => setFormData((prev) => ({ ...prev, secao_jiso: e.target.value }))} />
              </div>
              <div className="grid gap-2 sm:col-span-2 md:col-span-1">
                <Label>Local</Label>
                <Input value={formData.local_jiso} onChange={(e) => setFormData((prev) => ({ ...prev, local_jiso: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                rows={3}
              />
            </div>

            {formError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{formError}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaOpen(false)} disabled={createMutation.isPending}>Cancelar</Button>
            <Button onClick={salvarNovaJiso} disabled={createMutation.isPending} className="bg-[#1e3a5f] hover:bg-[#294c75]">
              {createMutation.isPending ? 'Salvando...' : 'Criar JISO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogDetalheOpen} onOpenChange={setDialogDetalheOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes da JISO</DialogTitle>
            <DialogDescription>A JISO é o registro central; documentos médicos permanecem vinculados separadamente.</DialogDescription>
          </DialogHeader>

          {jisoSelecionada && (
            <div className="space-y-5 py-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <UserRound className="w-5 h-5 text-slate-500 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">{jisoSelecionada.militar_posto || ''} {jisoSelecionada.militar_nome || 'Militar'}</p>
                      <p className="text-sm text-slate-500">Matrícula {jisoSelecionada.militar_matricula_atual || jisoSelecionada.militar_matricula || '—'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canRegistrarDecisao && (
                      <Button size="sm" variant="outline" onClick={() => setDialogDecisionOpen(true)}>
                        <FileCheck2 className="w-4 h-4 mr-2" /> Registrar decisão
                      </Button>
                    )}
                    {canGerirJiso && (
                      <Button
                        size="sm"
                        variant={jisoSelecionada.jiso_whatsapp_enviado_em ? 'outline' : 'default'}
                        onClick={() => setDialogWhatsAppOpen(true)}
                        className={!jisoSelecionada.jiso_whatsapp_enviado_em ? 'bg-emerald-700 hover:bg-emerald-800' : ''}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        {jisoSelecionada.jiso_whatsapp_enviado_em ? 'Reenviar convocação' : 'Convocar por WhatsApp'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <InfoMini label="Finalidade" value={jisoSelecionada.finalidade_jiso || '—'} />
                  <InfoMini label="Data" value={formatDateBR(jisoSelecionada.data_jiso)} />
                  <InfoMini label="Horário" value={jisoSelecionada.hora_jiso || '—'} />
                  <InfoMini label="Local" value={jisoSelecionada.local_jiso || '—'} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Atestados vinculados
                  </h3>
                  <Badge variant="secondary">{detalheAtestados.length}</Badge>
                </div>
                {detalheAtestados.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                    Esta JISO não depende de atestado médico.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detalheAtestados.map(({ atestado, vinculo }) => (
                      <div
                        key={`${atestado.id}-${vinculo?.id || 'legado'}`}
                        className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-sm text-slate-900">{atestado.tipo_afastamento || 'Atestado'} · {atestado.dias || '—'} dias</p>
                          <p className="text-xs text-slate-500">
                            {formatDateBR(atestado.data_inicio)} a {formatDateBR(atestado.data_termino)} · vínculo {vinculo?.origem_vinculo || 'manual'}
                          </p>
                          {vinculo?.resultado_atestado && (
                            <p className="text-xs font-medium text-emerald-700 mt-1">Resultado: {vinculo.resultado_atestado}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`)}
                        >
                          Abrir
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <StatusBox
                  icon={MessageCircle}
                  label="Convocação WhatsApp"
                  value={jisoSelecionada.jiso_whatsapp_enviado_em
                    ? `Enviada em ${new Date(jisoSelecionada.jiso_whatsapp_enviado_em).toLocaleString('pt-BR')}`
                    : 'Pendente'}
                />
                <StatusBox icon={FileText} label="Ata / publicação" value={jisoSelecionada.status_publicacao || 'Aguardando Nota'} />
                <StatusBox icon={CheckCircle2} label="Resultado" value={jisoSelecionada.resultado_jiso || 'Ainda não registrado'} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <JisoWhatsAppDialog
        jiso={jisoSelecionada}
        open={dialogWhatsAppOpen}
        onOpenChange={setDialogWhatsAppOpen}
        onSent={refreshBundle}
      />

      <JisoDecisionDialog
        jiso={jisoSelecionada}
        linkedAtestados={detalheAtestados}
        open={dialogDecisionOpen}
        onOpenChange={setDialogDecisionOpen}
        onSaved={refreshBundle}
      />
    </div>
  );
}

function ResumoCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="rounded-lg bg-slate-100 p-2"><Icon className="w-5 h-5 text-slate-600" /></div>
      </div>
    </div>
  );
}

function InfoMini({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-700 truncate" title={String(value || '')}>{value || '—'}</p>
    </div>
  );
}

function StatusBox({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <p className="text-sm font-medium text-slate-800 mt-2">{value}</p>
    </div>
  );
}

function AtestadoCountBadge({ count }) {
  if (!count) return <Badge variant="outline">Sem atestado</Badge>;
  return <Badge variant="outline">{count} {count === 1 ? 'atestado' : 'atestados'}</Badge>;
}
