import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  Settings,
  Trash2,
  Pencil,
  AlertTriangle,
  MoreHorizontal,
  LogIn,
  LogOut,
  PauseCircle,
  GitBranch,
} from 'lucide-react';
import RegistroLivroModal from '@/components/ferias/RegistroLivroModal';
import FamiliaFeriasPanel from '@/components/ferias/FamiliaFeriasPanel';
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { montarCadeia } from '@/components/ferias/feriasAdminUtils';

const statusColors = {
  Prevista: 'bg-slate-100 text-slate-700',
  'Em Curso': 'bg-amber-100 text-amber-700',
  Gozada: 'bg-emerald-100 text-emerald-700',
  Interrompida: 'bg-orange-100 text-orange-700',
};

const TIPOS_OPERACIONAIS = [
  'Saída Férias',
  'Retorno Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
];

const NOMES_OPERACIONAIS = {
  'Saída Férias': 'Início',
  'Retorno Férias': 'Término',
  'Interrupção de Férias': 'Interrupção',
  'Nova Saída / Retomada': 'Continuação',
};

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function formatDateBR(dateStr) {
  if (!dateStr) return '-';
  return format(parseDate(dateStr), 'dd/MM/yyyy');
}

function getEventDate(evento) {
  return evento?.data_registro || evento?.data_inicio || null;
}

function deriveInterrupcaoData(ferias, registrosLivro) {
  if (!ferias || !Array.isArray(registrosLivro)) {
    return {
      diasNoMomento: Number(ferias?.dias || 0),
      gozados: null,
      saldo: null,
      dataInterrupcao: null,
    };
  }

  const ultimaInterrupcao = registrosLivro
    .filter(
      (r) =>
        r.ferias_id === ferias.id &&
        r.tipo_registro === 'Interrupção de Férias'
    )
    .sort((a, b) => new Date(b.data_registro || 0) - new Date(a.data_registro || 0))[0];

  if (!ultimaInterrupcao) {
    return {
      diasNoMomento: Number(ferias.dias || 0),
      gozados: null,
      saldo: null,
      dataInterrupcao: null,
    };
  }

  const diasNoMomento = Number(
    ultimaInterrupcao.dias_no_momento ??
    ultimaInterrupcao.dias ??
    ferias.dias ??
    0
  );

  let gozados = null;
  let saldo = null;

  if (ferias.data_inicio && ultimaInterrupcao.data_registro) {
    const inicio = parseDate(ferias.data_inicio);
    const dataInterrupcao = parseDate(ultimaInterrupcao.data_registro);

    gozados = Math.max(0, differenceInDays(dataInterrupcao, inicio) + 1);
    gozados = Math.min(gozados, diasNoMomento);
    saldo = Math.max(0, diasNoMomento - gozados);
  }

  if (ultimaInterrupcao.dias_gozados != null && !Number.isNaN(Number(ultimaInterrupcao.dias_gozados))) {
    gozados = Number(ultimaInterrupcao.dias_gozados);
  }

  if (ultimaInterrupcao.saldo_remanescente != null && !Number.isNaN(Number(ultimaInterrupcao.saldo_remanescente))) {
    saldo = Number(ultimaInterrupcao.saldo_remanescente);
  }

  return {
    diasNoMomento,
    gozados,
    saldo,
    dataInterrupcao: ultimaInterrupcao.data_registro || null,
  };
}

function getCadeiaOperacional(ferias, registrosLivro) {
  if (!ferias) return [];

  return montarCadeia(ferias, registrosLivro).filter((r) =>
    TIPOS_OPERACIONAIS.includes(r.tipo_registro)
  );
}

function getEstadoAtualDaCadeia(cadeia) {
  if (!cadeia.length) {
    return {
      status: 'Sem Eventos',
      ultimoEvento: null,
      ultimaSaidaOuContinuacao: null,
      ultimaInterrupcao: null,
      ultimoRetorno: null,
    };
  }

  const ultimoEvento = cadeia[cadeia.length - 1];
  const ultimaSaidaOuContinuacao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Saída Férias' || e.tipo_registro === 'Nova Saída / Retomada');

  const ultimaInterrupcao = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Interrupção de Férias');

  const ultimoRetorno = [...cadeia]
    .reverse()
    .find((e) => e.tipo_registro === 'Retorno Férias');

  let status = 'Sem Eventos';

  if (
    ultimoEvento.tipo_registro === 'Saída Férias' ||
    ultimoEvento.tipo_registro === 'Nova Saída / Retomada'
  ) {
    status = 'Em Curso';
  } else if (ultimoEvento.tipo_registro === 'Interrupção de Férias') {
    status = 'Interrompida';
  } else if (ultimoEvento.tipo_registro === 'Retorno Férias') {
    status = 'Encerrada';
  }

  return {
    status,
    ultimoEvento,
    ultimaSaidaOuContinuacao,
    ultimaInterrupcao,
    ultimoRetorno,
  };
}

function validarEdicaoDataInicio({ ferias, novaData, registrosLivro }) {
  if (!ferias || !novaData) return null;

  const novaDataDate = parseDate(novaData);
  const cadeia = getCadeiaOperacional(ferias, registrosLivro);

  if (!cadeia.length) return null;

  const primeiroEvento = cadeia[0];
  const ultimoEvento = cadeia[cadeia.length - 1];
  const primeiroEventoDataStr = getEventDate(primeiroEvento);
  const ultimoEventoDataStr = getEventDate(ultimoEvento);
  const estadoAtual = getEstadoAtualDaCadeia(cadeia);

  if (primeiroEvento?.tipo_registro !== 'Saída Férias') {
    return 'A cadeia possui eventos sem um início operacional consistente. Revise os lançamentos antes de alterar a data de início.';
  }

  if (primeiroEventoDataStr && novaDataDate > parseDate(primeiroEventoDataStr)) {
    return `A data de início não pode ser posterior ao primeiro evento da cadeia (${NOMES_OPERACIONAIS[primeiroEvento.tipo_registro] || primeiroEvento.tipo_registro} em ${formatDateBR(primeiroEventoDataStr)}).`;
  }

  if (
    estadoAtual.ultimaInterrupcao &&
    getEventDate(estadoAtual.ultimaInterrupcao) &&
    novaDataDate > parseDate(getEventDate(estadoAtual.ultimaInterrupcao))
  ) {
    return `A data de início não pode ser posterior à interrupção de ${formatDateBR(getEventDate(estadoAtual.ultimaInterrupcao))}.`;
  }

  if (
    estadoAtual.ultimoRetorno &&
    getEventDate(estadoAtual.ultimoRetorno) &&
    novaDataDate > parseDate(getEventDate(estadoAtual.ultimoRetorno))
  ) {
    return `A data de início não pode ser posterior ao término de ${formatDateBR(getEventDate(estadoAtual.ultimoRetorno))}.`;
  }

  if (ultimoEventoDataStr && novaDataDate > parseDate(ultimoEventoDataStr)) {
    return `A data de início não pode ser posterior ao último evento da cadeia (${NOMES_OPERACIONAIS[ultimoEvento.tipo_registro] || ultimoEvento.tipo_registro} em ${formatDateBR(ultimoEventoDataStr)}).`;
  }

  return null;
}

export default function Ferias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feriasToDelete, setFeriasToDelete] = useState(null);
  const [livrosVinculados, setLivrosVinculados] = useState([]);
  const [livrosDialogOpen, setLivrosDialogOpen] = useState(false);
  const [deletingLivroId, setDeletingLivroId] = useState(null);

  const [registroLivroModal, setRegistroLivroModal] = useState({
    open: false,
    ferias: null,
    tipo: 'Saída Férias',
  });

  const [editDataModal, setEditDataModal] = useState({
    open: false,
    ferias: null,
    novaData: '',
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, ferias: null });

  const { data: ferias = [], isLoading } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio'),
  });

  const { data: registrosLivro = [] } = useQuery({
    queryKey: ['registros-livro-all'],
    queryFn: () => base44.entities.RegistroLivro.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ feriasId, periodoId }) => {
      await base44.entities.Ferias.delete(feriasId);

      if (periodoId) {
        await base44.entities.PeriodoAquisitivo.update(periodoId, {
          status: 'Disponível',
          dias_gozados: 0,
          dias_previstos: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
      setDeleteDialogOpen(false);
      setFeriasToDelete(null);
      setLivrosVinculados([]);
    },
  });

  const deleteLivroMutation = useMutation({
    mutationFn: (id) => base44.entities.RegistroLivro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });
      setDeletingLivroId(null);
    },
  });

  const filteredFerias = useMemo(() => {
    return ferias.filter((f) => {
      const matchesSearch =
        f.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.periodo_aquisitivo_ref?.includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ferias, searchTerm, statusFilter]);

  const feriasAgrupadas = useMemo(() => {
    return filteredFerias.reduce((acc, f) => {
      if (!f.data_inicio) {
        const key = 'Sem data';
        if (!acc[key]) acc[key] = { label: 'Sem data', items: [], sortKey: '9999-99' };
        acc[key].items.push(f);
        return acc;
      }

      const d = parseISO(`${f.data_inicio}T00:00:00`);
      const key = format(d, 'yyyy-MM');
      const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });

      if (!acc[key]) acc[key] = { label, items: [], sortKey: key };
      acc[key].items.push(f);
      return acc;
    }, {});
  }, [filteredFerias]);

  const gruposOrdenados = useMemo(() => {
    return Object.values(feriasAgrupadas).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [feriasAgrupadas]);

  const editDataError = useMemo(() => {
    return validarEdicaoDataInicio({
      ferias: editDataModal.ferias,
      novaData: editDataModal.novaData,
      registrosLivro,
    });
  }, [editDataModal, registrosLivro]);

  const previewEditData = useMemo(() => {
    if (!editDataModal.ferias || !editDataModal.novaData) return null;

    const f = editDataModal.ferias;
    const dias = Number(f.dias || 0);

    return {
      inicio: editDataModal.novaData,
      fim: format(addDays(parseDate(editDataModal.novaData), Math.max(dias - 1, 0)), 'yyyy-MM-dd'),
      retorno: format(addDays(parseDate(editDataModal.novaData), dias), 'yyyy-MM-dd'),
    };
  }, [editDataModal]);

  const handleDelete = async (f) => {
    setFeriasToDelete(f);

    const vinculados = registrosLivro.filter((r) => r.ferias_id === f.id);
    setLivrosVinculados(vinculados);

    if (vinculados.length > 0) {
      setLivrosDialogOpen(true);
    } else {
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (!feriasToDelete) return;

    deleteMutation.mutate({
      feriasId: feriasToDelete.id,
      periodoId: feriasToDelete.periodo_aquisitivo_id,
    });
  };

  const handleDeleteLivro = async (livroId) => {
    setDeletingLivroId(livroId);
    await deleteLivroMutation.mutateAsync(livroId);

    const remaining = livrosVinculados.filter((l) => l.id !== livroId);
    setLivrosVinculados(remaining);

    if (remaining.length === 0) {
      setLivrosDialogOpen(false);
      setDeleteDialogOpen(true);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(`${dateString}T00:00:00`), 'dd/MM/yyyy');
  };

  const handleSalvarEditData = async () => {
    if (!editDataModal.ferias || !editDataModal.novaData || editDataError) return;

    setSavingEdit(true);

    try {
      const f = editDataModal.ferias;
      const novaDataFim = format(
        addDays(parseDate(editDataModal.novaData), (f.dias || 0) - 1),
        'yyyy-MM-dd'
      );
      const novaDataRetorno = format(
        addDays(parseDate(editDataModal.novaData), f.dias || 0),
        'yyyy-MM-dd'
      );

      await base44.entities.Ferias.update(f.id, {
        data_inicio: editDataModal.novaData,
        data_fim: novaDataFim,
        data_retorno: novaDataRetorno,
      });

      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      setEditDataModal({ open: false, ferias: null, novaData: '' });
    } catch (error) {
      console.error('Erro ao alterar data de início das férias:', error);
      alert('Erro ao alterar data de início.');
    } finally {
      setSavingEdit(false);
    }
  };

  const stats = {
    total: ferias.length,
    emCurso: ferias.filter((f) => f.status === 'Em Curso').length,
    previstas: ferias.filter((f) => f.status === 'Prevista').length,
    gozadas: ferias.filter((f) => f.status === 'Gozada').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Férias</h1>
            <p className="text-slate-500">Plano de férias por período</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl('PeriodosAquisitivos'))}
              className="border-slate-300"
            >
              <Settings className="w-4 h-4 mr-2" />
              Períodos Aquisitivos
            </Button>

            <Button
              onClick={() => navigate(createPageUrl('CadastrarFerias'))}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Férias
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total',
              value: stats.total,
              icon: Calendar,
              iconBg: 'bg-[#1e3a5f]/10',
              iconText: 'text-[#1e3a5f]',
              valueText: 'text-[#1e3a5f]',
            },
            {
              label: 'Em Curso',
              value: stats.emCurso,
              icon: Clock,
              iconBg: 'bg-amber-100',
              iconText: 'text-amber-600',
              valueText: 'text-amber-600',
            },
            {
              label: 'Previstas',
              value: stats.previstas,
              icon: Calendar,
              iconBg: 'bg-blue-100',
              iconText: 'text-blue-600',
              valueText: 'text-blue-600',
            },
            {
              label: 'Gozadas',
              value: stats.gozadas,
              icon: CheckCircle,
              iconBg: 'bg-emerald-100',
              iconText: 'text-emerald-600',
              valueText: 'text-emerald-600',
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.iconText}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.valueText}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Buscar por militar, matrícula ou período..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-slate-200"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Prevista">Prevista</SelectItem>
                <SelectItem value="Em Curso">Em Curso</SelectItem>
                <SelectItem value="Gozada">Gozada</SelectItem>
                <SelectItem value="Interrompida">Interrompida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">
          {filteredFerias.length} férias encontrada(s)
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFerias.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhuma férias encontrada
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros'
                : 'Comece cadastrando as primeiras férias'}
            </p>

            {!searchTerm && statusFilter === 'all' && (
              <Button
                onClick={() => navigate(createPageUrl('CadastrarFerias'))}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Férias
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {gruposOrdenados.map((grupo) => (
              <div key={grupo.sortKey}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#1e3a5f]" />
                  <h2 className="text-base font-semibold text-[#1e3a5f] capitalize">
                    {grupo.label}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">{grupo.items.length} registro(s)</span>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Militar</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Período Aquisitivo</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Início</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Retorno</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Dias</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Fração</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                        <th
                          className="text-center px-3 py-3 font-semibold text-slate-600 w-10"
                          title="Rastro da família"
                        >
                          <GitBranch className="w-4 h-4 mx-auto text-slate-400" />
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-600">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {grupo.items.map((f) => {
                        const temEventos = registrosLivro.some(
                          (r) =>
                            r.ferias_id === f.id &&
                            [
                              'Saída Férias',
                              'Retorno Férias',
                              'Interrupção de Férias',
                              'Nova Saída / Retomada',
                            ].includes(r.tipo_registro)
                        );

                        const interrupcaoInfo =
                          f.status === 'Interrompida'
                            ? deriveInterrupcaoData(f, registrosLivro)
                            : null;

                        return (
                          <tr
                            key={f.id}
                            className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-900">
                                {f.militar_posto && (
                                  <span className="text-slate-500 mr-1 text-xs">{f.militar_posto}</span>
                                )}
                                {f.militar_nome}
                              </span>
                              <p className="text-xs text-slate-400">Mat: {f.militar_matricula}</p>
                            </td>

                            <td className="px-4 py-3 text-slate-600">{f.periodo_aquisitivo_ref || '-'}</td>

                            <td className="px-4 py-3 text-slate-700">
                              <div className="flex items-center gap-1 group">
                                <span>{formatDate(f.data_inicio)}</span>
                                {f.status !== 'Gozada' && (
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-[#1e3a5f]"
                                    title="Alterar data de início"
                                    onClick={() =>
                                      setEditDataModal({
                                        open: true,
                                        ferias: f,
                                        novaData: f.data_inicio || '',
                                      })
                                    }
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-slate-700">{formatDate(f.data_retorno)}</td>

                            <td className="px-4 py-3 text-slate-700">
                              <div className="flex flex-col">
                                <span>{f.dias}d</span>

                                {f.status === 'Interrompida' && interrupcaoInfo?.saldo != null && (
                                  <span className="text-xs text-orange-600 font-medium">
                                    Saldo: {interrupcaoInfo.saldo}d
                                  </span>
                                )}

                                {f.status === 'Interrompida' && interrupcaoInfo?.gozados != null && (
                                  <span className="text-xs text-slate-500">
                                    Gozados: {interrupcaoInfo.gozados}d
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              {f.fracionamento && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs">
                                  {f.fracionamento}
                                </Badge>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                className={`${statusColors[f.status] || 'bg-slate-100 text-slate-700'} text-xs`}
                              >
                                {f.status}
                              </Badge>
                            </td>

                            <td className="px-3 py-3 text-center">
                              {temEventos ? (
                                <button
                                  title="Ver rastro da família"
                                  onClick={() => setFamiliaPanel({ open: true, ferias: f })}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#1e3a5f]/8 hover:bg-[#1e3a5f]/15 text-[#1e3a5f] transition-colors"
                                >
                                  <GitBranch className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-slate-200">
                                  <GitBranch className="w-3.5 h-3.5 mx-auto" />
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-slate-500 hover:text-[#1e3a5f] hover:bg-slate-100"
                                    >
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end" className="w-56">
                                    {(f.status === 'Prevista' || f.status === 'Autorizada') && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setRegistroLivroModal({
                                            open: true,
                                            ferias: f,
                                            tipo: 'Saída Férias',
                                          })
                                        }
                                      >
                                        <LogOut className="w-4 h-4 mr-2 text-emerald-600" />
                                        <span>Iniciar Férias</span>
                                      </DropdownMenuItem>
                                    )}

                                    {f.status === 'Interrompida' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setRegistroLivroModal({
                                            open: true,
                                            ferias: f,
                                            tipo: 'Nova Saída / Retomada',
                                          })
                                        }
                                      >
                                        <LogOut className="w-4 h-4 mr-2 text-teal-600" />
                                        <span>Continuação</span>
                                      </DropdownMenuItem>
                                    )}

                                    {f.status === 'Em Curso' && (
                                      <>
                                        <DropdownMenuItem
                                          onClick={() =>
                                            setRegistroLivroModal({
                                              open: true,
                                              ferias: f,
                                              tipo: 'Retorno Férias',
                                            })
                                          }
                                        >
                                          <LogIn className="w-4 h-4 mr-2 text-blue-600" />
                                          <span>Término</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() =>
                                            setRegistroLivroModal({
                                              open: true,
                                              ferias: f,
                                              tipo: 'Interrupção de Férias',
                                            })
                                          }
                                        >
                                          <PauseCircle className="w-4 h-4 mr-2 text-orange-600" />
                                          <span>Interrupção</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {f.status !== 'Gozada' && (
                                      <>
                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem
                                          onClick={() =>
                                            setEditDataModal({
                                              open: true,
                                              ferias: f,
                                              novaData: f.data_inicio || '',
                                            })
                                          }
                                        >
                                          <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                          <span>Alterar Data de Início</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() =>
                                            navigate(createPageUrl('CadastrarFerias') + `?id=${f.id}`)
                                          }
                                        >
                                          <Pencil className="w-4 h-4 mr-2 text-slate-500" />
                                          <span>Editar Férias</span>
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                          onClick={() => handleDelete(f)}
                                          className="text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          <span>Excluir Férias</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {f.status === 'Gozada' && (
                                      <DropdownMenuItem disabled className="text-slate-400 text-xs italic">
                                        Férias encerrada — sem ações operacionais
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={livrosDialogOpen} onOpenChange={setLivrosDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Lançamentos de Livro Vinculados
            </DialogTitle>
            <DialogDescription>
              Estas férias possuem {livrosVinculados.length} lançamento(s) de livro vinculados.
              Você pode excluí-los antes de excluir as férias, ou cancelar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {livrosVinculados.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{l.tipo_registro}</p>
                  <p className="text-xs text-slate-500">
                    Data: {formatDate(l.data_registro)}
                    {l.dias ? ` — ${l.dias} dias` : ''}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={deletingLivroId === l.id}
                  onClick={() => handleDeleteLivro(l.id)}
                >
                  {deletingLivroId === l.id ? (
                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setLivrosDialogOpen(false);
                setFeriasToDelete(null);
              }}
            >
              Cancelar
            </Button>

            {livrosVinculados.length === 0 && (
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setLivrosDialogOpen(false);
                  setDeleteDialogOpen(true);
                }}
              >
                Prosseguir com exclusão
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RegistroLivroModal
        open={registroLivroModal.open}
        onClose={() =>
          setRegistroLivroModal({ open: false, ferias: null, tipo: 'Saída Férias' })
        }
        ferias={registroLivroModal.ferias}
        tipoInicial={registroLivroModal.tipo}
      />

      <Dialog
        open={editDataModal.open}
        onOpenChange={(v) => !v && setEditDataModal({ open: false, ferias: null, novaData: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Alterar Data de Início</DialogTitle>
            <DialogDescription>
              A alteração manual respeita a cronologia da cadeia já existente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {editDataModal.ferias && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">
                  {editDataModal.ferias.militar_posto} {editDataModal.ferias.militar_nome}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {editDataModal.ferias.dias} dias • Período {editDataModal.ferias.periodo_aquisitivo_ref || '-'}
                </p>
              </div>
            )}

            <div>
              <Input
                type="date"
                value={editDataModal.novaData}
                onChange={(e) =>
                  setEditDataModal((p) => ({ ...p, novaData: e.target.value }))
                }
                className="mt-1.5"
              />
            </div>

            {previewEditData && !editDataError && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">
                <div className="font-medium text-cyan-800 mb-2">Prévia da atualização</div>
                <div className="grid grid-cols-3 gap-3 text-cyan-900">
                  <div>
                    <div className="text-cyan-700 text-xs">Início</div>
                    <div className="font-semibold">{formatDate(previewEditData.inicio)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700 text-xs">Fim</div>
                    <div className="font-semibold">{formatDate(previewEditData.fim)}</div>
                  </div>
                  <div>
                    <div className="text-cyan-700 text-xs">Retorno</div>
                    <div className="font-semibold">{formatDate(previewEditData.retorno)}</div>
                  </div>
                </div>
              </div>
            )}

            {editDataError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {editDataError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDataModal({ open: false, ferias: null, novaData: '' })}
              >
                Cancelar
              </Button>

              <Button
                disabled={savingEdit || !editDataModal.novaData || !!editDataError}
                onClick={handleSalvarEditData}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {savingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {familiaPanel.open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setFamiliaPanel({ open: false, ferias: null })}
          />
          <FamiliaFeriasPanel
            ferias={familiaPanel.ferias}
            registrosLivro={registrosLivro}
            onClose={() => setFamiliaPanel({ open: false, ferias: null })}
          />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir estas férias de{' '}
              <strong>{feriasToDelete?.militar_nome}</strong>?
              {feriasToDelete?.periodo_aquisitivo_id && (
                <span className="block mt-2 text-amber-700 bg-amber-50 p-2 rounded">
                  O período aquisitivo <strong>{feriasToDelete?.periodo_aquisitivo_ref}</strong>{' '}
                  voltará ao status <strong>Disponível</strong>.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}