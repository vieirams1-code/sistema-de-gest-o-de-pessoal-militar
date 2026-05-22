import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { criarMilitarFuncaoEscopado, atualizarMilitarFuncaoEscopado, encerrarMilitarFuncaoEscopado } from '@/services/cudFuncoesTagsEscopadoClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { separarFuncoesPorStatus, validarDuplicidadeInstitucionalAtiva } from '@/utils/funcoesTags/militarFuncoes';
import { funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { getFuncaoMilitarId, isCatalogoAtivo } from '@/utils/funcoesTags/contratoCampos';

const formatDate = (date) => {
  if (!date) return '—';
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

function FuncaoItem({ vinculo, onSetPrincipal, onEncerrar, loadingSetPrincipal, loadingEncerrar }) {
  const funcao = vinculo.funcao || {};
  const cor = funcao.cor || '#1e3a5f';
  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge style={{ backgroundColor: `${cor}22`, color: cor, borderColor: `${cor}55` }} className="border">
            {(funcao.emoji || '🏷️')} {funcao.nome || 'Função sem nome'}
          </Badge>
          <Badge variant="outline">{vinculo.status || '—'}</Badge>
          {vinculo.principal && <Badge className="bg-amber-100 text-amber-900">Principal</Badge>}
        </div>
        {String(vinculo.status).toLowerCase() === 'ativa' &&
          <div className="flex gap-2">
            {!vinculo.principal &&
              <Button size="sm" variant="outline" disabled={loadingSetPrincipal} onClick={() => onSetPrincipal(vinculo)}>
                Tornar principal
              </Button>
            }
            <Button size="sm" variant="ghost" disabled={loadingEncerrar} onClick={() => onEncerrar(vinculo)}>Encerrar</Button>
          </div>
        }
      </div>
      <div className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-y-1">
        <p><strong>Início:</strong> {formatDate(vinculo.data_inicio)}</p>
        <p><strong>Fim:</strong> {formatDate(vinculo.data_fim)}</p>
        {vinculo.estrutura_nome && <p><strong>Estrutura:</strong> {vinculo.estrutura_nome}</p>}
        {vinculo.motivo && <p><strong>Motivo:</strong> {vinculo.motivo}</p>}
      </div>
    </div>
  );
}

export default function FuncoesMilitarSection({ militar }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    funcao_militar_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    principal: false,
    motivo: ''
  });

  const { data: funcoesCatalogo = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo('local', 'funcoes'),
    queryFn: () => base44.entities.FuncaoMilitar.list('nome')
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: funcoesTagsKeys.militarFuncoes('local', militar.id),
    queryFn: async () => {
      const items = await base44.entities.MilitarFuncao.filter({ militar_id: militar.id }, '-created_date');
      const mapaFuncoes = new Map(funcoesCatalogo.map((f) => [f.id, f]));
      return items.map((item) => ({ ...item, funcao: mapaFuncoes.get(getFuncaoMilitarId(item)) || null }));
    },
    enabled: !!militar?.id && funcoesCatalogo.length >= 0
  });

  const vinculosAtivos = React.useMemo(() => vinculos.filter((v) => String(v.status).toLowerCase() === 'ativa'), [vinculos]);
  const { ativas, encerradas } = React.useMemo(() => separarFuncoesPorStatus(vinculos), [vinculos]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.militarFuncoes('local', militar.id) });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-institucionais'] });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-filtros'] });
    queryClient.invalidateQueries({ queryKey: ['militar-funcao-institucional'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const funcao = funcoesCatalogo.find((f) => f.id === form.funcao_militar_id);
      if (!funcao || !isCatalogoAtivo(funcao)) {
        throw new Error('Selecione uma função ativa.');
      }
      const erroInstitucional = validarDuplicidadeInstitucionalAtiva({ vinculosAtivos, funcaoSelecionada: funcao });
      if (erroInstitucional) throw new Error(erroInstitucional);

      if (form.principal) {
        await Promise.all(vinculosAtivos.filter((v) => v.principal).map((v) =>
          atualizarMilitarFuncaoEscopado(v.id, { principal: false })
        ));
      }

      await criarMilitarFuncaoEscopado({
        militar_id: militar.id,
        funcao_militar_id: form.funcao_militar_id,
        status: 'ativa',
        principal: !!form.principal,
        data_inicio: form.data_inicio,
        escopo_tipo: funcao.escopo_tipo || null,
        escopo_id: funcao.escopo_id || null,
        estrutura_id: funcao.estrutura_id || null,
        estrutura_nome: funcao.estrutura_nome || null,
        tipo_estrutura: funcao.tipo_estrutura || null,
        motivo: form.motivo || null
      });
      // TODO: migrar CUD para endpoint escopado no backend quando disponível.
    },
    onSuccess: () => {
      toast({ title: 'Função adicionada com sucesso.' });
      setShowForm(false);
      setForm({ funcao_militar_id: '', data_inicio: new Date().toISOString().split('T')[0], principal: false, motivo: '' });
      invalidate();
    },
    onError: (error) => toast({ title: 'Erro ao adicionar função', description: error.message, variant: 'destructive' })
  });

  const setPrincipalMutation = useMutation({
    mutationFn: async (vinculo) => {
      const ativos = vinculosAtivos.filter((v) => v.id !== vinculo.id && v.principal);
      await Promise.all(ativos.map((v) => atualizarMilitarFuncaoEscopado(v.id, { principal: false })));
      await atualizarMilitarFuncaoEscopado(vinculo.id, { principal: true });
    },
    onSuccess: () => {toast({ title: 'Função principal atualizada.' }); invalidate();},
    onError: (error) => toast({ title: 'Erro ao definir principal', description: error.message, variant: 'destructive' })
  });

  const encerrarMutation = useMutation({
    mutationFn: async ({ vinculo, motivo }) => encerrarMilitarFuncaoEscopado(vinculo.id, {
      status: 'encerrada',
      data_fim: new Date().toISOString().split('T')[0],
      principal: false,
      motivo: motivo || vinculo.motivo || null
    }),
    onSuccess: () => {toast({ title: 'Função encerrada com sucesso.' }); invalidate();},
    onError: (error) => toast({ title: 'Erro ao encerrar função', description: error.message, variant: 'destructive' })
  });

  const funcoesAtivasCatalogo = funcoesCatalogo.filter((f) => isCatalogoAtivo(f));

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-[#1e3a5f]">Funções</CardTitle>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancelar' : 'Adicionar função'}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && <div className="rounded-lg border p-3 grid md:grid-cols-2 gap-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Função ativa</Label>
            <select className="w-full border rounded-md h-9 px-2" value={form.funcao_militar_id} onChange={(e) => setForm((old) => ({ ...old, funcao_militar_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {funcoesAtivasCatalogo.map((funcao) => <option key={funcao.id} value={funcao.id}>{funcao.emoji || '🏷️'} {funcao.nome}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Data de início</Label>
            <Input type="date" value={form.data_inicio} onChange={(e) => setForm((old) => ({ ...old, data_inicio: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Input value={form.motivo} onChange={(e) => setForm((old) => ({ ...old, motivo: e.target.value }))} placeholder="Ex.: designação interna" />
          </div>
          <label className="text-sm flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={form.principal} onChange={(e) => setForm((old) => ({ ...old, principal: e.target.checked }))} /> Definir como principal</label>
          <div className="md:col-span-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.funcao_militar_id || !form.data_inicio}>Salvar função</Button>
          </div>
        </div>}

        <div className="space-y-3">
          <h4 className="font-medium text-slate-700">Funções ativas</h4>
          {ativas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma função ativa.</p> : ativas.map((v) => <FuncaoItem key={v.id} vinculo={v} onSetPrincipal={(item) => setPrincipalMutation.mutate(item)} onEncerrar={(item) => {
            const motivo = window.prompt('Motivo do encerramento (opcional):', item.motivo || '');
            encerrarMutation.mutate({ vinculo: item, motivo: motivo || '' });
          }} loadingSetPrincipal={setPrincipalMutation.isPending} loadingEncerrar={encerrarMutation.isPending} />)}
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="font-medium text-slate-700">Histórico / encerradas</h4>
          {encerradas.length === 0 ? <p className="text-sm text-slate-500">Sem histórico de funções encerradas.</p> : encerradas.map((v) => <FuncaoItem key={v.id} vinculo={v} onSetPrincipal={() => {}} onEncerrar={() => {}} />)}
        </div>
      </CardContent>
    </Card>
  );
}
