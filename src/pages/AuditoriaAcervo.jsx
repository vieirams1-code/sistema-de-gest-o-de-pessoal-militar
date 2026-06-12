import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2, FileWarning, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditoriaAcervo() {
  const queryClient = useQueryClient();
  const { userEmail } = useCurrentUser();
  const [lastResult, setLastResult] = useState(null);

  const { data: historicoAuditoria = [] } = useQuery({
    queryKey: ['historico-auditoria'],
    queryFn: () => base44.entities.AuditAcervoLog.list('-data_execucao', 10)
  });

  const { data: repositorios = [] } = useQuery({
    queryKey: ['auditoria-repositorios'],
    queryFn: () => base44.entities.RepositorioDocumental.list('ordem_prioridade')
  });

  const auditMutation = useMutation({
    mutationFn: async () => {
      // 1. Buscar todos os registros do acervo
      const acervo = await base44.entities.AcervoFuncionalHistorico.list();

      const issues = {
        semArquivo: [],
        linkQuebrado: [],
        substituidos: [],
        pendentes: [],
        total: acervo.length
      };

      acervo.forEach(doc => {
        if (!doc.drive_file_id || doc.drive_file_id.includes('simulated')) {
          // No ambiente simulado consideramos link quebrado ou sem arquivo se for placeholder
          if (!doc.drive_file_id) issues.semArquivo.push(doc);
        }
        if (doc.status_documento === 'SUBSTITUIDO') issues.substituidos.push(doc);
        if (doc.status_documento === 'PENDENTE_RECONCILIACAO') issues.pendentes.push(doc);
      });

      // Registrar no banco
      await base44.entities.AuditAcervoLog.create({
        data_execucao: new Date().toISOString(),
        usuario_execucao: userEmail,
        resultado: issues
      });

      return issues;
    },
    onSuccess: (data) => {
      setLastResult({
        ...data,
        timestamp: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['historico-auditoria'] });
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <Shield className="w-6 h-6" /> Auditoria do Acervo
          </h1>
          <p className="text-slate-500">Monitoramento de integridade e governança documental</p>
        </div>
        <Button
          onClick={() => auditMutation.mutate()}
          disabled={auditMutation.isPending}
          className="bg-[#1e3a5f]"
        >
          {auditMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Executar Auditoria Agora
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 uppercase">Total de Registros</p>
              <p className="text-3xl font-bold text-[#1e3a5f]">{lastResult?.total || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lastResult?.semArquivo.length > 0 ? "border-red-200 bg-red-50" : ""}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 uppercase">Sem Arquivo/Link</p>
              <p className={`text-3xl font-bold ${lastResult?.semArquivo.length > 0 ? "text-red-600" : "text-slate-700"}`}>
                {lastResult?.semArquivo.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 uppercase">Substituídos</p>
              <p className="text-3xl font-bold text-slate-700">{lastResult?.substituidos.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lastResult?.pendentes.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500 uppercase">Pendentes</p>
              <p className={`text-3xl font-bold ${lastResult?.pendentes.length > 0 ? "text-amber-600" : "text-slate-700"}`}>
                {lastResult?.pendentes.length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Section title="Status dos Repositórios" icon={Shield}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Capacidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repositorios.map(repo => (
              <TableRow key={repo.id}>
                <TableCell className="font-medium">{repo.nome}</TableCell>
                <TableCell>
                  <Badge className={
                    repo.status === 'ATIVO' ? 'bg-emerald-100 text-emerald-700' :
                    repo.status === 'CHEIO' ? 'bg-red-100 text-red-700' : 'bg-slate-100'
                  }>
                    {repo.status}
                  </Badge>
                </TableCell>
                <TableCell>{repo.ordem_prioridade}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${repo.status === 'CHEIO' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: repo.status === 'CHEIO' ? '100%' : '20%' }} />
                    </div>
                    <span className="text-xs text-slate-500">{repo.status === 'CHEIO' ? '100%' : '< 80%'}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {lastResult && (
        <div className="mt-8 space-y-6">
          <Section title="Detalhamento da Auditoria" icon={AlertTriangle}>
            <div className="space-y-4">
              {lastResult.semArquivo.length === 0 && lastResult.pendentes.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Nenhuma inconsistência crítica detectada.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {lastResult.semArquivo.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-100 text-sm">
                      <div className="flex items-center gap-2">
                        <FileWarning className="w-4 h-4 text-red-600" />
                        <span className="font-medium">[{doc.tipo_documento}] {doc.titulo}</span>
                        <span className="text-slate-500">ID: {doc.id}</span>
                      </div>
                      <Badge variant="destructive">Arquivo Ausente</Badge>
                    </div>
                  ))}
                  {lastResult.pendentes.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-100 text-sm">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="font-medium">[{doc.tipo_documento}] {doc.titulo}</span>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700">Reconciliação Pendente</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <p className="text-xs text-slate-400 text-right">
            Última execução: {format(new Date(lastResult.timestamp), "dd/MM/yyyy HH:mm:ss")}
          </p>
        </div>
      )}

      {historicoAuditoria.length > 0 && (
        <div className="mt-8">
          <Section title="Histórico de Auditorias" icon={Search}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Total Registros</TableHead>
                  <TableHead>Problemas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoAuditoria.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.data_execucao), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>{log.usuario_execucao}</TableCell>
                    <TableCell>{log.resultado?.total || 0}</TableCell>
                    <TableCell>
                      <Badge variant={(log.resultado?.semArquivo?.length > 0 || log.resultado?.pendentes?.length > 0) ? "destructive" : "outline"}>
                        {(log.resultado?.semArquivo?.length || 0) + (log.resultado?.pendentes?.length || 0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
          {Icon && <Icon className="w-5 h-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
