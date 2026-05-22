import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { criarFeriasTagEscopado, removerFeriasTagEscopado } from '@/services/cudFuncoesTagsEscopadoClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import {
  separarTagsFeriasPorStatus,
  validarAplicabilidadeTagFerias,
  validarDuplicidadeTagAtivaFerias,
} from '@/utils/funcoesTags/feriasTags';

const formatDate = (date) => {
  if (!date) return '—';
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

function TagVinculoItem({ vinculo, removivel, onRemover, loading }) {
  const tag = vinculo.tag || {};
  const grupo = vinculo.grupo || null;
  const cor = tag.cor || '#1e3a5f';

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge style={{ backgroundColor: `${cor}22`, color: cor, borderColor: `${cor}55` }} className="border">
            {(tag.emoji || '🏷️')} {tag.nome || 'Tag sem nome'}
          </Badge>
          <Badge variant="outline">{vinculo.status || '—'}</Badge>
          {grupo && <Badge variant="outline">Grupo: {grupo.nome}</Badge>}
        </div>
        {removivel && <Button size="sm" variant="ghost" disabled={loading} onClick={() => onRemover(vinculo)}>Remover</Button>}
      </div>
      <div className="text-xs text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-y-1">
        <p><strong>Aplicabilidade:</strong> {tag.aplicabilidade || '—'}</p>
        <p><strong>Tipo visual:</strong> {tag.tipo_visual || '—'}</p>
        <p><strong>Data de aplicação:</strong> {formatDate(vinculo.data_aplicacao)}</p>
        <p><strong>Data de remoção:</strong> {formatDate(vinculo.data_remocao)}</p>
        {vinculo.motivo && <p className="md:col-span-2"><strong>Motivo:</strong> {vinculo.motivo}</p>}
      </div>
    </div>
  );
}

export default function FeriasTagsSection({ ferias }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    tag_id: '',
    data_aplicacao: new Date().toISOString().split('T')[0],
    motivo: '',
  });

  const { data: tagsCatalogo = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo('local', 'tags'),
    queryFn: () => base44.entities.Tag.list('nome'),
  });

  const { data: gruposCatalogo = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo('local', 'grupos'),
    queryFn: () => base44.entities.TagGrupo.list('nome'),
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: funcoesTagsKeys.feriasTags('local', ferias.id),
    queryFn: async () => {
      const items = await base44.entities.FeriasTag.filter({ ferias_id: ferias.id }, '-created_date');
      const mapaTags = new Map(tagsCatalogo.map((tag) => [tag.id, tag]));
      const mapaGrupos = new Map(gruposCatalogo.map((grupo) => [grupo.id, grupo]));
      return items.map((item) => {
        const tag = mapaTags.get(item.tag_id) || null;
        return {
          ...item,
          tag,
          grupo: tag?.tag_grupo_id ? mapaGrupos.get(tag.tag_grupo_id) || null : null,
        };
      });
    },
    enabled: !!ferias?.id,
  });

  const { ativas, removidas } = React.useMemo(() => separarTagsFeriasPorStatus(vinculos), [vinculos]);

  const tagsAtivasAplicaveis = tagsCatalogo.filter((tag) => {
    if (String(tag.status || '').toLowerCase() !== 'ativa') return false;
    return !validarAplicabilidadeTagFerias(tag);
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.feriasTags('local', ferias.id) });
    queryClient.invalidateQueries({ queryKey: ['ferias-tags'] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const tag = tagsCatalogo.find((item) => item.id === form.tag_id);
      if (!tag || String(tag.status || '').toLowerCase() !== 'ativa') {
        throw new Error('Selecione uma tag ativa.');
      }
      const erroAplicabilidade = validarAplicabilidadeTagFerias(tag);
      if (erroAplicabilidade) throw new Error(erroAplicabilidade);

      const erroDuplicidade = validarDuplicidadeTagAtivaFerias({ vinculosAtivos: ativas, tagId: form.tag_id });
      if (erroDuplicidade) throw new Error(erroDuplicidade);

      await criarFeriasTagEscopado({
        ferias_id: ferias.id,
        tag_id: form.tag_id,
        status: 'ativa',
        data_aplicacao: form.data_aplicacao,
        motivo: form.motivo || null,
      });
      // TODO: migrar CUD para endpoint escopado no backend quando disponível.
    },
    onSuccess: () => {
      toast({ title: 'Tag adicionada com sucesso.' });
      setShowForm(false);
      setForm({ tag_id: '', data_aplicacao: new Date().toISOString().split('T')[0], motivo: '' });
      invalidate();
    },
    onError: (error) => toast({ title: 'Erro ao adicionar tag', description: error.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ vinculo, motivo }) => removerFeriasTagEscopado(vinculo.id, {
      status: 'removida',
      data_remocao: new Date().toISOString().split('T')[0],
      motivo: motivo || vinculo.motivo || null,
    }),
    onSuccess: () => { toast({ title: 'Tag removida com sucesso.' }); invalidate(); },
    onError: (error) => toast({ title: 'Erro ao remover tag', description: error.message, variant: 'destructive' }),
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Tags das férias</h4>
        <Button size="sm" type="button" onClick={() => setShowForm((old) => !old)}>{showForm ? 'Cancelar' : 'Adicionar tag'}</Button>
      </div>

      {showForm && <div className="rounded-lg border p-3 grid md:grid-cols-2 gap-3">
        <div className="space-y-2 md:col-span-2">
          <Label>Tag ativa</Label>
          <select className="w-full border rounded-md h-9 px-2" value={form.tag_id} onChange={(e) => setForm((old) => ({ ...old, tag_id: e.target.value }))}>
            <option value="">Selecione...</option>
            {tagsAtivasAplicaveis.map((tag) => <option key={tag.id} value={tag.id}>{tag.emoji || '🏷️'} {tag.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Data de aplicação</Label>
          <Input type="date" value={form.data_aplicacao} onChange={(e) => setForm((old) => ({ ...old, data_aplicacao: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Input value={form.motivo} onChange={(e) => setForm((old) => ({ ...old, motivo: e.target.value }))} placeholder="Ex.: necessidade operacional" />
        </div>
        <div className="md:col-span-2">
          <Button size="sm" type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.tag_id || !form.data_aplicacao}>Salvar tag</Button>
        </div>
      </div>}

      <div className="space-y-3">
        <h5 className="font-medium text-slate-700">Tags ativas</h5>
        {ativas.length === 0 ? <p className="text-sm text-slate-500">Nenhuma tag ativa.</p> : ativas.map((vinculo) => <TagVinculoItem key={vinculo.id} vinculo={vinculo} removivel onRemover={(item) => {
          const motivo = window.prompt('Motivo da remoção (opcional):', item.motivo || '');
          removeMutation.mutate({ vinculo: item, motivo: motivo || '' });
        }} loading={removeMutation.isPending} />)}
      </div>

      <div className="space-y-3 border-t pt-3">
        <h5 className="font-medium text-slate-700">Histórico / removidas</h5>
        {removidas.length === 0 ? <p className="text-sm text-slate-500">Sem histórico de tags removidas.</p> : removidas.map((vinculo) => <TagVinculoItem key={vinculo.id} vinculo={vinculo} removivel={false} />)}
      </div>
    </div>
  );
}
