import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Eye, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  dataFormatada,
  ordenarPromocoes,
  tituloPromocao,
  valorOuTraco,
} from '@/services/promocaoService';

function agruparTotaisReais(historicos = []) {
  return historicos.reduce((acc, historico) => {
    const promocaoId = String(historico?.promocao_id || '').trim();
    if (!promocaoId) return acc;
    acc[promocaoId] = (acc[promocaoId] || 0) + 1;
    return acc;
  }, {});
}

export default function Promocoes() {
  const promocoesQuery = useQuery({
    queryKey: ['promocoes-operacionais'],
    queryFn: () => base44.entities.Promocao.list(),
  });

  const historicosQuery = useQuery({
    queryKey: ['promocoes-operacionais-historicos-v2'],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.list(),
  });

  const totaisReais = useMemo(() => agruparTotaisReais(historicosQuery.data || []), [historicosQuery.data]);
  const promocoesOrdenadas = useMemo(() => ordenarPromocoes(promocoesQuery.data || []), [promocoesQuery.data]);
  const isLoading = promocoesQuery.isLoading || historicosQuery.isLoading;
  const error = promocoesQuery.error || historicosQuery.error;

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Antiguidade / Promoções</p>
          <h1 className="text-3xl font-bold text-slate-900">Promoções</h1>
          <p className="text-slate-600 mt-1">
            Gestão operacional das promoções já criadas e conferência do total real de históricos vinculados.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            promocoesQuery.refetch();
            historicosQuery.refetch();
          }}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar promoções</AlertTitle>
          <AlertDescription>{error.message || 'Não foi possível consultar Promocao.list() ou HistoricoPromocaoMilitarV2.list().'}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Lista de promoções</CardTitle>
          <Badge variant="outline">{promocoesOrdenadas.length} registro(s)</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promoção</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Posto/graduação</TableHead>
                  <TableHead>Quadro</TableHead>
                  <TableHead>Data promoção</TableHead>
                  <TableHead>Boletim</TableHead>
                  <TableHead>Ato</TableHead>
                  <TableHead className="text-right">Vinculados reais</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-slate-500">Carregando promoções...</TableCell>
                  </TableRow>
                )}

                {!isLoading && promocoesOrdenadas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-slate-500">
                      Nenhuma promoção encontrada. Crie capas pelo Rastreamento de Promoções.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && promocoesOrdenadas.map((promocao) => (
                  <TableRow key={promocao.id}>
                    <TableCell className="font-medium min-w-64">{tituloPromocao(promocao)}</TableCell>
                    <TableCell>{valorOuTraco(promocao.tipo)}</TableCell>
                    <TableCell><Badge variant="secondary">{valorOuTraco(promocao.status)}</Badge></TableCell>
                    <TableCell>{valorOuTraco(promocao.posto_graduacao)}</TableCell>
                    <TableCell>{valorOuTraco(promocao.quadro)}</TableCell>
                    <TableCell>{dataFormatada(promocao.data_promocao)}</TableCell>
                    <TableCell>{valorOuTraco(promocao.boletim_referencia)}</TableCell>
                    <TableCell>{valorOuTraco(promocao.ato_referencia)}</TableCell>
                    <TableCell className="text-right font-semibold">{totaisReais[promocao.id] || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`${createPageUrl('DetalhePromocao')}?id=${promocao.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Abrir
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
