/**
 * AccessConsistencyReport.jsx — P1.2-A1 (MIRROR / READ-ONLY)
 * ============================================================================
 * Componente VISUAL PASSIVO de diagnóstico de acesso.
 *
 *  - Recebe dados por props (não consulta backend, não usa useCurrentUser).
 *  - Usa apenas accessRegistry / accessDiagnostics (puros, sem side effects).
 *  - NÃO chama base44.entities, NÃO faz create/update/delete.
 *  - NÃO acessa sessionStorage/localStorage, NÃO navega, NÃO bloqueia.
 *  - NÃO exibe dados operacionais sensíveis (nomes, CPF, documentos, anexos,
 *    CID, afastamentos/férias individuais).
 *
 * Trabalha apenas com moduleKeys, actionKeys, pageKeys, routeRules, menuRules,
 * divergências e o reflexo (mirror) das permissões recebidas por prop.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import {
  getAccessDefinition,
  explainMirrorAccess,
  listKnownDivergences,
} from '@/utils/accessDiagnostics';
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
import { Info, ShieldAlert, UserCog, KeyRound, Route as RouteIcon, Server } from 'lucide-react';
import SurfaceComparatorSection from '@/components/diagnostico/SurfaceComparatorSection';

// ----------------------------------------------------------------------------
// Mapeamento visual de estados (somente apresentação)
// ----------------------------------------------------------------------------
const STATUS_STYLES = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmado: 'bg-orange-50 text-orange-700 border-orange-200',
  pendente_validacao: 'bg-blue-50 text-blue-700 border-blue-200',
  nao_encontrado: 'bg-slate-100 text-slate-600 border-slate-300',
  nao_encontrado_em_enforcement: 'bg-slate-100 text-slate-600 border-slate-300',
  documental: 'bg-violet-50 text-violet-700 border-violet-200',
  divergencia_modulo: 'bg-amber-50 text-amber-700 border-amber-200',
  default: 'bg-slate-100 text-slate-600 border-slate-300',
};

const RISK_STYLES = {
  alto: 'bg-red-50 text-red-700 border-red-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  baixo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  default: 'bg-slate-100 text-slate-600 border-slate-300',
};

const STATUS_LABELS = {
  ok: 'OK',
  confirmado: 'Confirmado',
  pendente_validacao: 'Pendente de validação',
  nao_encontrado: 'Não encontrado',
  nao_encontrado_em_enforcement: 'Não encontrado (enforcement)',
  documental: 'Somente documental',
  divergencia_modulo: 'Divergência do módulo',
};

// Label específico para a célula de rota (uma divergência específica confirmada
// é exibida como "Divergência confirmada", não como o genérico "Confirmado").
const ROUTE_STATUS_LABELS = {
  confirmado: 'Divergência confirmada',
  pendente_validacao: 'Em atenção',
  divergencia_modulo: 'Divergência do módulo',
};

function StatusBadge({ status, labelOverride }) {
  const key = String(status || 'default');
  const style = STATUS_STYLES[key] || STATUS_STYLES.default;
  const label = labelOverride || STATUS_LABELS[key] || status || '—';
  return <Badge variant="outline" className={`font-medium ${style}`}>{label}</Badge>;
}

function RiskBadge({ risk }) {
  const key = String(risk || 'default').toLowerCase();
  const style = RISK_STYLES[key] || RISK_STYLES.default;
  return <Badge variant="outline" className={`font-medium ${style}`}>Risco: {risk || '—'}</Badge>;
}

function GrantBadge({ granted }) {
  return granted
    ? <Badge variant="outline" className={STATUS_STYLES.ok}>Previsto</Badge>
    : <Badge variant="outline" className={STATUS_STYLES.nao_encontrado}>Não previsto</Badge>;
}

function Mono({ children }) {
  return <span className="font-mono text-xs text-slate-700">{children}</span>;
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <CardTitle className="flex items-center gap-2 text-base">
      {Icon && <Icon className="w-4 h-4 text-slate-500" />}
      {children}
    </CardTitle>
  );
}

// ----------------------------------------------------------------------------
// Componente principal
// ----------------------------------------------------------------------------
export default function AccessConsistencyReport({
  moduleKey,
  userPermissions = {},
  currentUser = null,
  effectiveUser = null,
  isImpersonating = false,
  showKnownDivergences = true,
  showRoutes = true,
  showActions = true,
  showScope = true,
  showBackendRules = true,
}) {
  const moduleDef = useMemo(() => getAccessDefinition(moduleKey), [moduleKey]);
  const explanation = useMemo(
    () => explainMirrorAccess(moduleKey, userPermissions),
    [moduleKey, userPermissions],
  );
  const divergences = useMemo(() => {
    if (!moduleDef) return [];
    const canonical = moduleDef.canonicalModuleKey;
    return listKnownDivergences().filter((d) => d.module === canonical);
  }, [moduleDef]);

  if (!moduleDef) {
    return (
      <Alert className="border-slate-300 bg-slate-50">
        <ShieldAlert className="w-4 h-4" />
        <AlertDescription>
          Módulo <Mono>{String(moduleKey)}</Mono> não consta no accessRegistry (mirror).
        </AlertDescription>
      </Alert>
    );
  }

  const canonicalActions = moduleDef.permissions?.canonical || {};
  const legacyPerm = moduleDef.permissions?.legacyPerm || {};
  const composedActions = moduleDef.composedActions || {};
  const externalDependencies = moduleDef.externalDependencies || [];
  const crossModuleActions = moduleDef.crossModuleActions || [];
  const routeRules = moduleDef.routeRules || [];
  const menuByPage = new Map(
    (moduleDef.menuRules || []).map((m) => [String(m.pageKey || '').toLowerCase(), m]),
  );

  return (
    <div className="space-y-4">
      {/* Aviso fixo */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Diagnóstico informativo em modo <strong>mirror</strong>. Este painel não altera
          permissões, rotas, menu ou comportamento do sistema. As definições refletem o mapeamento
          documental (registry) e podem divergir do enforcement real em tempo de execução.
        </AlertDescription>
      </Alert>

      {/* 2. Card Resumo do Módulo */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={KeyRound}>Resumo do Módulo</SectionTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{moduleDef.label}</span>
            <Mono>{moduleDef.canonicalModuleKey}</Mono>
            <Badge variant="outline" className={STATUS_STYLES.documental}>
              {moduleDef.mirrorStatus}
            </Badge>
            <RiskBadge risk={moduleDef.risk} />
          </div>
          {moduleDef.legacyModuleKeys?.length > 0 && (
            <div className="text-xs text-slate-500">
              Chaves legadas: {moduleDef.legacyModuleKeys.map((k) => <Mono key={k}>{k} </Mono>)}
            </div>
          )}
          {moduleDef.recommendationFuture && (
            <p className="text-xs text-slate-500 border-t pt-2">
              <strong>Recomendação (P1.2+):</strong> {moduleDef.recommendationFuture}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Card Contexto do Usuário (sem dados operacionais sensíveis) */}
      <Card>
        <CardHeader className="pb-3">
          <SectionTitle icon={UserCog}>Contexto do Usuário (recebido por props)</SectionTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-slate-600">
              Usuário autenticado:{' '}
              <span className="font-medium text-slate-800">{currentUser?.hasUser ? 'Sim' : 'Não'}</span>
            </span>
            <span className="text-slate-600">
              Admin:{' '}
              <span className="font-medium text-slate-800">{currentUser?.isAdmin ? 'Sim' : 'Não'}</span>
            </span>
            <span className="text-slate-600">
              Modo de acesso:{' '}
              <span className="font-medium text-slate-800">{currentUser?.modoAcesso || '—'}</span>
            </span>
            <span className="text-slate-600">
              Impersonação:{' '}
              <span className="font-medium text-slate-800">{isImpersonating ? 'Ativa' : 'Inativa'}</span>
            </span>
            <span className="text-slate-600">
              Usuário efetivo:{' '}
              <span className="font-medium text-slate-800">{effectiveUser?.hasEffectiveUser ? 'Sim' : 'Não'}</span>
            </span>
            {isImpersonating && (
              <Badge variant="outline" className={STATUS_STYLES.confirmado}>Impersonação ativa</Badge>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Exibição limitada a metadados neutros de acesso. Nenhum dado pessoal ou operacional
            sensível é apresentado por este painel.
          </p>
        </CardContent>
      </Card>

      {/* 4. Bloco Permissões / Ações */}
      {showActions && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={KeyRound}>Permissões / Ações (mirror)</SectionTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Papel</TableHead>
                  <TableHead>Action canônica</TableHead>
                  <TableHead>Alias perm_</TableHead>
                  <TableHead>Status previsto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(canonicalActions).map(([role, key]) => {
                  const evaluated = explanation?.actionsEvaluated?.[role];
                  return (
                    <TableRow key={role}>
                      <TableCell className="text-xs text-slate-500">{role}</TableCell>
                      <TableCell><Mono>{key}</Mono></TableCell>
                      <TableCell><Mono>{legacyPerm[role] || '—'}</Mono></TableCell>
                      <TableCell><GrantBadge granted={Boolean(evaluated?.granted)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Ações compostas (allOf/anyOf + runtimeState) */}
            {Object.keys(composedActions).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Ações compostas
                </p>
                {Object.entries(composedActions).map(([name, def]) => (
                  <div key={name} className="rounded-md border bg-slate-50 p-2 text-xs">
                    <div className="font-medium text-slate-700">{name}</div>
                    {def.allOf && <div>allOf: {def.allOf.map((a) => <Mono key={a}>{a} </Mono>)}</div>}
                    {def.anyOf && <div>anyOf: {def.anyOf.map((a) => <Mono key={a}>{a} </Mono>)}</div>}
                    {def.runtimeState && <div className="text-slate-500">runtimeState: {def.runtimeState}</div>}
                    {def.note && <div className="text-slate-400 mt-1">{def.note}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* crossModuleActions */}
            {crossModuleActions.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Ações cross-module
                </p>
                {crossModuleActions.map((c) => (
                  <div key={c.action} className="text-xs text-slate-600">
                    <Mono>{c.action}</Mono> — origem:{' '}
                    <Mono>{c.externalActionSource || moduleDef.externalActionSource || '—'}</Mono>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Bloco Rotas */}
      {showRoutes && routeRules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={RouteIcon}>Rotas (mirror App.jsx)</SectionTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PageKey</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Menu / Contextual</TableHead>
                  <TableHead>Guard (App.jsx)</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeRules.map((route) => {
                  const menu = menuByPage.get(String(route.pageKey || '').toLowerCase());
                  const menuAction = menu?.rule?.actionKey || menu?.rule?.viewPermission || null;
                  const routeAction = route.appGuard?.actionKey || null;
                  const moduleOnly = Boolean(route.appGuard?.moduleKey) && !routeAction;
                  // Associação ROBUSTA: usa apenas a lista estruturada `affectedPageKeys`
                  // (ou `routePageKeys`) das divergências, com match EXATO por pageKey.
                  // NÃO usa includes/substring/contains em location (evita falsos positivos,
                  // ex.: "Atestados" casar com "ExtratoAtestadosMedicos").
                  const divergenciaEspecifica = divergences.find((d) => {
                    const lista = d.affectedPageKeys || d.routePageKeys || [];
                    return Array.isArray(lista) && lista.includes(route.pageKey);
                  });
                  const potencialDivergencia = Boolean(menuAction && moduleOnly);
                  const rowStatus = divergenciaEspecifica
                    ? (divergenciaEspecifica.status || 'confirmado')
                    : (potencialDivergencia ? 'divergencia_modulo' : null);
                  return (
                    <TableRow key={route.pageKey}>
                      <TableCell><Mono>{route.pageKey}</Mono></TableCell>
                      <TableCell className="text-xs text-slate-500">{route.type || '—'}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {route.menuVisible ? 'Menu' : route.contextualOnly ? 'Contextual' : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {route.appGuard?.moduleKey ? <Mono>{route.appGuard.moduleKey}</Mono> : null}
                        {routeAction ? <Mono> / {routeAction}</Mono> : null}
                        {!route.appGuard?.moduleKey && !routeAction && (
                          <span className="text-slate-400">{route.appGuard?.note || '—'}</span>
                        )}
                        {rowStatus && (
                          <div className="mt-1">
                            <StatusBadge status={rowStatus} labelOverride={ROUTE_STATUS_LABELS[rowStatus]} />
                          </div>
                        )}
                        {rowStatus === 'divergencia_modulo' && (
                          <p className="text-[11px] text-amber-600 mt-0.5">
                            Há divergência no módulo (menu x rota). Detalhes em “Divergências Conhecidas”.
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {route.adminOnly || route.appGuard?.requireAdmin
                          ? <Badge variant="outline" className={STATUS_STYLES.confirmado}>adminOnly</Badge>
                          : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 5.1 Comparador Menu x Rota x Registry (P1.2-B3, mirror/read-only) */}
      {showRoutes && <SurfaceComparatorSection moduleKey={moduleKey} />}

      {/* 6. Bloco Divergências Conhecidas */}
      {showKnownDivergences && divergences.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={ShieldAlert}>Divergências Conhecidas</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {divergences.map((d, idx) => (
              <div key={idx} className="rounded-md border bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={d.status} />
                  {d.risco && <Badge variant="outline" className={RISK_STYLES.default}>{d.risco}</Badge>}
                </div>
                <div className="text-slate-700"><strong>Local:</strong> {d.location}</div>
                {d.ruleMenu && d.ruleMenu !== 'n/a' && <div className="text-slate-600"><strong>Menu:</strong> {d.ruleMenu}</div>}
                {d.ruleRoute && d.ruleRoute !== 'n/a' && <div className="text-slate-600"><strong>Rota:</strong> {d.ruleRoute}</div>}
                {d.impact && <div className="text-slate-500"><strong>Impacto:</strong> {d.impact}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dependências externas */}
      {externalDependencies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={ShieldAlert}>Dependências Externas</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {externalDependencies.map((dep) => (
              <div key={dep.key} className="text-xs text-slate-600">
                <Mono>{dep.key}</Mono> (<Mono>{dep.legacyPerm}</Mono>) — origem:{' '}
                <Mono>{dep.sourceModule}</Mono>
                {dep.observation && <p className="text-slate-400 mt-0.5">{dep.observation}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 7. Bloco Backend / Services / Escopo */}
      {(showBackendRules || showScope) && (
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Server}>Backend / Services / Escopo (mirror)</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {showBackendRules && moduleDef.backendFunctions?.length > 0 && (
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wide">Backend Functions</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {moduleDef.backendFunctions.map((fn) => (
                    <Badge key={fn} variant="outline" className="font-mono text-[11px]">{fn}</Badge>
                  ))}
                </div>
              </div>
            )}
            {showBackendRules && moduleDef.services?.length > 0 && (
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wide">Services</p>
                <ul className="mt-1 space-y-0.5">
                  {moduleDef.services.map((s) => (
                    <li key={s}><Mono>{s}</Mono></li>
                  ))}
                </ul>
              </div>
            )}
            {showScope && moduleDef.scope && (
              <div className="border-t pt-2">
                <p className="font-semibold text-slate-500 uppercase tracking-wide">Escopo</p>
                <div className="mt-1 text-slate-600">
                  <div>Aplicável: {(moduleDef.scope.applicable || []).join(', ') || '—'}</div>
                  <div>Enforcement declarado: <Mono>{moduleDef.scope.enforcement || '—'}</Mono></div>
                  {moduleDef.scopeSource && <div>Origem: {moduleDef.scopeSource}</div>}
                  {moduleDef.scope.note && <p className="text-slate-400 mt-0.5">{moduleDef.scope.note}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {explanation?.note && (
        <p className="text-[11px] text-slate-400 italic px-1">{explanation.note}</p>
      )}
    </div>
  );
}