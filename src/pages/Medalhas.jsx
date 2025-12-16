import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, Plus, Search, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";

export default function Medalhas() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: medalhas = [], isLoading } = useQuery({
    queryKey: ['medalhas'],
    queryFn: () => base44.entities.Medalha.list('-created_date')
  });

  const filteredMedalhas = medalhas.filter(m =>
    m.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tipo_medalha_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    'Indicado': 'bg-blue-100 text-blue-700',
    'Concedido': 'bg-green-100 text-green-700',
    'Negado': 'bg-red-100 text-red-700'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Medalhas</h1>
              <p className="text-slate-500">Gerenciar indicações e concessões</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl('TiposMedalha'))}
            >
              <Settings className="w-5 h-5 mr-2" />
              Tipos de Medalha
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('CadastrarMedalha'))}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nova Indicação
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou tipo de medalha..."
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
        ) : filteredMedalhas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Award className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma medalha encontrada</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMedalhas.map((medalha) => (
              <div key={medalha.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <Award className="w-10 h-10 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">{medalha.tipo_medalha_nome}</h3>
                      <Badge className={statusColors[medalha.status]}>{medalha.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      {medalha.militar_posto} {medalha.militar_nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      Indicado em: {format(new Date(medalha.data_indicacao + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                    {medalha.data_concessao && (
                      <p className="text-xs text-slate-500">
                        Concedido em: {format(new Date(medalha.data_concessao + 'T00:00:00'), 'dd/MM/yyyy')}
                      </p>
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