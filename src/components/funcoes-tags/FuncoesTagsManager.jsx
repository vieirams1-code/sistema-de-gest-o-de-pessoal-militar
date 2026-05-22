import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const INSTITUCIONAIS = { comandante: 1, subcomandante: 2 };

export default function FuncoesTagsManager({ canEdit }) {
  const queryClient = useQueryClient();
  const [nomeFuncao, setNomeFuncao] = useState('');
  const [funcaoEdicao, setFuncaoEdicao] = useState(null);
  const [grupoForm, setGrupoForm] = useState({ nome: '', aplicabilidade: 'ambos' });
  const [tagForm, setTagForm] = useState({ grupo_id: '', nome: '', aplicabilidade: 'ambos' });

  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes-tags', 'funcoes'], queryFn: () => base44.entities.FuncaoMilitar.list('prioridade_lista') });
  const { data: grupos = [] } = useQuery({ queryKey: ['funcoes-tags', 'grupos'], queryFn: () => base44.entities.TagGrupo.list('ordem_exibicao') });
  const { data: tags = [] } = useQuery({ queryKey: ['funcoes-tags', 'tags'], queryFn: () => base44.entities.Tag.list('ordem_exibicao') });
  const gruposMap = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g])), [grupos]);

  const saveFuncao = useMutation({ mutationFn: (payload) => funcaoEdicao ? base44.entities.FuncaoMilitar.update(funcaoEdicao.id, payload) : base44.entities.FuncaoMilitar.create(payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'funcoes'] }) });
  const saveGrupo = useMutation({ mutationFn: (payload) => grupoForm.id ? base44.entities.TagGrupo.update(grupoForm.id, payload) : base44.entities.TagGrupo.create(payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'grupos'] }) });
  const saveTag = useMutation({ mutationFn: (payload) => tagForm.id ? base44.entities.Tag.update(tagForm.id, payload) : base44.entities.Tag.create(payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'tags'] }) });

  const initInstitucional = useMutation({ mutationFn: async () => {
    const all = await base44.entities.FuncaoMilitar.list();
    const keys = new Set(all.map((f) => f.institucional_chave));
    if (!keys.has('comandante')) await base44.entities.FuncaoMilitar.create({ nome: 'Comandante', institucional_chave: 'comandante', prioridade_lista: 1, ativa: true, emoji: '🛡️', cor: '#1D4ED8' });
    if (!keys.has('subcomandante')) await base44.entities.FuncaoMilitar.create({ nome: 'Subcomandante', institucional_chave: 'subcomandante', prioridade_lista: 2, ativa: true, emoji: '🔰', cor: '#2563EB' });
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'funcoes'] }) });

  const desativar = (tipo, row) => {
    if (tipo === 'funcao') {
      if (INSTITUCIONAIS[row.institucional_chave]) return;
      return base44.entities.FuncaoMilitar.update(row.id, { ativa: false }).then(() => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'funcoes'] }));
    }
    if (tipo === 'grupo') return base44.entities.TagGrupo.update(row.id, { ativo: false }).then(() => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'grupos'] }));
    return base44.entities.Tag.update(row.id, { ativo: false }).then(() => queryClient.invalidateQueries({ queryKey: ['funcoes-tags', 'tags'] }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#1e3a5f]">Funções e Tags</h2>
        <Button onClick={() => initInstitucional.mutate()} disabled={!canEdit}>Inicializar funções institucionais</Button>
      </div>
      <Tabs defaultValue="funcoes">
        <TabsList>
          <TabsTrigger value="funcoes">Funções Militares</TabsTrigger>
          <TabsTrigger value="grupos">Grupos de Tags</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="funcoes" className="space-y-2">
          <div className="flex gap-2"><Input placeholder="Nome da função" value={nomeFuncao} onChange={(e) => setNomeFuncao(e.target.value)} /><Button disabled={!canEdit} onClick={() => saveFuncao.mutate({ nome: nomeFuncao, prioridade_lista: 10, ativa: true })}>Novo</Button></div>
          {funcoes.map((f) => <div key={f.id} className="flex justify-between border p-2 rounded"><span>{f.emoji} {f.nome} ({f.ativa ? 'ativo' : 'inativo'})</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setFuncaoEdicao(f)}>Editar</Button><Button size="sm" variant="destructive" disabled={!!INSTITUCIONAIS[f.institucional_chave]} onClick={() => desativar('funcao', f)}>Desativar</Button></div></div>)}
        </TabsContent>
        <TabsContent value="grupos" className="space-y-2">
          <div className="grid grid-cols-3 gap-2"><Input placeholder="Nome grupo" value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} /><Input placeholder="Aplicabilidade" value={grupoForm.aplicabilidade} onChange={(e) => setGrupoForm({ ...grupoForm, aplicabilidade: e.target.value })} /><Button disabled={!canEdit} onClick={() => saveGrupo.mutate({ ...grupoForm, ativo: true })}>Novo</Button></div>
          {grupos.map((g) => <div key={g.id} className="flex justify-between border p-2 rounded"><span>{g.nome} ({g.ativo ? 'ativo' : 'inativo'})</span><Button size="sm" variant="destructive" onClick={() => desativar('grupo', g)}>Desativar</Button></div>)}
        </TabsContent>
        <TabsContent value="tags" className="space-y-2">
          <div className="grid grid-cols-4 gap-2"><select className="border rounded px-2" value={tagForm.grupo_id} onChange={(e) => setTagForm({ ...tagForm, grupo_id: e.target.value })}><option value="">Grupo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select><Input placeholder="Nome tag" value={tagForm.nome} onChange={(e) => setTagForm({ ...tagForm, nome: e.target.value })} /><Input placeholder="Aplicabilidade" value={tagForm.aplicabilidade} onChange={(e) => setTagForm({ ...tagForm, aplicabilidade: e.target.value })} /><Button disabled={!canEdit} onClick={() => { const grupo = gruposMap[tagForm.grupo_id]; if (!grupo) return; if (grupo.aplicabilidade !== 'ambos' && grupo.aplicabilidade !== tagForm.aplicabilidade) return; saveTag.mutate({ ...tagForm, ativo: true }); }}>Novo</Button></div>
          {tags.map((t) => <div key={t.id} className="flex justify-between border p-2 rounded"><span>{t.nome} ({t.ativo ? 'ativo' : 'inativo'})</span><Button size="sm" variant="destructive" onClick={() => desativar('tag', t)}>Desativar</Button></div>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
