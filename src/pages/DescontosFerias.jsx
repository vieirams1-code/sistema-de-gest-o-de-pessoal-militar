import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CalendarMinus2, Loader2, Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { fetchScopedPeriodosAquisitivosBundle } from '@/services/getScopedPeriodosAquisitivosBundleClient';
import { listarDescontosFerias, getStatusDescontoLabel, getStatusDescontoBadgeClass } from '@/services/descontoFeriasService';
import { criarDescontoFeriasGateway } from '@/services/descontoFeriasGatewayClient';
import { solicitarReversaoDescontoFerias } from '@/services/solicitarReversaoDescontoFeriasClient';
import AdicionarDescontoModal from '@/components/descontos-ferias/AdicionarDescontoModal';
import PublicacaoDescontoModal from '@/components/descontos-ferias/PublicacaoDescontoModal';

const STATUS_OPCOES = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'pendente_publicacao', label: 'Pendente de Publicação' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'revertido', label: 'Revertido' },
];

function formatarData(data) {
  if (!data) return '—';
  return String(data).slice(0, 10).split('-').reverse().join('/');
}

export default function DescontosFerias() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modalCadastro, setModalCadastro] = useState(false);
  const [modalPublicacao, setModalPublicacao] = useState(false);
  const [dadosDesconto, setDadosDesconto] = useState(null);

  const [busca, setBusca] = useState('');
  const [filtroLotacao, setFiltroLotacao] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const { data: bundle, isLoading: loadingBundle } = useQuery({
    queryKey: ['descontos-ferias-bundle'],
    queryFn: () => fetchScopedPeriodosAquisitivosBundle({}),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: descontos = [], isLoading: loadingDescontos } = useQuery({
    queryKey: ['descontos-ferias-lista'],
    queryFn: listarDescontosFerias,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const periodosPorMilitar = useMemo(() => {
    const map = {};
    (bundle?.periodosAquisitivos || []).forEach((p) => {
      const mid = String(p.militar_id || '');
      if (!mid) return;
      if (!map[mid]) map[mid] = [];
      map[mid].push(p);
    });
    return map;
  }, [bundle]);

  const lotacoesDisponiveis = useMemo(() => {
    const set = new Set();
    (descontos || []).forEach((d) => {
      const militar = (bundle?.militares || []).find((m) => String(m.id) === String(d.militar_id));
      const lot = militar?.lotacao || militar?.estrutura_nome || '';
      if (lot) set.add(lot);
    });
    return Array.from(set).sort();
  }, [descontos, bundle]);

  const descontosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (descontos || []).filter((d) => {
      if (filtroStatus !== 'todos' && d.status !== filtroStatus) return false;

      const militar = (bundle?.militares || []).find((m) => String(m.id) === String(d.militar_id));
      const lot = militar?.lotacao || militar?.estrutura_nome || '';
      if (filtroLotacao !== 'todas' && lot !== filtroLotacao) return false;

      if (termo) {
        const haystack = `${d.militar_nome || ''} ${d.militar_matricula || ''} ${d.militar_posto || ''}`.toLowerCase();
        if (!haystack.includes(termo)) return false;
      }
      return true;
    });
  }, [descontos, bundle, busca, filtroLotacao, filtroStatus]);

  const handleGerarPublicacao = (dados) => {
    setDadosDesconto(dados);
    setModalCadastro(false);
    setModalPublicacao(true);
  };

  const podeSolicitarReversao = (desconto) => (
    desconto?.status === 'ativo'
    && desconto?.saldo_aplicado === true
    && desconto?.publicacao
    && (desconto.publicacao.status === 'Publicado' || (desconto.publicacao.numero_bg && desconto.publicacao.data_bg))
    && !desconto?.publicacao_reversao
  );

  const handleSolicitarReversao = async (desconto) => {
    if (!podeSolicitarReversao(desconto)) return;
    const confirmado = window.confirm('Será gerada uma publicação de Tornar Sem Efeito. O saldo será restituído somente após a publicação em BG.');
    if (!confirmado) return;

    try {
      await solicitarReversaoDescontoFerias(desconto.id);
      toast({ title: 'Reversão solicitada', description: 'Publicação de Tornar sem Efeito criada no RP. O saldo ainda não foi restituído.' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['descontos-ferias-lista'] }),
        queryClient.invalidateQueries({ queryKey: ['publicacoes'] }),
      ]);
    } catch (error) {
      toast({ title: 'Falha ao solicitar reversão', description: error?.message || 'Não foi possível solicitar a reversão.', variant: 'destructive' });
    }
  };

  const handleConfirmarPublicacao = async (dadosPublicacao) => {
    await criarDescontoFeriasGateway({
      militar_id: dadosDesconto.militar_id,
      periodo_aquisitivo_id: dadosDesconto.periodo_aquisitivo_id,
      dias: dadosDesconto.dias,
      data_inicio: dadosDesconto.data_inicio,
      observacoes: dadosDesconto.observacoes,
      ...dadosPublicacao,
    });
    setModalPublicacao(false);
    setDadosDesconto(null);
    toast({ title: 'Desconto criado', description: 'Publicação gerada e enviada ao RP.' });
    await queryClient.invalidateQueries({ queryKey: ['descontos-ferias-lista'] });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#1e3a5f]/10 p-2.5">
            <CalendarMinus2 className="w-6 h-6 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Descontos em Férias</h1>
            <p className="text-sm text-slate-500">Abatimento administrativo de dias por período aquisitivo (máx. 8 dias/período).</p>
          </div>
        </div>
        <Button onClick={() => setModalCadastro(true)} className="bg-[#1e3a5f] hover:bg-[#16304f]">
          <Plus className="w-4 h-4 mr-2" /> Adicionar desconto
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por militar ou matrícula..." className="pl-9" />
        </div>
        <Select value={filtroLotacao} onValueChange={setFiltroLotacao}>
          <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="Lotação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as lotações</SelectItem>
            {lotacoesDisponiveis.map((lot) => <SelectItem key={lot} value={lot}>{lot}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full lg:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPCOES.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Militar</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-center">Dias</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Publicação (RP)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(loadingDescontos || loadingBundle) ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                </TableCell>
              </TableRow>
            ) : descontosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                  Nenhum desconto em férias encontrado.
                </TableCell>
              </TableRow>
            ) : (
              descontosFiltrados.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium text-slate-800">{d.militar_posto} {d.militar_nome}</div>
                    <div className="text-xs text-slate-500">Mat: {d.militar_matricula || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{d.periodo_aquisitivo_ref || '—'}</TableCell>
                  <TableCell className="text-center font-semibold">{d.dias}</TableCell>
                  <TableCell className="text-sm">{formatarData(d.data_inicio)}</TableCell>
                  <TableCell className="text-sm">{formatarData(d.data_fim)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusDescontoBadgeClass(d.status)}>
                      {getStatusDescontoLabel(d.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <div>{d.status_publicacao}</div>
                    {d.publicacao_reversao && (
                      <div className="text-xs text-amber-700 mt-1">TSE: {d.publicacao_reversao.status || 'em elaboração'}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {podeSolicitarReversao(d) ? (
                      <Button variant="outline" size="sm" onClick={() => handleSolicitarReversao(d)}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Solicitar reversão
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {modalCadastro && (
        <AdicionarDescontoModal
          open={modalCadastro}
          onClose={() => setModalCadastro(false)}
          periodosPorMilitar={periodosPorMilitar}
          descontosExistentes={descontos}
          onGerarPublicacao={handleGerarPublicacao}
        />
      )}

      {modalPublicacao && dadosDesconto && (
        <PublicacaoDescontoModal
          open={modalPublicacao}
          onClose={() => { setModalPublicacao(false); setDadosDesconto(null); }}
          dadosDesconto={dadosDesconto}
          onConfirmar={handleConfirmarPublicacao}
        />
      )}
    </div>
  );
}