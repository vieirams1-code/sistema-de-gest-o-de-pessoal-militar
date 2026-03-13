import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Trash2, Plus, Users, Shield, CheckSquare, Square, UserCog, Sliders, Building } from 'lucide-react';
import TiposPublicacaoManager from '@/components/configuracoes/TiposPublicacaoManager';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
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
  const { isAdmin, isLoading: loadingUser, getAccessModeFromUser } = useCurrentUser();
  const [novaLotacao, setNovaLotacao] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');

  // Ler tab da URL
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'permissoes');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t) setActiveTab(t);
  }, [window.location.search]);

  // Estado - permissões de usuários
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGrupamentoId, setUserGrupamentoId] = useState('');
  const [userSubgrupamentoId, setUserSubgrupamentoId] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [userAccessMode, setUserAccessMode] = useState('proprio');

  // Estado - atribuição em massa de militares
  const [massaGrupamentoId, setMassaGrupamentoId] = useState('');
  const [massaSubgrupamentoId, setMassaSubgrupamentoId] = useState('');
  const [militaresSelecionados, setMilitaresSelecionados] = useState([]);
  const [searchMassa, setSearchMassa] = useState('');
  const [savingMassa, setSavingMassa] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });

  useEffect(() => {
    if (!loadingUser && !isAdmin && activeTab === 'permissoes') {
      setActiveTab('adicoes');
    }
  }, [activeTab, isAdmin, loadingUser]);


  const { data: lotacoes = [] } = useQuery({ queryKey: ['lotacoes'], queryFn: () => base44.entities.Lotacao.list('-created_date') });
  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes'], queryFn: () => base44.entities.Funcao.list('-created_date') });
  const { data: militares = [] } = useQuery({ queryKey: ['militares-ativos'], queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' }) });
  const { data: usuarios = [] } = useQuery({ queryKey: ['usuarios'], queryFn: () => base44.entities.User.list() });
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


  const visibleTabs = useMemo(() => {
    if (isAdmin) return TABS;
    return TABS.filter((tab) => tab.id === 'adicoes');
  }, [isAdmin]);

  const handleSelectUser = (userId) => {
    const u = usuarios.find(u => u.id === userId);
    setSelectedUser(u);
    setUserAccessMode(getAccessModeFromUser(u));

    const sId = subgrupamentos.find(s => s.tipo === 'Subgrupamento' && s.id === u?.subgrupamento_id) ? u.subgrupamento_id : '';
    const gId = grupamentos.find(g => g.id === u?.subgrupamento_id) ? u.subgrupamento_id : '';

    if (sId) {
      const sub = subgrupamentos.find(s => s.id === sId);
      setUserGrupamentoId(sub?.grupamento_id || '');
      setUserSubgrupamentoId(sId);
      return;
    }

    setUserGrupamentoId(gId);
    setUserSubgrupamentoId('');
  };

  const handleSaveUserScope = async () => {
    if (!selectedUser) return;

    setSavingUser(true);
    try {
      const grupamento = grupamentos.find(g => g.id === userGrupamentoId);
      const sub = subgrupamentos.find(s => s.id === userSubgrupamentoId);

      const data = userAccessMode === 'admin'
        ? { role: 'admin', subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null }
        : userAccessMode === 'subsetor' && sub
          ? { role: 'user', subgrupamento_id: sub.id, subgrupamento_nome: sub.nome, subgrupamento_tipo: 'Subgrupamento' }
          : userAccessMode === 'setor' && grupamento
            ? { role: 'user', subgrupamento_id: grupamento.id, subgrupamento_nome: grupamento.nome, subgrupamento_tipo: 'Grupamento' }
            : { role: 'user', subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null };

      await base44.entities.User.update(selectedUser.id, data);
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setSelectedUser(prev => ({ ...prev, ...data }));
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
        {activeTab === 'permissoes' && isAdmin && (
          <div className="space-y-6">
            {/* Permissões de Usuários */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-xl font-semibold text-[#1e3a5f]">Permissões de Usuários</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">Defina qual setor/subsetor cada usuário pode acessar. Sem atribuição de setor = acesso apenas aos próprios dados (militares vinculados ao próprio email).</p>
              <div className="space-y-2 mb-6">
                {usuarios.map(u => (
                  <div key={u.id} onClick={() => handleSelectUser(u.id)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'border-[#1e3a5f] bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                    <div>
                      <p className="font-medium text-sm text-slate-800">{u.full_name || u.email}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    {u.subgrupamento_nome ? (
                      <Badge className={u.subgrupamento_tipo === 'Grupamento' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>{u.subgrupamento_nome} ({u.subgrupamento_tipo})</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">Próprio / sem setor</Badge>
                    )}
                  </div>
                ))}
                {usuarios.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum usuário cadastrado</p>}
              </div>
              {selectedUser && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-700">Editando: <span className="text-[#1e3a5f]">{selectedUser.full_name || selectedUser.email}</span></p>
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
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                      Este usuário ficará em modo <strong>Próprio / sem setor</strong>, com acesso apenas aos registros vinculados ao próprio e-mail.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                    <Button onClick={handleSaveUserScope} disabled={savingUser || (userAccessMode === 'setor' && !userGrupamentoId) || (userAccessMode === 'subsetor' && (!userGrupamentoId || !userSubgrupamentoId))} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">{savingUser ? 'Salvando...' : 'Salvar Permissão'}</Button>
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


        {activeTab === 'permissoes' && !isAdmin && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-2">Área restrita</h2>
            <p className="text-sm text-slate-500">As configurações de permissões e atribuições administrativas são exclusivas para administradores.</p>
          </div>
        )}

        {/* Tab: Adições e Personalizações */}
        {activeTab === 'adicoes' && (
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