import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Check, GitBranch, Network, Pencil, Plus, Search, Settings, Shield, Tags as TagsIcon, Trash2, X } from 'lucide-react';
import { normalizarAplicabilidade } from '@/utils/funcoesTags/normalizacao';
import { getTagGrupoId } from '@/utils/funcoesTags/contratoCampos';
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

const EMOJI_OPTIONS = [
  { value: '⭐', label: 'Destaque' }, { value: '🛡️', label: 'Comandante' }, { value: '🔰', label: 'Subcomandante' }, { value: '🚒', label: 'Bombeiro' },
  { value: '🚑', label: 'APH' }, { value: '🚗', label: 'Motorista' }, { value: '🚌', label: 'Condutor' }, { value: '🧗', label: 'Altura' },
  { value: '⚠️', label: 'Restrição' }, { value: '📻', label: 'Rádio' }, { value: '💻', label: 'TI' }, { value: '🛠️', label: 'Manutenção' },
  { value: '⚕️', label: 'Saúde' }, { value: '📋', label: 'Administrativo' }, { value: '📘', label: 'Instrutor' },
];
const APLICABILIDADES = [{ value: 'militar', label: 'Militar' }, { value: 'ferias', label: 'Férias' }, { value: 'ambos', label: 'Ambos' }];
const FORM_FUNCAO = { nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos' };
const FORM_GRUPO = { nome: '', aplicabilidade: 'ambos', emoji: '🚒', cor: '#0F766E' };
const FORM_TAG = { grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'chip', cor: '#F59E0B' };

export default function FuncoesTagsManager({ canEdit = true, initialTab = 'funcoes' }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [buscaFuncao, setBuscaFuncao] = useState('');
  const [buscaGrupo, setBuscaGrupo] = useState('');
  const [buscaTag, setBuscaTag] = useState('');
  const [formFuncao, setFormFuncao] = useState(FORM_FUNCAO);
  const [formGrupo, setFormGrupo] = useState(FORM_GRUPO);
  const [formTag, setFormTag] = useState(FORM_TAG);
  const [editandoFuncao, setEditandoFuncao] = useState(null);
  const [editandoGrupo, setEditandoGrupo] = useState(null);
  const [editandoTag, setEditandoTag] = useState(null);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const { data: funcoes = [] } = useQuery({ queryKey: ['funcoes-tags', 'funcoes'], queryFn: () => base44.entities.FuncaoMilitar.list('prioridade_lista') });
  const { data: grupos = [] } = useQuery({ queryKey: ['funcoes-tags', 'grupos'], queryFn: () => base44.entities.TagGrupo.list('ordem_exibicao') });
  const { data: tags = [] } = useQuery({ queryKey: ['funcoes-tags', 'tags'], queryFn: () => base44.entities.Tag.list('ordem_exibicao') });

  const gruposAtivos = useMemo(() => grupos.filter((g) => g.ativo !== false), [grupos]);
  const gruposPorId = useMemo(() => new Map(grupos.map((g) => [String(g.id), g])), [grupos]);
  const quantidadeTagsPorGrupo = useMemo(() => {
    const map = new Map();
    tags.forEach((tag) => { const grupoId = getTagGrupoId(tag) || 'sem-grupo'; map.set(grupoId, (map.get(grupoId) || 0) + 1); });
    return map;
  }, [tags]);

  const funcoesFiltradas = useMemo(() => filtrar(funcoes, buscaFuncao), [funcoes, buscaFuncao]);
  const gruposFiltrados = useMemo(() => filtrar(grupos, buscaGrupo), [grupos, buscaGrupo]);
  const tagsFiltradas = useMemo(() => filtrar(tags, buscaTag), [tags, buscaTag]);

  const invalidate = (key) => { queryClient.invalidateQueries({ queryKey: ['funcoes-tags', key] }); queryClient.invalidateQueries({ queryKey: ['militares-tags-filtros'] }); };
  const saveFuncao = useMutation({ mutationFn: (p) => editandoFuncao ? atualizarFuncaoMilitarEscopado(editandoFuncao.id, p) : criarFuncaoMilitarEscopado(p), onSuccess: () => { invalidate('funcoes'); toast({ title: 'Função salva com sucesso.' }); } });
  const saveGrupo = useMutation({ mutationFn: (p) => editandoGrupo ? atualizarTagGrupoEscopado(editandoGrupo.id, p) : criarTagGrupoEscopado(p), onSuccess: () => { invalidate('grupos'); toast({ title: 'Grupo salvo com sucesso.' }); } });
  const saveTag = useMutation({ mutationFn: (p) => editandoTag ? atualizarTagEscopado(editandoTag.id, p) : criarTagEscopado(p), onSuccess: () => { invalidate('tags'); toast({ title: 'Tag salva com sucesso.' }); } });

  const handleInicializarFuncoesBase = () => toast({ title: 'As funções base já são gerenciadas pelo catálogo atual.' });
  const cancelarEdicaoFuncao = () => { setEditandoFuncao(null); setFormFuncao(FORM_FUNCAO); };
  const cancelarEdicaoGrupo = () => { setEditandoGrupo(null); setFormGrupo(FORM_GRUPO); };
  const cancelarEdicaoTag = () => { setEditandoTag(null); setFormTag(FORM_TAG); };

  const salvarFuncao = () => { const payload = { ...formFuncao, ativa: true }; const erro = validarFuncao(payload, funcoes, editandoFuncao); if (erro) return toast({ title: erro, variant: 'destructive' }); saveFuncao.mutate(payload); cancelarEdicaoFuncao(); };
  const salvarGrupo = () => { const payload = { ...formGrupo, aplicabilidade: normalizarAplicabilidade(formGrupo.aplicabilidade), ativo: true }; const erro = validarTagGrupo(payload, grupos, editandoGrupo); if (erro) return toast({ title: erro, variant: 'destructive' }); saveGrupo.mutate(payload); cancelarEdicaoGrupo(); };
  const salvarTag = () => { const payload = { ...formTag, tipo_visual: formTag.tipo_visual || 'chip', aplicabilidade: normalizarAplicabilidade(formTag.aplicabilidade), ativo: true }; const erro = validarTag(payload, tags, editandoTag); if (erro) return toast({ title: erro, variant: 'destructive' }); saveTag.mutate(payload); cancelarEdicaoTag(); };

  const toggleFuncao = (f) => { if (INSTITUCIONAIS[f.institucional_chave]) return; desativarFuncaoMilitarEscopado(f.id, { ativa: !f.ativa }).then(() => invalidate('funcoes')); };
  const toggleGrupo = (g) => desativarTagGrupoEscopado(g.id, { ativo: !g.ativo }).then(() => invalidate('grupos'));
  const toggleTag = (t) => desativarTagEscopado(t.id, { ativo: !t.ativo }).then(() => invalidate('tags'));
  const excluirTag = async (tag) => {
    const confirmar = window.confirm(`Você está prestes a excluir a tag "${tag.nome}".\n\nImpacto: a tag deixará de existir no catálogo para novas aplicações.\n\nDeseja continuar?`);
    if (!confirmar) return;
    try {
      await base44.functions.invoke('cudFuncoesTagsEscopado', { entidade: 'Tag', operacao: 'delete', id: tag.id });
      invalidate('tags');
      toast({ title: 'Tag excluída com sucesso.' });
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('vínculo') || message.includes('vincul') || message.includes('constraint') || message.includes('foreign')) {
        toast({ title: 'Esta tag possui vínculos e não pode ser excluída. Desative-a para impedir novo uso.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Falha ao excluir tag. Caso possua vínculos, desative-a para impedir novo uso.', variant: 'destructive' });
    }
  };

  const excluirGrupo = async (grupo) => {
    const totalTags = quantidadeTagsPorGrupo.get(grupo.id) || 0;
    if (totalTags > 0) {
      toast({ title: 'Este grupo possui tags vinculadas. Remova ou mova as tags antes de excluir.', variant: 'destructive' });
      return;
    }
    const confirmar = window.confirm(`Você está prestes a excluir o grupo "${grupo.nome}".\n\nImpacto: o grupo deixará de existir no catálogo para novas aplicações.\n\nDeseja continuar?`);
    if (!confirmar) return;
    try {
      await base44.functions.invoke('cudFuncoesTagsEscopado', { entidade: 'TagGrupo', operacao: 'delete', id: grupo.id });
      invalidate('grupos');
      toast({ title: 'Grupo excluído com sucesso.' });
    } catch (error) {
      toast({ title: 'Este grupo possui tags vinculadas. Remova ou mova as tags antes de excluir.', variant: 'destructive' });
    }
  };

  return (<div className="max-w-6xl mx-auto space-y-6">
    <header className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><Settings className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold text-slate-900">Configurações de Funções e Tags</h1></div><p className="text-sm text-slate-500 mt-1">Gerencie a taxonomia militar, grupos de acesso e tags do sistema.</p></div><Button onClick={handleInicializarFuncoesBase} className="bg-slate-950 text-white hover:bg-slate-800"><GitBranch className="w-4 h-4 mr-2" />Inicializar funções base</Button></header>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1 inline-flex"><TabButton id="funcoes" icon={Shield} label="Funções Militares" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="grupos" icon={Network} label="Grupos de Tags" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="tags" icon={TagsIcon} label="Tags Individuais" activeTab={activeTab} setActiveTab={setActiveTab} /></div>
    {activeTab === 'funcoes' && <><FormCard title={editandoFuncao ? `Editando função: ${editandoFuncao.nome}` : 'Nova Função Militar'} isEditing={!!editandoFuncao} onCancel={cancelarEdicaoFuncao} preview={<PreviewBadge emoji={formFuncao.emoji} nome={formFuncao.nome || 'Nova função'} cor={formFuncao.cor} />}><div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"><Field label="Nome da função" className="md:col-span-4"><Input value={formFuncao.nome} onChange={(e) => setFormFuncao({ ...formFuncao, nome: e.target.value })} placeholder="Ex: Chefe de Seção" /></Field><Field label="Prioridade na lista" className="md:col-span-2"><Input type="number" value={formFuncao.prioridade_lista} onChange={(e) => setFormFuncao({ ...formFuncao, prioridade_lista: Number(e.target.value) })} placeholder="Ex: 10" /></Field><Field label="Ícone" className="md:col-span-2"><EmojiSelect value={formFuncao.emoji} onChange={(emoji) => setFormFuncao({ ...formFuncao, emoji })} /></Field><Field label="Cor de destaque" className="md:col-span-2"><ColorInput value={formFuncao.cor} onChange={(cor) => setFormFuncao({ ...formFuncao, cor })} /></Field><Button disabled={!canEdit} onClick={salvarFuncao} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700">{editandoFuncao ? 'Salvar Alterações' : 'Adicionar Função'}</Button></div></FormCard><ListCard title={`Funções Cadastradas (${funcoesFiltradas.length})`} search={buscaFuncao} setSearch={setBuscaFuncao} searchPlaceholder="Buscar função...">{funcoesFiltradas.map((funcao) => <div key={funcao.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold" style={{ borderColor: funcao.cor || '#CBD5E1', backgroundColor: `${funcao.cor || '#E2E8F0'}18`, color: funcao.cor || '#1E293B' }}>{funcao.emoji || '🏷️'} {funcao.nome}</span><span className="text-xs text-slate-500">Cor: {funcao.cor || '—'}</span><span className="text-xs text-slate-500">Escopo: Global</span><span className="text-xs text-slate-500">Prioridade: {funcao.prioridade_lista ?? '—'}</span></div><div className="flex items-center gap-3"><StatusBadge ativo={funcao.ativa !== false} /><IconButton icon={Pencil} onClick={() => { setEditandoFuncao(funcao); setFormFuncao({ ...FORM_FUNCAO, ...funcao }); }} /><IconButton icon={funcao.ativa === false ? Check : X} onClick={() => toggleFuncao(funcao)} /></div></div>)}</ListCard></>}
    {activeTab === 'grupos' && <><FormCard title={editandoGrupo ? `Editando grupo: ${editandoGrupo.nome}` : 'Novo Grupo de Tags'} isEditing={!!editandoGrupo} onCancel={cancelarEdicaoGrupo} preview={<PreviewBadge emoji={formGrupo.emoji} nome={formGrupo.nome || 'Novo grupo'} cor={formGrupo.cor} />}><div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"><Field label="Nome do grupo" className="md:col-span-4"><Input value={formGrupo.nome} onChange={(e) => setFormGrupo({ ...formGrupo, nome: e.target.value })} /></Field><Field label="Aplicabilidade" className="md:col-span-2"><AplicabilidadeSelect value={formGrupo.aplicabilidade} onChange={(v) => setFormGrupo({ ...formGrupo, aplicabilidade: v })} /></Field><Field label="Ícone" className="md:col-span-2"><EmojiSelect value={formGrupo.emoji} onChange={(emoji) => setFormGrupo({ ...formGrupo, emoji })} /></Field><Field label="Cor" className="md:col-span-2"><ColorInput value={formGrupo.cor} onChange={(cor) => setFormGrupo({ ...formGrupo, cor })} /></Field><Button disabled={!canEdit} onClick={salvarGrupo} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700">{editandoGrupo ? 'Salvar Alterações' : 'Adicionar Grupo'}</Button></div></FormCard><ListCard title={`Grupos de Tags (${gruposFiltrados.length})`} search={buscaGrupo} setSearch={setBuscaGrupo} searchPlaceholder="Buscar grupo...">{gruposFiltrados.map((grupo) => <div key={grupo.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold" style={{ borderColor: grupo.cor || '#CBD5E1', backgroundColor: `${grupo.cor || '#E2E8F0'}18`, color: grupo.cor || '#1E293B' }}>{grupo.emoji || '🏷️'} {grupo.nome}</span><span className="text-xs text-slate-500">Aplicabilidade: {labelAplicabilidade(grupo.aplicabilidade)}</span><span className="text-xs text-slate-500">{quantidadeTagsPorGrupo.get(grupo.id) || 0} tags</span><span className="text-xs text-slate-500">Escopo: Global</span></div><div className="flex items-center gap-3"><StatusBadge ativo={grupo.ativo !== false} /><IconButton icon={Pencil} title="Editar grupo" onClick={() => { setEditandoGrupo(grupo); setFormGrupo({ ...FORM_GRUPO, ...grupo }); }} /><ActionButton label={grupo.ativo === false ? 'Reativar' : 'Desativar'} icon={grupo.ativo === false ? Check : X} onClick={() => toggleGrupo(grupo)} /><ActionButton label="Excluir" icon={Trash2} variant="danger" onClick={() => excluirGrupo(grupo)} /></div></div>)}</ListCard></>}
    {activeTab === 'tags' && <><FormCard title={editandoTag ? `Editando tag: ${editandoTag.nome}` : 'Nova Tag Individual'} isEditing={!!editandoTag} onCancel={cancelarEdicaoTag} preview={<PreviewBadge emoji={formTag.emoji} nome={formTag.nome || 'Nova tag'} cor={formTag.cor} />}><div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"><Field label="Grupo da tag" className="md:col-span-3"><select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={formTag.grupo_id || ''} onChange={(e) => setFormTag({ ...formTag, grupo_id: e.target.value })}><option value="">Sem grupo</option>{gruposAtivos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.emoji} {grupo.nome}</option>)}</select></Field><Field label="Nome da tag" className="md:col-span-3"><Input value={formTag.nome} placeholder="Ex: Motorista" onChange={(e) => setFormTag({ ...formTag, nome: e.target.value })} /></Field><Field label="Aplicabilidade" className="md:col-span-2"><AplicabilidadeSelect value={formTag.aplicabilidade} onChange={(v) => setFormTag({ ...formTag, aplicabilidade: v })} /></Field><Field label="Ícone" className="md:col-span-1"><EmojiSelect value={formTag.emoji} onChange={(emoji) => setFormTag({ ...formTag, emoji })} /></Field><Field label="Tipo visual" className="md:col-span-2"><TipoVisualSelect value={formTag.tipo_visual} onChange={(v) => setFormTag({ ...formTag, tipo_visual: v })} /></Field><Button disabled={!canEdit} onClick={salvarTag} className="md:col-span-1">{editandoTag ? 'Salvar' : 'Criar'}</Button></div></FormCard><ListCard title={`Tags Individuais (${tagsFiltradas.length})`} search={buscaTag} setSearch={setBuscaTag} searchPlaceholder="Buscar tag...">{tagsFiltradas.map((tag) => { const grupo = gruposPorId.get(getTagGrupoId(tag)); return <div key={tag.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border" style={{ backgroundColor: `${tag.cor || '#F59E0B'}18`, borderColor: tag.cor || '#F59E0B' }}>{tag.emoji || '🏷️'}</div><div><div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{tag.nome}</p><StatusBadge ativo={tag.ativo !== false} /></div><div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1"><span>Grupo: {grupo?.nome || 'Sem grupo'}</span><span>•</span><span>Aplicabilidade: {labelAplicabilidade(tag.aplicabilidade)}</span><span>•</span><span>Tipo: {tag.tipo_visual || 'chip'}</span><span>•</span><span>Cor: {tag.cor || '—'}</span></div></div></div><div className="flex items-center gap-3"><IconButton icon={Pencil} title="Editar tag" onClick={() => { setEditandoTag(tag); setFormTag({ ...FORM_TAG, ...tag, grupo_id: getTagGrupoId(tag) || '' }); }} /><ActionButton label={tag.ativo === false ? 'Reativar' : 'Desativar'} icon={tag.ativo === false ? Check : X} onClick={() => toggleTag(tag)} /><ActionButton label="Excluir" icon={Trash2} variant="danger" onClick={() => excluirTag(tag)} /></div></div>; })}</ListCard></>}
  </div>);
}

const filtrar = (itens, termo) => itens.filter((i) => String(i?.nome || '').toLowerCase().includes(String(termo || '').toLowerCase()));
const labelAplicabilidade = (v) => v === 'militar' ? 'Militar' : v === 'ferias' ? 'Férias' : 'Ambos';
function TabButton({ id, icon: Icon, label, activeTab, setActiveTab }) { const active = activeTab === id; return <button type="button" onClick={() => setActiveTab(id)} className={['inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition', active ? 'bg-white text-indigo-700 shadow border border-indigo-100' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'].join(' ')}><Icon className="w-4 h-4" />{label}</button>; }
function FormCard({ title, preview, children, onCancel, isEditing }) { return <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200"><div className="flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /><h2 className="font-semibold text-slate-900">{title}</h2></div><div className="flex items-center gap-3">{preview}{isEditing && <Button variant="outline" size="sm" onClick={onCancel}>Cancelar edição</Button>}</div></div><div className="p-6">{children}</div></section>; }
function PreviewBadge({ emoji, nome, cor, fallback = 'Prévia' }) { return <div className="flex items-center gap-2"><span className="text-xs text-slate-400">Preview visual:</span><span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold" style={{ borderColor: cor || '#CBD5E1', backgroundColor: `${cor || '#E2E8F0'}22`, color: cor || '#334155' }}><span>{emoji || '🏷️'}</span><span>{nome || fallback}</span></span></div>; }
function Field({ label, children, className }) { return <label className={className}><span className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{label}</span>{children}</label>; }
function StatusBadge({ ativo }) { return <span className={['inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', ativo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'].join(' ')}>{ativo ? '✓ Ativo' : 'Inativo'}</span>; }
function IconButton({ icon: Icon, onClick }) { return <button type="button" onClick={onClick} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Icon className="w-5 h-5" /></button>; }
function ActionButton({ label, icon: Icon, onClick, variant = 'neutral' }) {
  const cls = variant === 'danger'
    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
    : 'border-slate-200 text-slate-700 hover:bg-slate-50';
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cls}`}><Icon className="w-3.5 h-3.5" />{label}</button>;
}
function SearchInput({ value, onChange, placeholder }) { return <div className="relative w-64"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><Input value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" placeholder={placeholder} /></div>; }
function ListCard({ title, search, setSearch, searchPlaceholder, children }) { return <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-semibold text-slate-900">{title}</h2><SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} /></div><div className="divide-y divide-slate-100">{children}</div></section>; }
function EmojiSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={value || '🏷️'} onChange={(e) => onChange(e.target.value)}>{EMOJI_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.value} {item.label}</option>)}</select>; }
function AplicabilidadeSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={normalizarAplicabilidade(value)} onChange={(e) => onChange(e.target.value)}>{APLICABILIDADES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>; }
function TipoVisualSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={value || 'chip'} onChange={(e) => onChange(e.target.value)}><option value="chip">Chip</option><option value="destaque">Destaque</option><option value="normal">Normal</option></select>; }
function ColorInput({ value, onChange }) { return <Input type="color" value={value || '#CBD5E1'} onChange={(e) => onChange(e.target.value)} className="h-10 p-1" />; }
