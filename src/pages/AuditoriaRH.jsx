import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  Search,
  Filter,
  FileWarning,
  User,
  ChevronRight,
  Download
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fetchScopedMilitares, getEffectiveEmail } from '@/services/getScopedMilitaresClient';
import { listarInconsistenciasCadastraisMilitar } from '@/utils/inconsistenciasCadastrais';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function AuditoriaRH() {
  const navigate = useNavigate();
  const { isAccessResolved, canAccessModule } = useCurrentUser();
  const effectiveEmail = getEffectiveEmail() || 'self';

  const [busca, setBusca] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('todos');

  const { data: militaresData, isLoading } = useQuery({
    queryKey: ['auditoria-rh-militares', effectiveEmail],
    queryFn: () => fetchScopedMilitares({ fetchAll: true, statusCadastro: 'Ativo' }),
    enabled: isAccessResolved,
  });

  const militares = militaresData?.militares || [];

  const auditoria = useMemo(() => {
    return militares.map(m => {
      const inconsistencias = listarInconsistenciasCadastraisMilitar(m);
      return {
        ...m,
        inconsistencias,
        totalInconsistencias: inconsistencias.length,
        temCritico: inconsistencias.some(i => i.nivel === 'critico'),
      };
    }).filter(m => m.totalInconsistencias > 0);
  }, [militares]);

  const resumo = useMemo(() => {
    const total = militares.length;
    const comPendencia = auditoria.length;
    const semPendencia = total - comPendencia;
    const saude = total > 0 ? Math.round((semPendencia / total) * 100) : 100;

    const criticos = auditoria.reduce((acc, m) => acc + m.inconsistencias.filter(i => i.nivel === 'critico').length, 0);
    const atencao = auditoria.reduce((acc, m) => acc + m.inconsistencias.filter(i => i.nivel === 'atencao').length, 0);

    return { total, comPendencia, semPendencia, saude, criticos, atencao };
  }, [militares, auditoria]);

  const auditoriaFiltrada = useMemo(() => {
    return auditoria.filter(m => {
      const matchBusca = !busca ||
        m.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
        m.matricula?.includes(busca) ||
        m.nome_guerra?.toLowerCase().includes(busca.toLowerCase());

      const matchNivel = filtroNivel === 'todos' ||
        (filtroNivel === 'critico' && m.temCritico) ||
        (filtroNivel === 'atencao' && m.inconsistencias.some(i => i.nivel === 'atencao'));

      return matchBusca && matchNivel;
    }).sort((a, b) => b.totalInconsistencias - a.totalInconsistencias);
  }, [auditoria, busca, filtroNivel]);

  if (!canAccessModule('militares')) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-slate-500">Você não tem permissão para acessar o módulo de Auditoria de RH.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Auditoria de RH</h1>
              <p className="text-slate-500 text-sm">Controle de integridade e qualidade dos dados cadastrais</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white">
              <Download className="w-4 h-4 mr-2" /> Exportar Relatório
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Saúde dos Dados</p>
                  <p className="text-3xl font-bold text-slate-800">{resumo.saude}%</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${resumo.saude > 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                  <ClipboardCheck className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${resumo.saude > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${resumo.saude}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Militares Auditados</p>
                  <p className="text-3xl font-bold text-slate-800">{resumo.total}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">{resumo.comPendencia} com alguma pendência</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pendências Críticas</p>
                  <p className="text-3xl font-bold text-red-600">{resumo.criticos}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <FileWarning className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">Bloqueiam fluxos automáticos</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pendências de Atenção</p>
                  <p className="text-3xl font-bold text-amber-600">{resumo.atencao}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">Qualidade da comunicação/localização</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Buscar por nome, matrícula ou nome de guerra..."
              className="pl-10"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={filtroNivel} onValueChange={setFiltroNivel}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Nível de Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Níveis</SelectItem>
                <SelectItem value="critico">Apenas Críticos</SelectItem>
                <SelectItem value="atencao">Apenas Atenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-white border-b border-slate-100">
            <CardTitle className="text-lg">Resultados da Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Processando auditoria da força...</div>
            ) : auditoriaFiltrada.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardCheck className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Nenhuma pendência encontrada!</p>
                <p className="text-slate-400 text-sm">Os filtros aplicados não retornaram resultados ou todos os dados estão íntegros.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="w-[300px]">Militar</TableHead>
                    <TableHead>Lotação</TableHead>
                    <TableHead className="text-center">Total Pendências</TableHead>
                    <TableHead>Principais Inconsistências</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditoriaFiltrada.map((m) => (
                    <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden">
                            {m.foto ? <img src={m.foto} alt={m.nome_guerra} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">
                              {m.posto_graduacao} {m.nome_guerra}
                            </p>
                            <p className="text-xs text-slate-500">Matrícula: {m.matricula}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{m.lotacao || 'Não informada'}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={m.temCritico ? 'destructive' : 'warning'} className="rounded-full">
                          {m.totalInconsistencias}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[400px]">
                          {m.inconsistencias.slice(0, 3).map((inc, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                inc.nivel === 'critico' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}
                            >
                              {inc.nivel === 'critico' ? <AlertCircle className="w-2.5 h-2.5" /> : <Info className="w-2.5 h-2.5" />}
                              {inc.labelCampo}
                            </span>
                          ))}
                          {m.totalInconsistencias > 3 && (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                              +{m.totalInconsistencias - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => navigate(createPageUrl('VerMilitar') + `?id=${m.id}&tab=dados`)}
                        >
                          Ver Perfil <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
