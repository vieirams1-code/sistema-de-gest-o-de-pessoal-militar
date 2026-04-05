import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, Printer } from 'lucide-react';

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

function formatarData(isoDate) {
  if (!isoDate) return '-';
  const [ano, mes, dia] = String(isoDate).split('-');
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataOuNaoInformado(isoDate) {
  return isoDate ? formatarData(isoDate) : 'Não informado';
}

function valorComFallback(valor, fallback = 'Não informado') {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto ? texto : fallback;
}

function montarNaturalidade(militar) {
  const cidade = String(militar?.naturalidade || '').trim();
  const uf = String(militar?.naturalidade_uf || '').trim();
  if (cidade && uf) return `${cidade}/${uf}`;
  if (cidade) return cidade;
  if (uf) return uf;
  return 'Não informado';
}

function montarIdentidade(militar) {
  const rg = String(militar?.rg || '').trim();
  const orgao = String(militar?.orgao_expedidor_rg || '').trim();
  if (rg && orgao) return `${rg} / ${orgao}`;
  if (rg) return rg;
  if (orgao) return orgao;
  return 'Não informado';
}

function montarTipoSanguineoRh(militar) {
  const tipo = String(militar?.tipo_sanguineo || militar?.tipo_sanguineo_abo || '').trim();
  const rh = String(militar?.fator_rh || militar?.rh || '').trim();

  if (tipo && rh) return `${tipo} ${rh}`;
  if (tipo) return tipo;
  if (rh) return rh;
  return 'Não informado';
}

function obterSinaisParticulares(militar) {
  const candidatos = [
    militar?.sinais_particulares,
    militar?.sinal_particular,
    militar?.outras_notas,
    militar?.observacoes,
    militar?.observacao,
  ];

  for (const valor of candidatos) {
    const texto = String(valor || '').trim();
    if (texto) return texto;
  }

  return 'Sem alteração';
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

function montarTextoAdministrativo({ tipo, dataEvento, item }) {
  const dataExtensa = formatarDataExtensa(dataEvento);
  const dataCurta = formatarData(dataEvento);

  if (tipo === 'Férias') {
    const dias = Number(item?.dias || 0);
    const periodoRef = item?.periodo_aquisitivo_ref ? `, referente ao período aquisitivo ${item.periodo_aquisitivo_ref}` : '';
    const fracao = item?.fracionamento ? `, em ${item.fracionamento}` : '';
    const diasLabel = dias > 0 ? `${dias} dia(s)` : 'período regulamentar';
    return `Em ${dataExtensa}, entrou em gozo de férias por ${diasLabel}${periodoRef}${fracao}.`;
  }

  if (tipo === 'Atestado') {
    const tipoAfastamento = item?.tipo_afastamento || 'afastamento médico';
    const dias = Number(item?.dias || 0);
    const diasLabel = dias > 0 ? `, pelo prazo de ${dias} dia(s)` : '';
    const cid = item?.cid_10 ? `, CID ${item.cid_10}` : '';
    return `Em ${dataExtensa}, foi registrado ${tipoAfastamento.toLowerCase()}${diasLabel}${cid}.`;
  }

  if (tipo === 'Publicação') {
    const tipoPublicacao = item?.tipo_registro || item?.tipo || item?.categoria || 'publicação administrativa';
    const numeroBg = item?.numero_bg ? `, no BG nº ${item.numero_bg}` : '';
    return `Em ${dataExtensa}, foi lançada ${String(tipoPublicacao).toLowerCase()}${numeroBg}.`;
  }

  if (tipo === 'Punição') {
    const tipoPunicao = item?.tipo_punicao || 'punição disciplinar';
    const diasPunicao = Number(item?.dias_punicao || 0);
    const diasLabel = diasPunicao > 0 ? `, pelo prazo de ${diasPunicao} dia(s)` : '';
    const boletim = item?.boletim_numero ? `, conforme boletim nº ${item.boletim_numero}` : '';
    return `Em ${dataExtensa}, foi aplicada ${String(tipoPunicao).toLowerCase()}${diasLabel}${boletim}.`;
  }

  return `Em ${dataCurta}, foi registrada alteração administrativa.`;
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
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [previa, setPrevia] = useState(null);

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

  const periodoValido = Boolean(dataInicial && dataFinal && dataInicial <= dataFinal);

  const { data: historicoAlteracoes = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ['folha-alteracoes-historico', previa?.militar?.id, previa?.periodo?.dataInicial, previa?.periodo?.dataFinal],
    queryFn: async () => {
      if (!previa?.militar?.id || !previa?.periodo?.dataInicial || !previa?.periodo?.dataFinal) return [];

      const militarId = previa.militar.id;
      const inicioPeriodo = previa.periodo.dataInicial;
      const fimPeriodo = previa.periodo.dataFinal;

      const [ferias, atestados, publicacoesExOfficio, punicoes] = await Promise.all([
        listarPorMilitar('Ferias', militarId, '-data_inicio'),
        listarPorMilitar('Atestado', militarId, '-data_inicio'),
        listarPorMilitar('PublicacaoExOfficio', militarId, '-data_publicacao'),
        listarPorMilitar('PunicaoDisciplinar', militarId, '-data_punicao'),
      ]);

      const publicacoesLivro = await listarPorMilitar('RegistroLivro', militarId, '-data_registro');
      const publicacoes = [...publicacoesExOfficio, ...publicacoesLivro];

      const filtrarPorPeriodo = (data) => Boolean(data && data >= inicioPeriodo && data <= fimPeriodo);

      const eventosFerias = ferias
        .map((item) => {
          const dataEvento = normalizarDataISO(item.data_inicio || item.created_date);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const periodoRef = item.periodo_aquisitivo_ref ? ` (${item.periodo_aquisitivo_ref})` : '';
          const fracao = item.fracionamento ? ` - ${item.fracionamento}` : '';
          const textoOficial = getTextoOficialRegistro(item);

          return {
            data: dataEvento,
            tipo: 'Férias',
            texto: textoOficial || montarTextoAdministrativo({ tipo: 'Férias', dataEvento, item }),
            descricao: `${item.dias || 0} dia(s) de férias${periodoRef}${fracao}`,
            origem: 'Ferias',
          };
        })
        .filter(Boolean);

      const eventosAtestados = atestados
        .map((item) => {
          const dataEvento = normalizarDataISO(item.data_inicio || item.created_date);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const tipoAfastamento = item.tipo_afastamento || 'Afastamento médico';
          const dias = item.dias ? ` (${item.dias} dia(s))` : '';
          const cid = item.cid_10 ? ` - CID ${item.cid_10}` : '';
          const textoOficial = getTextoOficialRegistro(item);

          return {
            data: dataEvento,
            tipo: 'Atestado',
            texto: textoOficial || montarTextoAdministrativo({ tipo: 'Atestado', dataEvento, item }),
            descricao: `${tipoAfastamento}${dias}${cid}`,
            origem: 'Atestado',
          };
        })
        .filter(Boolean);

      const eventosPublicacoes = publicacoes
        .map((item) => {
          const dataEvento = normalizarDataISO(
            item.data_publicacao ||
            item.data_registro ||
            item.data_inicio ||
            item.data_bg ||
            item.data_punicao ||
            item.created_date
          );
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const tipoPublicacao = item.tipo_registro || item.tipo || item.categoria || 'Publicação';
          const numeroBg = item.numero_bg ? ` - BG ${item.numero_bg}` : '';
          const textoOficial = getTextoOficialRegistro(item);

          return {
            data: dataEvento,
            tipo: 'Publicação',
            texto: textoOficial || montarTextoAdministrativo({ tipo: 'Publicação', dataEvento, item }),
            descricao: `${tipoPublicacao}${numeroBg}`,
            origem: 'PublicacaoExOfficio',
          };
        })
        .filter(Boolean);

      const eventosPunicoes = (punicoes || [])
        .map((item) => {
          const dataEvento = normalizarDataISO(item.data_punicao || item.data_inicio_cumprimento || item.boletim_data || item.created_date);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const tipoPunicao = item.tipo_punicao || 'Punição disciplinar';
          const dias = item.dias_punicao ? ` - ${item.dias_punicao} dia(s)` : '';
          const status = item.status_punicao ? ` (${item.status_punicao})` : '';
          const textoOficial = getTextoOficialRegistro(item);

          return {
            data: dataEvento,
            tipo: 'Punição',
            texto: textoOficial || montarTextoAdministrativo({ tipo: 'Punição', dataEvento, item }),
            descricao: `${tipoPunicao}${dias}${status}`,
            origem: 'PunicaoDisciplinar',
          };
        })
        .filter(Boolean);

      return [...eventosFerias, ...eventosAtestados, ...eventosPublicacoes, ...eventosPunicoes].sort((a, b) => a.data.localeCompare(b.data));
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
        dataInicial,
        dataFinal,
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
          <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f]/10 text-[#1e3a5f]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

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
                <label className="text-sm font-medium text-slate-700">Data inicial</label>
                <Input type="date" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data final</label>
                <Input type="date" value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} />
              </div>

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

            {!!dataInicial && !!dataFinal && dataInicial > dataFinal && (
              <p className="text-sm text-red-600">A data inicial não pode ser maior que a data final.</p>
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

              <div className="print-sheet print-section rounded-xl border border-[#1e3a5f]/20 bg-white p-5 md:p-6 space-y-5 print:border-slate-300">
                <div className="text-center border-b border-slate-200 pb-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Folha de Alterações</p>
                  <p className="text-lg md:text-xl font-bold text-[#1e3a5f] mt-1">Resumo de Identificação do Militar</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Nome</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.nome_completo)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Matrícula</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.matricula)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Posto/Graduação</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.posto_graduacao)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Quadro</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.quadro)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Identidade / Órgão Expedidor</p>
                    <p className="font-semibold text-slate-800">{montarIdentidade(previa.militar)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">OBM / Unidade</p>
                    <p className="font-semibold text-slate-800">
                      {valorComFallback(previa.militar.unidade || previa.militar.unidade_lotacao || previa.militar.lotacao)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Período da Folha</p>
                    <p className="font-semibold text-slate-800">
                      {formatarData(previa.periodo.dataInicial)} até {formatarData(previa.periodo.dataFinal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Comportamento Atual</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.comportamento, 'Sem alteração')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Data de Inclusão</p>
                    <p className="font-semibold text-slate-800">{formatarDataOuNaoInformado(previa.militar.data_inclusao)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Estado Civil</p>
                    <p className="font-semibold text-slate-800">{valorComFallback(previa.militar.estado_civil)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Naturalidade</p>
                    <p className="font-semibold text-slate-800">{montarNaturalidade(previa.militar)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Data de Nascimento</p>
                    <p className="font-semibold text-slate-800">{formatarDataOuNaoInformado(previa.militar.data_nascimento)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Tipo Sanguíneo / Fator RH</p>
                    <p className="font-semibold text-slate-800">{montarTipoSanguineoRh(previa.militar)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-slate-500 uppercase text-[11px] tracking-wide">Sinais Particulares / Outras Notas</p>
                    <p className="font-semibold text-slate-800 break-words">{obterSinaisParticulares(previa.militar)}</p>
                  </div>
                </div>
              </div>

              <div className="print-sheet print-section print-break-before rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                <p className="text-base font-semibold text-slate-800">Histórico de Alterações</p>

                {loadingHistorico && (
                  <p className="text-sm text-slate-500">Carregando histórico do período...</p>
                )}

                {!loadingHistorico && historicoPorAnoMes.length === 0 && (
                  <p className="text-sm text-slate-500">Não foi possível montar o histórico para o período selecionado.</p>
                )}

                {!loadingHistorico && historicoPorAnoMes.length > 0 && (
                  <div className="space-y-4">
                    {historicoPorAnoMes.map((ano) => (
                      <div key={ano.ano} className="print-year-block rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                        <h3 className="text-sm md:text-base font-bold text-[#1e3a5f]">ANO {ano.ano}</h3>

                        <div className="space-y-3">
                          {ano.meses.map((mes) => (
                            <div key={mes.chave} className="print-month-block rounded-md border border-slate-100 p-3 bg-slate-50/70">
                              <p className="text-xs md:text-sm font-semibold text-slate-700 mb-2">{mes.titulo}</p>

                              {mes.eventos.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Sem alteração</p>
                              ) : (
                                <ol className="space-y-2">
                                  {mes.eventos.map((evento, index) => (
                                    <li key={`${evento.origem}-${evento.data}-${index}`} className="text-sm text-slate-800 leading-relaxed">
                                      <span className="font-semibold">({index + 1}) </span>
                                      <span>{evento.texto}</span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="print-sheet print-section rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">
                  Fontes desta fase: Férias, Atestados, Publicações Ex Officio e Punições Disciplinares (quando disponíveis com data no cadastro).
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Estrutura preparada para ampliar outras fontes sem alterar o layout do histórico.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {previa && (
          <section className="print-only-document">
            <article className="doc-sheet doc-section">
              <header className="text-center border-b border-black pb-2">
                <p className="doc-title font-bold uppercase">FOLHA DE ALTERAÇÕES</p>
                <p className="doc-subtitle">Resumo de Identificação e Histórico Funcional</p>
              </header>

              <div className="doc-grid grid grid-cols-2 mt-3 text-[10.5pt]">
                <div className="doc-row"><strong>Nome:</strong> {valorComFallback(previa.militar.nome_completo)}</div>
                <div className="doc-row"><strong>Matrícula:</strong> {valorComFallback(previa.militar.matricula)}</div>
                <div className="doc-row"><strong>Posto/Graduação:</strong> {valorComFallback(previa.militar.posto_graduacao)}</div>
                <div className="doc-row"><strong>Quadro:</strong> {valorComFallback(previa.militar.quadro)}</div>
                <div className="doc-row"><strong>Identidade:</strong> {montarIdentidade(previa.militar)}</div>
                <div className="doc-row">
                  <strong>OBM/Unidade:</strong> {valorComFallback(previa.militar.unidade || previa.militar.unidade_lotacao || previa.militar.lotacao)}
                </div>
                <div className="doc-row">
                  <strong>Período:</strong> {formatarData(previa.periodo.dataInicial)} a {formatarData(previa.periodo.dataFinal)}
                </div>
                <div className="doc-row"><strong>Comportamento:</strong> {valorComFallback(previa.militar.comportamento, 'Sem alteração')}</div>
                <div className="doc-row"><strong>Data de Inclusão:</strong> {formatarDataOuNaoInformado(previa.militar.data_inclusao)}</div>
                <div className="doc-row"><strong>Data de Nascimento:</strong> {formatarDataOuNaoInformado(previa.militar.data_nascimento)}</div>
                <div className="doc-row"><strong>Naturalidade:</strong> {montarNaturalidade(previa.militar)}</div>
                <div className="doc-row"><strong>Estado Civil:</strong> {valorComFallback(previa.militar.estado_civil)}</div>
                <div className="doc-row"><strong>Tipo Sanguíneo/RH:</strong> {montarTipoSanguineoRh(previa.militar)}</div>
                <div className="doc-row"><strong>Sinais Particulares:</strong> {obterSinaisParticulares(previa.militar)}</div>
              </div>
            </article>

            <article className="doc-sheet mt-2">
              <h2 className="doc-section-title font-bold uppercase text-[11pt] border-b border-black pb-1">Histórico de Alterações</h2>

              {loadingHistorico && (
                <p className="mt-2">Carregando histórico do período...</p>
              )}

              {!loadingHistorico && historicoPorAnoMes.length === 0 && (
                <p className="mt-2">Não foi possível montar o histórico para o período selecionado.</p>
              )}

              {!loadingHistorico && historicoPorAnoMes.length > 0 && (
                <div className="mt-2 space-y-2">
                  {historicoPorAnoMes.map((ano) => (
                    <section key={ano.ano} className="doc-year">
                      <h3 className="font-bold">ANO {ano.ano}</h3>
                      {ano.meses.map((mes) => (
                        <div key={mes.chave} className="doc-month ml-3 mt-1">
                          <p className="font-semibold">{mes.titulo}</p>
                          {mes.eventos.length === 0 ? (
                            <p className="italic">Sem alteração.</p>
                          ) : (
                            <ol className="list-decimal ml-5">
                              {mes.eventos.map((evento, index) => (
                                <li key={`${evento.origem}-${evento.data}-${index}`}>{evento.texto}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
