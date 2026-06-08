import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { criarEscopado, atualizarEscopado } from '@/services/cudEscopadoClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import { useToast } from '@/components/ui/use-toast';
import { funcoesTagsKeys } from '@/utils/funcoesTags/queryKeys';
import { separarTagsPorStatus, validarAplicabilidadeTagMilitar, validarDuplicidadeTagAtiva } from '@/utils/funcoesTags/militarTags';
import { resolveTagVisual } from '@/utils/tags/tagPresenter';

const formatDate = (date) => {
  if (!date) return '—';
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
};

function TagItem({ vinculo, removivel, onRemover, loading }) {
  const tag = vinculo.tag || {};
  const grupo = vinculo.grupo || null;
  const cor = tag.cor || '#1e3a5f';

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge style={{ backgroundColor: `${cor}22`, color: cor, borderColor: `${cor}55` }} className="border inline-flex items-center gap-1">
            <IconeCatalogo value={resolveTagVisual(tag).emoji} /> {resolveTagVisual(tag).nome || 'Tag sem nome'}
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

export default function TagsMilitarSection({ militar }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    tag_id: '',
    data_aplicacao: new Date().toISOString().split('T')[0],
    motivo: ''
  });
  const [tagBusca, setTagBusca] = React.useState('');

  const { data: tagsCatalogo = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo('local', 'tags'),
    queryFn: () => base44.entities.Tag.list('nome')
  });

  const { data: gruposCatalogo = [] } = useQuery({
    queryKey: funcoesTagsKeys.catalogo('local', 'grupos'),
    queryFn: () => base44.entities.TagGrupo.list('nome')
  });

  const { data: vinculos = [] } = useQuery({
    queryKey: funcoesTagsKeys.militarTags('local', militar.id),
    queryFn: async () => {
      const items = await base44.entities.MilitarTag.filter({ militar_id: militar.id }, '-created_date');
      const mapaTags = new Map(tagsCatalogo.map((tag) => [tag.id, tag]));
      const mapaGrupos = new Map(gruposCatalogo.map((grupo) => [grupo.id, grupo]));
      return items.map((item) => {
        const tag = mapaTags.get(item.tag_id) || null;
        return {
          ...item,
          tag,
          grupo: tag?.tag_grupo_id ? mapaGrupos.get(tag.tag_grupo_id) || null : null
        };
      });
    },
    enabled: !!militar?.id
  });

  const { ativas, removidas } = React.useMemo(() => separarTagsPorStatus(vinculos), [vinculos]);

  const tagsAtivasAplicaveis = tagsCatalogo.filter((tag) => {
    const ativa = typeof tag.ativo === 'boolean' ? tag.ativo : String(tag.status || '').toLowerCase() === 'ativa';
    if (!ativa) return false;
    return !validarAplicabilidadeTagMilitar(tag);
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: funcoesTagsKeys.militarTags('local', militar.id) });
    queryClient.invalidateQueries({ queryKey: ['militares-tags-filtros'] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const tag = tagsCatalogo.find((item) => item.id === form.tag_id);
      const ativa = tag && (typeof tag.ativo === 'boolean' ? tag.ativo : String(tag.status || '').toLowerCase() === 'ativa');
      if (!tag || !ativa) {
        throw new Error('Selecione uma tag ativa.');
      }
      const erroAplicabilidade = validarAplicabilidadeTagMilitar(tag);
      if (erroAplicabilidade) throw new Error(erroAplicabilidade);

      const erroDuplicidade = validarDuplicidadeTagAtiva({ vinculosAtivos: ativas, tagId: form.tag_id });
      if (erroDuplicidade) throw new Error(erroDuplicidade);

      await criarEscopado('MilitarTag', {
        militar_id: militar.id,
        tag_id: form.tag_id,
        status: 'ativa',
        data_aplicacao: form.data_aplicacao,
        motivo: form.motivo || null
      });
      // TODO: migrar CUD para endpoint escopado no backend quando disponível.
    },
    onSuccess: () => {
      toast({ title: 'Tag adicionada com sucesso.' });
      setShowForm(false);
      setForm({ tag_id: '', data_aplicacao: new Date().toISOString().split('T')[0], motivo: '' });
      invalidate();
    },
    onError: (error) => toast({ title: 'Erro ao adicionar tag', description: error.message, variant: 'destructive' })
  });

  const removeMutation = useMutation({
    mutationFn: async ({ vinculo, motivo }) => atualizarEscopado('MilitarTag', vinculo.id, {
      status: 'removida',
      data_remocao: new Date().toISOString().split('T')[0],
      motivo: motivo || vinculo.motivo || null
    }),
    onSuccess: () => { toast({ title: 'Tag removida com sucesso.' }); invalidate(); },
    onError: (error) => toast({ title: 'Erro ao remover tag', description: error.message, variant: 'destructive' })
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-[#1e3a5f]">Tags do militar</CardTitle>
        <Button size="sm" onClick={() => setShowForm((old) => !old)}>{showForm ? 'Cancelar' : 'Adicionar tag'}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && <div className="rounded-lg border p-3 grid md:grid-cols-2 gap-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Tag ativa</Label>
            <Input placeholder="Buscar tag..." value={tagBusca} onChange={(e) => setTagBusca(e.target.value)} />
            <select className="w-full border rounded-md h-9 px-2" value={form.tag_id} onChange={(e) => setForm((old) => ({ ...old, tag_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {tagsAtivasAplicaveis.filter((tag) => String(tag.nome || '').toLowerCase().includes(tagBusca.toLowerCase())).map((tag) => {
                const grupo = gruposCatalogo.find((item) => item.id === tag.tag_grupo_id);
                return <option key={tag.id} value={tag.id}>{resolveTagVisual(tag).nome} {grupo ? `· ${grupo.nome}` : ''}</option>;
              })}
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
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.tag_id || !form.data_aplicacao}>Salvar tag</Button>
          </div>
        </div>}

        <div className="space-y-3">
          <h4 className="font-medium text-slate-700">Tags ativas</h4>
          {ativas.length === 0 ? <div className="rounded-lg border border-dashed p-4"><p className="text-sm text-slate-500">Este militar ainda não possui tags.</p><Button size="sm" className="mt-2" onClick={() => setShowForm(true)}>Adicionar tag</Button></div> : ativas.map((vinculo) => <TagItem key={vinculo.id} vinculo={vinculo} removivel onRemover={(item) => {
            const motivo = window.prompt('Motivo da remoção (opcional):', item.motivo || '');
            removeMutation.mutate({ vinculo: item, motivo: motivo || '' });
          }} loading={removeMutation.isPending} />)}
        </div>

        <div className="space-y-3 border-t pt-3">
          <h4 className="font-medium text-slate-700">Histórico / removidas</h4>
          {removidas.length === 0 ? <p className="text-sm text-slate-500">Sem histórico de tags removidas.</p> : removidas.map((vinculo) => <TagItem key={vinculo.id} vinculo={vinculo} removivel={false} />)}
        </div>
      </CardContent>
    </Card>
  );
}
