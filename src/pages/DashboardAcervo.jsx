import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Users,
  FileText,
  History,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardAcervo() {
  const { data: stats } = useQuery({
    queryKey: ['acervo-stats'],
    queryFn: async () => {
      const acervo = await base44.entities.AcervoFuncionalHistorico.list();
      const militares = await base44.entities.Militar.list();
      const importacoes = await base44.entities.ImportacaoAcervo.list('-data_inicio', 5);

      const comAcervo = new Set(acervo.map(a => a.militar_id)).size;

      return {
        totalDocumentos: acervo.length,
        militaresComAcervo: comAcervo,
        militaresSemAcervo: militares.length - comAcervo,
        totalMilitares: militares.length,
        pendenciasRevisao: acervo.filter(a => !a.validado || a.confianca_identificacao === 'BAIXA').length,
        duplicidades: acervo.filter(a => a.status_documento === 'SUBSTITUIDO').length,
        ultimasImportacoes: importacoes
      };
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Painel Operacional da Digitalização
        </h1>
        <p className="text-slate-500">Métricas e acompanhamento do Acervo Funcional Histórico</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          title="Militares com Acervo"
          value={stats?.militaresComAcervo}
          subtitle={`${Math.round((stats?.militaresComAcervo / stats?.totalMilitares) * 100) || 0}% do efetivo`}
          icon={Users}
          color="emerald"
        />
        <MetricCard
          title="Militares sem Acervo"
          value={stats?.militaresSemAcervo}
          subtitle="Aguardando digitalização"
          icon={Users}
          color="amber"
        />
        <MetricCard
          title="Total Documentos"
          value={stats?.totalDocumentos}
          subtitle="Arquivos no Drive"
          icon={FileText}
          color="blue"
        />
        <MetricCard
          title="Pendências de Revisão"
          value={stats?.pendenciasRevisao}
          subtitle="Confiança baixa ou manual"
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" /> Últimas Importações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Arquivos</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.ultimasImportacoes?.map(imp => (
                  <TableRow key={imp.id}>
                    <TableCell className="text-sm">
                      {format(new Date(imp.data_inicio), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">{imp.usuario}</TableCell>
                    <TableCell>
                      <Badge className={
                        imp.status === 'CONCLUIDA' ? 'bg-emerald-100 text-emerald-700' :
                        imp.status === 'PROCESSANDO' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }>
                        {imp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-bold">{imp.total_arquivos}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600 font-bold">{imp.importados}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Cobertura Documental
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <CoverageItem label="Cobertura Completa" value={stats?.militaresComAcervo} total={stats?.totalMilitares} color="bg-emerald-500" />
            <CoverageItem label="Cobertura Parcial" value={0} total={stats?.totalMilitares} color="bg-amber-500" />
            <CoverageItem label="Sem Acervo" value={stats?.militaresSemAcervo} total={stats?.totalMilitares} color="bg-slate-300" />

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">Meta de Digitalização</span>
                <span className="font-bold">65%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: '45%' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-800">{value || 0}</h3>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageItem({ label, value, total, color }) {
  const percent = Math.round((value / total) * 100) || 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold">
        <span>{label}</span>
        <span>{value} ({percent}%)</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
