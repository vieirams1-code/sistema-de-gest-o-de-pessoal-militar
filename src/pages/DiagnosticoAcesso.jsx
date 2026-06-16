/**
 * DiagnosticoAcesso.jsx — P1.2-A2 (MIRROR / READ-ONLY)
 * ============================================================================
 * Página administrativa de diagnóstico PASSIVO de acesso.
 *
 *  - adminOnly (rota protegida por RequireAdmin no App.jsx).
 *  - Usa useCurrentUser apenas para contexto de runtime já disponível.
 *  - NÃO chama backend novo, NÃO consulta base44.entities.
 *  - NÃO faz create/update/delete, NÃO acessa storage, NÃO navega.
 *  - NÃO aplica enforcement, NÃO altera permissões/perfis/menu/rotas.
 *  - NÃO expõe dados operacionais sensíveis nem PII (email/full_name etc.).
 *
 * Passa ao AccessConsistencyReport apenas objetos sanitizados (sem PII) e o
 * objeto de permissões no formato esperado pelo diagnóstico.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessConsistencyReport from '@/components/diagnostico/AccessConsistencyReport';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, ShieldCheck } from 'lucide-react';

const MODULOS_DIAGNOSTICO = [
  { key: 'militares', label: 'Militares' },
  { key: 'ferias', label: 'Férias' },
  { key: 'atestados', label: 'Atestados' },
];

export default function DiagnosticoAcesso() {
  const [selectedModule, setSelectedModule] = useState('militares');
  const { isAdmin, modoAcesso, isImpersonating, permissions, user } = useCurrentUser();

  // Contexto sanitizado — SEM PII (sem email, full_name, nome, CPF, matrícula).
  const safeCurrentUser = useMemo(() => ({
    kind: 'authenticated_user',
    isAdmin: Boolean(isAdmin),
    modoAcesso: modoAcesso || null,
    hasUser: Boolean(user),
  }), [isAdmin, modoAcesso, user]);

  const safeEffectiveUser = useMemo(() => ({
    kind: 'effective_user',
    isImpersonating: Boolean(isImpersonating),
    hasEffectiveUser: Boolean(isImpersonating),
  }), [isImpersonating]);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-slate-600" />
        <h1 className="text-xl font-bold text-slate-800">Diagnóstico de Acesso</h1>
      </div>

      {/* Aviso fixo de modo mirror */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Diagnóstico informativo em modo <strong>mirror</strong>. Esta tela não altera permissões,
          rotas, menu, perfis ou comportamento do sistema.
        </AlertDescription>
      </Alert>

      {/* Status de impersonação (sem PII) */}
      {isImpersonating && (
        <Alert className="border-orange-200 bg-orange-50">
          <Info className="w-4 h-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-sm">
            Sessão de diagnóstico em modo usuário efetivo (impersonação ativa). Identificadores
            pessoais não são exibidos nesta tela.
          </AlertDescription>
        </Alert>
      )}

      {/* Seletor de módulo */}
      <div className="flex flex-wrap gap-2">
        {MODULOS_DIAGNOSTICO.map((m) => (
          <Button
            key={m.key}
            type="button"
            variant={selectedModule === m.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedModule(m.key)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {/* Relatório de consistência (componente passivo) */}
      <AccessConsistencyReport
        moduleKey={selectedModule}
        userPermissions={permissions}
        currentUser={safeCurrentUser}
        effectiveUser={safeEffectiveUser}
        isImpersonating={Boolean(isImpersonating)}
        showKnownDivergences
        showRoutes
        showActions
        showScope
        showBackendRules
      />

      <p className="text-[11px] text-slate-400 italic text-center pt-2">
        Diagnóstico read-only. Nenhuma permissão, perfil ou rota é alterada por esta tela.
      </p>
    </div>
  );
}