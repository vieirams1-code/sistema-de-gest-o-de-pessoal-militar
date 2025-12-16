import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Plus, Search, Clock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

export default function AgendarJISO() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: atestados = [], isLoading } = useQuery({
    queryKey: ['atestados-jiso'],
    queryFn: () => base44.entities.Atestado.filter({ necessita_jiso: true }, '-created_date')
  });

  const filteredAtestados = atestados.filter(a =>
    a.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.militar_matricula?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    'Ativo': 'bg-blue-100 text-blue-700',
    'Encaminhado para JISO': 'bg-yellow-100 text-yellow-700',
    'JISO Realizada': 'bg-green-100 text-green-700'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Agenda JISO</h1>
              <p className="text-slate-500">Junta de Inspeção de Saúde</p>
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

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAtestados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Clock className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum atestado para JISO</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAtestados.map((atestado) => (
              <div key={atestado.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(createPageUrl('VerAtestado') + `?id=${atestado.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {atestado.militar_posto} {atestado.militar_nome}
                      </h3>
                      <Badge className={statusColors[atestado.status]}>
                        {atestado.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">Mat: {atestado.militar_matricula}</p>
                    <p className="text-sm text-slate-600">Tipo: {atestado.tipo_afastamento}</p>
                    <p className="text-sm text-slate-600">Dias: {atestado.dias}</p>
                    {atestado.data_jiso && (
                      <p className="text-sm text-green-600 font-medium mt-2">
                        JISO agendada para: {format(new Date(atestado.data_jiso + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
                    )}
                    {atestado.finalidade_jiso && (
                      <p className="text-sm text-slate-600">Finalidade: {atestado.finalidade_jiso}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}