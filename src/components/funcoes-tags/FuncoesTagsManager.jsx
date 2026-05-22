import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Search } from 'lucide-react';
import { normalizarAplicabilidade } from '@/utils/funcoesTags/normalizacao';
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
  desativarTagGrupoEscopado,
} from '@/services/cudFuncoesTagsEscopadoClient';

const APLICABILIDADE_OPTIONS = [
  { value: 'militar', label: 'Militar' },
  { value: 'ferias', label: 'Férias' },
  { value: 'ambos', label: 'Ambos' },
];

const EMOJIS_OPERACIONAIS = {
  Operacionais: ['🚒', '🚑', '🚗', '🧗'],
  Gestão: ['⚠️', '⭐', '🛡️', '🔰'],
  Gerais: ['📌', '📋', '📍', '🧭'],
};

export default function FuncoesTagsManager({ canEdit, initialTab = 'funcoes' }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState({ funcoes: '', grupos: '', tags: '' });

  const [funcaoForm, setFuncaoForm] = useState({ nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' });
  const [funcaoEdicao, setFuncaoEdicao] = useState(null);
  const [grupoForm, setGrupoForm] = useState({ nome: '', aplicabilidade: 'ambos' });
  const [grupoEdicao, setGrupoEdicao] = useState(null);
  const [tagForm, setTagForm] = useState({ grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'destaque', cor: '#F59E0B' });
  const [tagEdicao, setTagEdicao] = useState(null);

  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes-tags', 'funcoes'], queryFn: () => base44.entities.FuncaoMilitar.list('prioridade_lista') });
  const { data: grupos = [] } = useQuery({ queryKey: ['funcoes-tags', 'grupos'], queryFn: () => base44.entities.TagGrupo.list('ordem_exibicao') });
  const { data: tags = [] } = useQuery({ queryKey: ['funcoes-tags', 'tags'], queryFn: () => base44.entities.Tag.list('ordem_exibicao') });

  const gruposMap = useMemo(() => Object.fromEntries(grupos.map((g) => [g.id, g])), [grupos]);

  const filtrarPorNome = (arr, termo) => arr.filter((item) => (item?.nome || '').toLowerCase().includes(termo.toLowerCase()));

  const funcoesFiltradas = useMemo(() => filtrarPorNome(funcoes, search.funcoes), [funcoes, search.funcoes]);
  const gruposFiltrados = useMemo(() => filtrarPorNome(grupos, search.grupos), [grupos, search.grupos]);
  const tagsFiltradas = useMemo(() => filtrarPorNome(tags, search.tags), [tags, search.tags]);

  const invalidateCatalogo = (tipo) => {
    queryClient.invalidateQueries({ queryKey: ['funcoes-tags', tipo] });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-institucionais'] });
    queryClient.invalidateQueries({ queryKey: ['militares-funcoes-filtros'] });
    queryClient.invalidateQueries({ queryKey: ['militares-tags-filtros'] });
  };

  const saveFuncao = useMutation({ mutationFn: (payload) => funcaoEdicao ? atualizarFuncaoMilitarEscopado(funcaoEdicao.id, payload) : criarFuncaoMilitarEscopado(payload), onSuccess: () => { invalidateCatalogo('funcoes'); toast({ title: 'Função salva com sucesso.' }); } });
  const saveGrupo = useMutation({ mutationFn: (payload) => grupoEdicao ? atualizarTagGrupoEscopado(grupoEdicao.id, payload) : criarTagGrupoEscopado(payload), onSuccess: () => { invalidateCatalogo('grupos'); toast({ title: 'Grupo salvo com sucesso.' }); } });
  const saveTag = useMutation({ mutationFn: (payload) => tagEdicao ? atualizarTagEscopado(tagEdicao.id, payload) : criarTagEscopado(payload), onSuccess: () => { invalidateCatalogo('tags'); toast({ title: 'Tag salva com sucesso.' }); } });

  const upsertFuncao = () => {
    const payload = { ...funcaoForm, ativa: true };
    const erro = validarFuncao(payload, funcoes, funcaoEdicao);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveFuncao.mutate(payload);
    setFuncaoForm({ nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' });
    setFuncaoEdicao(null);
  };

  const upsertGrupo = () => {
    const aplicabilidade = normalizarAplicabilidade(grupoForm.aplicabilidade);
    const payload = { ...grupoForm, aplicabilidade, ativo: true };
    const erro = validarTagGrupo(payload, grupos, grupoEdicao);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveGrupo.mutate(payload);
    setGrupoForm({ nome: '', aplicabilidade: 'ambos' });
    setGrupoEdicao(null);
  };

  const upsertTag = () => {
    const aplicabilidade = normalizarAplicabilidade(tagForm.aplicabilidade);
    const payload = { ...tagForm, aplicabilidade, ativo: true };
    const erro = validarTag(payload, tags, tagEdicao);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveTag.mutate(payload);
    setTagForm({ grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'destaque', cor: '#F59E0B' });
    setTagEdicao(null);
  };

  const toggleAtivo = (tipo, row) => {
    if (tipo === 'funcao') {
      if (INSTITUCIONAIS[row.institucional_chave]) return;
      return desativarFuncaoMilitarEscopado(row.id, { ativa: !row.ativa }).then(() => invalidateCatalogo('funcoes'));
    }
    if (tipo === 'grupo') return desativarTagGrupoEscopado(row.id, { ativo: !row.ativo }).then(() => invalidateCatalogo('grupos'));
    return desativarTagEscopado(row.id, { ativo: !row.ativo }).then(() => invalidateCatalogo('tags'));
  };

  const renderBadge = (ativo) => <Badge variant={ativo ? 'default' : 'secondary'}>{ativo ? 'Ativo' : 'Inativo'}</Badge>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-[#1e3a5f]">Funções e Tags</h2>
        <p className="text-sm text-slate-500">Gerencie funções militares, grupos de tags e tags operacionais com visualização rápida.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="funcoes">Funções Militares</TabsTrigger>
          <TabsTrigger value="grupos">Grupos de Tags</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="funcoes" className="space-y-4">
          <EditorCard title={funcaoEdicao ? `Editando função: ${funcaoEdicao.nome}` : 'Nova função'} onCancel={() => { setFuncaoEdicao(null); setFuncaoForm({ nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' }); }} editing={!!funcaoEdicao}>
            <div className="grid md:grid-cols-6 gap-2">
              <Input className="md:col-span-2" placeholder="Nome da função" value={funcaoForm.nome} onChange={(e) => setFuncaoForm({ ...funcaoForm, nome: e.target.value })} />
              <Input type="number" placeholder="Prioridade na lista" value={funcaoForm.prioridade_lista} onChange={(e) => setFuncaoForm({ ...funcaoForm, prioridade_lista: Number(e.target.value) })} />
              <EmojiPicker value={funcaoForm.emoji} onChange={(emoji) => setFuncaoForm({ ...funcaoForm, emoji })} />
              <Input placeholder="Cor" value={funcaoForm.cor} onChange={(e) => setFuncaoForm({ ...funcaoForm, cor: e.target.value })} />
              <Button disabled={!canEdit} onClick={upsertFuncao}>{funcaoEdicao ? 'Salvar edição' : 'Salvar'}</Button>
            </div>
          </EditorCard>
          <SearchBox value={search.funcoes} onChange={(v) => setSearch((prev) => ({ ...prev, funcoes: v }))} />
          <div className="space-y-2">{funcoesFiltradas.map((f) => <ListRow key={f.id} title={`${f.emoji || '⭐'} ${f.nome}`} subtitle={`Prioridade na lista: ${f.prioridade_lista ?? '—'}`} badge={renderBadge(f.ativa)} onEdit={() => { setFuncaoEdicao(f); setFuncaoForm({ ...f, prioridade_lista: f.prioridade_lista ?? 10, emoji: f.emoji || '⭐', cor: f.cor || '#1D4ED8' }); }} onToggle={() => toggleAtivo('funcao', f)} toggleLabel={f.ativa ? 'Desativar' : 'Reativar'} />)}</div>
        </TabsContent>

        <TabsContent value="grupos" className="space-y-4">
          <EditorCard title={grupoEdicao ? `Editando grupo: ${grupoEdicao.nome}` : 'Novo grupo de tags'} editing={!!grupoEdicao} onCancel={() => { setGrupoEdicao(null); setGrupoForm({ nome: '', aplicabilidade: 'ambos' }); }}>
            <div className="grid md:grid-cols-3 gap-2">
              <Input placeholder="Nome do grupo" value={grupoForm.nome} onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })} />
              <select className="border rounded px-3" value={grupoForm.aplicabilidade} onChange={(e) => setGrupoForm({ ...grupoForm, aplicabilidade: e.target.value })}>{APLICABILIDADE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
              <Button disabled={!canEdit} onClick={upsertGrupo}>{grupoEdicao ? 'Salvar edição' : 'Salvar'}</Button>
            </div>
          </EditorCard>
          <SearchBox value={search.grupos} onChange={(v) => setSearch((prev) => ({ ...prev, grupos: v }))} />
          <div className="space-y-2">{gruposFiltradas.map((g) => <ListRow key={g.id} title={g.nome} subtitle={`Aplicabilidade: ${labelAplicabilidade(g.aplicabilidade)}`} badge={renderBadge(g.ativo)} onEdit={() => { setGrupoEdicao(g); setGrupoForm({ nome: g.nome, aplicabilidade: g.aplicabilidade || 'ambos' }); }} onToggle={() => toggleAtivo('grupo', g)} toggleLabel={g.ativo ? 'Desativar' : 'Reativar'} />)}</div>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <EditorCard title={tagEdicao ? `Editando tag: ${tagEdicao.nome}` : 'Nova tag'} editing={!!tagEdicao} onCancel={() => { setTagEdicao(null); setTagForm({ grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'destaque', cor: '#F59E0B' }); }}>
            <div className="grid md:grid-cols-6 gap-2">
              <select className="border rounded px-3" value={tagForm.grupo_id} onChange={(e) => setTagForm({ ...tagForm, grupo_id: e.target.value })}><option value="">Sem grupo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select>
              <Input placeholder="Nome da tag" value={tagForm.nome} onChange={(e) => setTagForm({ ...tagForm, nome: e.target.value })} />
              <select className="border rounded px-3" value={tagForm.aplicabilidade} onChange={(e) => setTagForm({ ...tagForm, aplicabilidade: e.target.value })}>{APLICABILIDADE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
              <EmojiPicker value={tagForm.emoji} onChange={(emoji) => setTagForm({ ...tagForm, emoji })} />
              <Input placeholder="Tipo visual" value={tagForm.tipo_visual} onChange={(e) => setTagForm({ ...tagForm, tipo_visual: e.target.value })} />
              <Button disabled={!canEdit} onClick={upsertTag}>{tagEdicao ? 'Salvar edição' : 'Salvar'}</Button>
            </div>
          </EditorCard>
          <SearchBox value={search.tags} onChange={(v) => setSearch((prev) => ({ ...prev, tags: v }))} />
          <Card><CardHeader><CardTitle className="text-base">Tags por grupo</CardTitle></CardHeader><CardContent className="space-y-4">{[...grupos, { id: '__sem_grupo__', nome: 'Sem grupo' }].map((grupo) => {
            const groupTags = tagsFiltradas.filter((t) => (t.tag_grupo_id || '__sem_grupo__') === grupo.id);
            if (!groupTags.length) return null;
            return <div key={grupo.id} className="space-y-2"><h4 className="font-medium text-slate-700">{grupo.nome}</h4>{groupTags.map((t) => <ListRow key={t.id} title={`${t.emoji || '⚠️'} ${t.nome}`} subtitle={`Grupo da tag: ${gruposMap[t.tag_grupo_id]?.nome || 'Sem grupo'} · Aplicabilidade: ${labelAplicabilidade(t.aplicabilidade)}`} badge={renderBadge(t.ativo)} onEdit={() => { setTagEdicao(t); setTagForm({ ...t, grupo_id: t.tag_grupo_id || '' }); }} onToggle={() => toggleAtivo('tag', t)} toggleLabel={t.ativo ? 'Desativar' : 'Reativar'} />)}</div>;
          })}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditorCard({ title, children, editing, onCancel }) {
  return <Card className={editing ? 'border-blue-300 bg-blue-50/40' : ''}><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{title}</CardTitle>{editing && <Button variant="outline" size="sm" onClick={onCancel}>Cancelar edição</Button>}</div></CardHeader><CardContent className="space-y-2">{children}</CardContent></Card>;
}

function SearchBox({ value, onChange }) {
  return <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nome" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function EmojiPicker({ value, onChange }) {
  return <div className="border rounded p-2"><Label className="text-xs text-slate-500">Emoji</Label><div className="grid grid-cols-4 gap-1 mt-1">{Object.entries(EMOJIS_OPERACIONAIS).flatMap(([, emojis]) => emojis).map((emoji) => <button key={emoji} type="button" className={`h-8 rounded border ${value === emoji ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`} onClick={() => onChange(emoji)}>{emoji}</button>)}</div></div>;
}

function ListRow({ title, subtitle, badge, onEdit, onToggle, toggleLabel }) {
  return <div className="border rounded-lg p-3 bg-slate-50"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{title}</p><p className="text-sm text-slate-600">{subtitle}</p></div><div className="flex items-center gap-2">{badge}<Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button><Button variant="outline" size="sm" onClick={onToggle}>{toggleLabel}</Button></div></div></div>;
}

const labelAplicabilidade = (value) => {
  if (value === 'militar') return 'Militar';
  if (value === 'ferias') return 'Férias';
  return 'Ambos';
};
