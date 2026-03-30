import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Search, ShieldAlert, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { PRIORIDADE_OPTIONS, STATUS_TAREFA, TIPO_TAREFA_OPTIONS } from '@/components/tarefasOperacionaisConfig';
import {
  getTarefaOperacionalDestinatarioEntity,
  getTarefaOperacionalEntity,
  getTarefaOperacionalHistoricoEntity,
  normalizeTipoEstrutura,
} from '@/services/tarefaOperacionalEntityResolver';

const FORMAS_DESTINACAO = ['Militar', 'Setor', 'Subsetor', 'Unidade'];

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
  subsetor_origem: '',
  unidade_origem: '',
  publico_resumo: '',
  forma_destinacao: 'Militar',
};

function containsTerm(value, term) {
  if (!term) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term);
}

function getParentId(item = {}) {
  return item.grupamento_id || item.setor_pai_id || item.parent_id || '';
}

function dedupeById(items = []) {
  return [...new Map(items.filter(Boolean).map((item) => [item.id, item])).values()];
}

export default function CadastrarTarefaOperacional() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    user,
    acesso,
    modoAcesso,
    subgrupamentoId,
    getMilitarScopeFilters,
    canAccessModule,
    canAccessAction,
    isLoading: loadingUser,
    isAccessResolved,
  } = useCurrentUser();

  const [formData, setFormData] = useState(initialState);
  const [searchMilitarTerm, setSearchMilitarTerm] = useState('');
  const [selectedMilitarIds, setSelectedMilitarIds] = useState([]);
  const [selectedScopeId, setSelectedScopeId] = useState('');

  const hasModuleAccess = canAccessModule('tarefas_operacionais');
  const canCreateTask = canAccessAction('criar_tarefa_operacional') || canAccessAction('admin_mode');

  const { data: estrutura = [] } = useQuery({
    queryKey: ['estrutura-organizacional-tarefas-operacionais'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const { data: militaresEscopo = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['militares-destinatarios-tarefa-operacional', modoAcesso, subgrupamentoId, user?.email],
    queryFn: async () => {
      const filtros = getMilitarScopeFilters();
      if (modoAcesso === 'admin') return base44.entities.Militar.list('nome_completo');
      if (!filtros.length) return [];
      const arrays = await Promise.all(filtros.map((filtro) => base44.entities.Militar.filter(filtro, 'nome_completo')));
      return dedupeById(arrays.flat());
    },
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const estruturaNormalizada = useMemo(() => {
    return estrutura.map((item) => ({
      ...item,
      parentId: getParentId(item),
      tipoNormalizado: normalizeTipoEstrutura(item),
    }));
  }, [estrutura]);

  const allowedScope = useMemo(() => {
    const setores = estruturaNormalizada.filter((item) => item.tipoNormalizado === 'Setor');
    const subsetores = estruturaNormalizada.filter((item) => item.tipoNormalizado === 'Subsetor');
    const unidades = estruturaNormalizada.filter((item) => item.tipoNormalizado === 'Unidade');

    if (modoAcesso === 'admin') {
      return { setores, subsetores, unidades };
    }

    if (modoAcesso === 'setor') {
      const setorIds = [subgrupamentoId].filter(Boolean);
      const subsetorPermitidos = subsetores.filter((item) => setorIds.includes(item.parentId));
      const unidadePermitidas = unidades.filter((item) => subsetorPermitidos.some((sub) => sub.id === item.parentId));
      return {
        setores: setores.filter((item) => setorIds.includes(item.id)),
        subsetores: subsetorPermitidos,
        unidades: unidadePermitidas,
      };
    }

    if (modoAcesso === 'subsetor') {
      const subsetorIds = [subgrupamentoId].filter(Boolean);
      const unidadePermitidas = unidades.filter((item) => subsetorIds.includes(item.parentId));
      return {
        setores: [],
        subsetores: subsetores.filter((item) => subsetorIds.includes(item.id)),
        unidades: unidadePermitidas,
      };
    }

    if (modoAcesso === 'unidade') {
      const unidadeIds = [subgrupamentoId].filter(Boolean);
      return {
        setores: [],
        subsetores: [],
        unidades: unidades.filter((item) => unidadeIds.includes(item.id)),
      };
    }

    return { setores: [], subsetores: [], unidades: [] };
  }, [estruturaNormalizada, modoAcesso, subgrupamentoId]);

  const militaresById = useMemo(() => new Map(militaresEscopo.map((m) => [m.id, m])), [militaresEscopo]);

  const militaresFiltrados = useMemo(() => {
    const term = searchMilitarTerm.trim().toLowerCase();
    return militaresEscopo.filter((militar) => (
      containsTerm(militar.nome_completo, term)
      || containsTerm(militar.nome_guerra, term)
      || containsTerm(militar.matricula, term)
      || containsTerm(militar.funcao, term)
    ));
  }, [militaresEscopo, searchMilitarTerm]);

  const resolveMilitaresFromScope = (forma, escopoId) => {
    if (!escopoId) return [];

    if (forma === 'Setor') {
      const subsetoresFilhos = estruturaNormalizada
        .filter((item) => item.tipoNormalizado === 'Subsetor' && item.parentId === escopoId)
        .map((item) => item.id);
      const unidadesFilhasDoSetor = estruturaNormalizada
        .filter((item) => item.tipoNormalizado === 'Unidade' && subsetoresFilhos.includes(item.parentId))
        .map((item) => item.id);

      return militaresEscopo.filter((militar) => (
        militar.grupamento_id === escopoId
        || militar.subgrupamento_id === escopoId
        || subsetoresFilhos.includes(militar.subgrupamento_id)
        || unidadesFilhasDoSetor.includes(militar.subgrupamento_id)
      ));
    }

    if (forma === 'Subsetor') {
      const unidadesFilhasDoSubsetor = estruturaNormalizada
        .filter((item) => item.tipoNormalizado === 'Unidade' && item.parentId === escopoId)
        .map((item) => item.id);

      return militaresEscopo.filter((militar) => (
        militar.subgrupamento_id === escopoId
        || unidadesFilhasDoSubsetor.includes(militar.subgrupamento_id)
      ));
    }

    if (forma === 'Unidade') {
      return militaresEscopo.filter((militar) => militar.subgrupamento_id === escopoId);
    }

    return [];
  };

  const destinatariosPreview = useMemo(() => {
    if (formData.forma_destinacao === 'Militar') {
      return dedupeById(selectedMilitarIds.map((id) => militaresById.get(id)).filter(Boolean));
    }
    return dedupeById(resolveMilitaresFromScope(formData.forma_destinacao, selectedScopeId));
  }, [formData.forma_destinacao, selectedMilitarIds, selectedScopeId, militaresById]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const titulo = formData.titulo.trim();
      if (!titulo) throw new Error('Informe o título da tarefa.');

      const destinoViaMilitar = formData.forma_destinacao === 'Militar';
      if (!destinoViaMilitar && !selectedScopeId) throw new Error('Selecione um escopo de destinação.');

      const scopePermitido = (
        formData.forma_destinacao === 'Setor' ? allowedScope.setores
          : formData.forma_destinacao === 'Subsetor' ? allowedScope.subsetores
            : allowedScope.unidades
      );

      if (!destinoViaMilitar && !scopePermitido.some((item) => item.id === selectedScopeId)) {
        throw new Error('Escopo selecionado fora da sua permissão de acesso.');
      }

      const destinatariosFinais = destinatariosPreview;
      if (!destinatariosFinais.length) throw new Error('Não há destinatários elegíveis para o escopo selecionado.');

      const idsFinais = new Set(destinatariosFinais.map((m) => m.id));
      const idsNoEscopo = new Set(militaresEscopo.map((m) => m.id));
      const bypass = [...idsFinais].some((id) => !idsNoEscopo.has(id));
      if (bypass) throw new Error('Destinatários inválidos para seu nível de acesso.');

      const tarefaEntity = await getTarefaOperacionalEntity();
      const destinatarioEntity = await getTarefaOperacionalDestinatarioEntity();
      const historicoEntity = await getTarefaOperacionalHistoricoEntity();

      const nowIso = new Date().toISOString();
      const escopoSelecionado = estruturaNormalizada.find((item) => item.id === selectedScopeId);

      const payload = {
        ...formData,
        titulo,
        descricao: formData.descricao.trim(),
        publico_resumo: (formData.publico_resumo || `${formData.forma_destinacao}: ${destinatariosFinais.length} destinatário(s)`).trim(),
        criado_por: user?.email || 'sistema',
        data_criacao: nowIso,
        total_destinatarios: destinatariosFinais.length,
        setor_origem: formData.setor_origem || (acesso?.tipo_acesso === 'setor' ? (acesso?.subgrupamento_nome || '') : ''),
        subsetor_origem: formData.subsetor_origem || (acesso?.tipo_acesso === 'subsetor' ? (acesso?.subgrupamento_nome || '') : ''),
        unidade_origem: formData.unidade_origem || (acesso?.tipo_acesso === 'unidade' ? (acesso?.subgrupamento_nome || '') : ''),
        forma_destinacao: formData.forma_destinacao,
        escopo_destino_id: escopoSelecionado?.id || '',
        escopo_destino_nome: escopoSelecionado?.nome || '',
      };

      const tarefaCriada = await tarefaEntity.create(payload);

      const destinatarioPayloads = destinatariosFinais.map((militar) => ({
        tarefa_id: tarefaCriada.id,
        militar_id: militar.id,
        militar_nome: militar.nome_completo || militar.nome_guerra || 'Militar',
        militar_email: militar.email_funcional || militar.email_particular || '',
        status_individual: 'Pendente',
      }));

      await Promise.all(destinatarioPayloads.map((item) => destinatarioEntity.create(item)));

      if (historicoEntity) {
        await historicoEntity.create({
          tarefa_id: tarefaCriada.id,
          evento: 'TAREFA_CRIADA',
          descricao: `Tarefa criada com destinação ${formData.forma_destinacao} para ${destinatarioPayloads.length} destinatário(s).`,
          usuario: user?.email || 'sistema',
          timestamp: nowIso,
        });
      }
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

  const handleFormaDestinacao = (value) => {
    setFormData((prev) => ({ ...prev, forma_destinacao: value }));
    setSelectedMilitarIds([]);
    setSelectedScopeId('');
  };

  const optionsEscopo = formData.forma_destinacao === 'Setor'
    ? allowedScope.setores
    : formData.forma_destinacao === 'Subsetor'
      ? allowedScope.subsetores
      : allowedScope.unidades;

  const bloqueioEscopo = modoAcesso === 'proprio' && formData.forma_destinacao !== 'Militar';

  if (loadingUser || !isAccessResolved) return null;
  if (!hasModuleAccess) return <AccessDenied modulo="Tarefas Operacionais" />;
  if (!canCreateTask) return <AccessDenied modulo="Criar tarefa operacional" />;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cadastrar Tarefa Operacional</h1>
            <p className="text-sm text-slate-500 mt-1">Criação por escopo com revalidação de permissão no submit.</p>
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
                <Label htmlFor="publico_resumo">Resumo público</Label>
                <Input id="publico_resumo" value={formData.publico_resumo} onChange={(e) => handleChange('publico_resumo', e.target.value)} placeholder="Resumo curto para listagens" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição / orientações</Label>
                <Textarea id="descricao" rows={5} value={formData.descricao} onChange={(e) => handleChange('descricao', e.target.value)} placeholder="Descreva as orientações para execução da tarefa." />
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
              Destinação e destinatários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Forma de destinação</Label>
              <Select value={formData.forma_destinacao} onValueChange={handleFormaDestinacao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_DESTINACAO.map((forma) => (
                    <SelectItem
                      key={forma}
                      value={forma}
                      disabled={modoAcesso === 'proprio' && forma !== 'Militar'}
                    >
                      {forma}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.forma_destinacao === 'Militar' ? (
              <>
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
                    <p className="p-4 text-sm text-slate-500">Carregando efetivo permitido...</p>
                  ) : militaresFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">Nenhum militar elegível no seu escopo.</p>
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
              </>
            ) : (
              <div className="space-y-2">
                <Label>{formData.forma_destinacao} de destino</Label>
                <Select value={selectedScopeId} onValueChange={setSelectedScopeId} disabled={bloqueioEscopo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o escopo" /></SelectTrigger>
                  <SelectContent>
                    {optionsEscopo.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bloqueioEscopo ? (
                  <p className="text-xs text-amber-700 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Modo próprio não pode criar tarefa ampla.</p>
                ) : optionsEscopo.length === 0 ? (
                  <p className="text-xs text-amber-700">Você não possui escopo autorizado para esta forma de destinação.</p>
                ) : null}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                Destinatários elegíveis: <span className="font-semibold text-slate-800">{destinatariosPreview.length}</span>
              </p>

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
