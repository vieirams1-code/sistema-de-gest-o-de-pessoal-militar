import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Trash2, Users } from 'lucide-react';
import {
  associarMilitaresATurmaPromocao,
  criarTurmaPromocaoMilitar,
  executarPromocaoDaTurma,
  getEntidadeTurmaPromocao,
  getEntidadeTurmaPromocaoMembro,
} from '@/services/turmaPromocaoMilitarService';

const POSTOS_GRADUACOES = [
  'Coronel',
  'Tenente-Coronel',
  'Major',
  'Capitão',
  '1º Tenente',
  '2º Tenente',
  'Aspirante',
  'Subtenente',
  '1º Sargento',
  '2º Sargento',
  '3º Sargento',
  'Cabo',
  'Soldado',
];

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function statusVariant(status) {
  if (status === 'Processada') return 'default';
  if (status === 'Processada com pendências') return 'secondary';
  if (status === 'Em processamento') return 'outline';
  if (status === 'Falha na execução') return 'destructive';
  return 'outline';
}

export default function TurmasPromocaoMilitar() {
  const queryClient = useQueryClient();
  const { canAccessModule, userEmail } = useCurrentUser();

  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMembrosDialog, setShowAddMembrosDialog] = useState(false);
  const [militarSearch, setMilitarSearch] = useState('');
  const [selectedMilitarIds, setSelectedMilitarIds] = useState([]);
  const [newTurma, setNewTurma] = useState({
    nome: '',
    identificacao: '',
    posto_graduacao_alvo: '',
    data_promocao: '',
  });

  const { data: turmas = [], isLoading: loadingTurmas } = useQuery({
    queryKey: ['turmas-promocao-militar'],
    queryFn: async () => {
      const { entidade } = getEntidadeTurmaPromocao();
      const lista = await entidade.list('-created_date');
      return Array.isArray(lista) ? lista : [];
    },
  });

  const turmaSelecionada = useMemo(
    () => turmas.find((turma) => turma.id === selectedTurmaId) || null,
    [turmas, selectedTurmaId],
  );

  const { data: membrosTurma = [], isLoading: loadingMembros } = useQuery({
    queryKey: ['turma-promocao-militar-membros', selectedTurmaId],
    queryFn: async () => {
      if (!selectedTurmaId) return [];
      const { entidade } = getEntidadeTurmaPromocaoMembro();
      const lista = await entidade.filter({ turma_promocao_id: selectedTurmaId }, '-created_date');
      return Array.isArray(lista) ? lista : [];
    },
    enabled: Boolean(selectedTurmaId),
  });

  const { data: militares = [] } = useQuery({
    queryKey: ['militares-para-turma-promocao'],
    queryFn: async () => {
      const lista = await base44.entities.Militar.list('nome_completo');
      return Array.isArray(lista) ? lista : [];
    },
    enabled: showAddMembrosDialog,
  });

  const militaresById = useMemo(
    () => Object.fromEntries(militares.map((militar) => [militar.id, militar])),
    [militares],
  );

  const membroIdsSet = useMemo(
    () => new Set(membrosTurma.map((membro) => membro.militar_id).filter(Boolean)),
    [membrosTurma],
  );

  const militaresFiltrados = useMemo(() => {
    const termo = militarSearch.toLowerCase().trim();
    return militares.filter((militar) => {
      if (!termo) return true;
      return (
        militar.nome_completo?.toLowerCase().includes(termo) ||
        militar.nome_guerra?.toLowerCase().includes(termo) ||
        militar.matricula?.toLowerCase().includes(termo)
      );
    });
  }, [militares, militarSearch]);

  const createTurmaMutation = useMutation({
    mutationFn: () => criarTurmaPromocaoMilitar({
      nome: newTurma.nome,
      identificacao: newTurma.identificacao,
      postoGraduacaoAlvo: newTurma.posto_graduacao_alvo,
      dataPromocao: newTurma.data_promocao,
      userEmail: userEmail || '',
    }),
    onSuccess: (turmaCriada) => {
      queryClient.invalidateQueries({ queryKey: ['turmas-promocao-militar'] });
      setSelectedTurmaId(turmaCriada?.id || '');
      setShowCreateDialog(false);
      setNewTurma({ nome: '', identificacao: '', posto_graduacao_alvo: '', data_promocao: '' });
      alert('Turma criada com sucesso.');
    },
    onError: (error) => alert(error?.message || 'Falha ao criar turma.'),
  });

  const addMembrosMutation = useMutation({
    mutationFn: () => associarMilitaresATurmaPromocao({
      turmaId: selectedTurmaId,
      militaresSelecionados: selectedMilitarIds,
      userEmail: userEmail || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-promocao-militar-membros', selectedTurmaId] });
      queryClient.invalidateQueries({ queryKey: ['turmas-promocao-militar'] });
      setSelectedMilitarIds([]);
      setMilitarSearch('');
      setShowAddMembrosDialog(false);
      alert('Militares vinculados à turma com sucesso.');
    },
    onError: (error) => alert(error?.message || 'Falha ao adicionar membros na turma.'),
  });

  const removeMembroMutation = useMutation({
    mutationFn: async (membroId) => {
      const { entidade } = getEntidadeTurmaPromocaoMembro();
      return entidade.delete(membroId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turma-promocao-militar-membros', selectedTurmaId] });
      queryClient.invalidateQueries({ queryKey: ['turmas-promocao-militar'] });
    },
    onError: (error) => alert(error?.message || 'Falha ao remover membro da turma.'),
  });

  const executarTurmaMutation = useMutation({
    mutationFn: () => executarPromocaoDaTurma({ turmaId: selectedTurmaId, userEmail: userEmail || '' }),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['turmas-promocao-militar'] });
      queryClient.invalidateQueries({ queryKey: ['turma-promocao-militar-membros', selectedTurmaId] });
      alert(`Execução concluída. Promovidos: ${resultado?.promovidos || 0}. Falhas: ${resultado?.falhas || 0}.`);
    },
    onError: (error) => alert(error?.message || 'Falha ao executar promoção da turma.'),
  });

  if (!canAccessModule('militares')) return <AccessDenied modulo="Efetivo" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Turmas de Promoção Militar</h1>
            <p className="text-slate-500">Gestão administrativa de turmas formais de promoção</p>
          </div>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova turma
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h2 className="text-lg font-semibold text-[#1e3a5f]">Listagem de turmas</h2>
            {loadingTurmas ? (
              <p className="text-sm text-slate-500">Carregando turmas...</p>
            ) : turmas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma turma cadastrada até o momento.</p>
            ) : (
              <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
                {turmas.map((turma) => {
                  const ativa = turma.id === selectedTurmaId;
                  return (
                    <button
                      key={turma.id}
                      type="button"
                      onClick={() => setSelectedTurmaId(turma.id)}
                      className={`w-full text-left rounded-lg border p-3 transition ${
                        ativa ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{turma.nome || turma.identificacao || 'Sem identificação'}</p>
                          <p className="text-xs text-slate-500">{turma.identificacao || 'Sem identificação formal'}</p>
                        </div>
                        <Badge variant={statusVariant(turma.status)}>{turma.status || 'Rascunho'}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mt-3 text-slate-600">
                        <span>Posto alvo: <strong>{turma.posto_graduacao_alvo || '-'}</strong></span>
                        <span>Promoção: <strong>{formatDate(turma.data_promocao)}</strong></span>
                        <span>Membros: <strong>{turma.total_membros || 0}</strong></span>
                        <span>Promovidos: <strong>{turma.total_promovidos || 0}</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            {!turmaSelecionada ? (
              <p className="text-sm text-slate-500">Selecione uma turma para abrir o detalhe e gerenciar membros.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#1e3a5f]">{turmaSelecionada.nome || turmaSelecionada.identificacao}</h2>
                    <p className="text-xs text-slate-500">ID: {turmaSelecionada.identificacao || 'Não informado'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowAddMembrosDialog(true)}>
                      <Users className="w-4 h-4 mr-2" />
                      Adicionar militares
                    </Button>
                    <Button
                      onClick={() => executarTurmaMutation.mutate()}
                      disabled={executarTurmaMutation.isPending || membrosTurma.length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Executar turma
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><strong>Posto alvo:</strong> {turmaSelecionada.posto_graduacao_alvo || '-'}</div>
                  <div><strong>Data de promoção:</strong> {formatDate(turmaSelecionada.data_promocao)}</div>
                  <div><strong>Status:</strong> {turmaSelecionada.status || '-'}</div>
                  <div><strong>Última execução:</strong> {formatDate(turmaSelecionada.ultima_execucao_em)}</div>
                </div>

                <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
                  <p className="text-sm"><strong>Mensagem de status:</strong> {turmaSelecionada.mensagem_status || 'Sem mensagens no momento.'}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                  <div className="rounded border p-2 bg-slate-50">Total membros: <strong>{turmaSelecionada.total_membros || 0}</strong></div>
                  <div className="rounded border p-2 bg-slate-50">Processados: <strong>{turmaSelecionada.total_processados || 0}</strong></div>
                  <div className="rounded border p-2 bg-slate-50">Promovidos: <strong>{turmaSelecionada.total_promovidos || 0}</strong></div>
                  <div className="rounded border p-2 bg-slate-50">Sem alteração: <strong>{turmaSelecionada.total_sem_alteracao || 0}</strong></div>
                  <div className="rounded border p-2 bg-slate-50">Falhas: <strong>{turmaSelecionada.total_falhas || 0}</strong></div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-[#1e3a5f]">Membros da turma</h3>
                  {loadingMembros ? (
                    <p className="text-xs text-slate-500">Carregando membros...</p>
                  ) : membrosTurma.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum militar vinculado.</p>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {membrosTurma.map((membro) => {
                        const militar = militaresById[membro.militar_id];
                        return (
                          <div key={membro.id} className="rounded border border-slate-200 p-2 flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-800">
                                {militar?.nome_completo || membro.militar_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {militar?.matricula || 'Matrícula não carregada'} • Status: {membro.status_processamento || 'Pendente'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMembroMutation.mutate(membro.id)}
                              disabled={removeMembroMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastro de turma de promoção</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome da turma"
              value={newTurma.nome}
              onChange={(e) => setNewTurma((prev) => ({ ...prev, nome: e.target.value }))}
            />
            <Input
              placeholder="Identificação"
              value={newTurma.identificacao}
              onChange={(e) => setNewTurma((prev) => ({ ...prev, identificacao: e.target.value }))}
            />
            <select
              className="w-full border border-slate-200 rounded-md h-10 px-3 bg-white"
              value={newTurma.posto_graduacao_alvo}
              onChange={(e) => setNewTurma((prev) => ({ ...prev, posto_graduacao_alvo: e.target.value }))}
            >
              <option value="">Selecione o posto/graduação alvo</option>
              {POSTOS_GRADUACOES.map((posto) => (
                <option key={posto} value={posto}>{posto}</option>
              ))}
            </select>
            <Input
              type="date"
              value={newTurma.data_promocao}
              onChange={(e) => setNewTurma((prev) => ({ ...prev, data_promocao: e.target.value }))}
            />
            <Button className="w-full" onClick={() => createTurmaMutation.mutate()} disabled={createTurmaMutation.isPending}>
              Criar turma
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMembrosDialog} onOpenChange={setShowAddMembrosDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar militares na turma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Buscar por nome, nome de guerra ou matrícula"
              value={militarSearch}
              onChange={(e) => setMilitarSearch(e.target.value)}
            />
            <div className="max-h-[45vh] overflow-y-auto border rounded-md p-2 space-y-1">
              {militaresFiltrados.map((militar) => {
                const jaVinculado = membroIdsSet.has(militar.id);
                const checked = selectedMilitarIds.includes(militar.id);
                return (
                  <label key={militar.id} className={`flex items-center justify-between rounded p-2 ${jaVinculado ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                    <div>
                      <p className="text-sm font-medium">{militar.nome_completo}</p>
                      <p className="text-xs text-slate-500">{militar.nome_guerra || '-'} • {militar.matricula || '-'}</p>
                    </div>
                    {jaVinculado ? (
                      <Badge variant="outline">Já vinculado</Badge>
                    ) : (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedMilitarIds((prev) => {
                            if (isChecked) return prev.includes(militar.id) ? prev : [...prev, militar.id];
                            return prev.filter((id) => id !== militar.id);
                          });
                        }}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <Button
              onClick={() => addMembrosMutation.mutate()}
              disabled={addMembrosMutation.isPending || selectedMilitarIds.length === 0}
            >
              Adicionar selecionados ({selectedMilitarIds.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
