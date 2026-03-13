import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Plus,
  ChevronDown
} from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';
import FamiliaPublicacaoPanel from '@/components/publicacao/FamiliaPublicacaoPanel';
import { addDays, differenceInDays, format } from 'date-fns';
import {
  calcStatusPublicacao,
  reverterAtestadosPorExclusaoPublicacao,
} from '@/components/atestado/atestadoPublicacaoHelpers';
import { getLivroRegistrosContrato } from '@/components/livro/livroService';

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

function abreviarPostoGraduacao(valor) {
  const mapa = {
    'Coronel': 'Cel',
    'Tenente Coronel': 'TC',
    'Major': 'Maj',
    'Capitão': 'Cap',
    '1º Tenente': '1º Ten',
    '2º Tenente': '2º Ten',
    'Aspirante': 'Asp',
    'Subtenente': 'ST',
    '1º Sargento': '1º Sgt',
    '2º Sargento': '2º Sgt',
    '3º Sargento': '3º Sgt',
    'Cabo': 'Cb',
    'Soldado': 'Sd',
  };

  return mapa[valor] || valor || '';
}

function montarNomeInstitucional({ postoGraduacao, quadro, nomeExibicao }) {
  return [postoGraduacao, quadro, nomeExibicao].filter(Boolean).join(' ').trim();
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

  const militarContrato = registro?.militar || {};
  const militarNome = origemTipo === 'livro'
    ? (militarContrato?.nome_guerra || militarContrato?.nome || registro?.militar_nome || '')
    : (registro?.militar_nome || registro?.nome_guerra || registro?.nome || '');

  const postoGraduacaoBruto = origemTipo === 'livro'
    ? (militarContrato?.posto_graduacao || militarContrato?.posto || militarContrato?.graduacao || '')
    : (registro?.militar_posto_graduacao || registro?.posto_graduacao || registro?.posto || registro?.graduacao || '');

  const quadro = origemTipo === 'livro'
    ? (militarContrato?.quadro || '')
    : (registro?.militar_quadro || registro?.quadro || '');

  const postoGraduacao = abreviarPostoGraduacao(postoGraduacaoBruto);

  const integridadeStatus =
    registro?.inconsistencia?.motivo_curto ||
    registro?.inconsistencia_contrato?.motivo_curto ||
    registro?.status_codigo === 'inconsistente'
      ? 'inconsistente'
      : 'ok';

  const integridadeMensagem =
    registro?.inconsistencia?.detalhe ||
    registro?.inconsistencia_contrato?.detalhe ||
    registro?.inconsistencia?.motivo_curto ||
    registro?.inconsistencia_contrato?.motivo_curto ||
    '';

  return {
    ...registro,
    origem_tipo: origemTipo,
    status_calculado: registro.status_calculado || (
      origemTipo === 'livro'
        ? mapStatusContratoParaControle(registro.status_codigo)
        : calcStatusPublicacao(registro)
    ),
    tipo_display: tipoDisplay,
    grupo_display: grupoDisplay,
    tipo_composto_display: tipoCompostoDisplay,
    tipo: origemTipo === 'livro' ? (registro.tipo_label || registro.tipo) : registro.tipo,
    tipo_registro: origemTipo === 'livro' ? tipoBase : registro.tipo_registro,
    militar_nome: militarNome,
    militar_matricula: origemTipo === 'livro'
      ? (militarContrato?.matricula || registro?.militar_matricula || '')
      : (registro?.militar_matricula || ''),
    militar_id: origemTipo === 'livro'
      ? (militarContrato?.id || registro?.militar_id)
      : registro?.militar_id,
    militar_posto_graduacao: postoGraduacao,
    militar_quadro: quadro,
    militar_nome_institucional: montarNomeInstitucional({
      postoGraduacao,
      quadro,
      nomeExibicao: militarNome,
    }),
    created_date: origemTipo === 'livro'
      ? (registro?.detalhes?.criado_em_iso || registro.created_date)
      : registro.created_date,
    data_registro: origemTipo === 'livro'
      ? (registro.data_inicio_iso || registro.data_registro)
      : registro.data_registro,
    ferias_id: origemTipo === 'livro'
      ? (registro?.vinculos?.ferias?.id || registro.ferias_id)
      : registro.ferias_id,
    nota_para_bg: origemTipo === 'livro'
      ? (registro?.publicacao?.nota_para_bg || registro.nota_para_bg || '')
      : (registro.nota_para_bg || ''),
    numero_bg: origemTipo === 'livro'
      ? (registro?.publicacao?.numero_bg || registro.numero_bg || '')
      : (registro.numero_bg || ''),
    data_bg: origemTipo === 'livro'
      ? (registro?.publicacao?.data_bg || registro.data_bg || '')
      : (registro.data_bg || ''),
    detalhes_contrato: origemTipo === 'livro' ? (registro?.detalhes || null) : registro.detalhes_contrato,
    vinculos_contrato: origemTipo === 'livro' ? (registro?.vinculos || null) : registro.vinculos_contrato,
    publicacao_contrato: origemTipo === 'livro' ? (registro?.publicacao || null) : registro.publicacao_contrato,
    inconsistencia_contrato: origemTipo === 'livro' ? (registro?.inconsistencia || null) : registro.inconsistencia_contrato,
    cadeia_eventos_contrato: origemTipo === 'livro'
      ? (registro?.cadeia_eventos || [])
      : (registro.cadeia_eventos_contrato || []),
    integridade_status: integridadeStatus,
    integridade_mensagem: integridadeMensagem,
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

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function toDateOnly(date) {
  return format(date, 'yyyy-MM-dd');
}

function getEventDate(registro) {
  return registro?.data_registro || registro?.data_inicio || registro?.data_inicio_iso || null;
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
    !!(registro.ferias_id || registro?.vinculos?.ferias?.id) &&
    (
      TIPOS_FERIAS.includes(registro.tipo_registro) ||
      ['saida_ferias', 'interrupcao_de_ferias', 'nova_saida_retomada', 'retorno_ferias'].includes(registro.tipo_codigo)
    )
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
  const navigate = useNavigate();
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
    mutationFn: ({ id, data, tipo }) => {
      const registroAtual = registros.find((item) => item.id === id);
      const payloadFinal = montarPayloadAtualizacao(registroAtual, data, tipo);

      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, payloadFinal);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, payloadFinal);
      return base44.entities.RegistroLivro.update(id, payloadFinal);
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
          const feriasAtual = await base44.entities.Ferias.get(registro.ferias_id);
          const allOpsBruto = await base44.entities.RegistroLivro.filter({ ferias_id: registro.ferias_id }, 'data_registro');
          const allOps = allOpsBruto
            .filter(op => TIPOS_FERIAS.includes(op.tipo_registro))
            .sort(compareEventos);

          const remainingOps = allOps.filter(op => op.id !== id);

          if (!remainingOps.length) {
            await base44.entities.Ferias.update(feriasAtual.id, {
              status: 'Prevista',
              saldo_remanescente: null,
              dias_gozados_interrupcao: null,
              data_interrupcao: null,
            });
            return base44.entities.RegistroLivro.delete(id);
          }

          const novoEstado = buildFeriasStateFromChain(feriasAtual, remainingOps);

          await base44.entities.Ferias.update(feriasAtual.id, novoEstado);
          return base44.entities.RegistroLivro.delete(id);
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
        r.militar_nome_institucional?.toLowerCase().includes(termo) ||
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
      label: 'AGUARDANDO NOTA',
      color: 'text-amber-800',
      border: 'border-amber-300',
      bg: 'bg-amber-50'
    },
    {
      key: 'Aguardando Publicação',
      label: 'AGUARDANDO PUBLICAÇÃO',
      color: 'text-blue-800',
      border: 'border-blue-300',
      bg: 'bg-blue-50'
    },
    {
      key: 'Publicado',
      label: 'PUBLICADO',
      color: 'text-emerald-800',
      border: 'border-emerald-300',
      bg: 'bg-emerald-50'
    },
    {
      key: 'Inconsistente',
      label: 'INCONSISTENTE',
      color: 'text-red-800',
      border: 'border-red-300',
      bg: 'bg-red-50'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-4 py-6 lg:px-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 pl-11 border-slate-300 bg-white rounded-xl shadow-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-[170px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white shadow-sm">
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
              </div>

              <Button
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                onClick={() => navigate(createPageUrl('CadastrarPublicacao'))}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Publicação
              </Button>
            </div>
          </div>

          <div className="text-sm font-medium text-slate-500">
            {filteredRegistros.length} registro(s) encontrado(s)
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#1e3a5f]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{stats.aguardandoNota}</p>
                    <p className="text-xs text-slate-500">Aguardando Nota</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{stats.aguardandoPublicacao}</p>
                    <p className="text-xs text-slate-500">Aguardando Publ.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
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

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRegistros.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
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
                    <div className={`inline-flex items-center gap-3 mb-4 px-5 py-3 rounded-full border ${grupo.border} ${grupo.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${grupo.key === 'Aguardando Nota' ? 'bg-amber-400' : grupo.key === 'Aguardando Publicação' ? 'bg-blue-400' : grupo.key === 'Publicado' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                      <span className={`font-bold text-sm tracking-wide ${grupo.color}`}>{grupo.label}</span>
                      <span className={`text-sm ${grupo.color} opacity-80`}>{items.length} registro(s)</span>
                    </div>

                    <div className="space-y-4">
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