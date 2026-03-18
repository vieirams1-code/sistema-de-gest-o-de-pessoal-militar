import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Shield, UserPlus, Building2, UserCircle, Save, Settings2, Info, BadgeAlert, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { permissionStructure, modulosList, acoesSensiveis } from '@/config/permissionStructure';

const initialPermissions = {
  ...modulosList.reduce((acc, m) => ({ ...acc, [m.key]: false }), {}),
  ...acoesSensiveis.reduce((acc, a) => ({ ...acc, [a.key]: false }), {})
};

const toBooleanPermission = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }

  return value === true || value === 1;
};

const buildPermissionsFromSource = (source = {}) => {
  const normalizedPermissions = {};

  Object.keys(initialPermissions).forEach((key) => {
    normalizedPermissions[key] = toBooleanPermission(source[key]);
  });

  return normalizedPermissions;
};

export default function PermissoesUsuarios() {
  const queryClient = useQueryClient();
  const { canAccessAction, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAccess = !loadingUser && isAccessResolved && canAccessAction('gerir_permissoes');

  const [selectedUser, setSelectedUser] = useState(null);
  const [isNewAcesso, setIsNewAcesso] = useState(false);
  const [userNomeUsuario, setUserNomeUsuario] = useState('');
  const [userUserEmail, setUserUserEmail] = useState('');
  const [userAtivo, setUserAtivo] = useState(true);
  const [userAccessMode, setUserAccessMode] = useState('proprio');
  const [userGrupamentoId, setUserGrupamentoId] = useState('');
  const [userSubgrupamentoId, setUserSubgrupamentoId] = useState('');
  const [userUnidadeId, setUserUnidadeId] = useState('');
  const [userMilitarId, setUserMilitarId] = useState('');
  const [userMilitarEmail, setUserMilitarEmail] = useState('');
  const [userPermissions, setUserPermissions] = useState(initialPermissions);

  const [selectedProfileId, setSelectedProfileId] = useState('_nenhum');
  const [savingUser, setSavingUser] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(permissionStructure[0]?.category || '');
  const [activePanel, setActivePanel] = useState('dados');


  // Queries — só executam após resolução do acesso e confirmação de permissão
  const { data: militares = [] } = useQuery({ queryKey: ['militares-ativos'], queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }), enabled: hasAccess });
  const { data: subgrupamentos = [] } = useQuery({ queryKey: ['subgrupamentos'], queryFn: () => base44.entities.Subgrupamento.filter({ ativo: true }, 'nome'), enabled: hasAccess });
  const { data: acessos = [], error: acessosError } = useQuery({
    queryKey: ['usuariosAcesso'],
    queryFn: () => base44.entities.UsuarioAcesso.list(),
    enabled: hasAccess,
  });
  const { data: perfis = [] } = useQuery({
    queryKey: ['perfisPermissao'],
    queryFn: () => base44.entities.PerfilPermissao.list('nome_perfil'),
    enabled: hasAccess,
  });

  const selectedProfilePreview = useMemo(() => {
    if (selectedProfileId === '_nenhum') return null;
    return perfis.find((p) => p.id === selectedProfileId) || null;
  }, [selectedProfileId, perfis]);

  const grupamentos = useMemo(() => subgrupamentos.filter(s => s.tipo === 'Grupamento'), [subgrupamentos]);
  const subgrupamentosFilhos = useMemo(() => subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === userGrupamentoId), [subgrupamentos, userGrupamentoId]);
  const unidadesFilhas = useMemo(() => subgrupamentos.filter(s => s.tipo === 'Unidade' && s.grupamento_id === userSubgrupamentoId), [subgrupamentos, userSubgrupamentoId]);

  const militaresOrdenados = useMemo(() => {
    return [...militares].sort((a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''));
  }, [militares]);

  const filteredAcessos = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return acessos;

    return acessos.filter((u) => {
      const nome = (u.nome_usuario || '').toLowerCase();
      const email = (u.user_email || '').toLowerCase();
      const perfil = (u.perfil_nome || '').toLowerCase();
      const tipo = (u.tipo_acesso || '').toLowerCase();
      return nome.includes(query) || email.includes(query) || perfil.includes(query) || tipo.includes(query);
    });
  }, [acessos, userSearch]);

  const activeCategoryGroup = useMemo(() => {
    return permissionStructure.find((item) => item.category === selectedCategory) || permissionStructure[0];
  }, [selectedCategory]);

  if (loadingUser || !isAccessResolved) return null;
  if (!canAccessAction('gerir_permissoes')) {
    return <AccessDenied modulo="Permissões de Usuários" />;
  }

  const handleSelectAcesso = async (acesso) => {
    let fullAcesso = acesso;
    try {
      // O list() pode não retornar todos os campos booleanos de permissão;
      // ao selecionar, buscamos o registro completo para hidratar corretamente.
      fullAcesso = await base44.entities.UsuarioAcesso.get(acesso.id);
    } catch {
      // Em caso de falha, seguimos com os dados já retornados no list().
    }

    setSelectedUser(fullAcesso);
    setIsNewAcesso(false);
    setUserAccessMode(fullAcesso.tipo_acesso || 'proprio');
    setUserNomeUsuario(fullAcesso.nome_usuario || '');
    setUserUserEmail(fullAcesso.user_email || '');
    setUserAtivo(fullAcesso.ativo !== false);
    setUserMilitarId(fullAcesso.militar_id || '');
    setUserMilitarEmail(fullAcesso.militar_email || '');

    let gId = fullAcesso.grupamento_id || '';
    let sId = fullAcesso.subgrupamento_id || '';
    let uId = '';

    if (fullAcesso.tipo_acesso === 'unidade') {
      uId = fullAcesso.subgrupamento_id || '';
      const uni = subgrupamentos.find(x => x.id === uId);
      if (uni) {
        sId = uni.grupamento_id || '';
      }
    } else if (fullAcesso.tipo_acesso === 'subsetor') {
      sId = fullAcesso.subgrupamento_id || '';
    }

    setUserGrupamentoId(gId);
    setUserSubgrupamentoId(sId);
    setUserUnidadeId(uId);
    setSelectedProfileId(fullAcesso.perfil_id || '_nenhum');
    setActivePanel('dados');

    setUserPermissions(buildPermissionsFromSource(fullAcesso));
  };

  const handleCreateNew = () => {
    setSelectedUser({});
    setIsNewAcesso(true);
    setUserAccessMode('proprio');
    setUserNomeUsuario('');
    setUserUserEmail('');
    setUserAtivo(true);
    setUserMilitarId('');
    setUserMilitarEmail('');
    setUserGrupamentoId('');
    setUserSubgrupamentoId('');
    setUserUnidadeId('');
    setSelectedProfileId('_nenhum');
    setActivePanel('dados');
    setUserPermissions(initialPermissions);
  };

  const aplicarPerfil = () => {
    if (!selectedProfilePreview) return;

    const newPerms = { ...userPermissions };
    modulosList.forEach((m) => {
      newPerms[m.key] = toBooleanPermission(selectedProfilePreview[m.key]);
    });
    acoesSensiveis.forEach((a) => {
      newPerms[a.key] = toBooleanPermission(selectedProfilePreview[a.key]);
    });

    setUserPermissions(newPerms);
  };

  const handleSaveUserScope = async () => {
    if (!selectedUser) return;
    // Revalidação explícita no handler — não depende só da UI
    if (!canAccessAction('gerir_permissoes')) {
      alert('Ação negada: você não tem permissão para gerenciar permissões de usuários.');
      return;
    }
    if (!userUserEmail) { alert('E-mail do Usuário é obrigatório.'); return; }

    setSavingUser(true);
    try {
      const permissionKeys = Object.keys(initialPermissions);
      const grupamento = grupamentos.find(g => g.id === userGrupamentoId);
      const sub = subgrupamentos.find(s => s.id === userSubgrupamentoId);
      const uni = subgrupamentos.find(s => s.id === userUnidadeId);
      const perfilSelected = selectedProfilePreview;

      const militarVinculado = militares.find((m) => m.id === userMilitarId);
      const militarEmailVinculado = militarVinculado?.email || militarVinculado?.email_particular || militarVinculado?.email_funcional || userMilitarEmail || userUserEmail || '';

      const normalizedPermissions = buildPermissionsFromSource(userPermissions);

      const baseData = {
        nome_usuario: userNomeUsuario,
        user_email: userUserEmail.trim(),
        ativo: userAtivo,
        perfil_id: perfilSelected ? perfilSelected.id : '',
        perfil_nome: perfilSelected ? perfilSelected.nome_perfil : '',
        ...normalizedPermissions
      };

      let roleData = {};
      if (userAccessMode === 'admin') {
        roleData = { tipo_acesso: 'admin', grupamento_id: '', grupamento_nome: '', subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null, militar_id: '', militar_email: '' };
      } else if (userAccessMode === 'subsetor' && sub) {
        roleData = { tipo_acesso: 'subsetor', grupamento_id: grupamento?.id || '', grupamento_nome: grupamento?.nome || '', subgrupamento_id: sub.id, subgrupamento_nome: sub.nome, subgrupamento_tipo: 'Subgrupamento', militar_id: '', militar_email: '' };
      } else if (userAccessMode === 'setor' && grupamento) {
        roleData = { tipo_acesso: 'setor', grupamento_id: grupamento.id, grupamento_nome: grupamento.nome, subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: 'Grupamento', militar_id: '', militar_email: '' };
      } else if (userAccessMode === 'unidade' && uni) {
        roleData = { tipo_acesso: 'unidade', grupamento_id: grupamento?.id || '', grupamento_nome: grupamento?.nome || '', subgrupamento_id: uni.id, subgrupamento_nome: uni.nome, subgrupamento_tipo: 'Unidade', militar_id: '', militar_email: '' };
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
    } catch {
      alert('Erro ao salvar permissão no Base44.');
    } finally {
      setSavingUser(false);
    }
  };

  const getTipoBadge = (u) => {
    if (u.tipo_acesso === 'admin') return <Badge className="bg-emerald-100 text-emerald-800">Admin</Badge>;
    if (u.tipo_acesso === 'unidade') return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{u.subgrupamento_nome}</Badge>;
    if (u.subgrupamento_nome) return <Badge className={(u.tipo_acesso === 'setor' || u.subgrupamento_tipo === 'Grupamento') ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>{u.subgrupamento_nome}</Badge>;
    return <Badge variant="outline" className="text-slate-500">Próprio</Badge>;
  };

  const isSaveDisabled = savingUser
    || (userAccessMode === 'setor' && !userGrupamentoId)
    || (userAccessMode === 'subsetor' && (!userGrupamentoId || !userSubgrupamentoId))
    || (userAccessMode === 'unidade' && (!userGrupamentoId || !userSubgrupamentoId || !userUnidadeId))
    || (userAccessMode === 'proprio' && !userMilitarId);

  const topPanels = [
    { key: 'dados', label: 'Dados do Usuário' },
    { key: 'escopo', label: 'Escopo Organizacional' },
    { key: 'perfil', label: 'Perfil Base' },
    { key: 'matriz', label: 'Matriz de Permissões' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Permissões de Usuários</h1>
              <p className="text-sm text-slate-500">Gerencie contas, acessos organizacionais e permissões</p>
            </div>
          </div>
          <Button onClick={handleCreateNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
            <UserPlus className="w-4 h-4 mr-2" /> Novo Usuário
          </Button>
        </div>

        {acessosError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex gap-3">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-sm">Falha ao carregar acessos. Verifique a existência da entidade UsuarioAcesso no Base44.</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Coluna da Esquerda: Lista de Usuários */}
          <div className="xl:col-span-4 2xl:col-span-3 flex flex-col h-[calc(100vh-10rem)]">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
                <h2 className="font-semibold text-slate-900">Usuários</h2>
                <p className="text-xs text-slate-500 mb-3">{acessos.length} registros</p>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou perfil"
                    className="pl-9 h-9 rounded-lg border-slate-200"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                {filteredAcessos.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-sm">Nenhum acesso cadastrado</p>
                ) : (
                  filteredAcessos.map((u) => (
                    <div 
                      key={u.id} 
                      onClick={() => handleSelectAcesso(u)} 
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedUser?.id === u.id ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md ring-2 ring-[#1e3a5f]/35' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}
                    >
                      <div className="flex justify-between items-start mb-1.5 gap-2">
                        <div className={`font-semibold text-sm truncate ${selectedUser?.id === u.id ? 'text-white' : 'text-slate-800'}`} title={u.nome_usuario || u.user_email}>
                          {u.nome_usuario || u.user_email}
                          {!u.ativo && <span className={`ml-1.5 text-xs font-semibold ${selectedUser?.id === u.id ? 'text-rose-100' : 'text-red-500'}`}>(Inativo)</span>}
                        </div>
                        <div className="shrink-0 [&_.bg-emerald-100]:bg-white/20 [&_.text-emerald-800]:text-white [&_.bg-emerald-50]:bg-white/20 [&_.text-emerald-700]:text-white [&_.border-emerald-200]:border-white/30 [&_.bg-blue-100]:bg-white/20 [&_.text-blue-800]:text-white [&_.bg-amber-100]:bg-white/20 [&_.text-amber-800]:text-white [&_.text-slate-500]:text-white">
                          {getTipoBadge(u)}
                        </div>
                      </div>
                      <div className={`text-xs mb-2 truncate ${selectedUser?.id === u.id ? 'text-slate-100' : 'text-slate-500'}`} title={u.user_email}>{u.user_email}</div>
                      
                      {u.perfil_nome && (
                        <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full inline-block truncate max-w-full ${selectedUser?.id === u.id ? 'bg-white/20 text-white border border-white/30' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>
                          Perfil: {u.perfil_nome}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Edição / Detalhes do Usuário */}
          <div className="xl:col-span-8 2xl:col-span-9">
            {selectedUser ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
                <div className="p-4 lg:p-5 border-b border-slate-200 bg-white sticky top-0 z-20 shrink-0">
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
                    <div>
                      <h2 className="font-bold text-[#1e3a5f] text-lg lg:text-xl">Editando: {userNomeUsuario || userUserEmail || 'Novo Usuário'}</h2>
                      <p className="text-sm text-slate-500">Ajuste o escopo organizacional, perfil base e permissões por categoria.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)} className="rounded-lg">Cancelar</Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveUserScope} 
                      disabled={isSaveDisabled}
                      className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white rounded-lg"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingUser ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 bg-slate-50/50">
                  <div className="bg-white border border-slate-200 rounded-xl p-2">
                    <div className="flex flex-wrap gap-2">
                      {topPanels.map((panel) => {
                        const isActive = activePanel === panel.key;
                        return (
                          <button
                            key={panel.key}
                            type="button"
                            onClick={() => setActivePanel(panel.key)}
                            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                          >
                            {panel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activePanel === 'dados' && (
                  <>
                  {/* Bloco 1: Dados do Usuário */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <UserCircle className="w-5 h-5 text-slate-400" />
                      Dados do Usuário
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Nome de Usuário</label>
                        <Input value={userNomeUsuario} onChange={(e) => setUserNomeUsuario(e.target.value)} placeholder="Ex: João da Silva" className="bg-white" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">E-mail do Usuário <span className="text-red-500">*</span></label>
                        <Input value={userUserEmail} onChange={(e) => setUserUserEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-white" />
                      </div>
                      <div className="col-span-1 md:col-span-2 flex items-center gap-2 pt-1 border-t border-slate-200">
                        <input type="checkbox" id="userAtivo" checked={userAtivo} onChange={(e) => setUserAtivo(e.target.checked)} className="rounded border-slate-300 w-5 h-5 text-[#1e3a5f]" />
                        <label htmlFor="userAtivo" className="text-sm font-semibold text-slate-700 cursor-pointer">Usuário Ativo e Habilitado para Login</label>
                      </div>
                    </div>
                  </div>
                  </>
                  )}

                  {activePanel === 'escopo' && (
                  <>
                  {/* Bloco 2: Alcance Organizacional */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      Escopo Organizacional
                    </h3>
                    
                    <div className="mb-5">
                      <label className="text-sm font-semibold text-slate-700 block mb-1.5">Escopo de Acesso</label>
                      <Select
                        value={userAccessMode}
                        onValueChange={(v) => {
                          setUserAccessMode(v);
                          if (v === 'proprio' || v === 'admin') {
                            setUserGrupamentoId('');
                            setUserSubgrupamentoId('');
                            setUserUnidadeId('');
                          }
                          if (v !== 'proprio') {
                            setUserMilitarId('');
                            setUserMilitarEmail('');
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white md:max-w-xs"><SelectValue placeholder="Selecione o escopo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proprio">Proprio / Sem Setor Visto (Padrão)</SelectItem>
                          <SelectItem value="unidade">Unidade / Nível 3</SelectItem>
                          <SelectItem value="subsetor">Subsetor / Seção</SelectItem>
                          <SelectItem value="setor">Setor / Grupamento Todo</SelectItem>
                          <SelectItem value="admin">Administrador Global</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(userAccessMode === 'setor' || userAccessMode === 'subsetor' || userAccessMode === 'unidade') && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5 p-4 bg-white border border-blue-100 rounded-lg">
                        <div>
                          <label className="text-sm font-semibold text-slate-700 block mb-1.5">Setor (Obrigatório)</label>
                          <Select value={userGrupamentoId || '_nenhum'} onValueChange={(v) => { setUserGrupamentoId(v === '_nenhum' ? '' : v); setUserSubgrupamentoId(''); setUserUnidadeId(''); }}>
                            <SelectTrigger><SelectValue placeholder="Selecione um setor..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_nenhum">— Selecione —</SelectItem>
                              {grupamentos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {userAccessMode === 'setor' && userGrupamentoId && !userSubgrupamentoId && <p className="text-xs font-medium text-blue-600 mt-2">✓ Terá visão de dados deste setor inteiro.</p>}
                        </div>

                        {(userAccessMode === 'subsetor' || userAccessMode === 'unidade') && (
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Subsetor/Seção (Obrigatório)</label>
                            <Select 
                              value={userSubgrupamentoId || '_nenhum'} 
                              onValueChange={(v) => { setUserSubgrupamentoId(v === '_nenhum' ? '' : v); setUserUnidadeId(''); }}
                              disabled={!userGrupamentoId || subgrupamentosFilhos.length === 0}
                            >
                              <SelectTrigger><SelectValue placeholder={!userGrupamentoId ? "Selecione o setor primeiro" : (subgrupamentosFilhos.length === 0 ? "Sem subsetores" : "Selecione o subsetor") } /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_nenhum">— Selecione —</SelectItem>
                                {subgrupamentosFilhos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {userAccessMode === 'subsetor' && userSubgrupamentoId && <p className="text-xs font-medium text-blue-600 mt-2">✓ Terá visão de dados apenas deste subsetor e suas unidades.</p>}
                          </div>
                        )}

                        {userAccessMode === 'unidade' && (
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Unidade (Obrigatório)</label>
                            <Select 
                              value={userUnidadeId || '_nenhum'} 
                              onValueChange={(v) => setUserUnidadeId(v === '_nenhum' ? '' : v)}
                              disabled={!userSubgrupamentoId || unidadesFilhas.length === 0}
                            >
                              <SelectTrigger><SelectValue placeholder={!userSubgrupamentoId ? "Selecione o subsetor" : (unidadesFilhas.length === 0 ? "Sem unidades filhas" : "Selecione a unidade") } /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_nenhum">— Selecione —</SelectItem>
                                {unidadesFilhas.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}{u.sigla ? ` (${u.sigla})` : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {userUnidadeId && <p className="text-xs font-medium text-blue-600 mt-2">✓ Terá visão estrita e limitada a esta unidade.</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bloco 3: Vínculo com Militar */}
                  {userAccessMode === 'proprio' && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Users className="w-5 h-5 text-indigo-500" />
                          Vínculo do Próprio Militar
                        </h3>
                        <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs">Modo Próprio</Badge>
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-4">
                        Neste modo, o usuário não gerencia setores. Ele acessa apenas os próprios dados (avaliações, assentamentos pessoais, atestados, etc). Para isso, <b>é obrigatório vinculá-lo a um militar cadastrado</b>.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white p-4 rounded-lg border border-indigo-50">
                        <div>
                          <label className="text-sm font-semibold text-slate-700 block mb-1.5">Militar Vinculado <span className="text-red-500">*</span></label>
                          <Select value={userMilitarId || '_nenhum'} onValueChange={(v) => {
                            const militarId = v === '_nenhum' ? '' : v;
                            setUserMilitarId(militarId);
                            const militar = militares.find((m) => m.id === militarId);
                            setUserMilitarEmail(militar?.email || militar?.email_particular || militar?.email_funcional || selectedUser?.email || '');
                          }}>
                            <SelectTrigger className="border-indigo-200"><SelectValue placeholder="Selecione o militar" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_nenhum">— Selecione —</SelectItem>
                              {militaresOrdenados.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.posto_graduacao ? `${m.posto_graduacao} ` : ''}{m.nome_completo} {m.matricula ? `- Mat ${m.matricula}` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-700 block mb-1.5">E-mail Secundário do Vínculo</label>
                          <Input value={userMilitarEmail || userUserEmail || ''} onChange={(e) => setUserMilitarEmail(e.target.value)} placeholder="email@militar" className="border-indigo-200 bg-slate-50" />
                          <p className="text-xs text-slate-500 mt-1.5 font-medium">E-mail principal do acesso: {userUserEmail || 'sem e-mail preenchido'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  </>
                  )}

                  {activePanel === 'perfil' && (
                  <>
                  {/* Bloco 4: Perfil de Permissões */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-500" />
                      Perfil Base
                    </h3>
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-lg border border-slate-200">
                      <div className="flex-1 w-full">
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Carregar permissões de um Perfil existente</label>
                        <Select value={selectedProfileId} onValueChange={(v) => setSelectedProfileId(v)}>
                          <SelectTrigger><SelectValue placeholder="Escolha um perfil para aplicar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_nenhum">— Personalizado / Não aplicar perfil —</SelectItem>
                            {perfis.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nome_perfil}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="secondary" 
                        onClick={aplicarPerfil}
                        disabled={selectedProfileId === '_nenhum'}
                        className="w-full sm:w-auto shrink-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Settings2 className="w-4 h-4 mr-2" /> Aplicar Perfil
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                      <Info className="w-4 h-4" /> Selecionar um perfil apenas exibe a prévia abaixo. As permissões do formulário só mudam ao clicar em <b>Aplicar Perfil</b>.
                    </p>

                    {selectedProfilePreview && (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                        <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                          <BadgeAlert className="w-4 h-4" />
                          Prévia do Perfil: {selectedProfilePreview.nome_perfil}
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white border border-emerald-100 rounded-lg p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Módulos do perfil</p>
                            <div className="space-y-2">
                              {modulosList.map((mod) => (
                                <label key={`preview_mod_${mod.key}`} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={selectedProfilePreview[mod.key] === true}
                                    readOnly
                                    className="rounded border-slate-300 w-4 h-4 text-blue-600 pointer-events-none"
                                  />
                                  <span>{mod.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white border border-orange-100 rounded-lg p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">Ações sensíveis do perfil</p>
                            <div className="space-y-2">
                              {acoesSensiveis.map((act) => (
                                <label key={`preview_act_${act.key}`} className="flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={selectedProfilePreview[act.key] === true}
                                    readOnly
                                    className="rounded border-orange-300 w-4 h-4 text-orange-600 pointer-events-none"
                                  />
                                  <span>{act.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  </>
                  )}

                  {activePanel === 'matriz' && (
                  <>
                  {/* Bloco 5: Matriz de Permissões */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 mb-2">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Matriz de Permissões por Categoria e Módulo
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <aside className="lg:col-span-4 xl:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-2 h-fit lg:sticky lg:top-24">
                        {permissionStructure.map((categoryGroup) => {
                          const isActive = activeCategoryGroup?.category === categoryGroup.category;
                          return (
                            <button
                              type="button"
                              key={categoryGroup.category}
                              onClick={() => setSelectedCategory(categoryGroup.category)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition mb-1 ${isActive ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'}`}
                            >
                              <div className="font-semibold">{categoryGroup.category}</div>
                              <div className={`text-[11px] ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{categoryGroup.modules.length} módulos</div>
                            </button>
                          );
                        })}
                      </aside>

                      <div className="lg:col-span-8 xl:col-span-9 space-y-3">
                        <div className="px-1">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Categoria selecionada</h4>
                          <p className="text-base font-semibold text-slate-900">{activeCategoryGroup?.category}</p>
                        </div>
                        {activeCategoryGroup?.modules.map((mod) => {
                              const isModuleEnabled = userPermissions[mod.key] === true;
                              const moduleOverride = selectedProfilePreview && (selectedProfilePreview[mod.key] === true) !== isModuleEnabled;
                              return (
                                <div key={mod.key} className={`rounded-xl border ${isModuleEnabled ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}>
                                  <div
                                    className="p-3.5 flex flex-wrap items-center gap-3 justify-between cursor-pointer"
                                    onClick={() => setUserPermissions((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isModuleEnabled ? 'bg-[#1e3a5f]' : 'bg-slate-300'}`}>
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${isModuleEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                                      </span>
                                      <label className="text-sm font-semibold text-slate-800 pointer-events-none">{mod.label}</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {moduleOverride && (
                                        <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded uppercase tracking-wide">Modificado</span>
                                      )}
                                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isModuleEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {isModuleEnabled ? 'Ativo' : 'Inativo'}
                                      </span>
                                    </div>
                                  </div>

                                  {mod.actions.length > 0 && isModuleEnabled && (
                                    <div className="px-3.5 pb-3.5">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-blue-100 pt-3">
                                        {mod.actions.map((act) => {
                                          const isActionEnabled = userPermissions[act.key] === true;
                                          const actionOverride = selectedProfilePreview && (selectedProfilePreview[act.key] === true) !== isActionEnabled;
                                          return (
                                            <div
                                              key={act.key}
                                              className={`flex items-center justify-between gap-3 p-2 rounded-md border cursor-pointer ${isActionEnabled ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'} ${act.sensitive ? 'ring-1 ring-orange-100' : ''}`}
                                              onClick={() => setUserPermissions((prev) => ({ ...prev, [act.key]: !prev[act.key] }))}
                                            >
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={isActionEnabled}
                                                  readOnly
                                                  className="rounded border-orange-300 w-4 h-4 text-orange-600 pointer-events-none"
                                                />
                                                <span className="text-sm text-slate-700">{act.label}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                {act.sensitive && <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">Sensível</span>}
                                                {actionOverride && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">Mod.</span>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                      </div>
                    </div>
                  </div>
                  </>
                  )}

                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center p-12 h-[calc(100vh-12rem)]">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                  <UserPlus className="w-8 h-8 ml-1" />
                </div>
                <h2 className="text-lg font-bold text-slate-700 mb-2">Nenhum usuário selecionado</h2>
                <p className="text-slate-500 text-center max-w-sm mb-6">
                  Selecione um usuário na lista à esquerda para gerenciar seus acessos, ou crie um novo.
                </p>
                <Button onClick={handleCreateNew} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar Novo Usuário
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
