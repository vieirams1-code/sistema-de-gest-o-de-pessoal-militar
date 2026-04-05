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

function normalizarDataISO(value) {
  if (!value) return null;
  if (typeof value === 'string') {
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

      const [ferias, atestados, publicacoes, punicoes] = await Promise.all([
        base44.entities.Ferias.filter({ militar_id: militarId }, '-data_inicio').catch(() => []),
        base44.entities.Atestado.filter({ militar_id: militarId }, '-data_inicio').catch(() => []),
        base44.entities.PublicacaoExOfficio.filter({ militar_id: militarId }, '-data_publicacao').catch(() => []),
        base44.entities.PunicaoDisciplinar?.filter({ militar_id: militarId }, '-data_punicao').catch(() => []) || Promise.resolve([]),
      ]);

      const filtrarPorPeriodo = (data) => Boolean(data && data >= inicioPeriodo && data <= fimPeriodo);

      const eventosFerias = ferias
        .map((item) => {
          const dataEvento = normalizarDataISO(item.data_inicio || item.created_date);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const periodoRef = item.periodo_aquisitivo_ref ? ` (${item.periodo_aquisitivo_ref})` : '';
          const fracao = item.fracionamento ? ` - ${item.fracionamento}` : '';

          return {
            data: dataEvento,
            tipo: 'Férias',
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

          return {
            data: dataEvento,
            tipo: 'Atestado',
            descricao: `${tipoAfastamento}${dias}${cid}`,
            origem: 'Atestado',
          };
        })
        .filter(Boolean);

      const eventosPublicacoes = publicacoes
        .map((item) => {
          const dataEvento = normalizarDataISO(item.data_publicacao || item.data_registro || item.data_bg || item.created_date);
          if (!filtrarPorPeriodo(dataEvento)) return null;

          const tipoPublicacao = item.tipo_registro || item.tipo || 'Publicação';
          const numeroBg = item.numero_bg ? ` - BG ${item.numero_bg}` : '';

          return {
            data: dataEvento,
            tipo: 'Publicação',
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

          return {
            data: dataEvento,
            tipo: 'Punição',
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

  if (!loadingUser && isAccessResolved && !canAccessModule('militares')) {
    return <AccessDenied modulo="Efetivo" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
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

        <Card className="shadow-sm border-slate-200">
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
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg text-[#1e3a5f]">Prévia da Folha de Alterações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Nome</p>
                  <p className="font-semibold text-slate-800">{previa.militar.nome_completo || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Matrícula</p>
                  <p className="font-semibold text-slate-800">{previa.militar.matricula || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Posto/Graduação</p>
                  <p className="font-semibold text-slate-800">{previa.militar.posto_graduacao || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Quadro</p>
                  <p className="font-semibold text-slate-800">{previa.militar.quadro || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-500">Unidade/Lotação</p>
                  <p className="font-semibold text-slate-800">
                    {previa.militar.unidade || previa.militar.unidade_lotacao || previa.militar.lotacao || '-'}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-slate-500">Período selecionado</p>
                  <p className="font-semibold text-slate-800">
                    {formatarData(previa.periodo.dataInicial)} até {formatarData(previa.periodo.dataFinal)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
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
                      <div key={ano.ano} className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                        <h3 className="text-sm md:text-base font-bold text-[#1e3a5f]">ANO {ano.ano}</h3>

                        <div className="space-y-3">
                          {ano.meses.map((mes) => (
                            <div key={mes.chave} className="rounded-md border border-slate-100 p-3 bg-slate-50/70">
                              <p className="text-xs md:text-sm font-semibold text-slate-700 mb-2">{mes.titulo}</p>

                              {mes.eventos.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">Sem alteração</p>
                              ) : (
                                <ul className="space-y-2">
                                  {mes.eventos.map((evento, index) => (
                                    <li key={`${evento.origem}-${evento.data}-${index}`} className="rounded border border-slate-200 bg-white px-3 py-2">
                                      <p className="text-sm text-slate-800">
                                        <span className="font-semibold">{formatarData(evento.data)}</span>
                                        {' • '}
                                        <span className="font-medium">{evento.tipo}</span>
                                      </p>
                                      <p className="text-sm text-slate-600">{evento.descricao}</p>
                                      <p className="text-xs text-slate-500">Origem: {evento.origem}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
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
      </div>
    </div>
  );
}
