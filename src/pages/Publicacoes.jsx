import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';
import FamiliaPublicacaoPanel from '@/components/publicacao/FamiliaPublicacaoPanel';
import { addDays, differenceInDays, format } from 'date-fns';

const TIPOS_FERIAS = [
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
];

function calcStatus(registro) {
  if (registro.numero_bg && registro.data_bg) return 'Publicado';
  if (registro.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) {
    return 'ex-officio';
  }
  if (registro.medico || registro.cid_10) {
    return 'atestado';
  }
  return 'livro';
}

function getTipoDisplay(tipo) {
  if (tipo === 'Saída Férias') return 'Início';
  if (tipo === 'Interrupção de Férias') return 'Interrupção';
  if (tipo === 'Nova Saída / Retomada') return 'Continuação';
  if (tipo === 'Retorno Férias') return 'Término';
  return tipo;
}

function getGrupoDisplay(registro) {
  const tipoBase = registro.tipo_registro || registro.tipo || '';

  if (TIPOS_FERIAS.includes(tipoBase)) {
    return 'Férias';
  }

  if (registro.medico || registro.cid_10) {
    return 'Atestado';
  }

  return '';
}

function normalizarRegistro(registro) {
  const tipoBase = registro.tipo_registro || registro.tipo || '';
  const tipoDisplay = getTipoDisplay(tipoBase);
  const grupoDisplay = getGrupoDisplay(registro);
  const tipoCompostoDisplay = grupoDisplay
    ? `${grupoDisplay} • ${tipoDisplay}`
    : tipoDisplay;

  return {
    ...registro,
    origem_tipo: detectarOrigemTipo(registro),
    status_calculado: calcStatus(registro),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: tipoCompostoDisplay,
  };
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function toDateOnly(date) {
  return format(date, 'yyyy-MM-dd');
}

function getEventDate(registro) {
  return registro?.data_registro || registro?.data_inicio || null;
}

function compareEventos(a, b) {
  const da = getEventDate(a) || '2000-01-01';
  const db = getEventDate(b) || '2000-01-01';

  const dateA = new Date(`${da}T00:00:00`);
  const dateB = new Date(`${db}T00:00:00`);

  if (dateA.getTime() !== dateB.getTime()) {
    return dateA - dateB;
  }

  return new Date(a?.created_date || 0) - new Date(b?.created_date || 0);
}

function isFeriasOperacional(registro) {
  return (
    detectarOrigemTipo(registro) === 'livro' &&
    !!registro.ferias_id &&
    TIPOS_FERIAS.includes(registro.tipo_registro)
  );
}

function buildFeriasStateFromChain(feriasAtual, remainingOps) {
  if (!remainingOps.length) {
    return {
      status: 'Prevista',
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  const ordenados = [...remainingOps].sort(compareEventos);
  const ultimo = ordenados[ordenados.length - 1];
  const tipo = ultimo.tipo_registro;
  const dataBase = ultimo.data_registro;

  if (tipo === 'Saída Férias') {
    const dias = Number(ultimo.dias ?? feriasAtual.dias ?? 0);
    return {
      status: 'Em Curso',
      data_inicio: dataBase,
      data_fim: toDateOnly(addDays(parseDate(dataBase), Math.max(dias - 1, 0))),
      data_retorno: toDateOnly(addDays(parseDate(dataBase), dias)),
      dias,
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  if (tipo === 'Interrupção de Férias') {
    const diasNoMomento = Number(ultimo.dias_no_momento ?? ultimo.dias ?? feriasAtual.dias ?? 0);

    let gozados = Number(ultimo.dias_gozados ?? 0);
    let saldo = Number(ultimo.saldo_remanescente ?? 0);

    if ((!ultimo.dias_gozados && ultimo.dias_gozados !== 0) || (!ultimo.saldo_remanescente && ultimo.saldo_remanescente !== 0)) {
      const inicioReferencia = [...ordenados]
        .reverse()
        .find((r) => r.tipo_registro === 'Saída Férias' || r.tipo_registro === 'Nova Saída / Retomada');

      if (inicioReferencia?.data_registro && ultimo.data_registro) {
        gozados = Math.max(0, differenceInDays(parseDate(ultimo.data_registro), parseDate(inicioReferencia.data_registro)) + 1);
        gozados = Math.min(gozados, diasNoMomento);
        saldo = Math.max(0, diasNoMomento - gozados);
      }
    }

    return {
      status: 'Interrompida',
      dias: diasNoMomento,
      saldo_remanescente: saldo,
      dias_gozados_interrupcao: gozados,
      data_interrupcao: ultimo.data_registro,
    };
  }

  if (tipo === 'Nova Saída / Retomada') {
    const dias = Number(ultimo.dias ?? feriasAtual.dias ?? 0);
    return {
      status: 'Em Curso',
      data_inicio: dataBase,
      data_fim: toDateOnly(addDays(parseDate(dataBase), Math.max(dias - 1, 0))),
      data_retorno: toDateOnly(addDays(parseDate(dataBase), dias)),
      dias,
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  if (tipo === 'Retorno Férias') {
    return {
      status: 'Gozada',
      saldo_remanescente: null,
      dias_gozados_interrupcao: null,
      data_interrupcao: null,
    };
  }

  return {};
}

export default function Publicacoes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, registro: null });

  const { data: registrosLivro = [], isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: () => base44.entities.RegistroLivro.list('-created_date')
  });

  const { data: publicacoesExOfficio = [], isLoading: loadingExOfficio } = useQuery({
    queryKey: ['publicacoes-ex-officio'],
    queryFn: () => base44.entities.PublicacaoExOfficio.list('-created_date')
  });

  const { data: atestados = [], isLoading: loadingAtestados } = useQuery({
    queryKey: ['atestados-publicacao'],
    queryFn: async () => {
      const all = await base44.entities.Atestado.list('-created_date');
      return all.filter(a => a.nota_para_bg || a.numero_bg);
    }
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados;

  const registros = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map(normalizarRegistro)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data, tipo }) => {
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, data);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, data);
      return base44.entities.RegistroLivro.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tipo, registro }) => {
      if (tipo === 'atestado') return;

      const detectarTipo = (refId) => {
        const found = [...registrosLivro, ...publicacoesExOfficio, ...atestados].find(r => r.id === refId);
        if (!found) return 'ex-officio';
        return detectarOrigemTipo(found);
      };

      const reverterVinculo = async (isApostila, isTSE, refId, origemTipoHint) => {
        if (!refId) return;
        const origemTipo = origemTipoHint || detectarTipo(refId);
        const entityOriginal =
          origemTipo === 'atestado' ? base44.entities.Atestado :
          origemTipo === 'livro' ? base44.entities.RegistroLivro :
          base44.entities.PublicacaoExOfficio;

        const originais = await entityOriginal.filter({ id: refId });
        const original = originais[0];
        if (!original) return;

        if (isApostila && original.apostilada_por_id === id) {
          await entityOriginal.update(refId, { apostilada_por_id: null });
        } else if (isTSE && original.tornada_sem_efeito_por_id === id) {
          await entityOriginal.update(refId, { tornada_sem_efeito_por_id: null });
        }
      };

      if (tipo === 'ex-officio') {
        const isApostila = registro?.tipo === 'Apostila';
        const isTSE = registro?.tipo === 'Tornar sem Efeito';

        if (isApostila || isTSE) {
          await reverterVinculo(isApostila, isTSE, registro?.publicacao_referencia_id, registro?.publicacao_referencia_origem_tipo);
        }

        if (registro?.tipo === 'Homologação de Atestado' && registro?.atestado_homologado_id) {
          const atList = await base44.entities.Atestado.filter({ id: registro.atestado_homologado_id });
          const at = atList[0];
          if (at && at.homologado_comandante === true) {
            await base44.entities.Atestado.update(registro.atestado_homologado_id, {
              homologado_comandante: false,
              status_jiso: null,
              status_publicacao: 'Aguardando Nota',
            });
          }
        }

        if (registro?.tipo === 'Ata JISO' && registro?.atestados_jiso_ids?.length) {
          for (const aid of registro.atestados_jiso_ids) {
            const atList = await base44.entities.Atestado.filter({ id: aid });
            const at = atList[0];
            if (at && at.status_jiso === 'Homologado pela JISO') {
              await base44.entities.Atestado.update(aid, {
                status_jiso: 'Aguardando JISO',
                status_publicacao: 'Aguardando Nota',
              });
            }
          }
        }

        return base44.entities.PublicacaoExOfficio.delete(id);
      }

      if (tipo === 'livro') {
        const isApostila = registro?.tipo === 'Apostila';
        const isTSE = registro?.tipo === 'Tornar sem Efeito';

        if (isApostila || isTSE) {
          await reverterVinculo(isApostila, isTSE, registro?.publicacao_referencia_id, registro?.publicacao_referencia_origem_tipo);
          return base44.entities.RegistroLivro.delete(id);
        }

        if (isFeriasOperacional(registro)) {
          const feriasList = await base44.entities.Ferias.filter({ id: registro.ferias_id });
          const feriasAtual = feriasList[0];

          if (!feriasAtual) {
            return base44.entities.RegistroLivro.delete(id);
          }

          const registrosDaFerias = (await base44.entities.RegistroLivro.filter({ ferias_id: registro.ferias_id }))
            .filter(r => TIPOS_FERIAS.includes(r.tipo_registro))
            .sort(compareEventos);

          const idx = registrosDaFerias.findIndex(r => r.id === id);
          if (idx === -1) {
            return base44.entities.RegistroLivro.delete(id);
          }

          const posteriores = registrosDaFerias.slice(idx + 1);
          const posterioresPublicados = posteriores.filter(r => calcStatus(r) === 'Publicado');

          if (posterioresPublicados.length > 0) {
            throw new Error(
              'Há registros posteriores já publicados nesta cadeia. Exclua ou trate os eventos mais recentes antes de remover este item.'
            );
          }

          const idsParaExcluir = registrosDaFerias.slice(idx).map(r => r.id);

          for (const rid of idsParaExcluir.reverse()) {
            try {
              await base44.entities.RegistroLivro.delete(rid);
            } catch (error) {
              const msg = String(error?.message || error || '');
              if (!msg.toLowerCase().includes('not found')) {
                throw error;
              }
            }
          }

          const remainingOps = registrosDaFerias.filter(r => !idsParaExcluir.includes(r.id));
          const novoEstado = buildFeriasStateFromChain(feriasAtual, remainingOps);

          await base44.entities.Ferias.update(feriasAtual.id, novoEstado);
          return;
        }

        return base44.entities.RegistroLivro.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
    },
    onError: (error) => {
      alert(error?.message || 'Erro ao excluir registro.');
    }
  });

  const filteredRegistros = useMemo(() => {
    return registros.filter((r) => {
      const matchesStatus =
        statusFilter === 'all' || r.status_calculado === statusFilter;

      const termo = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !termo ||
        r.militar_nome?.toLowerCase().includes(termo) ||
        r.militar_matricula?.toLowerCase().includes(termo) ||
        r.numero_bg?.toLowerCase().includes(termo) ||
        r.nota_para_bg?.toLowerCase().includes(termo) ||
        r.tipo?.toLowerCase().includes(termo) ||
        r.tipo_registro?.toLowerCase().includes(termo) ||
        r.tipo_display?.toLowerCase().includes(termo) ||
        r.grupo_display?.toLowerCase().includes(termo) ||
        r.tipo_composto_display?.toLowerCase().includes(termo);

      return matchesStatus && matchesSearch;
    });
  }, [registros, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: registros.length,
      aguardandoNota: registros.filter(r => r.status_calculado === 'Aguardando Nota').length,
      aguardandoPublicacao: registros.filter(r => r.status_calculado === 'Aguardando Publicação').length,
      publicados: registros.filter(r => r.status_calculado === 'Publicado').length
    };
  }, [registros]);

  const handleUpdate = (id, data, tipo) => {
    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    if (tipo === 'atestado') {
      alert('Atestados não podem ser excluídos pelo Controle de Publicações. Acesse o módulo de Atestados.');
      return;
    }

    if (registro.status_calculado === 'Publicado') {
      if (registro.tipo !== 'Apostila' && registro.tipo !== 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
      if (registro.tipo === 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
    }

    deleteMutation.mutate({ id, tipo, registro });
  };

  const grupos = [
    {
      key: 'Aguardando Nota',
      label: 'Aguardando Nota',
      color: 'text-amber-700',
      border: 'border-amber-300',
      bg: 'bg-amber-50'
    },
    {
      key: 'Aguardando Publicação',
      label: 'Aguardando Publicação',
      color: 'text-blue-700',
      border: 'border-blue-300',
      bg: 'bg-blue-50'
    },
    {
      key: 'Publicado',
      label: 'Publicado',
      color: 'text-emerald-700',
      border: 'border-emerald-300',
      bg: 'bg-emerald-50'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Publicações</h1>
          <p className="text-slate-500">Controle de notas e boletins gerais</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.aguardandoNota}</p>
                  <p className="text-xs text-slate-500">Aguardando Nota</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.aguardandoPublicacao}</p>
                  <p className="text-xs text-slate-500">Aguardando Publ.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{stats.publicados}</p>
                  <p className="text-xs text-slate-500">Publicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-slate-200"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                <SelectItem value="Publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">
          {filteredRegistros.length} registro(s) encontrado(s)
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRegistros.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-slate-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Os registros de publicação aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo) => {
              const items = filteredRegistros.filter(r => r.status_calculado === grupo.key);
              if (items.length === 0) return null;

              return (
                <div key={grupo.key}>
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${grupo.border} ${grupo.bg}`}>
                    <span className={`font-bold text-sm ${grupo.color}`}>{grupo.label}</span>
                    <span className={`text-xs ${grupo.color} opacity-70`}>
                      — {items.length} registro(s)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {items.map((registro) => (
                      <PublicacaoCard
                        key={registro.id}
                        registro={registro}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onVerFamilia={() => setFamiliaPanel({ open: true, registro })}
                        todosRegistros={registros}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {familiaPanel.open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setFamiliaPanel({ open: false, registro: null })}
          />
          <FamiliaPublicacaoPanel
            registro={familiaPanel.registro}
            todosRegistros={registros}
            onClose={() => setFamiliaPanel({ open: false, registro: null })}
          />
        </>
      )}
    </div>
  );
}