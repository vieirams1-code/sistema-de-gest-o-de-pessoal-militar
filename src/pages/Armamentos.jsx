import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, Search, Edit } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function Armamentos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: armamentos = [], isLoading } = useQuery({
    queryKey: ['armamentos'],
    queryFn: () => base44.entities.Armamento.list('-created_date')
  });

  const filteredArmamentos = armamentos.filter(a =>
    a.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.numero_serie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.cad_bm?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.militar_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    'Ativo': 'bg-green-100 text-green-700',
    'Vendido': 'bg-blue-100 text-blue-700',
    'Extraviado': 'bg-red-100 text-red-700',
    'Furtado': 'bg-red-100 text-red-700',
    'Baixado': 'bg-slate-100 text-slate-700'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#1e3a5f]" />
            <div>
              <h1 className="text-3xl font-bold text-[#1e3a5f]">Armamentos</h1>
              <p className="text-slate-500">Controle de armamentos</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarArmamento'))}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Armamento
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Buscar por militar, tipo, número de série ou CAD BM..."
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
        ) : filteredArmamentos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhum armamento encontrado</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArmamentos.map((arma) => (
              <div key={arma.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(createPageUrl('CadastrarArmamento') + `?id=${arma.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{arma.tipo}</h3>
                  <Badge className={statusColors[arma.status]}>{arma.status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  {arma.militar_nome && (
                    <p><span className="font-medium">Militar:</span> {arma.militar_posto} {arma.militar_nome}</p>
                  )}
                  <p><span className="font-medium">Calibre:</span> {arma.calibre}</p>
                  <p><span className="font-medium">Marca:</span> {arma.marca}</p>
                  <p><span className="font-medium">N° Série:</span> {arma.numero_serie}</p>
                  {arma.cad_bm && <p><span className="font-medium">CAD BM:</span> {arma.cad_bm}</p>}
                  {arma.numero_sigma && <p><span className="font-medium">SIGMA:</span> {arma.numero_sigma}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}