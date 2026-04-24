import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import {
  STATUS_POSSIVEL_DUPLICIDADE,
  executarMergeManualMilitares,
  listarPendenciasPossivelDuplicidade,
  resolverPendenciaPossivelDuplicidade,
} from '@/services/militarIdentidadeService';

const statusLabel = {
  [STATUS_POSSIVEL_DUPLICIDADE.PENDENTE]: 'Pendente',
  [STATUS_POSSIVEL_DUPLICIDADE.CONFIRMADO_DUPLICADO]: 'Duplicado confirmado',
  [STATUS_POSSIVEL_DUPLICIDADE.DESCARTADO]: 'Descartado',
  [STATUS_POSSIVEL_DUPLICIDADE.MESCLADO]: 'Mesclado',
};

function parseJsonSafe(texto) {
  if (!texto || typeof texto !== 'string') return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

export default function RevisaoDuplicidadesMilitar() {
  const { user, isLoading: loadingUser, isAccessResolved, canAccessModule, canAccessAction } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState('');
  const [motivoMerge, setMotivoMerge] = useState('Saneamento manual após revisão humana de duplicidade.');
  const [origemId, setOrigemId] = useState('');
  const [destinoId, setDestinoId] = useState('');

  const { data: pendencias = [], isLoading } = useQuery({
    queryKey: ['possiveis-duplicidades-militar'],
    queryFn: () => listarPendenciasPossivelDuplicidade({ status: STATUS_POSSIVEL_DUPLICIDADE.PENDENTE }),
  });

  const selecionada = useMemo(() => pendencias.find((item) => item.id === selectedId) || null, [pendencias, selectedId]);

  const atualizarStatusMutation = useMutation({
    mutationFn: ({ pendenciaId, status }) => resolverPendenciaPossivelDuplicidade({ pendenciaId, status, resolvidoPor: user?.email || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['possiveis-duplicidades-militar'] }),
  });

  const mergeMutation = useMutation({
    mutationFn: () => executarMergeManualMilitares({
      militarOrigemId: origemId,
      militarDestinoId: destinoId,
      pendenciaId: selectedId,
      executadoPor: user?.email || '',
      motivo: motivoMerge,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['possiveis-duplicidades-militar'] });
      window.alert('Merge concluído com auditoria registrada.');
      setOrigemId('');
      setDestinoId('');
      setSelectedId('');
    },
  });

  if (!loadingUser && isAccessResolved && (!canAccessModule('migracao_alteracoes_legado') || !canAccessAction('revisar_duplicidades'))) {
    return <AccessDenied modulo="Revisão de Duplicidades (Admin)" />;
  }

  const snapshot = parseJsonSafe(selecionada?.snapshot_comparativo);
  const payloadNovoCadastro = parseJsonSafe(selecionada?.payload_novo_cadastro);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Revisão de Possíveis Duplicidades</h1>
          <p className="text-slate-500">Fila operacional para análise humana e merge manual auditável.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendências pendentes ({pendencias.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(isLoading || loadingUser) && <p className="text-sm text-slate-500">Carregando pendências...</p>}
          {!isLoading && pendencias.length === 0 && <p className="text-sm text-slate-500">Sem pendências abertas.</p>}

          {pendencias.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedId(item.id);
                setOrigemId(item.militar_candidato_id || '');
                setDestinoId(item.militar_existente_id || '');
              }}
              className={`w-full border rounded-lg p-3 text-left ${selectedId === item.id ? 'border-[#1e3a5f] bg-slate-50' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Pendência #{item.id}</p>
                  <p className="text-sm text-slate-600">{item.motivo || 'Sem motivo informado.'}</p>
                </div>
                <Badge>{statusLabel[item.status] || item.status}</Badge>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      {selecionada && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da pendência #{selecionada.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2 p-3 border rounded-lg">
                <p><strong>Militar existente:</strong> {selecionada.militar_existente_id || 'N/D'}</p>
                <p><strong>Militar candidato:</strong> {selecionada.militar_candidato_id || 'N/D'}</p>
                <p><strong>Nível de confiança:</strong> {selecionada.nivel_confianca ?? 'N/D'}</p>
                <p><strong>Criado por:</strong> {selecionada.criado_por || 'N/D'}</p>
              </div>
              <div className="space-y-2 p-3 border rounded-lg">
                <p className="font-semibold">Ações rápidas</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => atualizarStatusMutation.mutate({ pendenciaId: selecionada.id, status: STATUS_POSSIVEL_DUPLICIDADE.CONFIRMADO_DUPLICADO })}
                  >
                    Confirmar duplicado
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => atualizarStatusMutation.mutate({ pendenciaId: selecionada.id, status: STATUS_POSSIVEL_DUPLICIDADE.DESCARTADO })}
                  >
                    Descartar falso positivo
                  </Button>
                  {selecionada.militar_existente_id && (
                    <Button
                      variant="outline"
                      onClick={() => navigate(`${createPageUrl('VerMilitar')}?id=${selecionada.militar_existente_id}`)}
                    >
                      Abrir militar existente
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="font-semibold text-sm">Snapshot comparativo</p>
                <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 overflow-auto max-h-72">{JSON.stringify(snapshot, null, 2)}</pre>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-sm">Payload novo cadastro</p>
                <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-3 overflow-auto max-h-72">{JSON.stringify(payloadNovoCadastro, null, 2)}</pre>
              </div>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <p className="font-semibold">Merge manual auditável</p>
              <div className="grid md:grid-cols-2 gap-3">
                <Input value={origemId} onChange={(e) => setOrigemId(e.target.value)} placeholder="ID do militar origem (será mesclado)" />
                <Input value={destinoId} onChange={(e) => setDestinoId(e.target.value)} placeholder="ID do militar destino (registro preservado)" />
              </div>
              <Textarea value={motivoMerge} onChange={(e) => setMotivoMerge(e.target.value)} placeholder="Motivo do merge" />
              <Button
                onClick={() => mergeMutation.mutate()}
                disabled={!origemId || !destinoId || mergeMutation.isPending}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              >
                Executar merge manual
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
