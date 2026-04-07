import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import FolhaAlteracoesDocumento from '@/components/folha-alteracoes/FolhaAlteracoesDocumento';
import { montarLinhaAssinatura } from '@/components/folha-alteracoes/postoGraduacao';
import { Check, ChevronsUpDown, FileSpreadsheet, Printer, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];
const TIPOS_PERIODO = {
  DATAS_COMPLETAS: 'datas-completas',
  MES_ANO: 'mes-ano',
};

function formatarData(isoDate) {
  if (!isoDate) return '-';
  const [ano, mes, dia] = String(isoDate).split('-');
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataExtensa(isoDate) {
  if (!isoDate) return '';
  const [ano, mes, dia] = String(isoDate).split('-').map(Number);
  if (!ano || !mes || !dia) return String(isoDate);
  const dateObj = new Date(Date.UTC(ano, mes - 1, dia));
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function obterLocalFechamento(militar) {
  const cidade = String(
    militar?.cidade ||
    militar?.municipio ||
    militar?.naturalidade ||
    militar?.cidade_lotacao ||
    ''
  ).trim();
  const uf = String(militar?.uf || militar?.estado || militar?.naturalidade_uf || '').trim();

  if (cidade && uf) return `${cidade}/${uf}`;
  if (cidade) return cidade;
  if (uf) return uf;
  return '';
}

function getTextoOficialRegistro(item) {
  const camposPreferenciais = [
    'texto_publicacao',
    'texto_renderizado',
    'texto_oficial',
    'texto_base',
    'texto_complemento',
    'nota_para_bg',
    'observacoes',
    'descricao',
    'historico',
    'resumo',
  ];

  for (const campo of camposPreferenciais) {
    const valor = item?.[campo];
    if (typeof valor === 'string' && valor.trim()) {
      return valor.trim();
    }
  }

  return '';
}

function normalizarDataISO(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    return null;
  }

  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return null;
  const ano = dateObj.getFullYear();
  const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dateObj.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function toText(value) {
  return String(value || '').trim();
}

function extrairDadosBg(item = {}) {
  const numero = toText(item?.numero_bg || item?.boletim_numero);
  const data = normalizarDataISO(item?.data_bg || item?.boletim_data);
  return {
    numero,
    data,
    completo: Boolean(numero && data),
  };
}

function statusPublicado(item = {}) {
  return toText(item?.status) === 'Publicado';
}

function registroPublicadoEmBg(item = {}) {
  const bg = extrairDadosBg(item);
  return statusPublicado(item) && bg.completo;
}

function montarReferenciaBoletim(item = {}) {
  const bg = extrairDadosBg(item);
  if (!bg.completo) return '';
  return `Boletim ${bg.numero}, de ${formatarData(bg.data)}`;
}

function listarMesesNoPeriodo(dataInicial, dataFinal) {
  if (!dataInicial || !dataFinal || dataInicial > dataFinal) return [];

  const [anoInicio, mesInicio] = dataInicial.split('-').map(Number);
  const [anoFim, mesFim] = dataFinal.split('-').map(Number);

  const itens = [];
  let anoAtual = anoInicio;
  let mesAtual = mesInicio;

  while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
    itens.push({
      ano: anoAtual,
      mes: mesAtual,
      chave: `${anoAtual}-${String(mesAtual).padStart(2, '0')}`,
      titulo: `MÊS DE ${MESES[mesAtual - 1]}/${anoAtual}`,
    });

    mesAtual += 1;
    if (mesAtual > 12) {
      mesAtual = 1;
      anoAtual += 1;
    }
  }

  return itens;
}

function toAnoMesTexto(ano, mes) {
  if (!ano || !mes) return '';
  return `${String(mes).padStart(2, '0')}/${ano}`;
}

function converterMesAnoParaPeriodo({ mesInicial, anoInicial, mesFinal, anoFinal }) {
  if (!mesInicial || !anoInicial || !mesFinal || !anoFinal) {
    return { dataInicial: '', dataFinal: '', valido: false, descricaoSelecao: '' };
  }

  const primeiroDia = `${anoInicial}-${String(mesInicial).padStart(2, '0')}-01`;
  const ultimoDiaMesFinal = new Date(Date.UTC(Number(anoFinal), Number(mesFinal), 0)).getUTCDate();
  const ultimoDia = `${anoFinal}-${String(mesFinal).padStart(2, '0')}-${String(ultimoDiaMesFinal).padStart(2, '0')}`;
  const valido = primeiroDia <= ultimoDia;

  return {
    dataInicial: primeiroDia,
    dataFinal: ultimoDia,
    valido,
    descricaoSelecao: `${toAnoMesTexto(anoInicial, mesInicial)} a ${toAnoMesTexto(anoFinal, mesFinal)}`,
  };
}

function agruparHistoricoPorAnoMes(eventos, dataInicial, dataFinal) {
  const meses = listarMesesNoPeriodo(dataInicial, dataFinal);
  const agrupadoPorAno = new Map();

  meses.forEach((mesInfo) => {
    if (!agrupadoPorAno.has(mesInfo.ano)) {
      agrupadoPorAno.set(mesInfo.ano, []);
    }

    const eventosDoMes = eventos
      .filter((evento) => {
        if (!evento?.data) return false;
        return evento.data.startsWith(mesInfo.chave);
      })
      .sort((a, b) => a.data.localeCompare(b.data));

    agrupadoPorAno.get(mesInfo.ano).push({
      ...mesInfo,
      eventos: eventosDoMes,
    });
  });

  return Array.from(agrupadoPorAno.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ano, mesesDoAno]) => ({ ano, meses: mesesDoAno }));
}

function getEntitySafe(entityName) {
  return base44?.entities?.[entityName] || null;
}

function getStorageKey(user) {
  const identificador = user?.id || user?.email || 'anonimo';
  return `sgp:folha-alteracoes:impressao:${identificador}`;
}

function getDefaultImpressaoConfig() {
  return {
    cabecalhoLinha3: '',
    cabecalhoLinha4: '',
    signatarioId: '',
    cargoFuncao: '',
    localAssinatura: '',
  };
}

function carregarConfigImpressao(user) {
  if (typeof window === 'undefined') return getDefaultImpressaoConfig();

  try {
    const bruto = window.localStorage.getItem(getStorageKey(user));
    if (!bruto) return getDefaultImpressaoConfig();
    const parsed = JSON.parse(bruto);
    return {
      cabecalhoLinha3: String(parsed?.cabecalhoLinha3 || ''),
      cabecalhoLinha4: String(parsed?.cabecalhoLinha4 || ''),
      signatarioId: String(parsed?.signatarioId || ''),
      cargoFuncao: String(parsed?.cargoFuncao || ''),
      localAssinatura: String(parsed?.localAssinatura || ''),
    };
  } catch (error) {
    return getDefaultImpressaoConfig();
  }
}

async function listarPorMilitar(entityName, militarId, sort) {
  const entity = getEntitySafe(entityName);
  if (!entity?.filter) return [];

  const tentativas = [
    { militar_id: militarId },
    { militarId: militarId },
  ];

  for (const filtro of tentativas) {
    try {
      const resultado = await entity.filter(filtro, sort);
      if (Array.isArray(resultado) && resultado.length > 0) {
        return resultado;
      }
    } catch (error) {
      // continua para fallback
    }
  }

  try {
    const lista = await entity.list(sort, 2000);
    if (!Array.isArray(lista)) return [];
    return lista.filter((item) => {
      const militarRef = item?.militar_id || item?.militarId || item?.militar?.id || item?.militar;
      return String(militarRef || '') === String(militarId || '');
    });
  } catch (error) {
    return [];
  }
}

export default function FolhaAlteracoes() {
  const {
    user,
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasSelfAccess,
    canAccessModule,
    getMilitarScopeFilters,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();

  const [filtroMilitarId, setFiltroMilitarId] = useState('');
  const [tipoPeriodo, setTipoPeriodo] = useState(TIPOS_PERIODO.DATAS_COMPLETAS);
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [mesInicial, setMesInicial] = useState('');
  const [anoInicial, setAnoInicial] = useState('');
  const [mesFinal, setMesFinal] = useState('');
  const [anoFinal, setAnoFinal] = useState('');
  const [previa, setPrevia] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [signatarioPopoverOpen, setSignatarioPopoverOpen] = useState(false);
  const [buscaSignatario, setBuscaSignatario] = useState('');
  const [impressaoConfig, setImpressaoConfig] = useState(getDefaultImpressaoConfig());

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['folha-alteracoes-militares', isAdmin, subgrupamentoId, subgrupamentoTipo, modoAcesso, userEmail, linkedMilitarId, linkedMilitarEmail],
    queryFn: async () => {
      if (isAdmin) {
        const listaAdmin = await base44.entities.Militar.list('-nome_completo');
        return listaAdmin.filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, '-nome_completo'));
        for (const email of knownEmails) {
          requests.push(base44.entities.Militar.filter({ email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ created_by: email }, '-nome_completo'));
          requests.push(base44.entities.Militar.filter({ militar_email: email }, '-nome_completo'));
        }

        const batches = await Promise.all(requests);
        const ids = new Set();
        return batches
          .flat()
          .filter((m) => m.status_cadastro !== 'Inativo')
          .filter((m) => {
            if (!hasSelfAccess(m) || ids.has(m.id)) return false;
            ids.add(m.id);
            return true;
          });
      }

      const filters = getMilitarScopeFilters();
      if (!filters.length) return [];

      const requests = filters.map((filtro) => base44.entities.Militar.filter(filtro, '-nome_completo'));
      const batches = await Promise.all(requests);
      const ids = new Set();
      return batches
        .flat()
        .filter((m) => m.status_cadastro !== 'Inativo')
        .filter((m) => {
          if (ids.has(m.id)) return false;
          ids.add(m.id);
          return true;
        });
    },
    enabled: isAccessResolved,
  });

  const militaresOrdenados = useMemo(
    () => [...militares].sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || '')),
    [militares]
  );

  const militarSelecionado = useMemo(
    () => militaresOrdenados.find((militar) => militar.id === filtroMilitarId) || null,
    [militaresOrdenados, filtroMilitarId]
  );

  useEffect(() => {
    if (!user?.id && !user?.email) return;
    setImpressaoConfig(carregarConfigImpressao(user));
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user?.id && !user?.email) return;
    window.localStorage.setItem(getStorageKey(user), JSON.stringify(impressaoConfig));
  }, [impressaoConfig, user?.id, user?.email]);

  useEffect(() => {
    if (!impressaoConfig.signatarioId) return;
    const signatarioExiste = militaresOrdenados.some((item) => item.id === impressaoConfig.signatarioId);
    if (!signatarioExiste) {
      setImpressaoConfig((prev) => ({ ...prev, signatarioId: '' }));
    }
  }, [militaresOrdenados, impressaoConfig.signatarioId]);

  const anosDisponiveis = useMemo(() => {
    const anoAtual = new Date().getUTCFullYear();
    return Array.from({ length: 21 }, (_, index) => anoAtual - 10 + index);
  }, []);

  const periodoConvertidoMesAno = useMemo(
    () => converterMesAnoParaPeriodo({ mesInicial, anoInicial, mesFinal, anoFinal }),
    [mesInicial, anoInicial, mesFinal, anoFinal]
  );

  const periodoEfetivo = useMemo(() => {
    if (tipoPeriodo === TIPOS_PERIODO.MES_ANO) {
      return {
        dataInicial: periodoConvertidoMesAno.dataInicial,
        dataFinal: periodoConvertidoMesAno.dataFinal,
        valido: periodoConvertidoMesAno.valido,
        descricaoSelecao: periodoConvertidoMesAno.descricaoSelecao,
        tipo: TIPOS_PERIODO.MES_ANO,
      };
    }

    const valido = Boolean(dataInicial && dataFinal && dataInicial <= dataFinal);
    return {
      dataInicial,
      dataFinal,
      valido,
      descricaoSelecao: '',
      tipo: TIPOS_PERIODO.DATAS_COMPLETAS,
    };
  }, [tipoPeriodo, periodoConvertidoMesAno, dataInicial, dataFinal]);

  const periodoValido = periodoEfetivo.valido;

  const { data: historicoAlteracoes = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ['folha-alteracoes-historico', previa?.militar?.id, previa?.periodo?.dataInicial, previa?.periodo?.dataFinal],
    queryFn: async () => {
      if (!previa?.militar?.id || !previa?.periodo?.dataInicial || !previa?.periodo?.dataFinal) return [];

      const militarId = previa.militar.id;
      const inicioPeriodo = previa.periodo.dataInicial;
      const fimPeriodo = previa.periodo.dataFinal;

      const publicacoes = await listarPorMilitar('PublicacaoExOfficio', militarId, '-data_bg');

      const filtrarPorPeriodo = (data) => Boolean(data && data >= inicioPeriodo && data <= fimPeriodo);

      const eventosPublicacoes = publicacoes
        .map((item) => {
          if (!registroPublicadoEmBg(item)) return null;
          const dataEvento = normalizarDataISO(item.data_bg);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const tipoPublicacao = item.tipo_registro || item.tipo || item.categoria || 'Publicação';
          const textoOficial = getTextoOficialRegistro(item);

          return {
            data: dataEvento,
            tipo: 'Publicação',
            texto: textoOficial,
            referenciaBoletim: montarReferenciaBoletim(item),
            descricao: `${tipoPublicacao} - BG ${item.numero_bg}`,
            origem: 'PublicacaoExOfficio',
          };
        })
        .filter(Boolean);

      return eventosPublicacoes.sort((a, b) => a.data.localeCompare(b.data));
    },
    enabled: !!previa,
  });

  const historicoPorAnoMes = useMemo(() => {
    if (!previa?.periodo?.dataInicial || !previa?.periodo?.dataFinal) return [];
    return agruparHistoricoPorAnoMes(historicoAlteracoes, previa.periodo.dataInicial, previa.periodo.dataFinal);
  }, [historicoAlteracoes, previa]);

  const handleGerarPrevia = () => {
    if (!militarSelecionado || !periodoValido) return;

    setPrevia({
      militar: militarSelecionado,
      periodo: {
        dataInicial: periodoEfetivo.dataInicial,
        dataFinal: periodoEfetivo.dataFinal,
        tipo: periodoEfetivo.tipo,
        descricaoSelecao: periodoEfetivo.descricaoSelecao,
      },
      geradoEm: new Date().toISOString(),
    });
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleExportarPdf = () => {
    window.print();
  };

  const localFechamento = obterLocalFechamento(previa?.militar);
  const dataFechamento = formatarDataExtensa(previa?.periodo?.dataFinal || previa?.geradoEm);
  const signatarioSelecionado = useMemo(
    () => militaresOrdenados.find((militar) => militar.id === impressaoConfig.signatarioId) || null,
    [militaresOrdenados, impressaoConfig.signatarioId]
  );
  const signatarioNome = signatarioSelecionado
    ? String(signatarioSelecionado.nome_completo || signatarioSelecionado.nome_guerra || '').trim()
    : '';
  const signatarioLabel = signatarioSelecionado
    ? `${signatarioSelecionado.posto_graduacao ? `${signatarioSelecionado.posto_graduacao} ` : ''}${signatarioNome}`.trim()
    : '';
  const signatarioLinha1 = signatarioSelecionado
    ? montarLinhaAssinatura(signatarioNome, signatarioSelecionado.posto_graduacao, signatarioSelecionado.quadro)
    : '';
  const signatarioLinha2 = signatarioSelecionado?.matricula
    ? `MATRÍCULA ${String(signatarioSelecionado.matricula).trim()}`
    : '';
  const militaresSignatariosFiltrados = useMemo(() => {
    const termo = buscaSignatario.trim().toLowerCase();
    if (!termo) return militaresOrdenados;
    return militaresOrdenados.filter((militar) => (
      String(militar.nome_completo || '').toLowerCase().includes(termo) ||
      String(militar.nome_guerra || '').toLowerCase().includes(termo) ||
      String(militar.matricula || '').toLowerCase().includes(termo)
    ));
  }, [buscaSignatario, militaresOrdenados]);

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) {
    return <AccessDenied modulo="Efetivo" />;
  }

  return (
    <div className="folha-alteracoes-page min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <style>{`
        @media screen {
          .print-only-document {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 14mm 12mm 16mm 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          .print-only-document,
          .print-only-document * {
            visibility: visible !important;
          }

          body {
            background: #fff !important;
          }

          .folha-alteracoes-page {
            position: static !important;
            background: #fff !important;
          }

          .print-only-document {
            display: block !important;
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #111827 !important;
            font-family: "Times New Roman", Times, serif !important;
            font-size: 11pt !important;
            line-height: 1.3 !important;
          }

          .print-only-document .doc-sheet {
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 0 4mm 0 !important;
            box-shadow: none !important;
          }

          .print-only-document .doc-title {
            letter-spacing: normal !important;
            font-size: 15pt !important;
            margin: 0 !important;
          }

          .print-only-document .doc-subtitle {
            margin: 2mm 0 0 0 !important;
            font-size: 10.5pt !important;
          }

          .print-only-document .doc-grid {
            gap: 1.5mm 4mm !important;
          }

          .print-only-document .doc-row {
            break-inside: avoid-page;
          }

          .print-only-document .doc-section-title {
            margin: 4mm 0 2mm !important;
          }

          .print-only-document .doc-year {
            break-inside: auto !important;
          }

          .print-only-document .doc-month {
            break-inside: avoid-page;
            margin-bottom: 2mm !important;
          }

          .print-only-document .doc-event-list {
            list-style: none !important;
            margin: 1mm 0 0 0 !important;
            padding: 0 !important;
          }

          .print-only-document .doc-event-item {
            display: grid !important;
            grid-template-columns: auto 1fr !important;
            column-gap: 1.5mm !important;
            align-items: start !important;
            margin-top: 1.5mm !important;
            line-height: 1.45 !important;
          }

          .print-only-document .doc-event-marker {
            font-weight: 700 !important;
            white-space: nowrap !important;
          }

          .print-only-document .doc-event-body {
            text-align: justify !important;
            text-justify: inter-word !important;
            white-space: pre-line !important;
            margin: 0 !important;
          }

          .screen-preview,
          .no-print,
          .print-document-card,
          .print-document-content,
          .print-container > :not(.print-only-document) {
            display: none !important;
          }
        }
      `}</style>
      <div className="print-container max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="no-print flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Folha de Alterações</h1>
            <p className="text-slate-500 mt-1">
              Geração e impressão da folha de alterações do militar (versão inicial de prévia em tela).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-slate-300" onClick={() => setConfigOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Configurar impressão
            </Button>
            <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>
        </div>

        <Sheet open={configOpen} onOpenChange={setConfigOpen}>
          <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Configuração da impressão</SheetTitle>
              <SheetDescription>
                Esses dados ficam salvos localmente para o usuário logado e podem ser alterados a qualquer momento.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <h3 className="font-semibold text-slate-800">Cabeçalho</h3>
                <div className="space-y-1">
                  <Label>Linha 1 (fixa)</Label>
                  <Input value="ESTADO DE MATO GROSSO DO SUL" disabled />
                </div>
                <div className="space-y-1">
                  <Label>Linha 2 (fixa)</Label>
                  <Input value="CORPO DE BOMBEIROS MILITAR" disabled />
                </div>
                <div className="space-y-1">
                  <Label>Linha 3 (editável)</Label>
                  <Input
                    value={impressaoConfig.cabecalhoLinha3}
                    onChange={(event) => setImpressaoConfig((prev) => ({ ...prev, cabecalhoLinha3: event.target.value }))}
                    placeholder="Ex.: COMANDO DE ÁREA..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Linha 4 (editável)</Label>
                  <Input
                    value={impressaoConfig.cabecalhoLinha4}
                    onChange={(event) => setImpressaoConfig((prev) => ({ ...prev, cabecalhoLinha4: event.target.value }))}
                    placeholder="Ex.: SUBUNIDADE / SEÇÃO..."
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <h3 className="font-semibold text-slate-800">Assinatura</h3>

                <div className="space-y-2">
                  <Label>Militar signatário</Label>
                  <Popover open={signatarioPopoverOpen} onOpenChange={setSignatarioPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between">
                        <span className="truncate">
                          {signatarioLabel || 'Selecione um militar'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Buscar por nome, guerra ou matrícula..."
                          value={buscaSignatario}
                          onValueChange={setBuscaSignatario}
                        />
                        <CommandEmpty>Nenhum militar encontrado.</CommandEmpty>
                        <CommandGroup className="max-h-72 overflow-auto">
                          {militaresSignatariosFiltrados.map((militar) => {
                            const nome = `${militar.posto_graduacao ? `${militar.posto_graduacao} ` : ''}${militar.nome_completo || militar.nome_guerra || ''}`.trim();
                            return (
                              <CommandItem
                                key={militar.id}
                                value={`${nome} ${militar.matricula || ''}`}
                                onSelect={() => {
                                  setImpressaoConfig((prev) => ({ ...prev, signatarioId: militar.id }));
                                  setSignatarioPopoverOpen(false);
                                  setBuscaSignatario('');
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', impressaoConfig.signatarioId === militar.id ? 'opacity-100' : 'opacity-0')} />
                                <span className="truncate">{nome}{militar.matricula ? ` • Mat ${militar.matricula}` : ''}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label>Cargo/Função do signatário</Label>
                  <Input
                    value={impressaoConfig.cargoFuncao}
                    onChange={(event) => setImpressaoConfig((prev) => ({ ...prev, cargoFuncao: event.target.value }))}
                    placeholder="Ex.: Comandante do 2º SGBM"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Local da assinatura</Label>
                  <Input
                    value={impressaoConfig.localAssinatura}
                    onChange={(event) => setImpressaoConfig((prev) => ({ ...prev, localAssinatura: event.target.value }))}
                    placeholder="Ex.: Campo Grande-MS"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Persistência: localStorage do navegador, isolado por usuário logado.
              </p>
            </div>
          </SheetContent>
        </Sheet>

        <Card className="no-print shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg text-[#1e3a5f]">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm font-medium text-slate-700">Militar</label>
                <Select value={filtroMilitarId} onValueChange={setFiltroMilitarId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingMilitares ? 'Carregando militares...' : 'Selecione um militar'} />
                  </SelectTrigger>
                  <SelectContent>
                    {militaresOrdenados.map((militar) => (
                      <SelectItem key={militar.id} value={militar.id}>
                        {(militar.posto_graduacao ? `${militar.posto_graduacao} ` : '') + (militar.nome_guerra || militar.nome_completo)}
                        {militar.matricula ? ` • Mat ${militar.matricula}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tipo de período</label>
                <Select value={tipoPeriodo} onValueChange={setTipoPeriodo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TIPOS_PERIODO.DATAS_COMPLETAS}>Datas completas</SelectItem>
                    <SelectItem value={TIPOS_PERIODO.MES_ANO}>Mês/Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoPeriodo === TIPOS_PERIODO.DATAS_COMPLETAS ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data inicial</label>
                    <Input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Data final</label>
                    <Input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Mês inicial</label>
                    <Select value={mesInicial} onValueChange={setMesInicial}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, index) => (
                          <SelectItem key={mes} value={String(index + 1).padStart(2, '0')}>
                            {mes}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Ano inicial</label>
                    <Select value={anoInicial} onValueChange={setAnoInicial}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {anosDisponiveis.map((ano) => (
                          <SelectItem key={`ano-inicial-${ano}`} value={String(ano)}>
                            {ano}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Mês final</label>
                    <Select value={mesFinal} onValueChange={setMesFinal}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {MESES.map((mes, index) => (
                          <SelectItem key={`mes-final-${mes}`} value={String(index + 1).padStart(2, '0')}>
                            {mes}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Ano final</label>
                    <Select value={anoFinal} onValueChange={setAnoFinal}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o ano" />
                      </SelectTrigger>
                      <SelectContent>
                        {anosDisponiveis.map((ano) => (
                          <SelectItem key={`ano-final-${ano}`} value={String(ano)}>
                            {ano}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex items-end">
                <Button
                  className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={handleGerarPrevia}
                  disabled={!militarSelecionado || !periodoValido}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Gerar prévia
                </Button>
              </div>
            </div>

            {tipoPeriodo === TIPOS_PERIODO.DATAS_COMPLETAS && !!dataInicial && !!dataFinal && dataInicial > dataFinal && (
              <p className="text-sm text-red-600">A data inicial não pode ser maior que a data final.</p>
            )}

            {tipoPeriodo === TIPOS_PERIODO.MES_ANO && !!mesInicial && !!anoInicial && !!mesFinal && !!anoFinal && !periodoConvertidoMesAno.valido && (
              <p className="text-sm text-red-600">O mês/ano inicial não pode ser maior que o mês/ano final.</p>
            )}

            {tipoPeriodo === TIPOS_PERIODO.MES_ANO && periodoConvertidoMesAno.valido && (
              <p className="text-xs text-slate-500">
                Período convertido automaticamente: {formatarData(periodoConvertidoMesAno.dataInicial)} a {formatarData(periodoConvertidoMesAno.dataFinal)}.
              </p>
            )}
          </CardContent>
        </Card>

        {previa && (
          <Card className="print-document-card shadow-sm border-slate-200">
            <CardHeader className="no-print">
              <CardTitle className="text-lg text-[#1e3a5f]">Prévia da Folha de Alterações</CardTitle>
            </CardHeader>
            <CardContent className="print-document-content space-y-6">
              <div className="no-print flex flex-wrap gap-3">
                <Button
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={handleImprimir}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button
                  variant="outline"
                  className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
                  onClick={handleExportarPdf}
                >
                  Exportar PDF
                </Button>
                <p className="text-xs text-slate-500 self-center">
                  Dica: use o destino &quot;Salvar como PDF&quot; na janela de impressão para gerar o arquivo PDF.
                </p>
              </div>

              <FolhaAlteracoesDocumento
                previa={previa}
                historicoPorAnoMes={historicoPorAnoMes}
                loadingHistorico={loadingHistorico}
                localFechamento={localFechamento}
                dataFechamento={dataFechamento}
                impressaoConfig={{
                  ...impressaoConfig,
                  signatarioLinha1,
                  signatarioLinha2,
                }}
                formatarData={formatarData}
                variant="screen"
              />
            </CardContent>
          </Card>
        )}

        {previa && (
          <section className="print-only-document">
            <FolhaAlteracoesDocumento
              previa={previa}
              historicoPorAnoMes={historicoPorAnoMes}
              loadingHistorico={loadingHistorico}
              localFechamento={localFechamento}
              dataFechamento={dataFechamento}
              impressaoConfig={{
                ...impressaoConfig,
                signatarioLinha1,
                signatarioLinha2,
              }}
              formatarData={formatarData}
              variant="print"
            />
          </section>
        )}
      </div>
    </div>
  );
}
