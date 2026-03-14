import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Shield, Check, UserPlus, Building2, UserCircle, Save, Settings2, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const modulosList = [
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
];

const acoesSensiveis = [
  { key: 'perm_admin_mode', label: 'Pode Ativar Modo Admin' },
  { key: 'perm_gerir_cadeia_ferias', label: 'Gerir Cadeia de Férias' },
  { key: 'perm_excluir_ferias', label: 'Excluir Férias' },
  { key: 'perm_recalcular_ferias', label: 'Recalcular Férias' },
  { key: 'perm_gerir_templates', label: 'Gerir Templates' },
  { key: 'perm_gerir_permissoes', label: 'Gerir Permissões' },
  { key: 'perm_gerir_estrutura', label: 'Gerir Estrutura Org.' },
];

const initialPermissions = {
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
};

export default function PermissoesUsuarios() {
  const queryClient = useQueryClient();
  const { isAdmin, canAccessAction, isLoading: loadingUser } = useCurrentUser();

  const [selectedUser, setSelectedUser] = useState(null);
  const [isNewAcesso, setIsNewAcesso] = useState(false);
  const [userNomeUsuario, setUserNomeUsuario] = useState('');
  const [userUserEmail, setUserUserEmail] = useState('');
  const [userAtivo, setUserAtivo] = useState(true);
  const [userAccessMode, setUserAccessMode] = useState('proprio');
  const [userGrupamentoId, setUserGrupamentoId] = useState('');
  const [userSubgrupamentoId, setUserSubgrupamentoId] = useState('');
  const [userMilitarId, setUserMilitarId] = useState('');
  const [userMilitarEmail, setUserMilitarEmail] = useState('');
  const [userPermissions, setUserPermissions] = useState(initialPermissions);

  const [selectedProfileId, setSelectedProfileId] = useState('_nenhum');
  const [savingUser, setSavingUser] = useState(false);

  // Queries
  const { data: militares = [] } = useQuery({ queryKey: ['militares-ativos'], queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }) });
  const { data: subgrupamentos = [] } = useQuery({ queryKey: ['subgrupamentos'], queryFn: () => base44.entities.Subgrupamento.filter({ ativo: true }, 'nome') });
  const { data: acessos = [], error: acessosError } = useQuery({
    queryKey: ['usuariosAcesso'],
    queryFn: () => base44.entities.UsuarioAcesso.list(),
  });
  const { data: perfis = [] } = useQuery({
    queryKey: ['perfisPermissao'],
    queryFn: () => base44.entities.PerfilPermissao.list('nome_perfil'),
  });

  if (!loadingUser && (!isAdmin && !canAccessAction('gerir_permissoes'))) {
    return <AccessDenied modulo="Permissões de Usuários" />;
  }

  const grupamentos = subgrupamentos.filter(s => s.tipo === 'Grupamento');
  const subgrupamentosFilhos = subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === userGrupamentoId);

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
    setUserMilitarId(acesso.militar_id || '');
    setUserMilitarEmail(acesso.militar_email || '');
    setUserGrupamentoId(acesso.grupamento_id || '');
    setUserSubgrupamentoId(acesso.subgrupamento_id || '');
    setSelectedProfileId(acesso.perfil_id || '_nenhum');

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
    setUserMilitarId('');
    setUserMilitarEmail('');
    setUserGrupamentoId('');
    setUserSubgrupamentoId('');
    setSelectedProfileId('_nenhum');
    setUserPermissions(initialPermissions);
  };

  const aplicarPerfil = () => {
    if (selectedProfileId === '_nenhum') return;
    const perfil = perfis.find(p => p.id === selectedProfileId);
    if (!perfil) return;

    const newPerms = { ...userPermissions };
    modulosList.forEach(m => newPerms[m.key] = perfil[m.key] === true);
    acoesSensiveis.forEach(a => newPerms[a.key] = perfil[a.key] === true);
    
    setUserPermissions(newPerms);
  };

  const handleSaveUserScope = async () => {
    if (!selectedUser) return;
    if (!userUserEmail) { alert('E-mail do Usuário é obrigatório.'); return; }

    setSavingUser(true);
    try {
      const grupamento = grupamentos.find(g => g.id === userGrupamentoId);
      const sub = subgrupamentos.find(s => s.id === userSubgrupamentoId);
      const perfilSelected = perfis.find(p => p.id === selectedProfileId);

      const militarVinculado = militares.find((m) => m.id === userMilitarId);
      const militarEmailVinculado = militarVinculado?.email || militarVinculado?.email_particular || militarVinculado?.email_funcional || userMilitarEmail || userUserEmail || '';

      const baseData = {
        nome_usuario: userNomeUsuario,
        user_email: userUserEmail.trim(),
        ativo: userAtivo,
        perfil_id: perfilSelected ? perfilSelected.id : '',
        perfil_nome: perfilSelected ? perfilSelected.nome_perfil : '',
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

  const getTipoBadge = (u) => {
    if (u.tipo_acesso === 'admin') return <Badge className="bg-emerald-100 text-emerald-800">Admin</Badge>;
    if (u.subgrupamento_nome) return <Badge className={(u.tipo_acesso === 'setor' || u.subgrupamento_tipo === 'Grupamento') ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>{u.subgrupamento_nome}</Badge>;
    return <Badge variant="outline" className="text-slate-500">Próprio</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna da Esquerda: Lista de Usuários */}
          <div className="lg:col-span-4 flex flex-col h-[calc(100vh-12rem)]">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-semibold text-slate-800">Usuários Cadastrados</h2>
                <p className="text-xs text-slate-500">{acessos.length} registros</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {acessos.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-sm">Nenhum acesso cadastrado</p>
                ) : (
                  acessos.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleSelectAcesso(u)} 
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedUser?.id === u.id ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-sm ring-1 ring-[#1e3a5f]/20' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-sm text-slate-800 truncate" title={u.nome_usuario || u.user_email}>
                          {u.nome_usuario || u.user_email}
                          {!u.ativo && <span className="text-red-500 ml-1.5 text-xs font-semibold">(Inativo)</span>}
                        </div>
                        {getTipoBadge(u)}
                      </div>
                      <div className="text-xs text-slate-500 mb-2 truncate" title={u.user_email}>{u.user_email}</div>
                      
                      {u.perfil_nome && (
                        <div className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block truncate max-w-full">
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
          <div className="lg:col-span-8">
            {selectedUser ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                  <h2 className="font-bold text-[#1e3a5f] text-lg">
                    {isNewAcesso ? 'Criando Novo Usuário' : 'Editar Usuário'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveUserScope} 
                      disabled={savingUser || (userAccessMode === 'setor' && !userGrupamentoId) || (userAccessMode === 'subsetor' && (!userGrupamentoId || !userSubgrupamentoId)) || (userAccessMode === 'proprio' && !userMilitarId)} 
                      className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingUser ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  {/* Bloco 1: Dados do Usuário */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <UserCircle className="w-5 h-5 text-slate-400" />
                      Dados do Usuário
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                  {/* Bloco 2: Alcance Organizacional */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      Alcance Organizacional
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
                          <SelectItem value="subsetor">Subsetor / Seção</SelectItem>
                          <SelectItem value="setor">Setor / Grupamento Todo</SelectItem>
                          <SelectItem value="admin">Administrador Global</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(userAccessMode === 'setor' || userAccessMode === 'subsetor') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 p-4 bg-white border border-blue-100 rounded-lg">
                        <div>
                          <label className="text-sm font-semibold text-slate-700 block mb-1.5">Setor (Obrigatório)</label>
                          <Select value={userGrupamentoId || '_nenhum'} onValueChange={(v) => { setUserGrupamentoId(v === '_nenhum' ? '' : v); setUserSubgrupamentoId(''); }}>
                            <SelectTrigger><SelectValue placeholder="Selecione um setor..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_nenhum">— Selecione —</SelectItem>
                              {grupamentos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {userAccessMode === 'setor' && userGrupamentoId && !userSubgrupamentoId && <p className="text-xs font-medium text-blue-600 mt-2">✓ Terá visão de dados deste setor inteiro.</p>}
                        </div>

                        {userAccessMode === 'subsetor' && (
                          <div>
                            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Subsetor/Seção (Obrigatório)</label>
                            <Select 
                              value={userSubgrupamentoId || '_nenhum'} 
                              onValueChange={(v) => setUserSubgrupamentoId(v === '_nenhum' ? '' : v)}
                              disabled={!userGrupamentoId || subgrupamentosFilhos.length === 0}
                            >
                              <SelectTrigger><SelectValue placeholder={!userGrupamentoId ? "Selecione o setor primeiro" : (subgrupamentosFilhos.length === 0 ? "Sem subsetores" : "Selecione o subsetor") } /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_nenhum">— Selecione —</SelectItem>
                                {subgrupamentosFilhos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {userSubgrupamentoId && <p className="text-xs font-medium text-blue-600 mt-2">✓ Terá visão de dados apenas deste subsetor.</p>}
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

                  {/* Bloco 4: Perfil de Permissões */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-emerald-500" />
                      Perfil de Permissões
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
                      <Info className="w-4 h-4" /> Ao aplicar um perfil, os módulos e ações abaixo serão preenchidos automaticamente. Você ainda pode ajustar manualmente se desejar.
                    </p>
                  </div>

                  {/* Bloco 5: Módulos Permitidos */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Módulos Permitidos (Menud do Sistema)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-slate-200">
                      {modulosList.map(mod => (
                        <div key={mod.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${userPermissions[mod.key] ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-100'}`} onClick={() => setUserPermissions(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}>
                          <input 
                            type="checkbox" 
                            id={`mod_${mod.key}`}
                            checked={userPermissions[mod.key]}
                            readOnly
                            className="rounded border-slate-300 w-4 h-4 text-blue-600 pointer-events-none"
                          />
                          <label className="text-sm font-semibold pointer-events-none">{mod.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bloco 6: Ações Sensíveis */}
                  <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-5 mb-4">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                      Ações Sensíveis e Administrativas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-orange-100">
                      {acoesSensiveis.map(act => (
                        <div key={act.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${userPermissions[act.key] ? 'bg-orange-50 border-orange-300 text-orange-900' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-orange-100'}`} onClick={() => setUserPermissions(prev => ({ ...prev, [act.key]: !prev[act.key] }))}>
                          <input 
                            type="checkbox" 
                            id={`act_${act.key}`}
                            checked={userPermissions[act.key]}
                            readOnly
                            className="rounded border-orange-300 w-4 h-4 text-orange-600 pointer-events-none"
                          />
                          <label className="text-sm font-bold pointer-events-none">{act.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>

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
