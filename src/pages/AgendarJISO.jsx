import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Search, Clock, ArrowRight, Edit } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

export default function AgendarJISO() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin, getMilitarScopeFilters, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAtestadosAccess = canAccessModule('atestados');
  const isAccessPending = loadingUser || !isAccessResolved;


  const { data: atestados = [], isLoading: isLoadingAtestados } = useQuery({
    queryKey: ['atestados-jiso', isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        const all = await base44.entities.Atestado.list('-created_date');
        return all.filter(a => a.necessita_jiso);
      }
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];

      const queryPromises = militarIds.map(id => base44.entities.Atestado.filter({ militar_id: id }, '-created_date'));
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => {
        if(item.necessita_jiso) m.set(item.id, item);
      });
      return Array.from(m.values()).sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0));
    },
    enabled: hasAtestadosAccess && isAccessResolved,
  });

  const { data: jisos = [] } = useQuery({
    queryKey: ['jisos', isAdmin],
    queryFn: async () => {
      if (isAdmin) return base44.entities.JISO.list('-created_date');
      const scopeFilters = getMilitarScopeFilters();
      if (!scopeFilters.length) return [];
      const militarQueries = await Promise.all(scopeFilters.map((f) => base44.entities.Militar.filter(f)));
      const militaresAcess = militarQueries.flat();
      const militarIds = [...new Set(militaresAcess.map(m => m.id).filter(Boolean))];
      if (!militarIds.length) return [];
      
      const queryPromises = militarIds.map(id => base44.entities.JISO.filter({ militar_id: id }, '-created_date'));
      const arrays = await Promise.all(queryPromises);
      const m = new Map();
      arrays.flat().forEach(item => m.set(item.id, item));
      return Array.from(m.values()).sort((a,b) => new Date(b.created_date||0) - new Date(a.created_date||0));
    },
    enabled: hasAtestadosAccess && isAccessResolved,
  });

  const filteredAtestados = atestados.filter(a =>
    a.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getJISOForAtestado = (atestadoId) => {
    return jisos.find(j => j.atestado_id === atestadoId);
  };

  const statusColors = {
    'Aguardando Realização': 'bg-yellow-100 text-yellow-700',
    'Realizada': 'bg-green-100 text-green-700',
    'Cancelada': 'bg-red-100 text-red-700'
  };

  if (isAccessPending) {
    return null;
  }

  if (!hasAtestadosAccess) {
    return <AccessDenied modulo="Atestados" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Agenda JISO</h1>
              <p className="text-slate-500">Junta de Inspeção de Saúde - Gestão e Pareceres</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoadingAtestados ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAtestados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum atestado encaminhado para JISO</h3>
            <p className="text-slate-500">Atestados marcados para JISO aparecerão aqui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAtestados.map((atestado) => {
              const jiso = getJISOForAtestado(atestado.id);
              
              return (
                <div 
                  key={atestado.id} 
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {atestado.militar_posto} {atestado.militar_nome}
                        </h3>
                        {jiso && (
                          <Badge className={statusColors[jiso.status]}>
                            {jiso.status}
                          </Badge>
                        )}
                        {!jiso && (
                          <Badge className="bg-amber-100 text-amber-700">
                            Aguardando Registro
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                        <div>
                          <p className="text-xs text-slate-500">Matrícula</p>
                          <p className="font-medium">{atestado.militar_matricula}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tipo</p>
                          <p className="font-medium">{atestado.tipo_afastamento}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Dias Originais</p>
                          <p className="font-medium">{atestado.dias} dias</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Início</p>
                          <p className="font-medium">
                            {atestado.data_inicio ? format(new Date(atestado.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                          </p>
                        </div>
                      </div>
                      {jiso && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-slate-500">Data JISO</p>
                              <p className="font-medium text-blue-600">
                                {jiso.data_jiso ? format(new Date(jiso.data_jiso + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Finalidade</p>
                              <p className="font-medium">{jiso.finalidade_jiso || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Resultado</p>
                              <p className="font-medium">{jiso.resultado_jiso || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Dias JISO</p>
                              <p className="font-medium text-green-600">{jiso.dias_jiso || '-'} dias</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {/* Botão só é exibido se o usuário tiver permissão para registrar/editar JISO,
                          alinhando a UI com a action key validada em EditarJISO.jsx (registrar_decisao_jiso) */}
                      {canAccessAction('registrar_decisao_jiso') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(createPageUrl('EditarJISO') + `?atestado_id=${atestado.id}`)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {jiso ? 'Editar JISO' : 'Registrar JISO'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`)}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
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