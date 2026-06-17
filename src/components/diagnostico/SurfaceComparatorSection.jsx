/**
 * SurfaceComparatorSection.jsx — P1.2-B3 (MIRROR / READ-ONLY)
 * ============================================================================
 * Seção VISUAL PASSIVA: Comparador Menu x Rota x Registry.
 *
 *  - Consome APENAS o helper puro compareAccessSurfaceByModule(moduleKey).
 *  - Sem backend, sem base44.entities, sem storage, sem router, sem console.
 *  - Sem create/update/delete, sem navigate, sem enforcement.
 *  - Exibe apenas metadados técnicos/documentais (pageKey, label, tipos,
 *    permissões declaradas, status, severidade, achados). NÃO exibe PII nem
 *    dados operacionais individuais.
 *  - Filtro local em memória (useState), sem persistência.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { compareAccessSurfaceByModule } from '@/utils/accessSurfaceDiagnostics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GitCompare, Info } from 'lucide-react';

// Rótulos amigáveis de status (somente apresentação).
const STATUS_LABELS = {
  aligned: 'Alinhado',
  contextual_expected: 'Contextual esperado',
  menu_only: 'Só no menu',
  route_only: 'Só na rota',
  registry_only: 'Só no registry',
  missing_registry: 'Sem registry',
  module_divergence: 'Divergência de módulo',
  action_divergence: 'Divergência de ação',
  admin_divergence: 'Divergência admin',
  known_divergence: 'Divergência conhecida',
  pending_mapping: 'Mapeamento pendente',
};

const STATUS_STYLES = {
  aligned: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  contextual_expected: 'bg-sky-50 text-sky-700 border-sky-200',
  menu_only: 'bg-amber-50 text-amber-700 border-amber-200',
  route_only: 'bg-amber-50 text-amber-700 border-amber-200',
  registry_only: 'bg-violet-50 text-violet-700 border-violet-200',
  missing_registry: 'bg-slate-100 text-slate-600 border-slate-300',
  module_divergence: 'bg-red-50 text-red-700 border-red-200',
  action_divergence: 'bg-amber-50 text-amber-700 border-amber-200',
  admin_divergence: 'bg-red-50 text-red-700 border-red-200',
  known_divergence: 'bg-blue-50 text-blue-700 border-blue-200',
  pending_mapping: 'bg-slate-100 text-slate-600 border-slate-300',
  default: 'bg-slate-100 text-slate-600 border-slate-300',
};

// Rótulos de severidade. Divergência conhecida usa visual neutro/atenuado.
const SEVERITY_LABELS = {
  info: 'Informação',
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const SEVERITY_STYLES = {
  info: 'bg-slate-100 text-slate-600 border-slate-300',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
  default: 'bg-slate-100 text-slate-600 border-slate-300',
};

// Filtros locais (read-only, em memória).
const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'attention', label: 'Atenções' },
  { key: 'high', label: 'Alto risco' },
  { key: 'known', label: 'Divergências conhecidas' },
  { key: 'aligned', label: 'Alinhados' },
];

function Mono({ children }) {
  return <span className="font-mono text-xs text-slate-700">{children}</span>;
}

function StatusBadge({ status }) {
  const key = String(status || 'default');
  const style = STATUS_STYLES[key] || STATUS_STYLES.default;
  return <Badge variant="outline" className={`font-medium ${style}`}>{STATUS_LABELS[key] || status || '—'}</Badge>;
}

function SeverityBadge({ severity, attenuated }) {
  const key = String(severity || 'info');
  // Para divergência conhecida atenuada, evitamos visual alarmista.
  const style = attenuated ? SEVERITY_STYLES.low : (SEVERITY_STYLES[key] || SEVERITY_STYLES.default);
  return <Badge variant="outline" className={`font-medium ${style}`}>{SEVERITY_LABELS[key] || severity || '—'}</Badge>;
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'aligned') return item.status === 'aligned' || item.status === 'contextual_expected';
  if (filter === 'high') return item.severity === 'high';
  if (filter === 'known') {
    return item.status === 'known_divergence' || (item.findings || []).some((f) => f.knownDivergence);
  }
  if (filter === 'attention') {
    // Qualquer coisa que não seja alinhado/contextual.
    return item.status !== 'aligned' && item.status !== 'contextual_expected';
  }
  return true;
}

export default function SurfaceComparatorSection({ moduleKey }) {
  const [filter, setFilter] = useState('all');

  const comparisons = useMemo(
    () => compareAccessSurfaceByModule(moduleKey) || [],
    [moduleKey],
  );

  const filtered = useMemo(
    () => comparisons.filter((item) => matchesFilter(item, filter)),
    [comparisons, filter],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="w-4 h-4 text-slate-500" />
          Comparador Menu x Rota x Registry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Comparação documental entre superfície declarada de menu, superfície declarada de rotas e
            accessRegistry. Este painel não lê App.jsx/Layout.jsx em runtime e não aplica bloqueios.
          </AlertDescription>
        </Alert>

        {/* Filtros locais (read-only) */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {comparisons.length === 0 ? (
          <Alert className="border-slate-300 bg-slate-50">
            <AlertDescription className="text-slate-600 text-sm">
              Nenhuma superfície mapeada para este módulo.
            </AlertDescription>
          </Alert>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 italic px-1">
            Nenhuma página corresponde ao filtro selecionado.
          </p>
        ) : (
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Página</TableHead>
                <TableHead className="w-[20%]">Menu</TableHead>
                <TableHead className="w-[24%]">Rota</TableHead>
                <TableHead className="w-[14%]">Resultado</TableHead>
                <TableHead className="w-[24%]">Achados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const attenuated = (item.findings || []).some((f) => f.knownDivergence);
                const adminOnly = item.menu?.adminOnly || item.route?.adminOnly;
                return (
                  <TableRow key={item.pageKey} className="align-top">
                    {/* Página: pageKey + label */}
                    <TableCell className="align-top">
                      <Mono>{item.pageKey}</Mono>
                      {item.menu?.label && (
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5 break-words">{item.menu.label}</p>
                      )}
                    </TableCell>

                    {/* Menu: aparece + tipo + viewPermission */}
                    <TableCell className="align-top text-[11px] text-slate-500 space-y-0.5">
                      <div>{item.menu?.exists ? (item.menu.appearsInMenu ? 'Visível' : 'Oculto') : '— sem menu'}</div>
                      {item.menu?.menuType && <div>tipo: {item.menu.menuType}</div>}
                      {item.menu?.viewPermission && <div className="break-words"><Mono>{item.menu.viewPermission}</Mono></div>}
                    </TableCell>

                    {/* Rota: path + routeType + moduleKey + actionKey + adminOnly */}
                    <TableCell className="align-top text-[11px] text-slate-500 space-y-0.5">
                      {item.route?.path ? <div className="break-words"><Mono>{item.route.path}</Mono></div> : <div>— sem rota</div>}
                      {item.route?.routeType && <div>tipo: {item.route.routeType}</div>}
                      {item.route?.moduleKey && <div className="break-words">mód: <Mono>{item.route.moduleKey}</Mono></div>}
                      {item.route?.actionKey && <div className="break-words">act: <Mono>{item.route.actionKey}</Mono></div>}
                      {adminOnly && <div className="text-amber-600 font-medium">adminOnly</div>}
                    </TableCell>

                    {/* Resultado: status + severidade */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={item.status} />
                        <SeverityBadge severity={item.severity} attenuated={attenuated} />
                      </div>
                    </TableCell>

                    {/* Achados: resumo dos findings */}
                    <TableCell className="align-top">
                      <ul className="space-y-0.5">
                        {(item.findings || []).map((f, idx) => (
                          <li key={idx} className="text-[11px] text-slate-500 leading-tight break-words">
                            {f.message}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}