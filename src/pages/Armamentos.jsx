import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Crosshair,
  FileDigit,
  Filter,
  History,
  MoreVertical,
  PenSquare,
  Plus,
  Search,
  Shield,
  Wrench,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';

const normalizeText = (value) => value?.toString().toLowerCase().trim() || '';

const parseDate = (value) => {
  if (!value || typeof value !== 'string') return null;

  const brDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDateMatch) {
    const [, day, month, year] = brDateMatch;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return 'Não informada';
  return parsed.toLocaleDateString('pt-BR');
};

export default function Armamentos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin, isLoading: loadingUser, hasAccess, canAccessModule, getMilitarScopeFilters, isAccessResolved } = useCurrentUser();

  if (!loadingUser && !isAccessResolved) return null;
  if (!loadingUser && !canAccessModule('armamentos')) return <AccessDenied modulo="Armamentos" />;

  const { data: armamentos = [], isLoading } = useQuery({
    queryKey: ['armamentos', isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        return base44.entities.Armamento.list('-created_date');
      }

      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];

      const militarQueries = await Promise.all(
        scopeFilters.map((f) => base44.entities.Militar.filter(f))
      );
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];

      if (!militarIds.length) return [];

      const queryPromises = militarIds.map(id =>
        base44.entities.Armamento.filter({ militar_id: id }, '-created_date')
      );
      
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => m.set(item.id, item));
      return Array.from(m.values()).sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0));
    },
    enabled: isAccessResolved && canAccessModule('armamentos'),
  });

  const filteredArmamentos = useMemo(() => {
    const normalizedTerm = normalizeText(searchTerm);

    if (!normalizedTerm) return armamentos;

    return armamentos.filter((arma) => {
      const terms = [
        arma.tipo,
        arma.numero_serie,
        arma.cad_bm,
        arma.numero_sigma,
        arma.militar_nome,
        arma.militar_posto,
        arma.calibre,
        arma.marca,
        arma.modelo,
      ];

      return terms.some((term) => normalizeText(term).includes(normalizedTerm));
    });
  }, [armamentos, searchTerm]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalRegistrado = armamentos.length;
  const crafVencidoOuIrregular = armamentos.filter((arma) => {
    const status = normalizeText(arma.status);
    if (status.includes('vencido') || status.includes('irregular') || status.includes('suspenso')) return true;

    const validade = parseDate(arma.validade_craf);
    return validade ? validade < today : false;
  }).length;
  const crafRegular = totalRegistrado - crafVencidoOuIrregular;

  const getStatusBadge = (arma) => {
    const status = normalizeText(arma.status);
    const validade = parseDate(arma.validade_craf);
    const isExpired = validade ? validade < today : false;

    if (status.includes('suspenso')) {
      return {
        icon: Wrench,
        label: 'Suspenso',
        className: 'bg-amber-100 text-amber-700',
      };
    }

    if (status.includes('vencido') || status.includes('irregular') || isExpired) {
      return {
        icon: AlertTriangle,
        label: 'CRAF Vencido',
        className: 'bg-red-100 text-red-700',
      };
    }

    return {
      icon: CheckCircle2,
      label: 'Regular',
      className: 'bg-emerald-100 text-emerald-700',
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2.5 rounded-xl text-white shadow-sm">
              <Shield size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Armamentos Particulares</h1>
              <p className="text-slate-500 text-sm">Controle de registro e porte de armas de fogo do efetivo</p>
            </div>
          </div>

          <Button
            onClick={() => navigate(createPageUrl('CadastrarArmamento'))}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm text-sm"
          >
            <Plus size={18} />
            Novo Registro
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
              <Crosshair size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Total Registrado</p>
              <h4 className="text-2xl font-bold text-slate-900">{totalRegistrado}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Regulares (CRAF Ativo)</p>
              <h4 className="text-2xl font-bold text-slate-900">{crafRegular}</h4>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">CRAF Vencido / Irregular</p>
              <h4 className="text-2xl font-bold text-slate-900">{crafVencidoOuIrregular}</h4>
            </div>
          </div>
        </div>

        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por militar, tipo, número de série ou CAD BM..."
              className="block w-full pl-10 pr-3 py-2.5 border-none bg-transparent focus:ring-0 text-slate-900 placeholder-slate-400 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="w-px bg-slate-200 hidden md:block"></div>
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors"
          >
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredArmamentos.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum armamento encontrado</h3>
            <p className="text-sm text-slate-500">Tente ajustar o termo de busca para localizar registros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArmamentos.map((arma) => {
              const statusBadge = getStatusBadge(arma);
              const StatusIcon = statusBadge.icon;

              return (
                <div
                  key={arma.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="bg-slate-100 p-2.5 rounded-lg text-slate-700 mt-1">
                        <Crosshair size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{arma.tipo || 'Tipo não informado'}</h3>
                        <p className="text-slate-500 text-sm font-medium">
                          {arma.marca || 'Marca não informada'} • {arma.calibre || 'Calibre não informado'}
                        </p>
                        <div className="mt-3 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded text-sm font-mono text-slate-700 border border-slate-200 inline-flex">
                          <FileDigit size={14} className="text-slate-400" />
                          SN: {arma.numero_serie || 'Não informado'}
                        </div>
                      </div>
                    </div>

                    <span className={`${statusBadge.className} px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1`}>
                      <StatusIcon size={12} /> {statusBadge.label}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-0.5">Nº SIGMA</span>
                        <span className="text-slate-800 font-medium">{arma.numero_sigma || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-0.5">Nº CRAF</span>
                        <span className="text-slate-800 font-medium">{arma.numero_craf || arma.cad_bm || 'Não informado'}</span>
                      </div>
                      <div className="col-span-2 mt-1">
                        <div
                          className={`flex items-center gap-1.5 text-xs font-medium ${
                            statusBadge.label === 'CRAF Vencido' ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          <CalendarDays size={14} />
                          Validade CRAF: {formatDate(arma.validade_craf)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold block mb-2">Proprietário</span>

                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="bg-slate-200 text-slate-700 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm">
                          {(arma.militar_nome || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-slate-800 truncate">{arma.militar_nome || 'Não vinculado'}</p>
                          <p className="text-xs text-slate-500">
                            {arma.militar_posto || 'Posto não informado'} • Mat: {arma.militar_matricula || 'Não informada'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                    <button type="button" className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-sm font-medium">
                      <History size={16} /> Histórico
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                        title="Editar"
                        onClick={() => navigate(createPageUrl('CadastrarArmamento') + `?id=${arma.id}`)}
                      >
                        <PenSquare size={18} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
                        title="Mais opções"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
