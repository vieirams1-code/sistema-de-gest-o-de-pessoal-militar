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
  forma_destinacao: 'Militar',
};

const DESTINACAO_OPTIONS = ['Militar', 'Setor', 'Subsetor', 'Unidade'];

const isSchemaNotFoundError = (error) => {
  const message = String(error?.message || error?.response?.data?.message || '').toLowerCase();
  return message.includes('entity schema') && message.includes('not found');
};

const normalizeTipo = (item = {}) => {
  const tipo = String(item.tipo || '').trim();
  if (tipo === 'Setor' || tipo === 'Grupamento') return 'Setor';
  if (tipo === 'Subsetor' || tipo === 'Subgrupamento') return 'Subsetor';
  if (tipo === 'Unidade') return 'Unidade';

  const nivel = Number(item.nivel_hierarquico);
  if (nivel === 1) return 'Setor';
  if (nivel === 2) return 'Subsetor';
  if (nivel === 3) return 'Unidade';

  return item.grupamento_id ? 'Subsetor' : 'Setor';
};

function containsTerm(value, term) {
  if (!term) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term);
}

function uniqById(items = []) {
  const ids = new Set();
  return items.filter((item) => {
    if (!item?.id || ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}

export default function CadastrarTarefaOperacional() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    user,
    canAccessModule,
    canAccessAction,
    isLoading: loadingUser,
    isAccessResolved,
    isAdmin,
    modoAcesso,
    subgrupamentoId,
    userEmail,
    linkedMilitarId,
    linkedMilitarEmail,
  } = useCurrentUser();

  const [formData, setFormData] = useState(initialState);
  const [searchMilitarTerm, setSearchMilitarTerm] = useState('');
  const [selectedMilitarIds, setSelectedMilitarIds] = useState([]);
  const [selectedScopeId, setSelectedScopeId] = useState('');

  const hasModuleAccess = canAccessModule('tarefas_operacionais');
  const canCreateTask = canAccessAction('criar_tarefa_operacional') || canAccessAction('admin_mode');

  const { data: estruturaRaw = [], isLoading: loadingEstrutura } = useQuery({
    queryKey: ['estrutura-organizacional-tarefas-operacionais'],
    queryFn: () => base44.entities.Subgrupamento.list('-created_date'),
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const { data: militaresRaw = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['militares-tarefas-operacionais'],
    queryFn: () => base44.entities.Militar.list('-nome_completo'),
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const estrutura = useMemo(() => estruturaRaw.map((item) => ({ ...item, tipoNormalizado: normalizeTipo(item) })), [estruturaRaw]);

  const allowedOrgIds = useMemo(() => {
    if (isAdmin) {
      return {
        setores: new Set(estrutura.filter((item) => item.tipoNormalizado === 'Setor').map((item) => item.id)),
        subsetores: new Set(estrutura.filter((item) => item.tipoNormalizado === 'Subsetor').map((item) => item.id)),
        unidades: new Set(estrutura.filter((item) => item.tipoNormalizado === 'Unidade').map((item) => item.id)),
      };
    }

    if (!subgrupamentoId) return { setores: new Set(), subsetores: new Set(), unidades: new Set() };

    if (modoAcesso === 'setor') {
      const subsetores = estrutura.filter((item) => item.tipoNormalizado === 'Subsetor' && item.grupamento_id === subgrupamentoId);
      const subsetorIds = new Set(subsetores.map((item) => item.id));
      const unidades = estrutura.filter((item) => item.tipoNormalizado === 'Unidade' && subsetorIds.has(item.grupamento_id));
      return {
        setores: new Set([subgrupamentoId]),
        subsetores: subsetorIds,
        unidades: new Set(unidades.map((item) => item.id)),
      };
    }

    if (modoAcesso === 'subsetor') {
      const unidades = estrutura.filter((item) => item.tipoNormalizado === 'Unidade' && item.grupamento_id === subgrupamentoId);
      return {
        setores: new Set(),
        subsetores: new Set([subgrupamentoId]),
        unidades: new Set(unidades.map((item) => item.id)),
      };
    }

    if (modoAcesso === 'unidade') {
      return {
        setores: new Set(),
        subsetores: new Set(),
        unidades: new Set([subgrupamentoId]),
      };
    }

    return { setores: new Set(), subsetores: new Set(), unidades: new Set() };
  }, [isAdmin, modoAcesso, estrutura, subgrupamentoId]);

  const militaresNoEscopo = useMemo(() => {
    const ativos = militaresRaw.filter((militar) => militar.status_cadastro !== 'Inativo');

    if (isAdmin) return ativos;

    if (modoAcesso === 'proprio') {
      const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
      return ativos.filter((militar) => {
        if (linkedMilitarId && militar.id === linkedMilitarId) return true;
        return knownEmails.some((email) => (
          militar.email === email
          || militar.email_particular === email
          || militar.email_funcional === email
          || militar.created_by === email
          || militar.militar_email === email
        ));
      });
    }

    return ativos.filter((militar) => {
      const isBySetor = militar.grupamento_id && allowedOrgIds.setores.has(militar.grupamento_id);
      const isBySubsetorOuUnidade = militar.subgrupamento_id
        && (allowedOrgIds.subsetores.has(militar.subgrupamento_id) || allowedOrgIds.unidades.has(militar.subgrupamento_id));
      return isBySetor || isBySubsetorOuUnidade;
    });
  }, [allowedOrgIds, isAdmin, linkedMilitarEmail, linkedMilitarId, militaresRaw, modoAcesso, userEmail]);

  const setoresDisponiveis = useMemo(
    () => estrutura.filter((item) => item.tipoNormalizado === 'Setor' && allowedOrgIds.setores.has(item.id)),
    [estrutura, allowedOrgIds.setores],
  );

  const subsetoresDisponiveis = useMemo(
    () => estrutura.filter((item) => item.tipoNormalizado === 'Subsetor' && allowedOrgIds.subsetores.has(item.id)),
    [estrutura, allowedOrgIds.subsetores],
  );

  const unidadesDisponiveis = useMemo(
    () => estrutura.filter((item) => item.tipoNormalizado === 'Unidade' && allowedOrgIds.unidades.has(item.id)),
    [estrutura, allowedOrgIds.unidades],
  );

  const militaresFiltrados = useMemo(() => {
    const term = searchMilitarTerm.trim().toLowerCase();
    return militaresNoEscopo.filter((militar) => (
      containsTerm(militar.nome_completo, term)
      || containsTerm(militar.nome_guerra, term)
      || containsTerm(militar.matricula, term)
      || containsTerm(militar.funcao, term)
    ));
  }, [militaresNoEscopo, searchMilitarTerm]);

  const militaresElegiveis = useMemo(() => {
    if (formData.forma_destinacao === 'Militar') {
      return uniqById(selectedMilitarIds.map((id) => militaresNoEscopo.find((militar) => militar.id === id)).filter(Boolean));
    }

    if (!selectedScopeId) return [];

    if (formData.forma_destinacao === 'Unidade') {
      return uniqById(militaresNoEscopo.filter((militar) => militar.subgrupamento_id === selectedScopeId));
    }

    if (formData.forma_destinacao === 'Subsetor') {
      const unidadeIds = new Set(
        estrutura
          .filter((item) => item.tipoNormalizado === 'Unidade' && item.grupamento_id === selectedScopeId)
          .map((item) => item.id),
      );

      return uniqById(militaresNoEscopo.filter((militar) => (
        militar.subgrupamento_id === selectedScopeId
        || unidadeIds.has(militar.subgrupamento_id)
      )));
    }

    if (formData.forma_destinacao === 'Setor') {
      const subsetorIds = new Set(
        estrutura
          .filter((item) => item.tipoNormalizado === 'Subsetor' && item.grupamento_id === selectedScopeId)
          .map((item) => item.id),
      );
      const unidadeIds = new Set(
        estrutura
          .filter((item) => item.tipoNormalizado === 'Unidade' && subsetorIds.has(item.grupamento_id))
          .map((item) => item.id),
      );

      return uniqById(militaresNoEscopo.filter((militar) => (
        militar.grupamento_id === selectedScopeId
        || subsetorIds.has(militar.subgrupamento_id)
        || unidadeIds.has(militar.subgrupamento_id)
      )));
    }

    return [];
  }, [formData.forma_destinacao, militaresNoEscopo, selectedMilitarIds, selectedScopeId, estrutura]);

  const semEscopo = !isAdmin && modoAcesso !== 'proprio' && !subgrupamentoId;
  const destinoAmploBloqueado = modoAcesso === 'proprio' && formData.forma_destinacao !== 'Militar';

  const registrarHistoricoSemBloqueio = async (payloadHistorico) => {
    if (!TarefaOperacionalHistorico) return;
    try {
      await TarefaOperacionalHistorico.create(payloadHistorico);
    } catch (error) {
      if (isSchemaNotFoundError(error)) return;
      throw error;
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const titulo = formData.titulo.trim();
      if (!titulo) throw new Error('Informe o título da tarefa.');
      if (!formData.prazo) throw new Error('Informe o prazo da tarefa.');
      if (semEscopo) throw new Error('Seu usuário não possui escopo organizacional válido para criar tarefas.');
      if (destinoAmploBloqueado) throw new Error('No modo próprio é permitido somente destinar tarefa para militar específico.');
      if (militaresElegiveis.length === 0) throw new Error('Nenhum destinatário elegível encontrado para a forma de destinação selecionada.');

      if (!TarefaOperacional) throw new Error('Entidade TarefaOperacional não encontrada no schema do app.');
      if (!TarefaOperacionalDestinatario) throw new Error('Entidade TarefaOperacionalDestinatario não encontrada no schema do app.');

      const nowIso = new Date().toISOString();
      const subsetorOrigem = modoAcesso === 'subsetor' ? subgrupamentoId : '';
      const unidadeOrigem = modoAcesso === 'unidade' ? subgrupamentoId : '';
      const setorOrigem = modoAcesso === 'setor' ? subgrupamentoId : '';

      const payload = {
        ...formData,
        titulo,
        descricao: formData.descricao.trim(),
        setor_origem: formData.setor_origem.trim() || setorOrigem,
        subsetor_origem: subsetorOrigem,
        unidade_origem: unidadeOrigem,
        publico_resumo: formData.publico_resumo.trim(),
        criado_por: user?.email || 'sistema',
        data_criacao: nowIso,
        total_destinatarios: militaresElegiveis.length,
      };

      const tarefaCriada = await TarefaOperacional.create(payload);

      const destinatarioPayloads = uniqById(militaresElegiveis).map((militar) => ({
        tarefa_id: tarefaCriada.id,
        militar_id: militar.id,
        militar_nome: militar.nome_completo || militar.nome_guerra || 'Militar',
        militar_email: militar.email_funcional || militar.email_particular || militar.email || '',
        status_individual: 'Pendente',
        resposta_texto: '',
        anexo_url: '',
        data_resposta: '',
        concluido_em: '',
        problema_reportado: false,
        detalhe_problema: '',
      }));

      await Promise.all(destinatarioPayloads.map((item) => TarefaOperacionalDestinatario.create(item)));

      await registrarHistoricoSemBloqueio({
        tarefa_id: tarefaCriada.id,
        evento: 'TAREFA_CRIADA',
        descricao: `Tarefa criada via ${formData.forma_destinacao} para ${destinatarioPayloads.length} destinatário(s).`,
        usuario: user?.email || 'sistema',
        timestamp: nowIso,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tarefas-operacionais'] });
      queryClient.invalidateQueries({ queryKey: ['militares-tarefas-operacionais'] });
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

  const handleFormaDestinacao = (value) => {
    setFormData((prev) => ({ ...prev, forma_destinacao: value }));
    setSelectedScopeId('');
    setSelectedMilitarIds([]);
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
            <p className="text-sm text-slate-500 mt-1">Cadastro com destinação por escopo (militar, setor, subsetor ou unidade).</p>
          </div>

          <Button variant="outline" onClick={() => navigate(createPageUrl('TarefasOperacionais'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </header>

        {semEscopo && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              Seu usuário não possui escopo organizacional definido para criar tarefas operacionais.
            </CardContent>
          </Card>
        )}

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
              Destinação e destinatários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Forma de destinação</Label>
                <Select value={formData.forma_destinacao} onValueChange={handleFormaDestinacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DESTINACAO_OPTIONS.map((tipo) => (
                      <SelectItem
                        key={tipo}
                        value={tipo}
                        disabled={modoAcesso === 'proprio' && tipo !== 'Militar'}
                      >
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.forma_destinacao !== 'Militar' && (
                <div className="space-y-2">
                  <Label>{formData.forma_destinacao} de destino</Label>
                  <Select value={selectedScopeId} onValueChange={setSelectedScopeId}>
                    <SelectTrigger><SelectValue placeholder={`Selecione ${formData.forma_destinacao.toLowerCase()}...`} /></SelectTrigger>
                    <SelectContent>
                      {(formData.forma_destinacao === 'Setor' ? setoresDisponiveis :
                        formData.forma_destinacao === 'Subsetor' ? subsetoresDisponiveis :
                          unidadesDisponiveis).map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {formData.forma_destinacao === 'Militar' && (
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
                  {loadingMilitares || loadingEstrutura ? (
                    <p className="p-4 text-sm text-slate-500">Carregando efetivo...</p>
                  ) : militaresFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">Nenhum militar elegível encontrado para o seu escopo.</p>
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
            )}

            {destinoAmploBloqueado && (
              <p className="text-sm text-amber-700 rounded-lg bg-amber-50 border border-amber-200 p-3">
                No modo próprio você só pode criar tarefa para militar específico dentro do seu vínculo.
              </p>
            )}

            <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
              <p className="text-sm text-slate-600">
                Destinatários elegíveis: <span className="font-semibold text-slate-800">{militaresElegiveis.length}</span>
              </p>

              <Button
                className="bg-[#173764] hover:bg-[#10294c]"
                onClick={() => createMutation.mutate()}
                disabled={
                  createMutation.isPending
                  || militaresElegiveis.length === 0
                  || semEscopo
                  || destinoAmploBloqueado
                }
              >
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
