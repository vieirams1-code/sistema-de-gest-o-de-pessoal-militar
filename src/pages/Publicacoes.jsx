import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import PublicacaoCard from '@/components/publicacao/PublicacaoCard';
import FamiliaPublicacaoPanel from '@/components/publicacao/FamiliaPublicacaoPanel';

function calcStatus(registro) {
  if (registro.numero_bg && registro.data_bg) return 'Publicado';
  if (registro.nota_para_bg) return 'Aguardando Publicação';
  return 'Aguardando Nota';
}

function detectarOrigemTipo(registro) {
  if (registro.tipo && !registro.tipo_registro && !registro.medico && !registro.cid_10) {
    return 'ex-officio';
  }
  if (registro.medico || registro.cid_10) {
    return 'atestado';
  }
  return 'livro';
}

function normalizarRegistro(registro) {
  return {
    ...registro,
    origem_tipo: detectarOrigemTipo(registro),
    status_calculado: calcStatus(registro),
  };
}

export default function Publicacoes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [familiaPanel, setFamiliaPanel] = useState({ open: false, registro: null });

  const { data: registrosLivro = [], isLoading: loadingLivro } = useQuery({
    queryKey: ['registros-livro'],
    queryFn: () => base44.entities.RegistroLivro.list('-created_date')
  });

  const { data: publicacoesExOfficio = [], isLoading: loadingExOfficio } = useQuery({
    queryKey: ['publicacoes-ex-officio'],
    queryFn: () => base44.entities.PublicacaoExOfficio.list('-created_date')
  });

  const { data: atestados = [], isLoading: loadingAtestados } = useQuery({
    queryKey: ['atestados-publicacao'],
    queryFn: async () => {
      const all = await base44.entities.Atestado.list('-created_date');
      return all.filter(a => a.homologado_comandante || a.encaminhado_jiso || a.necessita_jiso);
    }
  });

  const isLoading = loadingLivro || loadingExOfficio || loadingAtestados;

  const registros = useMemo(() => {
    return [...registrosLivro, ...publicacoesExOfficio, ...atestados]
      .map(normalizarRegistro)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [registrosLivro, publicacoesExOfficio, atestados]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data, tipo }) => {
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.update(id, data);
      if (tipo === 'atestado') return base44.entities.Atestado.update(id, data);
      return base44.entities.RegistroLivro.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, tipo, registro }) => {
      // Nunca excluir o atestado em si — apenas publicações derivadas (ex-officio)
      // Apostila ou TSE: reverter vínculo da original antes de excluir
      if (tipo === 'ex-officio' || tipo === 'livro') {
        const isApostila = registro?.tipo === 'Apostila';
        const isTSE = registro?.tipo === 'Tornar sem Efeito';
        const refId = registro?.publicacao_referencia_id;
        const origemTipo = registro?.publicacao_referencia_origem_tipo;

        if ((isApostila || isTSE) && refId) {
          const entityOriginal =
            origemTipo === 'atestado' ? base44.entities.Atestado :
            origemTipo === 'livro' ? base44.entities.RegistroLivro :
            base44.entities.PublicacaoExOfficio;

          if (isApostila) {
            // Buscar original para confirmar que o campo aponta para esta publicação
            const originais = await entityOriginal.filter({ id: refId });
            const original = originais[0];
            if (original?.apostilada_por_id === id) {
              await entityOriginal.update(refId, { apostilada_por_id: null });
            }
          } else if (isTSE) {
            const originais = await entityOriginal.filter({ id: refId });
            const original = originais[0];
            if (original?.tornada_sem_efeito_por_id === id) {
              await entityOriginal.update(refId, { tornada_sem_efeito_por_id: null });
            }
          }
        }
      }

      // Nunca excluir o Atestado em si — publicações de atestado são ex-officio (PublicacaoExOfficio)
      if (tipo === 'atestado') {
        // Registros de atestado na lista são apenas para visualização — não devem ser excluídos aqui
        return;
      }
      if (tipo === 'ex-officio') return base44.entities.PublicacaoExOfficio.delete(id);
      return base44.entities.RegistroLivro.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
      queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
      queryClient.invalidateQueries({ queryKey: ['atestados-publicacao'] });
      queryClient.invalidateQueries({ queryKey: ['atestados'] });
    }
  });

  const filteredRegistros = useMemo(() => {
    return registros.filter((r) => {
      const matchesStatus =
        statusFilter === 'all' || r.status_calculado === statusFilter;

      const termo = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !termo ||
        r.militar_nome?.toLowerCase().includes(termo) ||
        r.militar_matricula?.toLowerCase().includes(termo) ||
        r.numero_bg?.toLowerCase().includes(termo) ||
        r.nota_para_bg?.toLowerCase().includes(termo) ||
        r.tipo?.toLowerCase().includes(termo) ||
        r.tipo_registro?.toLowerCase().includes(termo);

      return matchesStatus && matchesSearch;
    });
  }, [registros, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: registros.length,
      aguardandoNota: registros.filter(r => r.status_calculado === 'Aguardando Nota').length,
      aguardandoPublicacao: registros.filter(r => r.status_calculado === 'Aguardando Publicação').length,
      publicados: registros.filter(r => r.status_calculado === 'Publicado').length
    };
  }, [registros]);

  const handleUpdate = (id, data, tipo) => {
    updateMutation.mutate({ id, data, tipo });
  };

  const handleDelete = (id, tipo) => {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    // Registros de atestado não podem ser excluídos daqui
    if (tipo === 'atestado') {
      alert('Atestados não podem ser excluídos pelo Controle de Publicações. Acesse o módulo de Atestados.');
      return;
    }

    if (registro.status_calculado === 'Publicado') {
      // Apostila publicada de Apostila pode ser TSE — mas excluir não é permitido
      if (registro.tipo !== 'Apostila' && registro.tipo !== 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
      // TSE publicado: não pode excluir
      if (registro.tipo === 'Tornar sem Efeito') {
        alert('Publicações já publicadas não podem ser excluídas. Use Apostila ou Tornar sem Efeito.');
        return;
      }
    }

    // Proteção conservadora para evitar bagunça em cadeias de férias/livro
    if (
      registro.origem_tipo === 'livro' &&
      registro.tipo !== 'Apostila' &&
      registro.tipo !== 'Tornar sem Efeito' &&
      (
        registro.ferias_id ||
        registro.periodo_aquisitivo ||
        registro.tipo_registro === 'Saída Férias' ||
        registro.tipo_registro === 'Retorno Férias' ||
        registro.tipo_registro === 'Interrupção de Férias'
      )
    ) {
      alert(
        'Este registro de férias/livro não será excluído automaticamente por segurança. ' +
        'Pode haver movimentações posteriores dependentes dele, o que causaria inconsistência na cadeia.'
      );
      return;
    }

    deleteMutation.mutate({ id, tipo, registro });
  };

  const grupos = [
    {
      key: 'Aguardando Nota',
      label: 'Aguardando Nota',
      color: 'text-amber-700',
      border: 'border-amber-300',
      bg: 'bg-amber-50'
    },
    {
      key: 'Aguardando Publicação',
      label: 'Aguardando Publicação',
      color: 'text-blue-700',
      border: 'border-blue-300',
      bg: 'bg-blue-50'
    },
    {
      key: 'Publicado',
      label: 'Publicado',
      color: 'text-emerald-700',
      border: 'border-emerald-300',
      bg: 'bg-emerald-50'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Publicações</h1>
          <p className="text-slate-500">Controle de notas e boletins gerais</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.aguardandoNota}</p>
                  <p className="text-xs text-slate-500">Aguardando Nota</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.aguardandoPublicacao}</p>
                  <p className="text-xs text-slate-500">Aguardando Publ.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{stats.publicados}</p>
                  <p className="text-xs text-slate-500">Publicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por militar, matrícula, tipo, nota ou número do BG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-slate-200"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="Aguardando Nota">Aguardando Nota</SelectItem>
                <SelectItem value="Aguardando Publicação">Aguardando Publicação</SelectItem>
                <SelectItem value="Publicado">Publicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-500">
          {filteredRegistros.length} registro(s) encontrado(s)
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRegistros.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-slate-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Os registros de publicação aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grupos.map((grupo) => {
              const items = filteredRegistros.filter(r => r.status_calculado === grupo.key);
              if (items.length === 0) return null;

              return (
                <div key={grupo.key}>
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${grupo.border} ${grupo.bg}`}>
                    <span className={`font-bold text-sm ${grupo.color}`}>{grupo.label}</span>
                    <span className={`text-xs ${grupo.color} opacity-70`}>
                      — {items.length} registro(s)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {items.map((registro) => (
                       <PublicacaoCard
                         key={registro.id}
                         registro={registro}
                         onUpdate={handleUpdate}
                         onDelete={handleDelete}
                         onVerFamilia={() => setFamiliaPanel({ open: true, registro })}
                       />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Painel Família Publicação */}
      {familiaPanel.open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setFamiliaPanel({ open: false, registro: null })}
          />
          <FamiliaPublicacaoPanel
            registro={familiaPanel.registro}
            todosRegistros={registros}
            onClose={() => setFamiliaPanel({ open: false, registro: null })}
          />
        </>
      )}
    </div>
  );
}