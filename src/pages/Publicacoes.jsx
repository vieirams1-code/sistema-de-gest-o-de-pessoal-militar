import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Shield, Plus, Search } from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';
import FamiliaPublicacaoPanel from '@/components/publicacao/FamiliaPublicacaoPanel';

import {
  calcStatusPublicacao,
  reverterAtestadosPorExclusaoPublicacao,
} from '@/components/atestado/atestadoPublicacaoHelpers';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';
import {
  montarCadeia,
  identificarDescendentes,
  executarExclusaoAdminCadeia,
} from '@/components/ferias/feriasAdminUtils';
import { reconciliarCadeiaFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';

const TIPOS_FERIAS = [
  'Saída Férias',
  'Interrupção de Férias',
  'Nova Saída / Retomada',
  'Retorno Férias',
];

function detectarOrigemTipo(registro) {
  if (registro.origem_tipo) return registro.origem_tipo;
  if (registro.tipo_label || registro.status_codigo || registro.origem) return 'livro';
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

function mapStatusContratoParaControle(statusCodigo) {
  if (statusCodigo === 'gerada') return 'Publicado';
  if (statusCodigo === 'aguardando_publicacao') return 'Aguardando Publicação';
  if (statusCodigo === 'aguardando_nota') return 'Aguardando Nota';
  if (statusCodigo === 'inconsistente') return 'Inconsistente';
  return 'Aguardando Nota';
}

function mapTipoCodigoParaTipoRegistro(tipoCodigo, fallbackLabel = '') {
  const mapa = {
    saida_ferias: 'Saída Férias',
    interrupcao_de_ferias: 'Interrupção de Férias',
    nova_saida_retomada: 'Nova Saída / Retomada',
    retorno_ferias: 'Retorno Férias',
  };

  return mapa[tipoCodigo] || fallbackLabel;
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
  const origemTipo = detectarOrigemTipo(registro);
  const tipoRegistroLivro = mapTipoCodigoParaTipoRegistro(registro.tipo_codigo, registro.tipo_label);
  const tipoBase = origemTipo === 'livro'
    ? (tipoRegistroLivro || registro.tipo_label || registro.tipo || '')
    : (registro.tipo_registro || registro.tipo || '');
  const tipoDisplay = getTipoDisplay(tipoBase);
  const grupoDisplay = getGrupoDisplay({ ...registro, tipo_registro: tipoBase });
  const tipoCompostoDisplay = grupoDisplay
    ? `${grupoDisplay} • ${tipoDisplay}`
    : tipoDisplay;

  return {
    ...registro,
    origem_tipo: origemTipo,
    status_calculado: registro.status_calculado || (origemTipo === 'livro'
      ? mapStatusContratoParaControle(registro.status_codigo)
      : calcStatusPublicacao(registro)),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: tipoCompostoDisplay,
    tipo: origemTipo === 'livro' ? (registro.tipo_label || registro.tipo) : registro.tipo,
    tipo_registro: origemTipo === 'livro' ? tipoBase : registro.tipo_registro,
    militar_nome: origemTipo === 'livro' ? (registro?.militar?.nome_guerra || registro?.militar_nome) : registro.militar_nome,
    militar_nome_exibicao: origemTipo === 'livro'
      ? (registro?.militar?.nome_guerra || registro?.militar_nome || registro?.militar?.nome_completo)
      : (registro.militar_nome || registro.nome_guerra || registro.nome_exibicao),
    militar_posto: origemTipo === 'livro'
      ? (registro?.militar?.posto_graduacao || registro?.militar_posto)
      : (registro.militar_posto || registro.posto_graduacao),
    militar_quadro: origemTipo === 'livro'
      ? (registro?.militar?.quadro || registro?.militar_quadro)
      : (registro.militar_quadro || registro.quadro),
    militar_matricula: origemTipo === 'livro' ? (registro?.militar?.matricula || registro?.militar_matricula) : registro.militar_matricula,
    militar_id: origemTipo === 'livro' ? (registro?.militar?.id || registro?.militar_id) : registro.militar_id,
    created_date: origemTipo === 'livro' ? (registro?.detalhes?.criado_em_iso || registro.created_date) : registro.created_date,
    data_registro: origemTipo === 'livro' ? (registro.data_inicio_iso || registro.data_registro) : registro.data_registro,
    ferias_id: origemTipo === 'livro' ? (registro?.vinculos?.ferias?.id || registro.ferias_id) : registro.ferias_id,
    nota_para_bg: origemTipo === 'livro' ? (registro?.publicacao?.nota_para_bg || registro.nota_para_bg || '') : (registro.nota_para_bg || ''),
    numero_bg: origemTipo === 'livro' ? (registro?.publicacao?.numero_bg || registro.numero_bg || '') : (registro.numero_bg || ''),
    data_bg: origemTipo === 'livro' ? (registro?.publicacao?.data_bg || registro.data_bg || '') : (registro.data_bg || ''),
    detalhes_contrato: origemTipo === 'livro' ? (registro?.detalhes || null) : registro.detalhes_contrato,
    vinculos_contrato: origemTipo === 'livro' ? (registro?.vinculos || null) : registro.vinculos_contrato,
    publicacao_contrato: origemTipo === 'livro' ? (registro?.publicacao || null) : registro.publicacao_contrato,
    inconsistencia_contrato: origemTipo === 'livro' ? (registro?.inconsistencia || null) : registro.inconsistencia_contrato,
    cadeia_eventos_contrato: origemTipo === 'livro' ? (registro?.cadeia_eventos || []) : (registro.cadeia_eventos_contrato || []),
  };
}

function montarPayloadAtualizacao(registroAtual, dataParcial, tipo) {
  const registroBase = registroAtual || {};
  const payloadParcial = dataParcial || {};
  const registroMesclado = { ...registroBase, ...payloadParcial };

  const houveAlteracaoCamposPublicacao =
    Object.prototype.hasOwnProperty.call(payloadParcial, 'nota_para_bg') ||
    Object.prototype.hasOwnProperty.call(payloadParcial, 'numero_bg') ||
    Object.prototype.hasOwnProperty.call(payloadParcial, 'data_bg');

  if (!houveAlteracaoCamposPublicacao) {
    return payloadParcial;
  }

  const statusCalculado = calcStatusPublicacao(registroMesclado);

  if (tipo === 'atestado') {
    return {
      ...payloadParcial,
      status_publicacao: statusCalculado,
    };
  }

  return {
    ...payloadParcial,
    status: statusCalculado,
  };
}

function getEventDate(registro) {
  return registro?.data_registro || registro?.data_inicio || registro?.data_inicio_iso || null;
}

function isFeriasOperacional(registro) {
  return (
    detectarOrigemTipo(registro) === 'livro' &&
    !!(registro.ferias_id || registro?.vinculos?.ferias?.id) &&
    (
      TIPOS_FERIAS.includes(registro.tipo_registro) ||
      ['saida_ferias', 'interrupcao_de_ferias', 'nova_saida_retomada', 'retorno_ferias'].includes(registro.tipo_codigo)
    )
  );
}


export default function Publicacoes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, registro: null });

  const { data: contratoLivro, isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: getLivroRegistrosContrato
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

  const registrosLivro = useMemo(() => contratoLivro?.registros_livro || [], [contratoLivro]);

  const registros = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map(normalizarRegistro)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, tipo }) => {
      const registroAtual = registros.find((item) => item.id === id);
      const payloadFinal = montarPayloadAtualizacao(registroAtual, data, tipo);

      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, payloadFinal);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, payloadFinal);

      await base44.entities.RegistroLivro.update(id, payloadFinal);
      if (isFeriasOperacional(registroAtual)) {
        await reconciliarCadeiaFerias({ feriasId: registroAtual.ferias_id });
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
      queryClient.invalidateQueries({ queryKey: ['ferias'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['conciliacao-atestados-publicacao'] });
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

        const payload = { ...(origemTipo === 'atestado' ? {} : { status: calcStatusPublicacao(original) }) };

        if (isApostila) {
          payload.apostilada_por_id = null;
          payload.foi_apostilada = false;
        }
        if (isTSE) {
          payload.tornada_sem_efeito_por_id = null;
          payload.foi_tornada_sem_efeito = false;
        }

        if (origemTipo === 'atestado') {
          payload.status_publicacao = calcStatusPublicacao(original);
        }

        await entityOriginal.update(refId, payload);
      };

      if (tipo === 'ex-officio') {
        const isApostila = registro.tipo === 'Apostila';
        const isTSE = registro.tipo === 'Tornar sem Efeito';

        if (isApostila || isTSE) {
          const refId = registro.publicacao_referencia_id;
          const origemTipoHint = registro.publicacao_referencia_origem_tipo || null;
          await reverterVinculo(isApostila, isTSE, refId, origemTipoHint);
        }

        await reverterAtestadosPorExclusaoPublicacao(
          registro,
          base44.entities.Atestado,
          base44.entities.PublicacaoExOfficio
        );


        return base44.entities.PublicacaoExOfficio.delete(id);
      }

      if (tipo === 'livro') {
        if (isFeriasOperacional(registro)) {
          const feriasList = await base44.entities.Ferias.filter({ id: registro.ferias_id });
          const feriasAtual = feriasList[0];

          if (!feriasAtual) {
            return base44.entities.RegistroLivro.delete(id);
          }

          const allOpsBruto = await base44.entities.RegistroLivro.filter({ ferias_id: registro.ferias_id }, 'data_registro');
          const allOps = allOpsBruto.filter(op => TIPOS_FERIAS.includes(op.tipo_registro));
          const cadeia = montarCadeia(feriasAtual, allOps);
          const eventoAlvo = cadeia.find((e) => e.id === id) || registro;
          const descendentes = identificarDescendentes(eventoAlvo, cadeia);

          const descendentesPublicados = descendentes.filter((d) => calcStatusPublicacao(d) === 'Publicado');
          if (descendentesPublicados.length > 0) {
            throw new Error('Não é possível excluir este registro porque existem eventos posteriores já publicados na cadeia de férias.');
          }

          await executarExclusaoAdminCadeia({
            ferias: feriasAtual,
            eventoAlvo,
            incluirDescendentes: descendentes.length > 0,
            cadeia,
            queryClient,
          });

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
      queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
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
      publicados: registros.filter(r => r.status_calculado === 'Publicado').length,
      inconsistentes: registros.filter(r => r.status_calculado === 'Inconsistente').length
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
    {
      key: 'Inconsistente',
      label: 'Inconsistente',
      color: 'text-red-700',
      border: 'border-red-300',
      bg: 'bg-red-50'
    },
  ];

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
          <div className="flex items-start gap-3">
            <div className="hidden sm:flex h-12 w-12 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-500 shadow-sm">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Controle de Publicações</h1>
              <p className="text-sm text-slate-500 mt-1">Análise, validação, rastreabilidade e integridade de atos administrativos.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 pl-10 border-slate-200 bg-slate-50/60"
              />
            </div>

            <div className="flex gap-3 lg:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 min-w-52 bg-white border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                  <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                  <SelectItem value="Publicado">Publicado</SelectItem>
                  <SelectItem value="Inconsistente">Inconsistente</SelectItem>
                </SelectContent>
              </Select>

              <button className="inline-flex items-center gap-2 px-4 h-11 bg-[#2258d9] text-white rounded-xl text-sm font-semibold hover:bg-[#1f4fc5] transition-colors">
                <Plus size={16} /> Nova Publicação
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{filteredRegistros.length} registro(s) encontrado(s)</span>
            <span className="hidden md:inline">Filtros Ativos</span>
          </div>
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
                  <div className={`inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full border ${grupo.border} ${grupo.bg}`}>
                    <span className={`font-bold text-sm uppercase ${grupo.color}`}>{grupo.label}</span>
                    <span className={`text-xs ${grupo.color} opacity-70`}>
                      | {items.length} registro(s)
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
