import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Users, Award, Shield } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const stats = {
    totalMilitares: militares.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Dashboard</h1>
          <p className="text-slate-500">Visão geral do sistema</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-3xl font-bold text-[#1e3a5f]">{stats.totalMilitares}</p>
                <p className="text-sm text-slate-500">Militares Ativos</p>
              </div>
            </div>
          </div>

        </div>

        {/* Atalhos Rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Atalhos Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Militares'))}
            >
              <Users className="w-6 h-6 mb-2" />
              <span>Efetivo</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Punicoes'))}
            >
              <Shield className="w-6 h-6 mb-2" />
              <span>Punições</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Medalhas'))}
            >
              <Award className="w-6 h-6 mb-2" />
              <span>Medalhas</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => navigate(createPageUrl('Armamentos'))}
            >
              <Shield className="w-6 h-6 mb-2" />
              <span>Armamentos</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}