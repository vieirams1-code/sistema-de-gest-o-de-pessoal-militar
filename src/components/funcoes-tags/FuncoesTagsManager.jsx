import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { getEscopoLabel } from '@/utils/funcoesTags/escopo';
import { INSTITUCIONAIS, validarFuncao, validarTag, validarTagGrupo } from '@/utils/funcoesTags/validacoes';
import {
  atualizarFuncaoMilitarEscopado,
  atualizarTagEscopado,
  atualizarTagGrupoEscopado,
  criarFuncaoMilitarEscopado,
  criarTagEscopado,
  criarTagGrupoEscopado,
  desativarFuncaoMilitarEscopado,
  desativarTagEscopado,
  desativarTagGrupoEscopado
} from '@/services/cudFuncoesTagsEscopadoClient';

export default function FuncoesTagsManager({ canEdit }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nomeFuncao, setNomeFuncao] = useState('');
  const [funcaoForm, setFuncaoForm] = useState({ nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' });
  const [funcaoEdicao, setFuncaoEdicao] = useState(null);
  const [grupoForm, setGrupoForm] = useState({ nome: '', aplicabilidade: 'ambos' });
  const [tagForm, setTagForm] = useState({ grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'destaque', cor: '#F59E0B' });

  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes-tags', 'funcoes'], queryFn: () => base44.entities.FuncaoMilitar.list('prioridade_lista') });
  const { data: grupos = [] } = useQuery({ queryKey: ['funcoes-tags', 'grupos'], queryFn: () => base44.entities.TagGrupo.list('ordem_exibicao') });
  const { data: tags = [] } = useQuery({ queryKey: ['funcoes-tags', 'tags'], queryFn: () => base44.entities.Tag.list('ordem_exibicao') });
  const gruposMap = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g])), [grupos]);

  const invalidateCatalogo = (tipo) => {
    queryClient.invalidateQueries({ queryKey: ['funcoes-tags', tipo] });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-institucionais'] });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-filtros'] });
    queryClient.invalidateQueries({ queryKey: ['militares-tags-filtros'] });
    queryClient.invalidateQueries({ queryKey: ['ferias-tags'] });
    queryClient.invalidateQueries({ queryKey: ['militar-funcao-institucional'] });
  };

  const saveFuncao = useMutation({ mutationFn: (payload) => funcaoEdicao ? atualizarFuncaoMilitarEscopado(funcaoEdicao.id, payload) : criarFuncaoMilitarEscopado(payload), onSuccess: () => { invalidateCatalogo('funcoes'); toast({ title: 'Função salva com sucesso.' }); }, onError: (error) => toast({ title: 'Erro ao salvar função', description: getErrorMessage(error, 'Tente novamente.'), variant: 'destructive' }) });
  const saveGrupo = useMutation({ mutationFn: (payload) => grupoForm.id ? atualizarTagGrupoEscopado(grupoForm.id, payload) : criarTagGrupoEscopado(payload), onSuccess: () => { invalidateCatalogo('grupos'); toast({ title: 'Grupo salvo com sucesso.' }); }, onError: (error) => toast({ title: 'Erro ao salvar grupo', description: getErrorMessage(error, 'Tente novamente.'), variant: 'destructive' }) });
  const saveTag = useMutation({ mutationFn: (payload) => tagForm.id ? atualizarTagEscopado(tagForm.id, payload) : criarTagEscopado(payload), onSuccess: () => { invalidateCatalogo('tags'); toast({ title: 'Tag salva com sucesso.' }); }, onError: (error) => toast({ title: 'Erro ao salvar tag', description: getErrorMessage(error, 'Tente novamente.'), variant: 'destructive' }) });

  const initInstitucional = useMutation({ mutationFn: async () => {
    const all = await base44.entities.FuncaoMilitar.list();
    const keys = new Set(all.map((f) => f.institucional_chave));
    let created = 0;
    if (!keys.has('comandante')) await criarFuncaoMilitarEscopado({ nome: 'Comandante', institucional_chave: 'comandante', prioridade_lista: 1, ativa: true, emoji: '🛡️', cor: '#1D4ED8' });
    if (!keys.has('comandante')) created += 1;
    if (!keys.has('subcomandante')) await criarFuncaoMilitarEscopado({ nome: 'Subcomandante', institucional_chave: 'subcomandante', prioridade_lista: 2, ativa: true, emoji: '🔰', cor: '#2563EB' });
    if (!keys.has('subcomandante')) created += 1;
    return { created };
  }, onSuccess: ({ created }) => { invalidateCatalogo('funcoes'); toast({ title: created > 0 ? 'Funções institucionais inicializadas.' : 'Funções institucionais já existem.' }); }, onError: (error) => toast({ title: 'Erro ao inicializar funções institucionais', description: getErrorMessage(error, 'Tente novamente.'), variant: 'destructive' }) });

  const upsertFuncao = () => {
    const bloqueada = funcaoEdicao && INSTITUCIONAIS[funcaoEdicao.institucional_chave];
    const payload = {
      ...funcaoForm,
      nome: funcaoForm.nome || nomeFuncao,
      ativa: true
    };

    if (bloqueada) {
      payload.institucional_chave = funcaoEdicao.institucional_chave;
      payload.prioridade_lista = INSTITUCIONAIS[funcaoEdicao.institucional_chave];
      payload.ativa = true;
    }

    const erro = validarFuncao(payload, funcoes, funcaoEdicao);
    if (erro) {
      toast({ title: erro, variant: 'destructive' });
      return;
    }

    saveFuncao.mutate(payload);
    setNomeFuncao('');
    setFuncaoForm({ nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' });
    setFuncaoEdicao(null);
  };

  const upsertGrupo = () => {
    const erro = validarTagGrupo(grupoForm, grupos, grupoForm.id ? grupoForm : null);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveGrupo.mutate({ ...grupoForm, ativo: true });
    setGrupoForm({ nome: '', aplicabilidade: 'ambos' });
  };

  const upsertTag = () => {
    const grupo = gruposMap[tagForm.grupo_id];
    if (grupo && grupo.aplicabilidade !== 'ambos' && grupo.aplicabilidade !== tagForm.aplicabilidade) {
      toast({ title: 'Aplicabilidade da tag deve seguir o grupo.', variant: 'destructive' });
      return;
    }
    const erro = validarTag(tagForm, tags, tagForm.id ? tagForm : null);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveTag.mutate({ ...tagForm, ativo: true });
    setTagForm({ grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'destaque', cor: '#F59E0B' });
  };

  const desativar = (tipo, row) => {
    if (tipo === 'funcao') {
      if (INSTITUCIONAIS[row.institucional_chave]) {
        toast({ title: 'Funções institucionais não podem ser desativadas.', variant: 'destructive' });
        return;
      }
      return desativarFuncaoMilitarEscopado(row.id, { ativa: false }).then(() => invalidateCatalogo('funcoes'));
    }
    if (tipo === 'grupo') return desativarTagGrupoEscopado(row.id, { ativo: false }).then(() => invalidateCatalogo('grupos'));
    return desativarTagEscopado(row.id, { ativo: false }).then(() => invalidateCatalogo('tags'));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#1e3a5f]">Configurações de Funções e Tags</h2>
        <Button onClick={() => initInstitucional.mutate()} disabled={!canEdit || initInstitucional.isPending}>{initInstitucional.isPending ? 'Inicializando...' : 'Inicializar funções institucionais'}</Button>
      </div>
      <Tabs defaultValue="funcoes">
        <TabsList>
          <TabsTrigger value="funcoes">Funções Militares</TabsTrigger>
          <TabsTrigger value="grupos">Grupos de Tags</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="funcoes" className="space-y-2">
          <div className="rounded-lg border border-slate-200 p-3 grid grid-cols-6 gap-2">
            <Label className="col-span-6 text-sm font-medium">Nova função</Label>
            <Input placeholder="Nome da função" value={funcaoForm.nome || nomeFuncao} onChange={(e) => { setNomeFuncao(e.target.value); setFuncaoForm({ ...funcaoForm, nome: e.target.value }); }} className="col-span-2" />
            <Input type="number" placeholder="Prioridade" value={funcaoForm.prioridade_lista} onChange={(e) => setFuncaoForm({ ...funcaoForm, prioridade_lista: Number(e.target.value) })} />
            <Input placeholder="Emoji" value={funcaoForm.emoji} onChange={(e) => setFuncaoForm({ ...funcaoForm, emoji: e.target.value })} />
            <Input placeholder="Cor" value={funcaoForm.cor} onChange={(e) => setFuncaoForm({ ...funcaoForm, cor: e.target.value })} />
            <Button disabled={!canEdit || saveFuncao.isPending} onClick={upsertFuncao}>{saveFuncao.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
          <div className="text-sm text-slate-600 border rounded p-2">Preview: <span className="font-medium" style={{ color: funcaoForm.cor }}>{funcaoForm.emoji || '⭐'} {funcaoForm.nome || 'Nova função'}</span> · Aplicabilidade: {funcaoForm.aplicabilidade}</div>
          {funcoes.map((f) => <div key={f.id} className="flex justify-between border p-2 rounded"><span>{f.emoji} {f.nome} ({f.ativa ? 'ativo' : 'inativo'}) · Escopo: {getEscopoLabel(f.escopo_tipo)} · Cor: {f.cor || '—'}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setFuncaoEdicao(f); setFuncaoForm({ ...f, prioridade_lista: f.prioridade_lista ?? 10, emoji: f.emoji || '⭐', cor: f.cor || '#1D4ED8' }); }}>Editar</Button><Button size="sm" variant="destructive" disabled={!!INSTITUCIONAIS[f.institucional_chave]} onClick={() => desativar('funcao', f)}>Desativar</Button></div></div>)}
        </TabsContent>
        <TabsContent value="grupos" className="space-y-2">
          <div className="rounded-lg border border-slate-200 p-3 grid grid-cols-3 gap-2"><Label className="col-span-3 text-sm font-medium">Novo grupo de tags</Label><Input placeholder="Nome grupo" value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} /><Input placeholder="Aplicabilidade" value={grupoForm.aplicabilidade} onChange={(e) => setGrupoForm({ ...grupoForm, aplicabilidade: e.target.value })} /><Button disabled={!canEdit || saveGrupo.isPending} onClick={upsertGrupo}>{saveGrupo.isPending ? 'Salvando...' : 'Salvar'}</Button></div>
          <div className="text-sm text-slate-600 border rounded p-2">Preview: ⚠️ {grupoForm.nome || 'Novo grupo'} · Aplicabilidade: {grupoForm.aplicabilidade}</div>
          {grupos.map((g) => <div key={g.id} className="flex justify-between border p-2 rounded"><span>{g.nome} ({g.ativo ? 'ativo' : 'inativo'}) · Escopo: {getEscopoLabel(g.escopo_tipo)}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setGrupoForm(g)}>Editar</Button><Button size="sm" variant="destructive" onClick={() => desativar('grupo', g)}>Desativar</Button></div></div>)}
        </TabsContent>
        <TabsContent value="tags" className="space-y-2">
          <div className="rounded-lg border border-slate-200 p-3 grid grid-cols-6 gap-2"><Label className="col-span-6 text-sm font-medium">Nova tag</Label><select className="border rounded px-2" value={tagForm.grupo_id} onChange={(e) => setTagForm({ ...tagForm, grupo_id: e.target.value })}><option value="">Sem grupo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select><Input placeholder="Nome tag" value={tagForm.nome} onChange={(e) => setTagForm({ ...tagForm, nome: e.target.value })} /><Input placeholder="Aplicabilidade" value={tagForm.aplicabilidade} onChange={(e) => setTagForm({ ...tagForm, aplicabilidade: e.target.value })} /><Input placeholder="Emoji" value={tagForm.emoji} onChange={(e) => setTagForm({ ...tagForm, emoji: e.target.value })} /><Input placeholder="Tipo visual" value={tagForm.tipo_visual} onChange={(e) => setTagForm({ ...tagForm, tipo_visual: e.target.value })} /><Button disabled={!canEdit || saveTag.isPending} onClick={upsertTag}>{saveTag.isPending ? 'Salvando...' : 'Salvar'}</Button></div>
          <div className="text-sm text-slate-600 border rounded p-2">Preview: <span style={{ color: tagForm.cor }}>{tagForm.emoji || '⚠️'} {tagForm.nome || 'Nova tag'}</span> · {tagForm.tipo_visual} · Aplicabilidade: {tagForm.aplicabilidade}</div>
          {tags.map((t) => <div key={t.id} className="flex justify-between border p-2 rounded"><span>{t.emoji || '⚠️'} {t.nome} ({t.ativo ? 'ativo' : 'inativo'}) · {t.tipo_visual || 'padrão'} · Cor: {t.cor || '—'} · Escopo: {getEscopoLabel(t.escopo_tipo)}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setTagForm({ ...t, grupo_id: t.tag_grupo_id || '' })}>Editar</Button><Button size="sm" variant="destructive" onClick={() => desativar('tag', t)}>Desativar</Button></div></div>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
  const getErrorMessage = (error, fallback) => error?.message || error?.response?.data?.error || fallback;
