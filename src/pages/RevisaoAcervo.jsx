import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Edit, ExternalLink, Search, Filter, ShieldCheck } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';

import AccessDenied from '@/components/auth/AccessDenied';

export default function RevisaoAcervo() {
  const { canAccessAction } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState('');

  const { data: pendencias, isLoading } = useQuery({
    queryKey: ['acervo-revisao'],
    queryFn: async () => {
      // Lista documentos não validados, com confiança baixa ou metadados incompletos
      const all = await base44.entities.AcervoFuncionalHistorico.list('-created_date');
      return all.filter(a =>
        a.ativo === true &&
        a.status_documento === 'ATIVO' &&
        (a.validado === false || a.confianca_identificacao === 'BAIXA' || !a.militar_id || !a.periodo_inicial)
      );
    }
  });

  const validarMutation = useMutation({
    mutationFn: (id) => base44.entities.AcervoFuncionalHistorico.update(id, {
      validado: true,
      confianca_identificacao: 'ALTA'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acervo-revisao'] });
      queryClient.invalidateQueries({ queryKey: ['acervo-stats'] });
      toast({ title: 'Documento validado', description: 'O registro foi marcado como revisado e validado.' });
    }
  });

  const filtered = pendencias?.filter(p =>
    p.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    p.matricula_utilizada?.includes(busca)
  );

  if (!canAccessAction('gerir_acervo_historico')) {
    return <AccessDenied modulo="Fila de Revisão do Acervo" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Fila de Revisão
          </h1>
          <p className="text-slate-500">Documentos identificados com baixa confiança ou pendentes de validação manual.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por título ou matrícula..."
                  className="pl-9"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-50">
                {pendencias?.length || 0} pendentes
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Importação</TableHead>
                <TableHead>Militar (Matrícula)</TableHead>
                <TableHead>Documento / Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Confiança</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">Carregando pendências...</TableCell>
                </TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">Nenhuma pendência encontrada.</TableCell>
                </TableRow>
              ) : filtered?.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {format(new Date(p.created_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">{p.matricula_utilizada}</span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    <p className="font-medium">{p.titulo}</p>
                    <p className="text-[10px] text-slate-400">{p.id}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{p.tipo_documento}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      p.confianca_identificacao === 'BAIXA' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }>
                      {p.confianca_identificacao || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver no Drive"
                        asChild
                        disabled={!canAccessAction('baixar_acervo_historico')}
                      >
                        <a
                          href={canAccessAction('baixar_acervo_historico') ? p.drive_url : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => !canAccessAction('baixar_acervo_historico') && e.preventDefault()}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar Metadados">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Validar Registro"
                        onClick={() => validarMutation.mutate(p.id)}
                        disabled={validarMutation.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
