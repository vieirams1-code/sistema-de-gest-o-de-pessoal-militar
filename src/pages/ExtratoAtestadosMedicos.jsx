import React, { useMemo, useState } from 'react';
import { CalendarDays, Download, FileText, Filter, Loader2, Paperclip, ShieldAlert, Stethoscope, Users } from 'lucide-react';
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
import { gerarRelatorioDpDintelAtestados } from '@/services/gerarRelatorioDpDintelAtestadosClient';
import { obterLinkAnexoAtestado } from '@/services/getAtestadoAnexoSignedUrlClient';
import { registrarAuditoriaExtratoAtestadosClient } from '@/services/registrarAuditoriaExtratoAtestadosClient';

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

const KpiCard = ({ title, value, description, icon: Icon, tone = 'slate' }) => {
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  return (
    <Card className="rounded-xl border-slate-200 bg-white/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-950">{value}</p>
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          {Icon && (
            <span className={`rounded-xl border p-2 ${toneClasses[tone] || toneClasses.slate}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const FormField = ({ id, label, children }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
    {children}
  </div>
);

const StatusBadge = ({ status }) => (
  <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}>
    {status || '-'}
  </Badge>
);

export default function ExtratoAtestadosMedicos() {
  const { canAccessModule, canAccessAction, isAdmin, isAccessResolved, isLoading: loadingUser } = useCurrentUser();
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingAnexoById, setLoadingAnexoById] = useState({});
  const [erroAnexoById, setErroAnexoById] = useState({});
  const [linkAnexoById, setLinkAnexoById] = useState({});
  const [diagnosticoAnexos, setDiagnosticoAnexos] = useState({
    ultimoErroAbrirAnexo: null,
    legacyAttachmentHint: false,
  });
  const canShowDiagnostics = Boolean(isAdmin || import.meta.env.DEV);
  const canGenerateDpDintelReport = canAccessAction('gerar_relatorio_dp_dintel_atestados');

  const normalizeAttachmentError = (error, context = {}) => ({
    code: String(error?.code || ''),
    message: String(error?.message || ''),
    detail: error?.detail ?? null,
    meta: error?.meta ?? null,
    status: Number(error?.status || error?.raw?.response?.status || 0) || null,
    raw: error?.raw ?? null,
    atestado_id: context.atestado_id ? String(context.atestado_id) : null,
    action: context.action || 'unknown',
    timestamp: new Date().toISOString(),
  });

  const handleCopyDiagnostico = async () => {
    const payload = JSON.stringify(diagnosticoAnexos, null, 2);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        window.alert('Diagnóstico copiado para a área de transferência.');
        return;
      }
    } catch {
      // fallback abaixo
    }
    window.prompt('Copie manualmente o diagnóstico:', payload);
  };

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


  const handleGerarRelatorioDpDintel = async () => {
    if (selectedIds.size === 0 || !canGenerateDpDintelReport) return;
    setIsGeneratingReport(true);
    try {
      const response = await gerarRelatorioDpDintelAtestados({ idsSelecionados: Array.from(selectedIds), incluirHistorico: false });
      downloadBlob(response.blob, response.fileName);
      await registrarAuditoria({
        acao: 'gerar_relatorio_dp_dintel_pdf_sem_historico',
        quantidade_registros: Number(response?.meta?.totalSelecionado || selectedIds.size),
        atestado_ids: Array.from(selectedIds),
        incluiu_sensiveis: Boolean(response?.meta?.sensiveis_incluidos),
        sensiveis_bloqueados: Boolean(response?.meta?.sensiveis_bloqueados),
        modo_acesso: 'relatorio_dp_dintel_pdf',
        escopo: 'scoped_atestados_bundle',
        extrato_parcial: Boolean(response?.meta?.extrato_parcial),
      });
    } finally {
      setIsGeneratingReport(false);
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
    setLinkAnexoById((prev) => ({ ...prev, [rowId]: '' }));
    try {
      const result = await obterLinkAnexoAtestado(rowId);
      setLinkAnexoById((prev) => ({ ...prev, [rowId]: result.url }));
      if (result.legacy_attachment) {
        setDiagnosticoAnexos((prev) => ({ ...prev, legacyAttachmentHint: true }));
      }
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
      const normalizedError = normalizeAttachmentError(e, {
        action: 'abrir_anexo',
        atestado_id: rowId,
      });
      setDiagnosticoAnexos((prev) => ({ ...prev, ultimoErroAbrirAnexo: normalizedError }));
      const apiMessage = String(e?.message || '');
      const code = String(e?.code || '');
      const safeDetail = e?.detail ? JSON.stringify(e.detail) : '';
      const status = Number(e?.status || e?.raw?.response?.status || 0) || '-';
      const rawPayload = e?.raw ? JSON.stringify(e.raw) : '';
      const isMissing = /não possui arquivo|nao possui arquivo|anexo/i.test(apiMessage) || code === 'NO_ATTACHMENT';
      const fullError = `status=${status} | code=${code || '-'} | message=${apiMessage || '-'}${safeDetail ? ` | detail=${safeDetail}` : ''}${rawPayload ? ` | raw=${rawPayload.slice(0, 500)}` : ''}`;
      setErroAnexoById((prev) => ({ ...prev, [rowId]: isMissing ? `Sem anexo disponível. ${fullError}` : `Falha ao abrir anexo. ${fullError}` }));
      console.error('[ExtratoAtestadosMedicos] erro abrir anexo', { rowId, status, code, message: apiMessage, detail: e?.detail || null, raw: e?.raw || null });
    } finally {
      setLoadingAnexoById((prev) => ({ ...prev, [rowId]: false }));
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAccess) return <AccessDenied modulo="Atestados" />;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white/95 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">Workspace de análise</Badge>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1e3a5f]">Extrato de Atestados Médicos</h1>
                <p className="mt-1 text-sm text-slate-500">Consulta operacional com filtros reais, seleção persistente, exportações e anexos.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <Button className="gap-2 bg-[#1e3a5f] hover:bg-[#16304f]" disabled={selectedIds.size === 0 || isExporting} onClick={handleExportarCsv}>
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Exportar CSV
              </Button>
              {canGenerateDpDintelReport && (
                <Button variant="outline" className="gap-2 bg-white" disabled={selectedIds.size === 0 || isGeneratingReport} onClick={handleGerarRelatorioDpDintel}>
                  {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  PDF DP/DINTEL sem histórico
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Total carregado" value={allRows.length} description="Registros no extrato" icon={FileText} tone="slate" />
          <KpiCard title="Total filtrado" value={filteredRows.length} description="Após filtros ativos" icon={Filter} tone="blue" />
          <KpiCard title="Total com JISO" value={totalComJiso} description="Fluxo de homologação" icon={Stethoscope} tone="indigo" />
          <KpiCard title="Dias afastamento" value={somaDiasAfastamento} description="Soma dos registros filtrados" icon={CalendarDays} tone="amber" />
          <KpiCard title="Selecionados" value={selectedIds.size} description="Persistente entre páginas" icon={Users} tone="emerald" />
        </div>

        <Card className="rounded-xl border-slate-200 bg-white/95 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Toolbar de ações</p>
              <p className="text-xs text-slate-500">Exporta somente registros selecionados. A seleção permanece ao carregar mais itens.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-slate-50 text-slate-700">Selecionados: {selectedIds.size}</Badge>
              {isExporting && <span className="text-sm text-slate-700">Gerando extrato...</span>}
              {isGeneratingReport && <span className="text-sm text-slate-700">Gerando relatório DP/DINTEL...</span>}
            </div>
          </CardContent>
        </Card>

        {canShowDiagnostics && (
          <Card className="rounded-xl border-amber-300 bg-amber-50/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                <ShieldAlert className="h-5 w-5 text-amber-700" />
                Diagnóstico de Anexos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-600">Painel temporário para suporte de erros de abertura de anexo.</p>
              {diagnosticoAnexos.legacyAttachmentHint && (
                <p className="rounded-lg border border-amber-200 bg-white/70 p-3 text-xs text-amber-800">Alguns anexos antigos podem exigir abertura individual pelo link assinado.</p>
              )}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-1 text-xs font-semibold text-slate-700">Último erro de abrir anexo</p>
                <pre className="text-[11px] whitespace-pre-wrap break-all text-slate-600">{JSON.stringify(diagnosticoAnexos.ultimoErroAbrirAnexo, null, 2) || '-'}</pre>
              </div>
              <Button variant="outline" size="sm" className="bg-white" onClick={handleCopyDiagnostico}>Copiar diagnóstico</Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Filter className="h-5 w-5 text-blue-700" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField id="periodo-inicio" label="Período inicial">
              <Input id="periodo-inicio" type="date" className="rounded-xl" value={filtros.periodoInicio} onChange={(e) => setFiltros((f) => ({ ...f, periodoInicio: e.target.value }))} />
            </FormField>
            <FormField id="periodo-fim" label="Período final">
              <Input id="periodo-fim" type="date" className="rounded-xl" value={filtros.periodoFim} onChange={(e) => setFiltros((f) => ({ ...f, periodoFim: e.target.value }))} />
            </FormField>
            <FormField id="filtro-mes" label="Mês">
              <select id="filtro-mes" className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={filtros.mes} onChange={(e) => setFiltros((f) => ({ ...f, mes: e.target.value }))}>
                <option value="all">Todos</option>
                {Array.from({ length: 12 }).map((_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return <option key={month} value={month}>{month}</option>;
                })}
              </select>
            </FormField>
            <FormField id="filtro-ano" label="Ano">
              <select id="filtro-ano" className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={filtros.ano} onChange={(e) => setFiltros((f) => ({ ...f, ano: e.target.value }))}>
                <option value="all">Todos</option>
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </FormField>
            <FormField id="militar" label="Nome do militar">
              <Input id="militar" placeholder="Digite o nome" className="rounded-xl" value={filtros.militar} onChange={(e) => setFiltros((f) => ({ ...f, militar: e.target.value }))} />
            </FormField>
            <FormField id="lotacao" label="Lotação/estrutura">
              <Input id="lotacao" placeholder="Digite a lotação" className="rounded-xl" value={filtros.lotacao} onChange={(e) => setFiltros((f) => ({ ...f, lotacao: e.target.value }))} />
            </FormField>
            <FormField id="status" label="Status do atestado">
              <select id="status" className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={filtros.status} onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}>
                <option value="all">Todos os status</option><option value="Ativo">Ativo</option><option value="Encerrado">Encerrado</option><option value="Cancelado">Cancelado</option>
              </select>
            </FormField>
            <FormField id="jiso" label="Filtro de JISO">
              <select id="jiso" className="h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={filtros.jiso} onChange={(e) => setFiltros((f) => ({ ...f, jiso: e.target.value }))}>
                <option value="all">Todos</option><option value="sim">Com JISO</option><option value="nao">Sem JISO</option>
              </select>
            </FormField>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">Colunas visíveis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.keys(DEFAULT_COLUMNS).map((col) => (
              <label key={col} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50">
                <Checkbox checked={columns[col]} onCheckedChange={(v) => setColumns((c) => ({ ...c, [col]: Boolean(v) }))} />
                <span>{COLUMN_LABELS[col]}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">Carregando extrato...</div>}
        {isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700 shadow-sm">Erro ao carregar: {error?.message || 'desconhecido'}</div>}
        {!isLoading && !isError && filteredRows.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">Nenhum resultado encontrado.</div>}

        {!isLoading && !isError && filteredRows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>Itens selecionados no extrato: <span className="font-semibold text-slate-900">{selectedIds.size}</span></span>
              <span>Exibindo <span className="font-semibold text-slate-900">{rows.length}</span> de <span className="font-semibold text-slate-900">{filteredRows.length}</span> filtrados</span>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm max-h-[65vh]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {columns.selected && <th className="p-3 text-left">Sel.</th>}
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
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const lotacao = row.lotacao_nome || row.estrutura_nome;
                    return (
                      <tr key={row.id} className="hover:bg-blue-50/40">
                          {columns.selected && <td className="p-3 align-top"><Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelection(row.id)} /></td>}
                          {columns.data_inicio && <td className="p-3 align-top font-medium text-slate-700">{formatDateBr(row.data_inicio)}</td>}
                          {columns.militar_nome && <td className="p-3 align-top font-semibold text-slate-950">{row.militar_nome || '-'}</td>}
                          {columns.lotacao_nome && (
                            <td className="p-3 align-top text-slate-700">
                              {lotacao ? lotacao : <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">Lotação ausente</Badge>}
                            </td>
                          )}
                          {columns.status && <td className="p-3 align-top"><StatusBadge status={row.status} /></td>}
                          {columns.necessita_jiso && <td className="p-3 align-top"><Badge variant="outline" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.necessita_jiso ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{row.necessita_jiso ? 'Sim' : 'Não'}</Badge></td>}
                          {columns.medico && <td className="p-3 align-top text-slate-700">{row.medico || '-'}</td>}
                          {columns.dias && <td className="p-3 align-top text-slate-700">{row.dias ?? '-'}</td>}
                          {columns.anexo && (
                            <td className="p-3 align-top">
                              <div className="space-y-1">
                                <Button variant="outline" size="sm" className="gap-2 rounded-full bg-white" disabled={Boolean(loadingAnexoById[row.id])} onClick={() => handleAbrirAnexo(row)}>
                                  {loadingAnexoById[row.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                                  {loadingAnexoById[row.id] ? 'Gerando link...' : 'Abrir'}
                                </Button>
                                {erroAnexoById[row.id] && <div className="max-w-xs text-xs text-rose-600">{erroAnexoById[row.id]}</div>}
                                {linkAnexoById[row.id] && (
                                  <a className="block text-xs text-blue-700 underline" href={linkAnexoById[row.id]} target="_blank" rel="noopener noreferrer">
                                    Abrir anexo
                                  </a>
                                )}
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
              <Button variant="outline" className="rounded-full bg-white shadow-sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>Carregar mais</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
