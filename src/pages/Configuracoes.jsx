import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Trash2, Plus, Users, Shield, CheckSquare, Square, UserCog, Sliders } from 'lucide-react';
import TiposPublicacaoManager from '@/components/configuracoes/TiposPublicacaoManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TABS = [
  { id: 'permissoes', label: 'Permissões e Usuários', icon: UserCog },
  { id: 'adicoes', label: 'Adições e Personalizações', icon: Sliders },
];

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const { isAdmin, canAccessModule, canAccessAction, isLoading: loadingUser } = useCurrentUser();
  const [novaLotacao, setNovaLotacao] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');

  if (!loadingUser && (!isAdmin && !canAccessModule('configuracoes'))) {
    return <AccessDenied modulo="Configurações" />;
  }

  // Ler tab da URL
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'permissoes');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setActiveTab(t);
  }, [window.location.search]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [isNewAcesso, setIsNewAcesso] = useState(false);
  const [userNomeUsuario, setUserNomeUsuario] = useState('');
  const [userUserEmail, setUserUserEmail] = useState('');
  const [userAtivo, setUserAtivo] = useState(true);
  const [userObservacoes, setUserObservacoes] = useState('');
  const [userGrupamentoId, setUserGrupamentoId] = useState('');
  const [userSubgrupamentoId, setUserSubgrupamentoId] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [userAccessMode, setUserAccessMode] = useState('proprio');
  const [userMilitarId, setUserMilitarId] = useState('');
  const [userMilitarEmail, setUserMilitarEmail] = useState('');

  const initialPermissions = useMemo(() => ({
    acesso_militares: false,
    acesso_ferias: false,
    acesso_livro: false,
    acesso_publicacoes: false,
    acesso_atestados: false,
    acesso_armamentos: false,
    acesso_medalhas: false,
    acesso_templates: false,
    acesso_configuracoes: false,
    acesso_quadro_operacional: false,
    acesso_processos: false,
    perm_admin_mode: false,
    perm_gerir_cadeia_ferias: false,
    perm_excluir_ferias: false,
    perm_recalcular_ferias: false,
    perm_gerir_templates: false,
    perm_gerir_permissoes: false,
    perm_gerir_estrutura: false,
  }), []);
  
  const [userPermissions, setUserPermissions] = useState(initialPermissions);

  // Estado - atribuição em massa de militares
  const [massaGrupamentoId, setMassaGrupamentoId] = useState('');
  const [massaSubgrupamentoId, setMassaSubgrupamentoId] = useState('');
  const [militaresSelecionados, setMilitaresSelecionados] = useState([]);
  const [searchMassa, setSearchMassa] = useState('');
  const [savingMassa, setSavingMassa] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });

  const visibleTabs = useMemo(() => {
    const tabs = [];
    if (isAdmin || canAccessAction('gerir_permissoes')) tabs.push(TABS[0]);
    if (isAdmin || canAccessAction('gerir_estrutura')) tabs.push(TABS[1]);
    return tabs;
  }, [isAdmin, canAccessAction]);

  useEffect(() => {
    if (!loadingUser && visibleTabs.length > 0) {
      if (!visibleTabs.find(t => t.id === activeTab)) {
        setActiveTab(visibleTabs[0].id);
      }
    }
  }, [activeTab, visibleTabs, loadingUser]);

  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: () => base44.entities.Lotacao.list('-created_date') });
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: () => base44.entities.Funcao.list('-created_date') });
  const { data: militares = [] } = useQuery({ queryKey: ['militares-ativos'], queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }) });
  const { data: acessos = [], error: acessosError } = useQuery({
    queryKey: ['usuariosAcesso'],
    queryFn: () => base44.entities.UsuarioAcesso.list(),
    enabled: isAdmin,
  });
  const { data: subgrupamentos = [] } = useQuery({ queryKey: ['subgrupamentos'], queryFn: () => base44.entities.Subgrupamento.filter({ ativo: true }, 'nome') });

  const grupamentos = subgrupamentos.filter(s => s.tipo === 'Grupamento');
  const subgrupamentosFilhos = subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === userGrupamentoId);
  const massaSubgrupamentosFilhos = subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === massaGrupamentoId);
  const militaresFiltradosMassa = militares.filter(m =>
    !searchMassa ||
    m.nome_completo?.toLowerCase().includes(searchMassa.toLowerCase()) ||
    m.matricula?.includes(searchMassa) ||
    m.posto_graduacao?.toLowerCase().includes(searchMassa.toLowerCase())
  );

  const militaresOrdenados = useMemo(() => {
    return [...militares].sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''));
  }, [militares]);

  const handleSelectAcesso = (acesso) => {
    setSelectedUser(acesso);
    setIsNewAcesso(false);
    setUserAccessMode(acesso.tipo_acesso || 'proprio');
    setUserNomeUsuario(acesso.nome_usuario || '');
    setUserUserEmail(acesso.user_email || '');
    setUserAtivo(acesso.ativo !== false);
    setUserObservacoes(acesso.observacoes || '');

    setUserMilitarId(acesso.militar_id || '');
    setUserMilitarEmail(acesso.militar_email || '');
    setUserGrupamentoId(acesso.grupamento_id || '');
    setUserSubgrupamentoId(acesso.subgrupamento_id || '');

    const loadedPerms = {};
    Object.keys(initialPermissions).forEach(key => {
      loadedPerms[key] = acesso[key] === true;
    });
    setUserPermissions(loadedPerms);
  };

  const handleCreateNew = () => {
    setSelectedUser({});
    setIsNewAcesso(true);
    setUserAccessMode('proprio');
    setUserNomeUsuario('');
    setUserUserEmail('');
    setUserAtivo(true);
    setUserObservacoes('');
    setUserMilitarId('');
    setUserMilitarEmail('');
    setUserGrupamentoId('');
    setUserSubgrupamentoId('');
    setUserPermissions(initialPermissions);
  };

  const handleSaveUserScope = async () => {
    if (!selectedUser) return;
    if (!userUserEmail) { alert('E-mail do Usuário é obrigatório.'); return; }

    setSavingUser(true);
    try {
      const grupamento = grupamentos.find(g => g.id === userGrupamentoId);
      const sub = subgrupamentos.find(s => s.id === userSubgrupamentoId);

      const militarVinculado = militares.find((m) => m.id === userMilitarId);
      const militarEmailVinculado = militarVinculado?.email || militarVinculado?.email_particular || militarVinculado?.email_funcional || userMilitarEmail || userUserEmail || '';

      const baseData = {
        nome_usuario: userNomeUsuario,
        user_email: userUserEmail.trim(),
        ativo: userAtivo,
        observacoes: userObservacoes,
        ...userPermissions
      };

      let roleData = {};
      if (userAccessMode === 'admin') {
        roleData = { tipo_acesso: 'admin', grupamento_id: '', grupamento_nome: '', subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null, militar_id: '', militar_email: '' };
      } else if (userAccessMode === 'subsetor' && sub) {
        roleData = { tipo_acesso: 'subsetor', grupamento_id: grupamento?.id || '', grupamento_nome: grupamento?.nome || '', subgrupamento_id: sub.id, subgrupamento_nome: sub.nome, subgrupamento_tipo: 'Subgrupamento', militar_id: '', militar_email: '' };
      } else if (userAccessMode === 'setor' && grupamento) {
        roleData = { tipo_acesso: 'setor', grupamento_id: grupamento.id, grupamento_nome: grupamento.nome, subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: 'Grupamento', militar_id: '', militar_email: '' };
      } else {
        roleData = { tipo_acesso: 'proprio', grupamento_id: '', grupamento_nome: '', subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null, militar_id: userMilitarId || '', militar_email: militarEmailVinculado };
      }

      const dataToSave = { ...baseData, ...roleData };

      if (isNewAcesso) {
        await base44.entities.UsuarioAcesso.create(dataToSave);
      } else {
        await base44.entities.UsuarioAcesso.update(selectedUser.id, dataToSave);
      }
      queryClient.invalidateQueries({ queryKey: ['usuariosAcesso'] });
      setSelectedUser(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar permissão no Base44.');
    } finally {
      setSavingUser(false);
    }
  };

  const toggleMilitar = (id) => setMilitaresSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleTodosMilitares = () => {
    const ids = militaresFiltradosMassa.map(m => m.id);
    const todosSelecionados = ids.every(id => militaresSelecionados.includes(id));
    if (todosSelecionados) setMilitaresSelecionados(prev => prev.filter(id => !ids.includes(id)));
    else setMilitaresSelecionados(prev => [...new Set([...prev, ...ids])]);
  };

  const handleSaveMassa = async () => {
    if (!massaGrupamentoId || militaresSelecionados.length === 0) return;
    setSavingMassa(true);
    const grupamento = grupamentos.find(g => g.id === massaGrupamentoId);
    const sub = subgrupamentos.find(s => s.id === massaSubgrupamentoId);
    await Promise.all(militaresSelecionados.map(id =>
      base44.entities.Militar.update(id, sub
        ? { grupamento_id: grupamento?.id, grupamento_nome: grupamento?.nome, subgrupamento_id: sub.id, subgrupamento_nome: sub.nome }
        : { grupamento_id: grupamento?.id, grupamento_nome: grupamento?.nome, subgrupamento_id: '', subgrupamento_nome: '' }
      )
    ));
    queryClient.invalidateQueries({ queryKey: ['militares-ativos'] });
    setMilitaresSelecionados([]);
    setSavingMassa(false);
  };

  const createLotacaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setNovaLotacao(''); } });
  const createFuncaoMutation = useMutation({ mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setNovaFuncao(''); } });
  const deleteLotacaoMutation = useMutation({ mutationFn: (id) => base44.entities.Lotacao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lotacoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });
  const deleteFuncaoMutation = useMutation({ mutationFn: (id) => base44.entities.Funcao.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcoes'] }); setDeleteDialog({ open: false, type: null, id: null }); } });

  const handleDelete = () => {
    if (deleteDialog.type === 'lotacao') deleteLotacaoMutation.mutate(deleteDialog.id);
    else deleteFuncaoMutation.mutate(deleteDialog.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Configurações</h1>
            <p className="text-slate-500">Gerencie permissões, dados e personalizações do sistema</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-[#1e3a5f] text-[#1e3a5f]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Permissões e Usuários */}
        {activeTab === 'permissoes' && (isAdmin || canAccessAction('gerir_permissoes')) && (
          <div className="space-y-6">
            {/* Permissões de Usuários */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Permissões de Usuários</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">Gerencie os acessos na entidade base UsuarioAcesso. Defina o tipo de acesso: Admin, Setor, Subsetor ou Próprio.</p>
              
              <div className="mb-4">
                <Button onClick={handleCreateNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                  <Plus className="w-4 h-4 mr-2" /> Novo Acesso
                </Button>
              </div>

              {acessosError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mb-3">
                  Falha ao carregar acessos. Verifique a existência da entidade UsuarioAcesso.
                </p>
              )}
              <div className="space-y-2 mb-6">
                {acessos.map(u => (
                  <div key={u.id} onClick={() => handleSelectAcesso(u)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'border-[#1e3a5f] bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <div>
                      <p className="font-medium text-sm text-slate-800">{u.nome_usuario || u.user_email} {!u.ativo && <span className="text-red-500 text-xs ml-1">(Inativo)</span>}</p>
                      <p className="text-xs text-slate-500">{u.user_email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {u.tipo_acesso === 'admin' ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Admin (acesso total)</Badge>
                      ) : u.subgrupamento_nome ? (
                        <Badge className={(u.tipo_acesso === 'setor' || u.subgrupamento_tipo === 'Grupamento') ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>{u.subgrupamento_nome} ({u.subgrupamento_tipo || u.tipo_acesso})</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">Próprio / sem setor</Badge>
                      )}
                      {!u.subgrupamento_nome && u.tipo_acesso !== 'admin' && (u.militar_email || u.militar_id) && (
                        <Badge variant="outline" className="text-indigo-600 border-indigo-200">Vínculo: {u.militar_email || 'Militar selecionado'}</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {acessos.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum acesso cadastrado</p>}
              </div>
              {selectedUser && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-700">{isNewAcesso ? 'Criando Novo Acesso' : 'Editando Acesso:'} <span className="text-[#1e3a5f]">{!isNewAcesso && (selectedUser.nome_usuario || selectedUser.user_email)}</span></p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Nome de Usuário (Opcional)</label>
                      <Input value={userNomeUsuario} onChange={(e) => setUserNomeUsuario(e.target.value)} placeholder="Ex: João da Silva" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">E-mail do Usuário <span className="text-red-500">*</span></label>
                      <Input value={userUserEmail} onChange={(e) => setUserUserEmail(e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                     <input type="checkbox" id="userAtivo" checked={userAtivo} onChange={(e) => setUserAtivo(e.target.checked)} className="rounded border-slate-300 w-4 h-4 text-[#1e3a5f]" />
                     <label htmlFor="userAtivo" className="text-sm font-medium text-slate-700 cursor-pointer">Acesso Ativo</label>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Modo de acesso</label>
                    <Select
                      value={userAccessMode}
                      onValueChange={(v) => {
                        setUserAccessMode(v);
                        if (v === 'proprio' || v === 'admin') {
                          setUserGrupamentoId('');
                          setUserSubgrupamentoId('');
                        }
                        if (v !== 'proprio') {
                          setUserMilitarId('');
                          setUserMilitarEmail('');
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o modo de acesso" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="setor">Setor</SelectItem>
                        <SelectItem value="subsetor">Subsetor</SelectItem>
                        <SelectItem value="proprio">Próprio / sem setor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(userAccessMode === 'setor' || userAccessMode === 'subsetor') && (
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Setor</label>
                      <Select value={userGrupamentoId || '_nenhum'} onValueChange={(v) => { setUserGrupamentoId(v === '_nenhum' ? '' : v); setUserSubgrupamentoId(''); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione um setor..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_nenhum">— Selecione —</SelectItem>
                          {grupamentos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {userAccessMode === 'setor' && userGrupamentoId && !userSubgrupamentoId && <p className="text-xs text-blue-600 mt-1">✓ Acesso ao setor e subsetores subordinados</p>}
                    </div>
                  )}

                  {userAccessMode === 'subsetor' && userGrupamentoId && subgrupamentosFilhos.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Subsetor/Seção</label>
                      <Select value={userSubgrupamentoId || '_nenhum'} onValueChange={(v) => setUserSubgrupamentoId(v === '_nenhum' ? '' : v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione um subsetor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_nenhum">— Selecione —</SelectItem>
                          {subgrupamentosFilhos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {userSubgrupamentoId && <p className="text-xs text-amber-600 mt-1">✓ Acesso restrito ao subsetor selecionado</p>}
                    </div>
                  )}

                  {userAccessMode === 'proprio' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                        Este usuário ficará em modo <strong>Próprio / sem setor</strong>, com acesso apenas ao militar vinculado (por ID e e-mail).
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium text-slate-700 block mb-1.5">Militar vinculado</label>
                          <Select value={userMilitarId || '_nenhum'} onValueChange={(v) => {
                            const militarId = v === '_nenhum' ? '' : v;
                            setUserMilitarId(militarId);
                            const militar = militares.find((m) => m.id === militarId);
                            setUserMilitarEmail(militar?.email || militar?.email_particular || militar?.email_funcional || selectedUser?.email || '');
                          }}>
                            <SelectTrigger><SelectValue placeholder="Selecione o militar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_nenhum">— Selecione —</SelectItem>
                              {militaresOrdenados.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.posto_graduacao ? `${m.posto_graduacao} ` : ''}{m.nome_completo} {m.matricula ? `- Mat ${m.matricula}` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700 block mb-1.5">E-mail de vínculo (curto prazo)</label>
                          <Input value={userMilitarEmail || userUserEmail || ''} onChange={(e) => setUserMilitarEmail(e.target.value)} placeholder="email@militar" />
                          <p className="text-xs text-slate-500 mt-1">Usuário: {userUserEmail || 'sem e-mail'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-slate-200 mt-6 pt-4">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">Módulos Permitidos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'acesso_militares', label: 'Militares' },
                        { key: 'acesso_ferias', label: 'Férias' },
                        { key: 'acesso_livro', label: 'Livro' },
                        { key: 'acesso_publicacoes', label: 'Publicações' },
                        { key: 'acesso_atestados', label: 'Atestados' },
                        { key: 'acesso_armamentos', label: 'Armamentos' },
                        { key: 'acesso_medalhas', label: 'Medalhas' },
                        { key: 'acesso_templates', label: 'Templates' },
                        { key: 'acesso_configuracoes', label: 'Configurações' },
                        { key: 'acesso_quadro_operacional', label: 'Quadro Operacional' },
                        { key: 'acesso_processos', label: 'Processos' },
                      ].map(mod => (
                        <div key={mod.key} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <input 
                            type="checkbox" 
                            id={`mod_${mod.key}`}
                            checked={userPermissions[mod.key]}
                            onChange={(e) => setUserPermissions(prev => ({ ...prev, [mod.key]: e.target.checked }))}
                            className="rounded border-slate-300 w-4 h-4 text-[#1e3a5f]"
                          />
                          <label htmlFor={`mod_${mod.key}`} className="text-sm cursor-pointer select-none">{mod.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 mt-6 pt-4">
                    <h3 className="text-lg font-medium text-slate-800 mb-4">Ações Sensíveis</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'perm_admin_mode', label: 'Pode Ativar Modo Admin' },
                        { key: 'perm_gerir_cadeia_ferias', label: 'Gerir Cadeia de Férias' },
                        { key: 'perm_excluir_ferias', label: 'Excluir Férias' },
                        { key: 'perm_recalcular_ferias', label: 'Recalcular Férias' },
                        { key: 'perm_gerir_templates', label: 'Gerir Templates' },
                        { key: 'perm_gerir_permissoes', label: 'Gerir Permissões' },
                        { key: 'perm_gerir_estrutura', label: 'Gerir Estrutura Org.' },
                      ].map(act => (
                        <div key={act.key} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                          <input 
                            type="checkbox" 
                            id={`act_${act.key}`}
                            checked={userPermissions[act.key]}
                            onChange={(e) => setUserPermissions(prev => ({ ...prev, [act.key]: e.target.checked }))}
                            className="rounded border-slate-300 w-4 h-4 text-orange-600"
                          />
                          <label htmlFor={`act_${act.key}`} className="text-sm cursor-pointer select-none font-medium">{act.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 mt-6 border-t border-slate-200 pt-4">
                    <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                    <Button onClick={handleSaveUserScope} disabled={savingUser || (userAccessMode === 'setor' && !userGrupamentoId) || (userAccessMode === 'subsetor' && (!userGrupamentoId || !userSubgrupamentoId)) || (userAccessMode === 'proprio' && !userMilitarId)} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">{savingUser ? 'Salvando...' : 'Salvar Permissão'}</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Atribuição em massa */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Atribuir Setor/Subsetor a Militares</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">Selecione militares e atribua o setor/subsetor em massa de uma vez.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                   <label className="text-sm font-medium text-slate-700 block mb-1.5">Setor</label>
                   <Select value={massaGrupamentoId || '_nenhum'} onValueChange={(v) => { setMassaGrupamentoId(v === '_nenhum' ? '' : v); setMassaSubgrupamentoId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o grupamento..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_nenhum">— Selecione —</SelectItem>
                      {grupamentos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {massaGrupamentoId && massaSubgrupamentosFilhos.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Subsetor/Seção (opcional)</label>
                    <Select value={massaSubgrupamentoId || '_todos'} onValueChange={(v) => setMassaSubgrupamentoId(v === '_todos' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Apenas grupamento" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_todos">— Apenas grupamento —</SelectItem>
                        {massaSubgrupamentosFilhos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="mb-3 flex gap-2">
                <Input placeholder="Buscar militar..." value={searchMassa} onChange={e => setSearchMassa(e.target.value)} className="flex-1" />
                <Button variant="outline" onClick={toggleTodosMilitares} className="whitespace-nowrap">
                  {militaresFiltradosMassa.every(m => militaresSelecionados.includes(m.id)) ? <><CheckSquare className="w-4 h-4 mr-1" /> Desmarcar todos</> : <><Square className="w-4 h-4 mr-1" /> Selecionar todos</>}
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                {militaresFiltradosMassa.length === 0 ? <p className="text-center text-slate-400 py-6 text-sm">Nenhum militar encontrado</p> : militaresFiltradosMassa.map(m => (
                  <div key={m.id} onClick={() => toggleMilitar(m.id)} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 transition-colors ${militaresSelecionados.includes(m.id) ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50'}`}>
                    {militaresSelecionados.includes(m.id) ? <CheckSquare className="w-4 h-4 text-[#1e3a5f] shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800">{m.posto_graduacao} {m.nome_completo}</span>
                      <span className="text-xs text-slate-400 ml-2">Mat. {m.matricula}</span>
                    </div>
                    {m.subgrupamento_nome && <Badge variant="outline" className="text-xs shrink-0">{m.subgrupamento_nome}</Badge>}
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-slate-500">{militaresSelecionados.length} militar(es) selecionado(s)</span>
                <Button onClick={handleSaveMassa} disabled={savingMassa || !massaGrupamentoId || militaresSelecionados.length === 0} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  {savingMassa ? 'Salvando...' : `Atribuir a ${militaresSelecionados.length} militar(es)`}
                </Button>
              </div>
            </div>
          </div>
        )}


        {/* Tab: Adições e Personalizações */}
        {activeTab === 'adicoes' && (isAdmin || canAccessAction('gerir_estrutura')) && (
          <div className="space-y-6">
            {/* Lotações */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Lotações</h2>
              <div className="flex gap-2 mb-6">
                <Input value={novaLotacao} onChange={(e) => setNovaLotacao(e.target.value)} placeholder="Nova lotação..." onKeyDown={(e) => e.key === 'Enter' && novaLotacao.trim() && createLotacaoMutation.mutate(novaLotacao.trim())} />
                <Button onClick={() => novaLotacao.trim() && createLotacaoMutation.mutate(novaLotacao.trim())} disabled={!novaLotacao.trim()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {lotacoes.map((lot) => (
                  <div key={lot.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="font-medium">{lot.nome}</span>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, type: 'lotacao', id: lot.id })} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {lotacoes.length === 0 && <p className="text-center text-slate-500 py-8">Nenhuma lotação cadastrada</p>}
              </div>
            </div>

            {/* Funções */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Funções</h2>
              <div className="flex gap-2 mb-6">
                <Input value={novaFuncao} onChange={(e) => setNovaFuncao(e.target.value)} placeholder="Nova função..." onKeyDown={(e) => e.key === 'Enter' && novaFuncao.trim() && createFuncaoMutation.mutate(novaFuncao.trim())} />
                <Button onClick={() => novaFuncao.trim() && createFuncaoMutation.mutate(novaFuncao.trim())} disabled={!novaFuncao.trim()} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {funcoes.map((func) => (
                  <div key={func.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <span className="font-medium">{func.nome}</span>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, type: 'funcao', id: func.id })} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {funcoes.length === 0 && <p className="text-center text-slate-500 py-8">Nenhuma função cadastrada</p>}
              </div>
            </div>

            {/* Tipos de Publicação Personalizados */}
            <TiposPublicacaoManager />
          </div>
        )}

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta {deleteDialog.type === 'lotacao' ? 'lotação' : 'função'}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
