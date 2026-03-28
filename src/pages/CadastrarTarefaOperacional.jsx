import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TarefaOperacional, TarefaOperacionalDestinatario, TarefaOperacionalHistorico } from '@/api/entities';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Search, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { PRIORIDADE_OPTIONS, STATUS_TAREFA, TIPO_TAREFA_OPTIONS } from '@/components/tarefasOperacionaisConfig';

const initialState = {
  titulo: '',
  descricao: '',
  tipo_tarefa: 'Envio de documento',
  prazo: '',
  prioridade: 'Média',
  status_tarefa: 'Aberta',
  exige_documento: false,
  permite_mensagem: true,
  setor_origem: '',
  publico_resumo: '',
};

function containsTerm(value, term) {
  if (!term) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term);
}

export default function CadastrarTarefaOperacional() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, canAccessModule, canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();

  const [formData, setFormData] = useState(initialState);
  const [searchMilitarTerm, setSearchMilitarTerm] = useState('');
  const [selectedMilitarIds, setSelectedMilitarIds] = useState([]);

  const hasModuleAccess = canAccessModule('tarefas_operacionais');
  const canCreateTask = canAccessAction('criar_tarefa_operacional') || canAccessAction('admin_mode');

  const { data: militares = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['militares-destinatarios-tarefa-operacional'],
    queryFn: () => base44.entities.Militar.list('nome_completo'),
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const militaresFiltrados = useMemo(() => {
    const term = searchMilitarTerm.trim().toLowerCase();
    return militares.filter((militar) => (
      containsTerm(militar.nome_completo, term) ||
      containsTerm(militar.nome_guerra, term) ||
      containsTerm(militar.matricula, term) ||
      containsTerm(militar.funcao, term)
    ));
  }, [militares, searchMilitarTerm]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const titulo = formData.titulo.trim();
      if (!titulo) throw new Error('Informe o título da tarefa.');
      if (selectedMilitarIds.length === 0) throw new Error('Selecione ao menos um destinatário.');

      const nowIso = new Date().toISOString();
      const payload = {
        ...formData,
        titulo,
        descricao: formData.descricao.trim(),
        setor_origem: formData.setor_origem.trim(),
        publico_resumo: formData.publico_resumo.trim(),
        criado_por: user?.email || 'sistema',
        data_criacao: nowIso,
        total_destinatarios: selectedMilitarIds.length,
      };

      if (!TarefaOperacional) throw new Error('Entidade TarefaOperacional não encontrada no schema do app.');
      if (!TarefaOperacionalDestinatario) throw new Error('Entidade TarefaOperacionalDestinatario não encontrada no schema do app.');
      if (!TarefaOperacionalHistorico) throw new Error('Entidade TarefaOperacionalHistorico não encontrada no schema do app.');

      const tarefaCriada = await TarefaOperacional.create(payload);

      const destinatarioPayloads = selectedMilitarIds
        .map((militarId) => militares.find((item) => item.id === militarId))
        .filter(Boolean)
        .map((militar) => ({
          tarefa_id: tarefaCriada.id,
          militar_id: militar.id,
          militar_nome: militar.nome_completo || militar.nome_guerra || 'Militar',
          militar_email: militar.email_funcional || militar.email_particular || '',
          status_individual: 'Pendente',
        }));

      await Promise.all(destinatarioPayloads.map((item) => TarefaOperacionalDestinatario.create(item)));

      await TarefaOperacionalHistorico.create({
        tarefa_id: tarefaCriada.id,
        evento: 'TAREFA_CRIADA',
        descricao: `Tarefa criada e distribuída para ${destinatarioPayloads.length} destinatário(s).`,
        usuario: user?.email || 'sistema',
        timestamp: nowIso,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas-operacionais'] });
      toast({
        title: 'Tarefa criada',
        description: 'A tarefa operacional foi criada e distribuída com sucesso.',
      });
      navigate(createPageUrl('TarefasOperacionais'));
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao criar tarefa',
        description: error?.message || 'Não foi possível salvar a tarefa operacional.',
      });
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMilitarSelection = (militarId, checked) => {
    setSelectedMilitarIds((prev) => {
      if (checked) {
        if (prev.includes(militarId)) return prev;
        return [...prev, militarId];
      }
      return prev.filter((id) => id !== militarId);
    });
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasModuleAccess) return <AccessDenied modulo="Tarefas Operacionais" />;
  if (!canCreateTask) return <AccessDenied modulo="Criar tarefa operacional" />;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cadastrar Tarefa Operacional</h1>
            <p className="text-sm text-slate-500 mt-1">LOTE 1 - cadastro inicial com definição de tipo, prazo e destinatários.</p>
          </div>

          <Button variant="outline" onClick={() => navigate(createPageUrl('TarefasOperacionais'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="titulo">Título da tarefa</Label>
                <Input id="titulo" value={formData.titulo} onChange={(e) => handleChange('titulo', e.target.value)} placeholder="Ex: Envio do relatório diário de patrulha" />
              </div>

              <div className="space-y-2">
                <Label>Tipo da tarefa</Label>
                <Select value={formData.tipo_tarefa} onValueChange={(value) => handleChange('tipo_tarefa', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_TAREFA_OPTIONS.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={formData.prazo} onChange={(e) => handleChange('prazo', e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={(value) => handleChange('prioridade', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORIDADE_OPTIONS.map((prioridade) => (
                      <SelectItem key={prioridade} value={prioridade}>{prioridade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status inicial</Label>
                <Select value={formData.status_tarefa} onValueChange={(value) => handleChange('status_tarefa', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_TAREFA.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setor_origem">Setor/Grupo de origem</Label>
                <Input id="setor_origem" value={formData.setor_origem} onChange={(e) => handleChange('setor_origem', e.target.value)} placeholder="Ex: 1ª Seção / Administração" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="publico_resumo">Resumo público</Label>
                <Input id="publico_resumo" value={formData.publico_resumo} onChange={(e) => handleChange('publico_resumo', e.target.value)} placeholder="Resumo curto para listagens" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição / orientações</Label>
                <Textarea id="descricao" rows={6} value={formData.descricao} onChange={(e) => handleChange('descricao', e.target.value)} placeholder="Descreva as orientações para execução da tarefa." />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 border-t border-slate-100 pt-4">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                <Checkbox checked={formData.exige_documento} onCheckedChange={(value) => handleChange('exige_documento', Boolean(value))} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Exigir documento</p>
                  <p className="text-xs text-slate-500">Obrigará envio de anexo na resposta do destinatário.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                <Checkbox checked={formData.permite_mensagem} onCheckedChange={(value) => handleChange('permite_mensagem', Boolean(value))} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Permitir mensagem do usuário</p>
                  <p className="text-xs text-slate-500">Habilita retorno textual junto da resposta individual.</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Destinatários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Buscar militar por nome, nome de guerra, matrícula ou função"
                value={searchMilitarTerm}
                onChange={(e) => setSearchMilitarTerm(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-slate-200">
              {loadingMilitares ? (
                <p className="p-4 text-sm text-slate-500">Carregando efetivo...</p>
              ) : militaresFiltrados.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Nenhum militar encontrado com o filtro informado.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {militaresFiltrados.map((militar) => (
                    <label key={militar.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50">
                      <Checkbox
                        checked={selectedMilitarIds.includes(militar.id)}
                        onCheckedChange={(value) => toggleMilitarSelection(militar.id, Boolean(value))}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{militar.nome_completo || militar.nome_guerra || 'Militar sem nome'}</p>
                        <p className="text-xs text-slate-500">
                          {militar.nome_guerra ? `${militar.nome_guerra} • ` : ''}
                          {militar.matricula ? `Mat: ${militar.matricula}` : 'Sem matrícula'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
              <p className="text-sm text-slate-600">Selecionados: <span className="font-semibold text-slate-800">{selectedMilitarIds.length}</span></p>

              <Button className="bg-[#173764] hover:bg-[#10294c]" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {createMutation.isPending ? 'Salvando...' : 'Criar tarefa'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
