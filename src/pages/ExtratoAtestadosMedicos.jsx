import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { fetchScopedExtratoAtestados } from '@/services/getScopedExtratoAtestadosClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { gerarExtratoAtestados } from '@/services/gerarExtratoAtestadosClient';
import { getAtestadoAnexoSignedUrlClient } from '@/services/getAtestadoAnexoSignedUrlClient';
import { registrarAuditoriaExtratoAtestadosClient } from '@/services/registrarAuditoriaExtratoAtestadosClient';
import { gerarZipAnexosAtestadosClient } from '@/services/gerarZipAnexosAtestadosClient';

const PAGE_SIZE = 30;
const DEFAULT_COLUMNS = {
  selected: true,
  data_inicio: true,
  militar_nome: true,
  lotacao_nome: true,
  status: true,
  necessita_jiso: true,
  medico: true,
  dias: true,
  anexo: false,
};

const COLUMN_LABELS = {
  selected: 'Seleção',
  data_inicio: 'Data de início',
  militar_nome: 'Militar',
  lotacao_nome: 'Lotação',
  status: 'Status',
  necessita_jiso: 'JISO',
  medico: 'Médico',
  dias: 'Dias',
  anexo: 'Anexo',
};

const statusBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'ativo') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (normalized === 'encerrado') return 'bg-slate-100 text-slate-700 border-slate-300';
  if (normalized === 'cancelado') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const formatDateBr = (value) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR').format(date);
};

export default function ExtratoAtestadosMedicos() {
  const { canAccessModule, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
  const hasAccess = canAccessModule('atestados');
  const [filtros, setFiltros] = useState({
    periodoInicio: '',
    periodoFim: '',
    militar: '',
    lotacao: '',
    status: 'all',
    jiso: 'all',
    mes: 'all',
    ano: 'all',
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [loadingAnexoById, setLoadingAnexoById] = useState({});
  const [erroAnexoById, setErroAnexoById] = useState({});

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };



  const registrarAuditoria = async (payload) => {
    try {
      await registrarAuditoriaExtratoAtestadosClient(payload);
    } catch (error) {
      console.warn('[ExtratoAtestadosMedicos] auditoria warning', error);
    }
  };

  const exportRowsToCsv = (rowsToExport) => {
    const headers = ['ID', 'Data início', 'Militar', 'Lotação', 'Status', 'JISO', 'Dias'];
    const csvRows = rowsToExport.map((row) => [
      row.id || '',
      row.data_inicio || '',
      row.militar_nome || '',
      row.lotacao_nome || row.estrutura_nome || '',
      row.status || '',
      row.necessita_jiso ? 'Sim' : 'Não',
      row.dias ?? '',
    ]);
    const content = [headers, ...csvRows].map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n');
    downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), `extrato-atestados-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportarCsv = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    try {
      const response = await gerarExtratoAtestados({ formato: 'xlsx', idsSelecionados: Array.from(selectedIds), incluirSensivel: false });
      const rowsToExport = Array.isArray(response?.atestados) ? response.atestados : [];
      exportRowsToCsv(rowsToExport);
      await registrarAuditoria({
        acao: 'export_csv',
        quantidade_registros: rowsToExport.length,
        atestado_ids: rowsToExport.map((row) => row?.id).filter(Boolean),
        incluiu_sensiveis: Boolean(response?.meta?.sensiveis_incluidos),
        sensiveis_bloqueados: Boolean(response?.meta?.sensiveis_bloqueados),
        modo_acesso: 'exportacao',
        escopo: 'scoped_atestados_bundle',
        extrato_parcial: Boolean(response?.extrato_parcial),
      });
    } finally {
      setIsExporting(false);
    }
  };


  const handleBaixarAnexosZip = async () => {
    if (selectedIds.size === 0) return;
    setIsExportingZip(true);
    try {
      const response = await gerarZipAnexosAtestadosClient(Array.from(selectedIds));
      downloadBlob(response.blob, response.fileName);
      await registrarAuditoria({
        acao: 'export_zip_anexos',
        quantidade_registros: selectedIds.size,
        atestado_ids: Array.from(selectedIds),
        modo_acesso: 'zip_signed_urls_backend',
        escopo: 'scoped_atestados_bundle',
        extrato_parcial: Boolean(response?.meta?.extrato_parcial),
        quantidade_anexos: Number(response?.meta?.quantidade_anexos || 0),
        arquivos_ignorados_sem_anexo: Number(response?.meta?.arquivos_ignorados_sem_anexo || 0),
      });
    } catch (e) {
      const msg = String(e?.message || 'Não foi possível gerar o ZIP agora.');
      const isLimit = String(e?.code || '').toUpperCase() === 'LIMIT_EXCEEDED';
      await registrarAuditoria({
        acao: 'export_zip_anexos',
        quantidade_registros: selectedIds.size,
        atestado_ids: Array.from(selectedIds),
        modo_acesso: 'zip_signed_urls_backend',
        escopo: 'scoped_atestados_bundle',
        extrato_parcial: false,
        quantidade_anexos: Number(e?.meta?.quantidade_anexos || 0),
        arquivos_ignorados_sem_anexo: Number(e?.meta?.arquivos_ignorados_sem_anexo || 0),
        limite_excedido: isLimit,
      });
      window.alert(isLimit ? 'Limite excedido: selecione até 50 anexos e tamanho estimado até 100MB.' : msg.includes('Nenhum selecionado possui anexo') ? 'Nenhum selecionado possui anexo para download.' : 'Não foi possível gerar o ZIP agora.');
    } finally {
      setIsExportingZip(false);
    }
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extrato-atestados-medicos'],
    queryFn: () => fetchScopedExtratoAtestados(),
    enabled: isAccessResolved && hasAccess,
  });

  const allRows = Array.isArray(data?.atestados) ? data.atestados : [];

  const years = useMemo(() => {
    const uniqueYears = new Set();
    allRows.forEach((row) => {
      const isoDate = String(row?.data_inicio || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) uniqueYears.add(isoDate.slice(0, 4));
    });
    return Array.from(uniqueYears).sort((a, b) => Number(b) - Number(a));
  }, [allRows]);

  const filteredRows = useMemo(() => allRows.filter((a) => {
    if (filtros.periodoInicio && a.data_inicio && a.data_inicio < filtros.periodoInicio) return false;
    if (filtros.periodoFim && a.data_inicio && a.data_inicio > filtros.periodoFim) return false;
    if (filtros.militar && !String(a.militar_nome || '').toLowerCase().includes(filtros.militar.toLowerCase())) return false;
    if (filtros.lotacao && !String(a.lotacao_nome || a.estrutura_nome || '').toLowerCase().includes(filtros.lotacao.toLowerCase())) return false;
    if (filtros.status !== 'all' && String(a.status || '') !== filtros.status) return false;

    if (filtros.mes !== 'all') {
      const rowMonth = String(a.data_inicio || '').slice(5, 7);
      if (rowMonth !== filtros.mes) return false;
    }

    if (filtros.ano !== 'all') {
      const rowYear = String(a.data_inicio || '').slice(0, 4);
      if (rowYear !== filtros.ano) return false;
    }

    const isJiso = Boolean(a.necessita_jiso) || String(a.fluxo_homologacao || '').toLowerCase() === 'jiso';
    if (filtros.jiso === 'sim' && !isJiso) return false;
    if (filtros.jiso === 'nao' && isJiso) return false;
    return true;
  }), [allRows, filtros]);

  const rows = filteredRows.slice(0, visibleCount);

  const totalComJiso = useMemo(
    () => filteredRows.filter((row) => Boolean(row.necessita_jiso) || String(row.fluxo_homologacao || '').toLowerCase() === 'jiso').length,
    [filteredRows],
  );

  const somaDiasAfastamento = useMemo(
    () => filteredRows.reduce((acc, row) => acc + (Number(row.dias) || 0), 0),
    [filteredRows],
  );

  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAbrirAnexo = async (row) => {
    const rowId = String(row?.id || '');
    if (!rowId) return;
    setLoadingAnexoById((prev) => ({ ...prev, [rowId]: true }));
    setErroAnexoById((prev) => ({ ...prev, [rowId]: '' }));
    try {
      const data = await getAtestadoAnexoSignedUrlClient(rowId);
      if (!data?.url) throw new Error('Não foi possível gerar o link do anexo.');
      window.open(data.url, '_blank', 'noopener,noreferrer');
      await registrarAuditoria({
        acao: 'abrir_anexo',
        quantidade_registros: 1,
        atestado_ids: [rowId],
        incluiu_sensiveis: false,
        sensiveis_bloqueados: false,
        modo_acesso: 'anexo_signed_url',
        escopo: 'atestado_unico',
        extrato_parcial: false,
      });
    } catch (e) {
      const apiMessage = String(e?.message || '');
      const code = String(e?.code || '');
      const safeDetail = e?.detail ? JSON.stringify(e.detail) : '';
      const isMissing = /não possui arquivo|nao possui arquivo|anexo/i.test(apiMessage) || code === 'NO_ATTACHMENT';
      const fullError = `code=${code || '-'} | message=${apiMessage || '-'}${safeDetail ? ` | detail=${safeDetail}` : ''}`;
      setErroAnexoById((prev) => ({ ...prev, [rowId]: isMissing ? `Sem anexo disponível. ${fullError}` : `Falha ao abrir anexo. ${fullError}` }));
    } finally {
      setLoadingAnexoById((prev) => ({ ...prev, [rowId]: false }));
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Atestados" />;

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Extrato de Atestados Médicos</h1>
        <Badge variant="outline" className="text-slate-700 bg-white">Workspace de análise</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total carregado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{allRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total filtrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{filteredRows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total com JISO</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-indigo-700">{totalComJiso}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Soma dias afastamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">{somaDiasAfastamento}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Selecionados</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <p className="text-2xl font-semibold text-slate-900">{selectedIds.size}</p>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200" variant="outline">Persistente entre páginas</Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" disabled={selectedIds.size === 0 || isExporting} onClick={handleExportarCsv}>Exportar CSV</Button>
          <Button variant="outline" disabled={selectedIds.size === 0 || isExportingZip} onClick={handleBaixarAnexosZip}>Baixar anexos ZIP</Button>
          <span className="text-xs text-slate-600">Exporta somente registros selecionados</span>
          {isExporting && <span className="text-sm text-slate-700">Gerando extrato...</span>}
          {isExportingZip && <span className="text-sm text-slate-700">Gerando ZIP...</span>}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="periodo-inicio">Período inicial</Label>
            <Input id="periodo-inicio" type="date" value={filtros.periodoInicio} onChange={(e) => setFiltros((f) => ({ ...f, periodoInicio: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="periodo-fim">Período final</Label>
            <Input id="periodo-fim" type="date" value={filtros.periodoFim} onChange={(e) => setFiltros((f) => ({ ...f, periodoFim: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-mes">Mês</Label>
            <select id="filtro-mes" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtros.mes} onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}>
              <option value="all">Todos</option>
              {Array.from({ length: 12 }).map((_, i) => {
                const month = String(i + 1).padStart(2, '0');
                return <option key={month} value={month}>{month}</option>;
              })}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filtro-ano">Ano</Label>
            <select id="filtro-ano" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtros.ano} onChange={(e) => setFiltros((f) => ({ ...f, ano: e.target.value }))}>
              <option value="all">Todos</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="militar">Nome do militar</Label>
            <Input id="militar" placeholder="Digite o nome" value={filtros.militar} onChange={(e) => setFiltros((f) => ({ ...f, militar: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lotacao">Lotação/estrutura</Label>
            <Input id="lotacao" placeholder="Digite a lotação" value={filtros.lotacao} onChange={(e) => setFiltros((f) => ({ ...f, lotacao: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status do atestado</Label>
            <select id="status" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtros.status} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}>
              <option value="all">Todos os status</option><option value="Ativo">Ativo</option><option value="Encerrado">Encerrado</option><option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jiso">Filtro de JISO</Label>
            <select id="jiso" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtros.jiso} onChange={(e) => setFiltros((f) => ({ ...f, jiso: e.target.value }))}>
              <option value="all">Todos</option><option value="sim">Com JISO</option><option value="nao">Sem JISO</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Colunas visíveis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.keys(DEFAULT_COLUMNS).map((col) => (
            <label key={col} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Checkbox checked={columns[col]} onCheckedChange={(v) => setColumns((c) => ({ ...c, [col]: Boolean(v) }))} />
              <span>{COLUMN_LABELS[col]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {isLoading && <div>Carregando extrato...</div>}
      {isError && <div className="text-red-600">Erro ao carregar: {error?.message || 'desconhecido'}</div>}
      {!isLoading && !isError && filteredRows.length === 0 && <div>Nenhum resultado encontrado.</div>}

      {!isLoading && !isError && filteredRows.length > 0 && (
        <>
          <div className="text-sm text-slate-600">Itens selecionados no extrato: <span className="font-semibold">{selectedIds.size}</span></div>
          <div className="overflow-auto border rounded-lg bg-white shadow-sm max-h-[65vh]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  {columns.selected && <th className="p-3">Sel.</th>}
                  {columns.data_inicio && <th className="p-3 text-left">Início</th>}
                  {columns.militar_nome && <th className="p-3 text-left">Militar</th>}
                  {columns.lotacao_nome && <th className="p-3 text-left">Lotação</th>}
                  {columns.status && <th className="p-3 text-left">Status</th>}
                  {columns.necessita_jiso && <th className="p-3 text-left">JISO</th>}
                  {columns.medico && <th className="p-3 text-left">Médico</th>}
                  {columns.dias && <th className="p-3 text-left">Dias</th>}
                  {columns.anexo && <th className="p-3 text-left">Anexo</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const lotacao = row.lotacao_nome || row.estrutura_nome;
                  return (
                    <tr key={row.id} className="border-t hover:bg-slate-50">
                      {columns.selected && <td className="p-3"><Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelection(row.id)} /></td>}
                      {columns.data_inicio && <td className="p-3">{formatDateBr(row.data_inicio)}</td>}
                      {columns.militar_nome && <td className="p-3 font-medium">{row.militar_nome || '-'}</td>}
                      {columns.lotacao_nome && (
                        <td className="p-3">
                          {lotacao ? lotacao : <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">Lotação ausente</Badge>}
                        </td>
                      )}
                      {columns.status && <td className="p-3"><Badge variant="outline" className={statusBadgeClass(row.status)}>{row.status || '-'}</Badge></td>}
                      {columns.necessita_jiso && <td className="p-3"><Badge variant="outline" className={row.necessita_jiso ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>{row.necessita_jiso ? 'Sim' : 'Não'}</Badge></td>}
                      {columns.medico && <td className="p-3">{row.medico || '-'}</td>}
                      {columns.dias && <td className="p-3">{row.dias ?? '-'}</td>}
                      {columns.anexo && (
                        <td className="p-3">
                          <div className="space-y-1">
                            <Button variant="outline" size="sm" disabled={Boolean(loadingAnexoById[row.id])} onClick={() => handleAbrirAnexo(row)}>
                              {loadingAnexoById[row.id] ? 'Abrindo...' : 'Abrir'}
                            </Button>
                            {erroAnexoById[row.id] && <div className="text-xs text-rose-600">{erroAnexoById[row.id]}</div>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visibleCount < filteredRows.length && (
            <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>Carregar mais</Button>
          )}
        </>
      )}
    </div>
  );
}
