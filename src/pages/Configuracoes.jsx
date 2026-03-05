import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Trash2, Plus, Crown, Users, Shield, CheckSquare, Square } from 'lucide-react';
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

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [novaLotacao, setNovaLotacao] = useState('');
  const [novaFuncao, setNovaFuncao] = useState('');

  // Estado - permissões de usuários
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGrupamentoId, setUserGrupamentoId] = useState('');
  const [userSubgrupamentoId, setUserSubgrupamentoId] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Estado - atribuição em massa de militares
  const [massaGrupamentoId, setMassaGrupamentoId] = useState('');
  const [massaSubgrupamentoId, setMassaSubgrupamentoId] = useState('');
  const [militaresSelecionados, setMilitaresSelecionados] = useState([]);
  const [searchMassa, setSearchMassa] = useState('');
  const [savingMassa, setSavingMassa] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, id: null });

  const { data: lotacoes = [] } = useQuery({
    queryKey: ['lotacoes'],
    queryFn: () => base44.entities.Lotacao.list('-created_date')
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => base44.entities.Funcao.list('-created_date')
  });

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-ativos'],
    queryFn: () => base44.entities.Militar.filter({ status_cadastro: 'Ativo' })
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['config-unidade'],
    queryFn: () => base44.entities.ConfiguracaoUnidade.list()
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: subgrupamentos = [] } = useQuery({
    queryKey: ['subgrupamentos'],
    queryFn: () => base44.entities.Subgrupamento.filter({ ativo: true }, 'nome')
  });

  const grupamentos = subgrupamentos.filter(s => s.tipo === 'Grupamento');
  const subgrupamentosFilhos = subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === userGrupamentoId);
  

  const comandanteConfig = configs.find(c => c.chave === 'comandante_id');
  const comandanteId = comandanteConfig?.valor || '';

  const massaSubgrupamentosFilhos = subgrupamentos.filter(s => s.tipo === 'Subgrupamento' && s.grupamento_id === massaGrupamentoId);

  const militaresFiltradosMassa = militares.filter(m =>
    !searchMassa ||
    m.nome_completo?.toLowerCase().includes(searchMassa.toLowerCase()) ||
    m.matricula?.includes(searchMassa) ||
    m.posto_graduacao?.toLowerCase().includes(searchMassa.toLowerCase())
  );

  const handleSelectUser = (userId) => {
    const u = usuarios.find(u => u.id === userId);
    setSelectedUser(u);
    // preenche o grupamento atual do usuário
    const gId = grupamentos.find(g => g.id === u?.subgrupamento_id) ? u.subgrupamento_id : '';
    const sId = subgrupamentos.find(s => s.tipo === 'Subgrupamento' && s.id === u?.subgrupamento_id) ? u.subgrupamento_id : '';
    if (sId) {
      const sub = subgrupamentos.find(s => s.id === sId);
      setUserGrupamentoId(sub?.grupamento_id || '');
      setUserSubgrupamentoId(sId);
    } else {
      setUserGrupamentoId(gId);
      setUserSubgrupamentoId('');
    }
  };

  const handleSaveUserScope = async () => {
    if (!selectedUser) return;
    setSavingUser(true);
    const grupamento = grupamentos.find(g => g.id === userGrupamentoId);
    const sub = subgrupamentos.find(s => s.id === userSubgrupamentoId);
    const data = sub
      ? { subgrupamento_id: sub.id, subgrupamento_nome: sub.nome, subgrupamento_tipo: 'Subgrupamento' }
      : grupamento
        ? { subgrupamento_id: grupamento.id, subgrupamento_nome: grupamento.nome, subgrupamento_tipo: 'Grupamento' }
        : { subgrupamento_id: '', subgrupamento_nome: '', subgrupamento_tipo: null };
    await base44.auth.updateMe ? null : null; // User.update via admin
    await base44.entities.User.update(selectedUser.id, data);
    queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    setSelectedUser(prev => ({ ...prev, ...data }));
    setSavingUser(false);
  };

  const toggleMilitar = (id) => {
    setMilitaresSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleTodosMilitares = () => {
    const ids = militaresFiltradosMassa.map(m => m.id);
    const todosSelecionados = ids.every(id => militaresSelecionados.includes(id));
    if (todosSelecionados) {
      setMilitaresSelecionados(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setMilitaresSelecionados(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handleSaveMassa = async () => {
    if (!massaGrupamentoId || militaresSelecionados.length === 0) return;
    setSavingMassa(true);
    const grupamento = grupamentos.find(g => g.id === massaGrupamentoId);
    const sub = subgrupamentos.find(s => s.id === massaSubgrupamentoId);
    const updates = militaresSelecionados.map(id =>
      base44.entities.Militar.update(id, sub
        ? { grupamento_id: grupamento?.id, grupamento_nome: grupamento?.nome, subgrupamento_id: sub.id, subgrupamento_nome: sub.nome }
        : { grupamento_id: grupamento?.id, grupamento_nome: grupamento?.nome, subgrupamento_id: '', subgrupamento_nome: '' }
      )
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['militares-ativos'] });
    setMilitaresSelecionados([]);
    setSavingMassa(false);
  };

  const saveComandanteMutation = useMutation({
    mutationFn: async (militarId) => {
      if (comandanteConfig) {
        await base44.entities.ConfiguracaoUnidade.update(comandanteConfig.id, { valor: militarId });
      } else {
        await base44.entities.ConfiguracaoUnidade.create({ chave: 'comandante_id', valor: militarId, descricao: 'ID do Comandante da Unidade' });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['config-unidade'] })
  });

  const createLotacaoMutation = useMutation({
    mutationFn: (nome) => base44.entities.Lotacao.create({ nome, ativa: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotacoes'] });
      setNovaLotacao('');
    }
  });

  const createFuncaoMutation = useMutation({
    mutationFn: (nome) => base44.entities.Funcao.create({ nome, ativa: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      setNovaFuncao('');
    }
  });

  const deleteLotacaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Lotacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotacoes'] });
      setDeleteDialog({ open: false, type: null, id: null });
    }
  });

  const deleteFuncaoMutation = useMutation({
    mutationFn: (id) => base44.entities.Funcao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      setDeleteDialog({ open: false, type: null, id: null });
    }
  });

  const handleCreateLotacao = () => {
    if (novaLotacao.trim()) {
      createLotacaoMutation.mutate(novaLotacao.trim());
    }
  };

  const handleCreateFuncao = () => {
    if (novaFuncao.trim()) {
      createFuncaoMutation.mutate(novaFuncao.trim());
    }
  };

  const handleDelete = () => {
    if (deleteDialog.type === 'lotacao') {
      deleteLotacaoMutation.mutate(deleteDialog.id);
    } else {
      deleteFuncaoMutation.mutate(deleteDialog.id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Configurações</h1>
            <p className="text-slate-500">Gerenciar lotações, funções e configurações da unidade</p>
          </div>
        </div>

        {/* Comandante */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-semibold text-[#1e3a5f]">Comandante da Unidade</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            O sexo do(a) comandante definido aqui será usado nos textos gerados para publicação (ex: "O Comandante" ou "A Comandante").
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Comandante</label>
              <Select value={comandanteId} onValueChange={v => saveComandanteMutation.mutate(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o(a) Comandante..." />
                </SelectTrigger>
                <SelectContent>
                  {militares.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.posto_graduacao} {m.nome_completo} — {m.sexo === 'Feminino' ? '♀ Feminino' : '♂ Masculino'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {comandanteId && (() => {
            const cmd = militares.find(m => m.id === comandanteId);
            return cmd ? (
              <p className="text-sm text-emerald-600 mt-3">
                ✓ Textos gerados com: "{cmd.sexo === 'Feminino' ? 'A Comandante' : 'O Comandante'}"
              </p>
            ) : null;
          })()}
        </div>

        {/* Permissões de Usuários */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="text-xl font-semibold text-[#1e3a5f]">Permissões de Usuários</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Defina qual grupamento/subgrupamento cada usuário pode acessar. Usuários sem atribuição têm acesso total.
          </p>

          {/* Lista de usuários com suas permissões atuais */}
          <div className="space-y-2 mb-6">
            {usuarios.filter(u => u.role !== 'admin').map(u => (
              <div
                key={u.id}
                onClick={() => handleSelectUser(u.id)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedUser?.id === u.id
                    ? 'border-[#1e3a5f] bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div>
                  <p className="font-medium text-sm text-slate-800">{u.full_name || u.email}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                {u.subgrupamento_nome ? (
                  <Badge className={u.subgrupamento_tipo === 'Grupamento' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>
                    {u.subgrupamento_nome} ({u.subgrupamento_tipo})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400">Sem restrição</Badge>
                )}
              </div>
            ))}
            {usuarios.filter(u => u.role !== 'admin').length === 0 && (
              <p className="text-center text-slate-400 py-4 text-sm">Nenhum usuário cadastrado</p>
            )}
          </div>

          {/* Painel de edição do usuário selecionado */}
          {selectedUser && (
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold text-slate-700">
                Editando: <span className="text-[#1e3a5f]">{selectedUser.full_name || selectedUser.email}</span>
              </p>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Grupamento</label>
                <Select value={userGrupamentoId || '_nenhum'} onValueChange={(v) => { setUserGrupamentoId(v === '_nenhum' ? '' : v); setUserSubgrupamentoId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupamento..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_nenhum">— Sem restrição —</SelectItem>
                    {grupamentos.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {userGrupamentoId && !userSubgrupamentoId && (
                  <p className="text-xs text-blue-600 mt-1">✓ Acesso a todos os subgrupamentos deste grupamento</p>
                )}
              </div>

              {userGrupamentoId && subgrupamentosFilhos.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Restringir a um Subgrupamento (opcional)</label>
                  <Select value={userSubgrupamentoId || '_todos'} onValueChange={(v) => setUserSubgrupamentoId(v === '_todos' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os subgrupamentos do grupamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_todos">— Acesso a todo o grupamento —</SelectItem>
                      {subgrupamentosFilhos.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userSubgrupamentoId && (
                    <p className="text-xs text-amber-600 mt-1">✓ Acesso restrito apenas a este subgrupamento</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                <Button onClick={handleSaveUserScope} disabled={savingUser} className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">
                  {savingUser ? 'Salvando...' : 'Salvar Permissão'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Atribuição em massa - Militares */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="text-xl font-semibold text-[#1e3a5f]">Atribuir Grupamento/Subgrupamento a Militares</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Selecione militares e atribua o grupamento/subgrupamento em massa de uma vez.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Grupamento</label>
              <Select value={massaGrupamentoId || '_nenhum'} onValueChange={(v) => { setMassaGrupamentoId(v === '_nenhum' ? '' : v); setMassaSubgrupamentoId(''); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grupamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_nenhum">— Selecione —</SelectItem>
                  {grupamentos.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.nome}{g.sigla ? ` (${g.sigla})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {massaGrupamentoId && massaSubgrupamentosFilhos.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">Subgrupamento (opcional)</label>
                <Select value={massaSubgrupamentoId || '_todos'} onValueChange={(v) => setMassaSubgrupamentoId(v === '_todos' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Apenas grupamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todos">— Apenas grupamento —</SelectItem>
                    {massaSubgrupamentosFilhos.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}{s.sigla ? ` (${s.sigla})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="mb-3 flex gap-2">
            <Input
              placeholder="Buscar militar..."
              value={searchMassa}
              onChange={e => setSearchMassa(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleTodosMilitares} className="whitespace-nowrap">
              {militaresFiltradosMassa.every(m => militaresSelecionados.includes(m.id)) ? (
                <><CheckSquare className="w-4 h-4 mr-1" /> Desmarcar todos</>
              ) : (
                <><Square className="w-4 h-4 mr-1" /> Selecionar todos</>
              )}
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            {militaresFiltradosMassa.length === 0 ? (
              <p className="text-center text-slate-400 py-6 text-sm">Nenhum militar encontrado</p>
            ) : militaresFiltradosMassa.map(m => (
              <div
                key={m.id}
                onClick={() => toggleMilitar(m.id)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 transition-colors ${
                  militaresSelecionados.includes(m.id) ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50'
                }`}
              >
                {militaresSelecionados.includes(m.id)
                  ? <CheckSquare className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                  : <Square className="w-4 h-4 text-slate-300 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{m.posto_graduacao} {m.nome_completo}</span>
                  <span className="text-xs text-slate-400 ml-2">Mat. {m.matricula}</span>
                </div>
                {m.subgrupamento_nome && (
                  <Badge variant="outline" className="text-xs shrink-0">{m.subgrupamento_nome}</Badge>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-slate-500">
              {militaresSelecionados.length} militar(es) selecionado(s)
            </span>
            <Button
              onClick={handleSaveMassa}
              disabled={savingMassa || !massaGrupamentoId || militaresSelecionados.length === 0}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              {savingMassa ? 'Salvando...' : `Atribuir a ${militaresSelecionados.length} militar(es)`}
            </Button>
          </div>
        </div>

        {/* Lotações */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Lotações</h2>
          
          <div className="flex gap-2 mb-6">
            <Input
              value={novaLotacao}
              onChange={(e) => setNovaLotacao(e.target.value)}
              placeholder="Nova lotação..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateLotacao()}
            />
            <Button
              onClick={handleCreateLotacao}
              disabled={!novaLotacao.trim()}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {lotacoes.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium">{lot.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteDialog({ open: true, type: 'lotacao', id: lot.id })}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {lotacoes.length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma lotação cadastrada</p>
            )}
          </div>
        </div>

        {/* Funções */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-[#1e3a5f] mb-4">Funções</h2>
          
          <div className="flex gap-2 mb-6">
            <Input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              placeholder="Nova função..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFuncao()}
            />
            <Button
              onClick={handleCreateFuncao}
              disabled={!novaFuncao.trim()}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {funcoes.map((func) => (
              <div
                key={func.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium">{func.nome}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteDialog({ open: true, type: 'funcao', id: func.id })}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {funcoes.length === 0 && (
              <p className="text-center text-slate-500 py-8">Nenhuma função cadastrada</p>
            )}
          </div>
        </div>

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta {deleteDialog.type === 'lotacao' ? 'lotação' : 'função'}?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}