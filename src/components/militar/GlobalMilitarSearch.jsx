import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, UserRound, BadgeCheck, Hash, Building2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais } from '@/services/matriculaMilitarViewService';
import {
  construirAtalhosMilitar,
  filtrarMilitaresGlobal,
  filtrarMilitaresPorEscopo,
} from '@/services/globalMilitarSearchService';

const RESULT_LIMIT = 10;
const DEBOUNCE_MS = 300;

export default function GlobalMilitarSearch() {
  const {
    isAdmin,
    subgrupamentoId,
    subgrupamentoTipo,
    modoAcesso,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
    hasSelfAccess,
    hasAccess,
    canAccessAction,
    isAccessResolved,
    getMilitarScopeFilters,
  } = useCurrentUser();

  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: militaresAcessiveis = [], isLoading } = useQuery({
    queryKey: ['global-search-militares', isAdmin, subgrupamentoId, subgrupamentoTipo, modoAcesso, userEmail, linkedMilitarId, linkedMilitarEmail],
    queryFn: async () => {
      if (isAdmin) {
        const lista = await base44.entities.Militar.list('-created_date');
        const enriquecidos = await carregarMilitaresComMatriculas(lista);
        return filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: true });
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, '-created_date'));
        for (const email of knownEmails) {
          requests.push(base44.entities.Militar.filter({ email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ created_by: email }, '-created_date'));
          requests.push(base44.entities.Militar.filter({ militar_email: email }, '-created_date'));
        }

        const batches = await Promise.all(requests);
        const ids = new Set();
        const vinculados = batches.flat().filter((m) => {
          if (!hasSelfAccess(m) || ids.has(m.id)) return false;
          ids.add(m.id);
          return true;
        });

        const enriquecidos = await carregarMilitaresComMatriculas(vinculados);
        return filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: true });
      }

      const filters = getMilitarScopeFilters();
      if (!filters.length) return [];

      const requests = filters.map((f) => base44.entities.Militar.filter(f, '-created_date'));
      const batches = await Promise.all(requests);
      const ids = new Set();
      const merged = [];
      for (const militar of batches.flat()) {
        if (ids.has(militar.id)) continue;
        ids.add(militar.id);
        merged.push(militar);
      }

      const enriquecidos = await carregarMilitaresComMatriculas(merged);
      const operacionais = filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: true });
      return filtrarMilitaresPorEscopo(operacionais, { hasAccess, hasSelfAccess });
    },
    enabled: isAccessResolved && (
      canAccessAction('visualizar_militares')
      || canAccessAction('visualizar_ferias')
      || canAccessAction('visualizar_medalhas')
      || canAccessAction('visualizar_registros_militar')
    ),
    staleTime: 5 * 60 * 1000,
  });

  const resultados = useMemo(
    () => filtrarMilitaresGlobal(militaresAcessiveis, debouncedTerm, { limit: RESULT_LIMIT }),
    [militaresAcessiveis, debouncedTerm],
  );

  const hasAnyPermissaoAtalho = (
    canAccessAction('visualizar_militares')
    || canAccessAction('visualizar_ferias')
    || canAccessAction('visualizar_medalhas')
    || canAccessAction('visualizar_registros_militar')
  );

  if (!hasAnyPermissaoAtalho) return null;

  return (
    <div className="relative w-full max-w-3xl">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
          placeholder="Pesquisar militar por nome, nome de guerra, matrícula ou CPF..."
          className="pl-9 bg-white"
        />
      </div>

      {showDropdown && debouncedTerm.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[420px] overflow-y-auto p-2 space-y-2">
            {!isLoading && resultados.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 text-center">
                Nenhum militar encontrado
              </div>
            )}

            {resultados.map((militar) => {
              const atalhos = construirAtalhosMilitar({ militarId: militar.id, canAccessAction });
              return (
                <div key={militar.id} className="rounded-lg border border-slate-100 p-3 hover:border-slate-200 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {militar.posto_graduacao && (
                      <Badge variant="outline" className="text-slate-700">
                        <BadgeCheck className="w-3 h-3 mr-1" />
                        {militar.posto_graduacao}
                      </Badge>
                    )}
                    <span className="font-semibold text-slate-900">{militar.nome_guerra || militar.nome_completo}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 mb-3">
                    <span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5" /> {militar.nome_completo || '-'}</span>
                    <span className="inline-flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> Matrícula: {militar.matricula || '-'}</span>
                    {militar.lotacao && (
                      <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {militar.lotacao}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {atalhos.map((atalho) => (
                      <Button
                        key={atalho.key}
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
                        <Link to={`${createPageUrl(atalho.page)}${atalho.query}`}>
                          {atalho.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {resultados.length >= RESULT_LIMIT && (
            <div className="border-t border-slate-100 p-2">
              <Button asChild variant="ghost" className="w-full justify-between text-slate-700">
                <Link to={`${createPageUrl('Militares')}?q=${encodeURIComponent(debouncedTerm)}`}>
                  Ver todos os resultados
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
