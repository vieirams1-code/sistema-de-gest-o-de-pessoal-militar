import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Search, UserRound, BadgeCheck, Hash, Building2, ArrowRight, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { carregarMilitaresComMatriculas, filtrarMilitaresOperacionais } from '@/services/matriculaMilitarViewService';
import { construirAtalhosMilitar } from '@/services/globalMilitarSearchService';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';

const RESULT_LIMIT = 10;
const BACKEND_LIMIT = 50;
const DEBOUNCE_MS = 300;

function getMilitarStatus(militar = {}) {
  const status = String(militar?.situacao_militar || militar?.status_cadastro || '').trim().toLowerCase();
  if (!status) return null;
  if (status.includes('férias') || status.includes('ferias')) return 'Férias';
  if (status.includes('afastado')) return 'Afastado';
  if (status.includes('inativo')) return 'Inativo';
  return 'Ativo';
}

function getAvatarLabel(militar = {}) {
  const name = String(militar?.nome_guerra || militar?.nome_completo || '').trim();
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function GlobalMilitarSearch() {
  const {
    canAccessAction,
    isAccessResolved,
  } = useCurrentUser();


  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    const handleWindowKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowDropdown(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, []);

  const effectiveEmail = getEffectiveEmail();

  const hasAnyPermissaoAtalho = (
    canAccessAction('visualizar_militares')
    || canAccessAction('visualizar_ferias')
    || canAccessAction('visualizar_medalhas')
    || canAccessAction('visualizar_registros_militar')
    || canAccessAction('visualizar_acervo_historico')
  );

  const { data: militaresAcessiveis = [], isLoading } = useQuery({
    queryKey: ['global-search-militares', debouncedTerm, effectiveEmail || 'self'],
    queryFn: async () => {
      const { militares } = await fetchScopedMilitares({
        search: debouncedTerm,
        limit: BACKEND_LIMIT,
        offset: 0,
        includeFoto: false,
      });
      const enriquecidos = await carregarMilitaresComMatriculas(militares);
      const militaresOperacionais = filtrarMilitaresOperacionais(enriquecidos, { incluirInativos: true });
      const resultadosMilitares = militaresOperacionais.map((militar) => ({ type: 'militar', id: `militar-${militar.id}`, data: militar }));

      if (!canAccessAction('visualizar_acervo_historico')) return resultadosMilitares;

      const termo = debouncedTerm.toLowerCase();
      const [documentos, todosMilitares] = await Promise.all([
        base44.entities.AcervoFuncionalHistorico.list(),
        base44.entities.Militar.list(),
      ]);
      const militarPorId = new Map(todosMilitares.map((militar) => [militar.id, militar]));
      const resultadosDocumentos = documentos
        .filter((doc) => doc?.ativo !== false && doc?.status_documento === 'ATIVO')
        .map((doc) => ({ ...doc, militar: militarPorId.get(doc.militar_id) }))
        .filter((doc) => {
          const militar = doc.militar || {};
          const texto = [doc.titulo, doc.observacoes, doc.tipo_documento, militar.nome_guerra, militar.nome_completo, militar.matricula]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return texto.includes(termo);
        })
        .slice(0, Math.max(0, RESULT_LIMIT - resultadosMilitares.length))
        .map((doc) => ({ type: 'documento', id: `documento-${doc.id}`, data: doc }));

      return [...resultadosMilitares, ...resultadosDocumentos];
    },
    enabled: isAccessResolved && hasAnyPermissaoAtalho && debouncedTerm.length > 0,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const resultados = useMemo(
    () => militaresAcessiveis.slice(0, RESULT_LIMIT),
    [militaresAcessiveis],
  );

  useEffect(() => {
    if (!showDropdown || resultados.length === 0) {
      setSelectedIndex(-1);
      return;
    }

    setSelectedIndex((current) => {
      if (current < 0 || current >= resultados.length) return 0;
      return current;
    });
  }, [resultados.length, showDropdown]);

  const handleSelect = (item) => {
    if (item?.type === 'documento') {
      const militarId = item.data?.militar_id;
      if (!militarId) return;
      navigate(`${createPageUrl('VerMilitar')}?id=${militarId}&tab=acervo-historico`);
      setShowDropdown(false);
      return;
    }

    const militar = item?.type === 'militar' ? item.data : item;
    if (!militar?.id) return;
    navigate(`${createPageUrl('VerMilitar')}?id=${militar.id}`);
    setShowDropdown(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
      return;
    }

    if (!showDropdown || resultados.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % resultados.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => (current <= 0 ? resultados.length - 1 : current - 1));
      return;
    }

    if (event.key === 'Enter' && selectedIndex >= 0 && selectedIndex < resultados.length) {
      event.preventDefault();
      handleSelect(resultados[selectedIndex]);
    }
  };

  const melhorResultado = resultados[0] || null;
  const outrosResultados = resultados.slice(1);
  const temBusca = debouncedTerm.length > 0;

  if (!hasAnyPermissaoAtalho) return null;

  const renderResultCard = (item, index) => {
    const selected = index === selectedIndex;

    if (item.type === 'militar') {
      const militar = item.data;
      const atalhos = construirAtalhosMilitar({ militarId: militar.id, canAccessAction });
      const status = getMilitarStatus(militar);

      return (
        <div
          key={`militar-${militar.id}`}
          role="option"
          aria-selected={selected}
          tabIndex={-1}
          onClick={(event) => {
            if (event.target.closest('a')) return;
            handleSelect(item);
          }}
          className={`rounded-2xl border p-3 transition ${selected ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'} cursor-pointer`}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
              {militar.foto ? (
                <img src={militar.foto} alt={militar.nome_guerra || militar.nome_completo} className="h-12 w-12 rounded-2xl object-cover" />
              ) : getAvatarLabel(militar)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {militar.posto_graduacao && (
                  <Badge variant="outline" className="text-slate-700">
                    <BadgeCheck className="w-3 h-3 mr-1" />
                    {militar.posto_graduacao}
                  </Badge>
                )}
                {status && (
                  <Badge variant="secondary" className="text-slate-700 bg-slate-100">
                    {status}
                  </Badge>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">{militar.nome_guerra || militar.nome_completo}</p>
                  <p className="truncate text-sm text-slate-500">{militar.nome_guerra && militar.nome_completo ? militar.nome_completo : ''}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{militar.quadro || ''}</span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5" /> {militar.nome_completo || '-'}</span>
                <span className="inline-flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {militar.matricula || '-'}</span>
                {(militar.subgrupamento_nome || militar.grupamento_nome || militar.lotacao_atual || militar.lotacao) && (
                  <span className="inline-flex items-center gap-1 col-span-full sm:col-auto"><Building2 className="w-3.5 h-3.5" /> {militar.subgrupamento_nome || militar.grupamento_nome || militar.lotacao_atual || militar.lotacao}</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        </div>
      );
    } else {
      const doc = item.data;
      return (
        <div
          key={`documento-${doc.id}`}
          role="option"
          aria-selected={selected}
          tabIndex={-1}
          onClick={() => handleSelect(item)}
          className={`rounded-2xl border p-3 transition ${selected ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'} cursor-pointer`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">{doc.tipo_documento}</Badge>
                <span className="text-[10px] text-slate-400">{doc.data_documento ? format(new Date(doc.data_documento + 'T00:00:00'), "dd/MM/yyyy") : ''}</span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-900">{doc.titulo || 'Documento sem título'}</p>
              <p className="truncate text-xs text-slate-500">{doc.militar?.nome_guerra || doc.militar?.nome_completo || 'Militar não identificado'} · {doc.militar?.matricula || 'sem matrícula'}</p>
              {doc.observacoes && <p className="truncate text-xs text-slate-500">{doc.observacoes}</p>}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="relative w-full max-w-3xl">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          ref={inputRef}
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar militar por nome, matrícula, CPF, lotação, posto..."
          className="pl-9 bg-white"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-[420px] overflow-y-auto p-2 space-y-2">
            {!isLoading && !temBusca && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 text-center">
                <p className="font-semibold text-slate-900">Digite para buscar militares</p>
                <p className="mt-1 text-slate-500">Use Ctrl+K para abrir de qualquer tela</p>
              </div>
            )}

            {temBusca && !isLoading && resultados.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 text-center">
                Nenhum militar encontrado
              </div>
            )}

            {temBusca && resultados.length > 0 && (
              <div className="space-y-4">
                <div>
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-600">Melhor correspondência</p>
                  <div className="mt-2">{renderResultCard(melhorResultado, 0)}</div>
                </div>

                {outrosResultados.length > 0 && (
                  <div>
                    <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">Outros resultados</p>
                    <div className="mt-2 space-y-2">
                      {outrosResultados.map((militar, index) => renderResultCard(militar, index + 1))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {temBusca && resultados.length >= RESULT_LIMIT && (
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