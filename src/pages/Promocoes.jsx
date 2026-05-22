import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, MoreHorizontal, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  dataFormatada,
  mensagemBloqueioExclusaoPromocao,
  ordenarPromocoes,
  promocaoPermiteExclusao,
  tituloPromocao,
  valorOuTraco,
} from '@/services/promocaoService';
import { createPageUrl } from '@/utils';

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

async function listarPromocaoMilitarVinculados(promocaoId) {
  const entity = base44.entities.PromocaoMilitar;
  if (!entity) throw new Error('Entidade PromocaoMilitar indisponível para validar a exclusão.');
  if (typeof entity.filter === 'function') return entity.filter({ promocao_id: promocaoId });
  if (typeof entity.list === 'function') {
    const registros = await entity.list();
    return (registros || []).filter((registro) => String(registro?.promocao_id || '') === String(promocaoId));
  }
  throw new Error('Não foi possível validar militares vinculados antes da exclusão.');
}

function agruparTotaisReais(historicos = []) {
  return historicos.reduce((acc, historico) => {
    const promocaoId = String(historico?.promocao_id || '').trim();
    if (!promocaoId) return acc;
    acc[promocaoId] = (acc[promocaoId] || 0) + 1;
    return acc;
  }, {});
}

const statusStyle = {
  ativa: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-800',
  rascunho: 'bg-amber-100 text-amber-800',
};

export default function Promocoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useCurrentUser();

  const [search, setSearch] = useState('');
  const [quadro, setQuadro] = useState('todos');
  const [ano, setAno] = useState('todos');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [promocaoAtiva, setPromocaoAtiva] = useState(null);

  const promocoesQuery = useQuery({
    queryKey: ['promocoes-operacionais'],
    queryFn: () => base44.entities.Promocao.list(),
  });
  const historicosQuery = useQuery({
    queryKey: ['promocoes-operacionais-historicos-v2'],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.list(),
  });
  const promocoesMilitaresQuery = useQuery({
    queryKey: ['promocoes-operacionais-promocoes-militares'],
    queryFn: async () => {
      const entity = base44.entities.PromocaoMilitar;
      if (!entity) return [];
      if (typeof entity.list === 'function') return entity.list();
      return [];
    },
  });

  const totaisReais = useMemo(() => agruparTotaisReais(historicosQuery.data || []), [historicosQuery.data]);
  const promocoesOrdenadas = useMemo(() => ordenarPromocoes(promocoesQuery.data || []), [promocoesQuery.data]);
  const isLoading = promocoesQuery.isLoading || historicosQuery.isLoading || promocoesMilitaresQuery.isLoading;
  const error = promocoesQuery.error || historicosQuery.error || promocoesMilitaresQuery.error;

  const militaresPorPromocao = useMemo(() => {
    const mapaPromocaoMilitar = {};
    (promocoesMilitaresQuery.data || []).forEach((registro) => {
      const id = String(registro?.promocao_id || '').trim();
      if (!id) return;
      if (!mapaPromocaoMilitar[id]) mapaPromocaoMilitar[id] = [];
      mapaPromocaoMilitar[id].push(registro);
    });

    const mapaHistorico = {};
    (historicosQuery.data || []).forEach((registro) => {
      const id = String(registro?.promocao_id || '').trim();
      if (!id) return;
      if (!mapaHistorico[id]) mapaHistorico[id] = [];
      mapaHistorico[id].push(registro);
    });

    const resultado = {};
    const ids = new Set([...Object.keys(mapaPromocaoMilitar), ...Object.keys(mapaHistorico)]);
    ids.forEach((id) => {
      resultado[id] = (mapaPromocaoMilitar[id] && mapaPromocaoMilitar[id].length > 0) ? mapaPromocaoMilitar[id] : (mapaHistorico[id] || []);
    });

    return resultado;
  }, [historicosQuery.data, promocoesMilitaresQuery.data]);

  const promocoesFiltradas = useMemo(() => {
    return promocoesOrdenadas.filter((promocao) => {
      const anoPromocao = promocao?.data_promocao ? new Date(promocao.data_promocao).getFullYear() : null;
      const termoBusca = search.trim().toLowerCase();
      const okSearch = !termoBusca
        || tituloPromocao(promocao).toLowerCase().includes(termoBusca)
        || `${promocao.boletim_referencia || ''} ${promocao.ato_referencia || ''}`.toLowerCase().includes(termoBusca);
      const okQuadro = quadro === 'todos' || String(promocao.quadro || '') === quadro;
      const okAno = ano === 'todos' || String(anoPromocao || '') === ano;
      return okSearch && okQuadro && okAno;
    });
  }, [ano, promocoesOrdenadas, quadro, search]);

  const gruposMes = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
    const grupos = promocoesFiltradas.reduce((acc, promocao) => {
      const data = promocao?.data_promocao ? new Date(promocao.data_promocao) : null;
      const key = data ? fmt.format(data) : 'Sem data';
      if (!acc[key]) acc[key] = { key, timestamp: data ? data.getTime() : -1, itens: [] };
      acc[key].itens.push(promocao);
      return acc;
    }, {});

    return Object.values(grupos).sort((a, b) => b.timestamp - a.timestamp);
  }, [promocoesFiltradas]);

  const excluirPromocaoMutation = useMutation({
    mutationFn: async (promocao) => {
      const vinculadosReais = totaisReais[promocao.id] || 0;
      const bloqueio = mensagemBloqueioExclusaoPromocao(promocao, { vinculadosReais });
      if (bloqueio) throw new Error(bloqueio);
      const vinculadosAtuais = await listarPromocaoMilitarVinculados(promocao.id);
      if ((vinculadosAtuais || []).length > 0) {
        throw new Error('Exclusão bloqueada: remova primeiro os militares da turma em rascunho/na promoção.');
      }
      await base44.entities.Promocao.delete(promocao.id);
    },
    onSuccess: () => {
      toast({ title: 'Promoção excluída', description: 'A promoção vazia foi removida da listagem.' });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-historicos-v2'] });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais-promocoes-militares'] });
    },
  });

  const confirmarExclusaoPromocao = (promocao) => {
    const vinculadosReais = totaisReais[promocao.id] || 0;
    const bloqueio = mensagemBloqueioExclusaoPromocao(promocao, { vinculadosReais });
    if (bloqueio) {
      toast({ title: 'Exclusão não permitida', description: bloqueio, variant: 'destructive' });
      return;
    }
    if (window.confirm('Excluir esta promoção vazia? Esta ação não altera militares nem histórico.')) {
      excluirPromocaoMutation.mutate(promocao);
    }
  };

  const novaPromocaoMutation = useMutation({
    mutationFn: criarPromocaoManual,
    onSuccess: (promocaoCriada) => {
      toast({ title: 'Promoção criada', description: 'Agora preencha os dados e adicione os militares.' });
      queryClient.invalidateQueries({ queryKey: ['promocoes-operacionais'] });
      navigate(`${createPageUrl('DetalhePromocao')}?id=${promocaoCriada.id}`);
    },
  });

  const quadros = [...new Set(promocoesOrdenadas.map((p) => p.quadro).filter(Boolean))];
  const anos = [...new Set(promocoesOrdenadas
    .map((p) => (p?.data_promocao ? String(new Date(p.data_promocao).getFullYear()) : null))
    .filter(Boolean))].sort((a, b) => Number(b) - Number(a));

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6 text-slate-900">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight font-extrabold">PROMOÇÕES</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Gerencie e acompanhe as promoções cadastradas.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => {
              promocoesQuery.refetch();
              historicosQuery.refetch();
              promocoesMilitaresQuery.refetch();
            }}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button className="h-11 rounded-xl px-5 font-bold bg-[#07172A] hover:bg-[#0F2647]" onClick={() => novaPromocaoMutation.mutate()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Promoção
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar promoções</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="bg-white border border-[#E5E7EB] rounded-[18px] p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar promoção" className="h-11 pl-9 rounded-xl bg-slate-50 border-[#E5E7EB]" />
          </div>
          <Select value={quadro} onValueChange={setQuadro}>
            <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-[#E5E7EB]"><SelectValue placeholder="Todos quadros" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos quadros</SelectItem>
              {quadros.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-[#E5E7EB]"><SelectValue placeholder="Todos anos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos anos</SelectItem>
              {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11 rounded-xl justify-start"><SlidersHorizontal className="h-4 w-4 mr-2" />Filtros</Button>
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-[#E5E7EB] shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="text-[11px] uppercase tracking-wider">Posto/Graduação</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Quadro</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Data</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Doc(Bol/Ato)</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-center">Militares</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && gruposMes.map((grupo) => (
              <React.Fragment key={grupo.key}>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableCell colSpan={7}>
                    <div className="flex items-center gap-2 font-extrabold text-slate-700">
                      ▾ {grupo.key}
                      <Badge variant="outline" className="bg-white border-slate-200">{grupo.itens.length} registros</Badge>
                    </div>
                  </TableCell>
                </TableRow>
                {grupo.itens.map((promocao) => (
                  <TableRow key={promocao.id} className="h-16 hover:bg-slate-50">
                    <TableCell className="text-sm font-medium">{valorOuTraco(promocao.posto_graduacao || tituloPromocao(promocao))}</TableCell>
                    <TableCell>{valorOuTraco(promocao.quadro)}</TableCell>
                    <TableCell>{dataFormatada(promocao.data_promocao)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{valorOuTraco(promocao.boletim_referencia)} / {valorOuTraco(promocao.ato_referencia)}</TableCell>
                    <TableCell className="text-center"><span className="inline-flex min-w-7 justify-center rounded-lg bg-blue-100 text-blue-700 font-bold px-2 py-1 text-xs">{totaisReais[promocao.id] || 0}</span></TableCell>
                    <TableCell><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[promocao.status] || 'bg-slate-100 text-slate-700'}`}>{valorOuTraco(promocao.status)}</span></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setPromocaoAtiva(promocao); setDrawerOpen(true); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" asChild><Link to={`${createPageUrl('DetalhePromocao')}?id=${promocao.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                        {isAdmin && promocaoPermiteExclusao(promocao, { vinculadosReais: totaisReais[promocao.id] || 0 }) && (
                          <Button variant="ghost" size="icon" onClick={() => confirmarExclusaoPromocao(promocao)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        )}
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
            {isLoading && <TableRow><TableCell colSpan={7} className="py-10 text-center">Carregando promoções...</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[500px] overflow-y-auto p-0">
          <div className="p-6 space-y-6">
            <SheetHeader>
              <SheetDescription className="text-[12px] uppercase tracking-wider">Detalhes da promoção</SheetDescription>
              <SheetTitle className="text-2xl">{valorOuTraco(promocaoAtiva?.posto_graduacao || tituloPromocao(promocaoAtiva || {}))}</SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4"><p className="text-[12px] uppercase text-slate-500">Data</p><p className="font-semibold mt-1">{dataFormatada(promocaoAtiva?.data_promocao)}</p></div>
              <div className="bg-slate-50 rounded-2xl p-4"><p className="text-[12px] uppercase text-slate-500">Quadro</p><p className="font-semibold mt-1">{valorOuTraco(promocaoAtiva?.quadro)}</p></div>
            </div>

            <div>
              <h3 className="text-[12px] uppercase tracking-wider text-slate-500 mb-2">Documentação</h3>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Boletim</span><span className="font-medium">{valorOuTraco(promocaoAtiva?.boletim_referencia)}</span></div>
                <div className="flex justify-between"><span>Ato</span><span className="font-medium">{valorOuTraco(promocaoAtiva?.ato_referencia)}</span></div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Militares vinculados ({(militaresPorPromocao[promocaoAtiva?.id] || []).length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(militaresPorPromocao[promocaoAtiva?.id] || []).map((militar, idx) => (
                  <div key={`${militar.id || idx}`} className="rounded-xl border border-[#E5E7EB] p-3 hover:bg-slate-50 cursor-pointer">
                    <p className="font-medium text-sm">{valorOuTraco(militar.nome_completo || militar.militar_nome || militar.nome)}</p>
                    <p className="text-xs text-slate-500 mt-1">{valorOuTraco(militar.matricula || militar.militar_matricula)}</p>
                    <p className="text-xs text-slate-600 mt-1">{valorOuTraco(militar.posto_graduacao || militar.posto_atual)} • {valorOuTraco(militar.quadro || militar.quadro_sigla)}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3 h-8 rounded-lg text-xs">Abrir ficha</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="text-[12px] uppercase tracking-wider text-slate-500 mb-2">Observações</h3>
              <p className="text-sm text-slate-700">{valorOuTraco(promocaoAtiva?.observacoes)}</p>
            </div>

            <Button className="w-full h-11 rounded-xl bg-[#07172A] hover:bg-[#0F2647]" asChild>
              <Link to={promocaoAtiva ? `${createPageUrl('DetalhePromocao')}?id=${promocaoAtiva.id}` : '#'}>Abrir Promoção Completa</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
