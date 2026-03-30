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
import { ArrowLeft, Save, Search, ShieldAlert, Users } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { PRIORIDADE_OPTIONS, STATUS_TAREFA, TIPO_TAREFA_OPTIONS } from '@/components/tarefasOperacionaisConfig';

const FORMA_DESTINACAO_OPTIONS = [
  { value: 'militar', label: 'Militar específico' },
  { value: 'setor', label: 'Setor' },
  { value: 'subsetor', label: 'Subsetor' },
  { value: 'unidade', label: 'Unidade' },
];

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
  forma_destinacao: 'militar',
};

function containsTerm(value, term) {
  if (!term) return true;
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term);
}

const normalizeTipo = (item = {}) => {
  const tipo = String(item.tipo || '').toLowerCase();
  const nivel = Number(item.nivel_hierarquico);
  if (tipo.includes('unidade') || nivel === 3) return 'Unidade';
  if (tipo.includes('subsetor') || tipo.includes('subgrupamento') || nivel === 2) return 'Subsetor';
  return 'Setor';
};

const getParentId = (item = {}) => item.grupamento_id || item.setor_pai_id || item.parent_id || '';

const uniqueById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export default function CadastrarTarefaOperacional() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    user,
    acesso,
    isAdmin,
    modoAcesso,
    subgrupamentoId,
    linkedMilitarId,
    linkedMilitarEmail,
    userEmail,
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

  const { data: estruturaRaw = [], isLoading: loadingEstrutura } = useQuery({
    queryKey: ['estrutura-tarefa-operacional'],
    queryFn: () => base44.entities.Subgrupamento.list('nome'),
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const estrutura = useMemo(() => estruturaRaw.map((item) => ({
    ...item,
    tipoNormalizado: normalizeTipo(item),
    parentId: getParentId(item),
  })), [estruturaRaw]);

  const estruturaById = useMemo(() => Object.fromEntries(estrutura.map((item) => [item.id, item])), [estrutura]);

  const setores = useMemo(() => estrutura.filter((item) => item.tipoNormalizado === 'Setor'), [estrutura]);
  const subsetores = useMemo(() => estrutura.filter((item) => item.tipoNormalizado === 'Subsetor'), [estrutura]);
  const unidades = useMemo(() => estrutura.filter((item) => item.tipoNormalizado === 'Unidade'), [estrutura]);

  const subsetoresDoSetor = (setorId) => subsetores.filter((item) => item.parentId === setorId);
  const unidadesDoSubsetor = (subsetorId) => unidades.filter((item) => item.parentId === subsetorId);

  const allowedScope = useMemo(() => {
    if (isAdmin) {
      return { setores, subsetores, unidades };
    }

    if (modoAcesso === 'setor' && subgrupamentoId) {
      const setorAtual = setores.filter((item) => item.id === subgrupamentoId);
      const subsetoresPermitidos = subsetoresDoSetor(subgrupamentoId);
      const unidadesPermitidas = subsetoresPermitidos.flatMap((sub) => unidadesDoSubsetor(sub.id));
      return { setores: setorAtual, subsetores: subsetoresPermitidos, unidades: unidadesPermitidas };
    }

    if (modoAcesso === 'subsetor' && subgrupamentoId) {
      const subsetorAtual = subsetores.filter((item) => item.id === subgrupamentoId);
      return { setores: [], subsetores: subsetorAtual, unidades: unidadesDoSubsetor(subgrupamentoId) };
    }

    if (modoAcesso === 'unidade' && subgrupamentoId) {
      const unidadeAtual = unidades.filter((item) => item.id === subgrupamentoId);
      return { setores: [], subsetores: [], unidades: unidadeAtual };
    }

    return { setores: [], subsetores: [], unidades: [] };
  }, [isAdmin, modoAcesso, setores, subgrupamentoId, subsetores, unidades]);

  const { data: militaresEscopo = [], isLoading: loadingMilitares } = useQuery({
    queryKey: ['militares-destinatarios-tarefa-operacional', isAdmin, modoAcesso, subgrupamentoId, linkedMilitarId, linkedMilitarEmail, userEmail, estrutura.length],
    queryFn: async () => {
      if (isAdmin) {
        const all = await base44.entities.Militar.list('nome_completo');
        return all.filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'setor' && subgrupamentoId) {
        const subsetoresPermitidos = subsetoresDoSetor(subgrupamentoId);
        const unidadesPermitidas = subsetoresPermitidos.flatMap((sub) => unidadesDoSubsetor(sub.id));
        const subIds = [subgrupamentoId, ...subsetoresPermitidos.map((s) => s.id), ...unidadesPermitidas.map((u) => u.id)];

        const reqs = [
          base44.entities.Militar.filter({ grupamento_id: subgrupamentoId }, 'nome_completo'),
          ...subIds.map((id) => base44.entities.Militar.filter({ subgrupamento_id: id }, 'nome_completo')),
        ];
        const batches = await Promise.all(reqs);
        return uniqueById(batches.flat()).filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'subsetor' && subgrupamentoId) {
        const unidadesPermitidas = unidadesDoSubsetor(subgrupamentoId);
        const reqs = [
          base44.entities.Militar.filter({ subgrupamento_id: subgrupamentoId }, 'nome_completo'),
          ...unidadesPermitidas.map((u) => base44.entities.Militar.filter({ subgrupamento_id: u.id }, 'nome_completo')),
        ];
        const batches = await Promise.all(reqs);
        return uniqueById(batches.flat()).filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'unidade' && subgrupamentoId) {
        const list = await base44.entities.Militar.filter({ subgrupamento_id: subgrupamentoId }, 'nome_completo');
        return list.filter((m) => m.status_cadastro !== 'Inativo');
      }

      if (modoAcesso === 'proprio') {
        const knownEmails = [userEmail, linkedMilitarEmail].filter(Boolean);
        if (!linkedMilitarId && knownEmails.length === 0) return [];

        const requests = [];
        if (linkedMilitarId) requests.push(base44.entities.Militar.filter({ id: linkedMilitarId }, 'nome_completo'));
        knownEmails.forEach((email) => {
          requests.push(base44.entities.Militar.filter({ email }, 'nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_particular: email }, 'nome_completo'));
          requests.push(base44.entities.Militar.filter({ email_funcional: email }, 'nome_completo'));
        });

        const batches = await Promise.all(requests);
        return uniqueById(batches.flat()).filter((m) => m.status_cadastro !== 'Inativo');
      }

      return [];
    },
    enabled: isAccessResolved && hasModuleAccess && canCreateTask,
  });

  const resolveMilitaresPorEscopo = (formaDestinacao, scopeId) => {
    if (formaDestinacao === 'militar') {
      return militaresEscopo.filter((militar) => selectedMilitarIds.includes(militar.id));
    }

    if (!scopeId) return [];

    if (formaDestinacao === 'setor') {
      const subsetoresFilhos = subsetoresDoSetor(scopeId);
      const unidadesFilhas = subsetoresFilhos.flatMap((sub) => unidadesDoSubsetor(sub.id));
      const scopeIds = new Set([scopeId, ...subsetoresFilhos.map((s) => s.id), ...unidadesFilhas.map((u) => u.id)]);
      return militaresEscopo.filter((m) => m.grupamento_id === scopeId || scopeIds.has(m.subgrupamento_id));
    }

    if (formaDestinacao === 'subsetor') {
      const unidadesFilhas = unidadesDoSubsetor(scopeId);
      const scopeIds = new Set([scopeId, ...unidadesFilhas.map((u) => u.id)]);
      return militaresEscopo.filter((m) => scopeIds.has(m.subgrupamento_id));
    }

    if (formaDestinacao === 'unidade') {
      return militaresEscopo.filter((m) => m.subgrupamento_id === scopeId);
    }

    return [];
  };

  const destinatariosResolvidos = useMemo(() => {
    const resolved = resolveMilitaresPorEscopo(formData.forma_destinacao, selectedScopeId);
    return uniqueById(resolved);
  }, [formData.forma_destinacao, militaresEscopo, selectedScopeId, selectedMilitarIds]);

  const militaresFiltrados = useMemo(() => {
    const term = searchMilitarTerm.trim().toLowerCase();
    return militaresEscopo.filter((militar) => (
      containsTerm(militar.nome_completo, term)
      || containsTerm(militar.nome_guerra, term)
      || containsTerm(militar.matricula, term)
      || containsTerm(militar.funcao, term)
    ));
  }, [militaresEscopo, searchMilitarTerm]);

  const optionsByForma = useMemo(() => {
    if (formData.forma_destinacao === 'setor') return allowedScope.setores;
    if (formData.forma_destinacao === 'subsetor') return allowedScope.subsetores;
    if (formData.forma_destinacao === 'unidade') return allowedScope.unidades;
    return [];
  }, [allowedScope, formData.forma_destinacao]);

  const canUseForma = (forma) => {
    if (forma === 'militar') return true;
    if (forma === 'setor') return isAdmin || modoAcesso === 'setor';
    if (forma === 'subsetor') return isAdmin || modoAcesso === 'setor' || modoAcesso === 'subsetor';
    if (forma === 'unidade') return isAdmin || modoAcesso === 'setor' || modoAcesso === 'subsetor' || modoAcesso === 'unidade';
    return false;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const titulo = formData.titulo.trim();
      if (!titulo) throw new Error('Informe o título da tarefa.');
      if (!TarefaOperacional) throw new Error('Entidade TarefaOperacional não encontrada no schema do app.');
      if (!TarefaOperacionalDestinatario) throw new Error('Entidade TarefaOperacionalDestinatario não encontrada no schema do app.');
      if (!TarefaOperacionalHistorico) throw new Error('Entidade TarefaOperacionalHistorico não encontrada no schema do app.');

      if (!canUseForma(formData.forma_destinacao)) {
        throw new Error('Seu nível de acesso não permite essa forma de destinação.');
      }

      if (formData.forma_destinacao !== 'militar') {
        const allowedIds = new Set(optionsByForma.map((item) => item.id));
        if (!selectedScopeId || !allowedIds.has(selectedScopeId)) {
          throw new Error('Escopo selecionado inválido para o seu perfil de acesso.');
        }
      }

      if (formData.forma_destinacao === 'militar') {
        const scopedIds = new Set(militaresEscopo.map((item) => item.id));
        const invalid = selectedMilitarIds.find((id) => !scopedIds.has(id));
        if (invalid) throw new Error('Há destinatário fora do escopo permitido para o usuário logado.');
      }

      const destinatarios = uniqueById(destinatariosResolvidos);
      if (destinatarios.length === 0) throw new Error('Nenhum destinatário elegível foi encontrado para o escopo selecionado.');

      const nowIso = new Date().toISOString();
      const escopoSelecionado = estruturaById[selectedScopeId];
      const setorOrigem = formData.setor_origem.trim() || acesso?.grupamento_nome || '';
      const subsetorOrigem = formData.subsetor_origem.trim() || (escopoSelecionado?.tipoNormalizado === 'Subsetor' ? escopoSelecionado.nome : acesso?.subgrupamento_tipo === 'Subgrupamento' ? acesso?.subgrupamento_nome || '' : '');
      const unidadeOrigem = formData.unidade_origem.trim() || (escopoSelecionado?.tipoNormalizado === 'Unidade' ? escopoSelecionado.nome : acesso?.subgrupamento_tipo === 'Unidade' ? acesso?.subgrupamento_nome || '' : '');
      const publicoResumo = formData.publico_resumo.trim() || `Destinação por ${formData.forma_destinacao} para ${destinatarios.length} militar(es).`;

      const payload = {
        ...formData,
        titulo,
        descricao: formData.descricao.trim(),
        setor_origem: setorOrigem,
        subsetor_origem: subsetorOrigem,
        unidade_origem: unidadeOrigem,
        publico_resumo: publicoResumo,
        criado_por: user?.email || 'sistema',
        data_criacao: nowIso,
        total_destinatarios: destinatarios.length,
      };

      const tarefaCriada = await TarefaOperacional.create(payload);

      const destinatarioPayloads = destinatarios.map((militar) => ({
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
        descricao: `Tarefa criada (${formData.forma_destinacao}) para ${destinatarioPayloads.length} destinatário(s).`,
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

  const handleFormaDestinacaoChange = (value) => {
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

  const allowScopeSelection = formData.forma_destinacao !== 'militar';
  const hasScopeOptions = optionsByForma.length > 0;
  const showScopeDenied = allowScopeSelection && !hasScopeOptions;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cadastrar Tarefa Operacional</h1>
            <p className="text-sm text-slate-500 mt-1">Criação com destinação por militar, setor, subsetor ou unidade com validação de escopo.</p>
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
                <Label htmlFor="setor_origem">Setor de origem</Label>
                <Input id="setor_origem" value={formData.setor_origem} onChange={(e) => handleChange('setor_origem', e.target.value)} placeholder="Ex: 1º GBM" />
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
            <div className="space-y-2">
              <Label>Forma de destinação</Label>
              <Select value={formData.forma_destinacao} onValueChange={handleFormaDestinacaoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMA_DESTINACAO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={!canUseForma(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {allowScopeSelection && (
              <div className="space-y-2">
                <Label>
                  Selecionar {formData.forma_destinacao === 'setor' ? 'setor' : formData.forma_destinacao === 'subsetor' ? 'subsetor' : 'unidade'}
                </Label>
                <Select value={selectedScopeId} onValueChange={setSelectedScopeId} disabled={loadingEstrutura || !hasScopeOptions}>
                  <SelectTrigger>
                    <SelectValue placeholder={hasScopeOptions ? 'Selecione um escopo' : 'Nenhum escopo disponível para seu perfil'} />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsByForma.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.nome}{item.sigla ? ` (${item.sigla})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showScopeDenied && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5" />
                <span>Seu perfil atual não permite selecionar esse escopo de destinação.</span>
              </div>
            )}

            {formData.forma_destinacao === 'militar' && (
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
                    <p className="p-4 text-sm text-slate-500">Carregando efetivo...</p>
                  ) : militaresFiltrados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">Nenhum militar encontrado dentro do seu escopo.</p>
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

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Destinatários elegíveis para a destinação selecionada: <span className="font-semibold">{destinatariosResolvidos.length}</span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
              <p className="text-sm text-slate-600">Validação de escopo aplicada no carregamento e também no envio.</p>

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
