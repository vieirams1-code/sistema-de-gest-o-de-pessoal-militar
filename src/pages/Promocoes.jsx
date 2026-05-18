import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, ListChecks, Plus, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  dataFormatada,
  ordenarPromocoes,
  tituloPromocao,
  valorOuTraco,
} from '@/services/promocaoService';


async function criarPromocaoManual() {
  const agora = new Date().toISOString();
  const usuario = typeof base44.auth?.me === 'function' ? await base44.auth.me() : null;
  const responsavel = usuario?.email || usuario?.full_name || '';

  return base44.entities.Promocao.create({
    tipo: 'historica',
    natureza: 'coletiva',
    posto_graduacao: '',
    quadro: '',
    data_promocao: '',
    data_publicacao: '',
    boletim_referencia: '',
    ato_referencia: '',
    status: 'rascunho',
    origem: 'manual',
    observacoes: 'Criada manualmente pela tela Promoções.',
    chave_agrupamento: '',
    hash_agrupamento: '',
    total_militares_vinculados: 0,
    criado_por: responsavel,
    criado_em: agora,
    atualizado_por: responsavel,
    atualizado_em: agora,
  });
}

function agruparTotaisReais(historicos = []) {
  return historicos.reduce((acc, historico) => {
    const promocaoId = String(historico?.promocao_id || '').trim();
    if (!promocaoId) return acc;
    acc[promocaoId] = (acc[promocaoId] || 0) + 1;
    return acc;
  }, {});
}

export default function Promocoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

  const novaPromocaoMutation = useMutation({
    mutationFn: criarPromocaoManual,
    onSuccess: (promocaoCriada) => {
      toast({ title: 'Promoção criada', description: 'Agora preencha os dados e adicione os militares.' });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
      navigate(`${createPageUrl('DetalhePromocao')}?id=${promocaoCriada.id}`);
    },
    onError: (mutationError) => {
      toast({
        title: 'Não foi possível criar a promoção',
        description: mutationError?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Antiguidade / Promoções</p>
          <h1 className="text-3xl font-bold text-slate-900">Promoções</h1>
          <p className="text-slate-600 mt-1">
            Crie uma nova promoção, abra o detalhe, adicione os militares e salve a lista operacional.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={() => novaPromocaoMutation.mutate()} disabled={novaPromocaoMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Promoção
          </Button>
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
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar promoções</AlertTitle>
          <AlertDescription>{error.message || 'Não foi possível carregar a lista de promoções. Atualize a tela ou tente novamente.'}</AlertDescription>
        </Alert>
      )}

      <Card className="border-blue-100 bg-blue-50/70 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Fluxo manual</p>
            <h2 className="text-xl font-bold text-slate-900">Comece por Nova Promoção</h2>
            <p className="mt-1 text-sm text-slate-700">
              Depois abra o detalhe, informe os dados da promoção, adicione os militares e salve as alterações.
            </p>
          </div>
          <Button onClick={() => novaPromocaoMutation.mutate()} disabled={novaPromocaoMutation.isPending} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nova Promoção
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Promoções cadastradas</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              O rastreamento de agrupamentos continua disponível como atalho para criar promoções em lote, mas não é obrigatório para o fluxo manual.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={createPageUrl('RastreamentoPromocoes')}>
                <ListChecks className="mr-2 h-4 w-4" />
                Atalho: agrupamentos
              </Link>
            </Button>
            <Badge variant="outline">{promocoesOrdenadas.length} registro(s)</Badge>
          </div>
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
                      Nenhuma promoção encontrada. Clique em “Nova Promoção” para iniciar o fluxo manual; se preferir, use agrupamentos apenas como atalho.
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
