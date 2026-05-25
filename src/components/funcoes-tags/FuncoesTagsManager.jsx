import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, GitBranch, Network, Pencil, Plus, Search, Settings, Shield, Tags as TagsIcon, X } from 'lucide-react';
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
import IconeCatalogo, { OPCOES_ICONE_CATALOGO } from '@/components/funcoes-tags/IconeCatalogo';

const APLICABILIDADES = [{ value: 'militar', label: 'Militar' }, { value: 'ferias', label: 'Férias' }, { value: 'ambos', label: 'Ambos' }];
const FORM_FUNCAO = { nome: '', prioridade_lista: 10, institucional_chave: '', emoji: '⭐', cor: '#1D4ED8', aplicabilidade: 'ambos', ativa: true };
const FORM_GRUPO = { nome: '', aplicabilidade: 'ambos', emoji: '🚒', cor: '#0F766E', ativo: true };
const FORM_TAG = { grupo_id: '', nome: '', aplicabilidade: 'ambos', emoji: '⚠️', tipo_visual: 'chip', cor: '#F59E0B', ativo: true };
const isFuncaoInstitucionalProtegida = (funcao) => Boolean(funcao?.institucional_chave && INSTITUCIONAIS[funcao.institucional_chave]);

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
  const [modalFuncaoOpen, setModalFuncaoOpen] = useState(false);
  const [modalGrupoOpen, setModalGrupoOpen] = useState(false);
  const [modalTagOpen, setModalTagOpen] = useState(false);
  const [tagParaArquivar, setTagParaArquivar] = useState(null);
  const [grupoParaArquivar, setGrupoParaArquivar] = useState(null);
  const [grupoBloqueado, setGrupoBloqueado] = useState(null);

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
  const saveFuncao = useMutation({
    mutationFn: (p) => {
      const editandoId = editandoFuncao?.id;
      console.debug('[FUNCAO_SAVE_MUTATION_FN]', { editandoId, modo: editandoId ? 'update' : 'create' });
      return editandoId
        ? atualizarFuncaoMilitarEscopado(editandoId, p)
        : criarFuncaoMilitarEscopado(p);
    },
    onSuccess: () => {
      console.debug('[FUNCAO_SAVE_SUCCESS]');
      invalidate('funcoes');
      toast({ title: 'Função salva com sucesso.' });
      cancelarEdicaoFuncao();
    },
    onError: (error) => {
      console.debug('[FUNCAO_SAVE_ERROR]', error);
      toast({ title: 'Não foi possível salvar a função.', description: error?.message, variant: 'destructive' });
    },
  });
  const saveGrupo = useMutation({
    mutationFn: (p) => editandoGrupo ? atualizarTagGrupoEscopado(editandoGrupo.id, p) : criarTagGrupoEscopado(p),
    onSuccess: () => { invalidate('grupos'); toast({ title: 'Grupo salvo com sucesso.' }); },
    onError: (error) => toast({ title: 'Não foi possível salvar o grupo.', description: error?.message, variant: 'destructive' }),
  });
  const saveTag = useMutation({
    mutationFn: (p) => editandoTag ? atualizarTagEscopado(editandoTag.id, p) : criarTagEscopado(p),
    onSuccess: () => { invalidate('tags'); toast({ title: 'Tag salva com sucesso.' }); },
    onError: (error) => toast({ title: 'Não foi possível salvar a tag.', description: error?.message, variant: 'destructive' }),
  });
  const desativarTagMutation = useMutation({
    mutationFn: (tagId) => desativarTagEscopado(tagId, { ativo: false }),
    onSuccess: () => {
      invalidate('tags');
      toast({ title: 'Tag arquivada com sucesso.', description: 'Se houver histórico ou vínculos, eles foram preservados.' });
      setTagParaArquivar(null);
    },
  });
  const desativarGrupoMutation = useMutation({
    mutationFn: (grupoId) => desativarTagGrupoEscopado(grupoId, { ativo: false }),
    onSuccess: () => {
      invalidate('grupos');
      toast({ title: 'Grupo arquivado com sucesso.' });
      setGrupoParaArquivar(null);
    },
  });

  const handleInicializarFuncoesBase = () => toast({ title: 'As funções base já são gerenciadas pelo catálogo atual.' });
  const cancelarEdicaoFuncao = () => { setEditandoFuncao(null); setFormFuncao(FORM_FUNCAO); setModalFuncaoOpen(false); };
  const cancelarEdicaoGrupo = () => { setEditandoGrupo(null); setFormGrupo(FORM_GRUPO); setModalGrupoOpen(false); };
  const cancelarEdicaoTag = () => { setEditandoTag(null); setFormTag(FORM_TAG); setModalTagOpen(false); };

  const abrirNovoFuncao = () => { setEditandoFuncao(null); setFormFuncao(FORM_FUNCAO); setModalFuncaoOpen(true); };
  const abrirEditarFuncao = (funcao) => { setEditandoFuncao(funcao); setFormFuncao({ ...FORM_FUNCAO, ...funcao }); setModalFuncaoOpen(true); };
  const abrirNovoGrupo = () => { setEditandoGrupo(null); setFormGrupo(FORM_GRUPO); setModalGrupoOpen(true); };
  const abrirEditarGrupo = (grupo) => { setEditandoGrupo(grupo); setFormGrupo({ ...FORM_GRUPO, ...grupo }); setModalGrupoOpen(true); };
  const abrirNovoTag = () => { setEditandoTag(null); setFormTag(FORM_TAG); setModalTagOpen(true); };
  const abrirEditarTag = (tag) => { setEditandoTag(tag); setFormTag({ ...FORM_TAG, ...tag, grupo_id: getTagGrupoId(tag) || '' }); setModalTagOpen(true); };

  const salvarFuncao = () => {
    const funcaoInstitucional = isFuncaoInstitucionalProtegida(editandoFuncao);
    const payload = {
      ...formFuncao,
      ativa: formFuncao.ativa ?? editandoFuncao?.ativa ?? true,
      institucional_chave: funcaoInstitucional
        ? editandoFuncao.institucional_chave
        : (formFuncao.institucional_chave || editandoFuncao?.institucional_chave || ''),
      prioridade_lista: funcaoInstitucional
        ? Number(editandoFuncao?.prioridade_lista)
        : Number(formFuncao.prioridade_lista ?? editandoFuncao?.prioridade_lista),
      aplicabilidade: funcaoInstitucional
        ? normalizarAplicabilidade(editandoFuncao?.aplicabilidade)
        : normalizarAplicabilidade(formFuncao.aplicabilidade ?? editandoFuncao?.aplicabilidade),
    };
    const erro = validarFuncao(payload, funcoes, editandoFuncao);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    console.debug('[FUNCAO_SAVE]', { editandoId: editandoFuncao?.id, payload });
    saveFuncao.mutate(payload);
  };

  const salvarGrupo = () => {
    const payload = { ...formGrupo, aplicabilidade: normalizarAplicabilidade(formGrupo.aplicabilidade), ativo: editandoGrupo?.ativo ?? true };
    const erro = validarTagGrupo(payload, grupos, editandoGrupo);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveGrupo.mutate(payload);
    cancelarEdicaoGrupo();
  };

  const salvarTag = () => {
    const tipoVisual = (formTag.tipo_visual || 'normal') === 'chip' ? 'normal' : (formTag.tipo_visual || 'normal');
    const payload = { ...formTag, tipo_visual: tipoVisual, aplicabilidade: normalizarAplicabilidade(formTag.aplicabilidade), ativo: editandoTag?.ativo ?? true };
    const erro = validarTag(payload, tags, editandoTag);
    if (erro) return toast({ title: erro, variant: 'destructive' });
    saveTag.mutate(payload);
    cancelarEdicaoTag();
  };

  const toggleFuncao = (f) => { if (INSTITUCIONAIS[f.institucional_chave]) return; desativarFuncaoMilitarEscopado(f.id, { ativa: !f.ativa }).then(() => { invalidate('funcoes'); toast({ title: `Função ${f.ativa === false ? 'reativada' : 'desativada'} com sucesso.` }); }).catch((error) => toast({ title: 'Não foi possível alterar o status da função.', description: error?.message, variant: 'destructive' })); };
  const toggleGrupo = (g) => desativarTagGrupoEscopado(g.id, { ativo: !g.ativo }).then(() => { invalidate('grupos'); toast({ title: `Grupo ${g.ativo === false ? 'reativado' : 'desativado'} com sucesso.` }); }).catch((error) => toast({ title: 'Não foi possível alterar o status do grupo.', description: error?.message, variant: 'destructive' }));
  const toggleTag = (t) => desativarTagEscopado(t.id, { ativo: !t.ativo }).then(() => { invalidate('tags'); toast({ title: `Tag ${t.ativo === false ? 'reativada' : 'desativada'} com sucesso.` }); }).catch((error) => toast({ title: 'Não foi possível alterar o status da tag.', description: error?.message, variant: 'destructive' }));

  const confirmarArquivamentoTag = () => {
    if (!tagParaArquivar) return;
    desativarTagMutation.mutate(tagParaArquivar.id);
  };

  const excluirGrupo = async (grupo) => {
    const totalTags = quantidadeTagsPorGrupo.get(grupo.id) || 0;
    if (totalTags > 0) {
      setGrupoBloqueado({ grupo, totalTags });
      return;
    }
    setGrupoParaArquivar(grupo);
  };

  return (<div className="max-w-6xl mx-auto space-y-6">
    <header className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><Settings className="w-7 h-7 text-indigo-600" /><h1 className="text-2xl font-bold text-slate-900">Configurações de Funções e Tags</h1></div><p className="text-sm text-slate-500 mt-1">Gerencie a taxonomia militar, grupos de acesso e tags do sistema.</p></div><Button onClick={handleInicializarFuncoesBase} className="bg-slate-950 text-white hover:bg-slate-800"><GitBranch className="w-4 h-4 mr-2" />Inicializar funções base</Button></header>
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1 inline-flex"><TabButton id="funcoes" icon={Shield} label="Funções Militares" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="grupos" icon={Network} label="Grupos de Tags" activeTab={activeTab} setActiveTab={setActiveTab} /><TabButton id="tags" icon={TagsIcon} label="Tags Individuais" activeTab={activeTab} setActiveTab={setActiveTab} /></div>

    {activeTab === 'funcoes' && <><div className="flex justify-end"><Button disabled={!canEdit} onClick={abrirNovoFuncao}><Plus className="w-4 h-4 mr-2" />Nova Função Militar</Button></div><ListCard title={`Funções Cadastradas (${funcoesFiltradas.length})`} search={buscaFuncao} setSearch={setBuscaFuncao} searchPlaceholder="Buscar função...">{funcoesFiltradas.map((funcao) => <div key={funcao.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold" style={{ borderColor: funcao.cor || '#CBD5E1', backgroundColor: `${funcao.cor || '#E2E8F0'}18`, color: funcao.cor || '#1E293B' }}><IconeCatalogo value={funcao.emoji || '🏷️'} /> {funcao.nome}</span><span className="text-xs text-slate-500">Cor: {funcao.cor || '—'}</span><span className="text-xs text-slate-500">Escopo: Global</span><span className="text-xs text-slate-500">Prioridade: {funcao.prioridade_lista ?? '—'}</span></div><div className="flex items-center gap-3"><StatusBadge ativo={funcao.ativa !== false} /><ActionButton label="Editar" icon={Pencil} onClick={() => abrirEditarFuncao(funcao)} /><ActionButton label={funcao.ativa === false ? 'Reativar' : 'Desativar'} icon={funcao.ativa === false ? Check : X} onClick={() => toggleFuncao(funcao)} /></div></div>)}</ListCard></>}

    {activeTab === 'grupos' && <><div className="flex justify-end"><Button disabled={!canEdit} onClick={abrirNovoGrupo}><Plus className="w-4 h-4 mr-2" />Novo Grupo de Tags</Button></div><ListCard title={`Grupos de Tags (${gruposFiltrados.length})`} search={buscaGrupo} setSearch={setBuscaGrupo} searchPlaceholder="Buscar grupo...">{gruposFiltrados.map((grupo) => <div key={grupo.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold" style={{ borderColor: grupo.cor || '#CBD5E1', backgroundColor: `${grupo.cor || '#E2E8F0'}18`, color: grupo.cor || '#1E293B' }}><IconeCatalogo value={grupo.emoji || '🏷️'} /> {grupo.nome}</span><span className="text-xs text-slate-500">Aplicabilidade: {labelAplicabilidade(grupo.aplicabilidade)}</span><span className="text-xs text-slate-500">{quantidadeTagsPorGrupo.get(grupo.id) || 0} tags</span><span className="text-xs text-slate-500">Escopo: Global</span></div><div className="flex items-center gap-3"><StatusBadge ativo={grupo.ativo !== false} /><ActionButton label="Editar" icon={Pencil} onClick={() => abrirEditarGrupo(grupo)} /><ActionButton label={grupo.ativo === false ? 'Reativar' : 'Desativar'} icon={grupo.ativo === false ? Check : X} onClick={() => toggleGrupo(grupo)} /><ActionButton label="Arquivar" icon={X} variant="danger" onClick={() => excluirGrupo(grupo)} /></div></div>)}</ListCard></>}

    {activeTab === 'tags' && <><div className="flex justify-end"><Button disabled={!canEdit} onClick={abrirNovoTag}><Plus className="w-4 h-4 mr-2" />Nova Tag Individual</Button></div><ListCard title={`Tags Individuais (${tagsFiltradas.length})`} search={buscaTag} setSearch={setBuscaTag} searchPlaceholder="Buscar tag...">{tagsFiltradas.map((tag) => { const grupo = gruposPorId.get(getTagGrupoId(tag)); return <div key={tag.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"><div className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border" style={{ backgroundColor: `${tag.cor || '#F59E0B'}18`, borderColor: tag.cor || '#F59E0B' }}><IconeCatalogo value={tag.emoji || '🏷️'} /></div><div><div className="flex items-center gap-2"><p className="font-semibold text-slate-900">{tag.nome}</p><StatusBadge ativo={tag.ativo !== false} /></div><div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-1"><span>Grupo: {grupo?.nome || 'Sem grupo'}</span><span>•</span><span>Aplicabilidade: {labelAplicabilidade(tag.aplicabilidade)}</span><span>•</span><span>Tipo: {tag.tipo_visual || 'chip'}</span><span>•</span><span>Cor: {tag.cor || '—'}</span></div></div></div><div className="flex items-center gap-3"><ActionButton label="Editar" icon={Pencil} onClick={() => abrirEditarTag(tag)} /><ActionButton label={tag.ativo === false ? 'Reativar' : 'Desativar'} icon={tag.ativo === false ? Check : X} onClick={() => toggleTag(tag)} /><ActionButton label="Arquivar" icon={X} variant="danger" onClick={() => setTagParaArquivar(tag)} /></div></div>; })}</ListCard></>}

    <EntityModal open={modalFuncaoOpen} onClose={cancelarEdicaoFuncao} title={editandoFuncao ? `Editar função militar: ${editandoFuncao.nome}` : 'Nova Função Militar'} description="Defina nome, ícone, cor e prioridade da função." loading={saveFuncao.isPending} onSave={salvarFuncao} preview={<PreviewBadge emoji={formFuncao.emoji} nome={formFuncao.nome || 'Nova função'} cor={formFuncao.cor} />}>
      <>
        {isFuncaoInstitucionalProtegida(editandoFuncao) && <div className="mb-3 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Função institucional protegida</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Nome da função"><Input disabled={isFuncaoInstitucionalProtegida(editandoFuncao)} value={formFuncao.nome} onChange={(e) => setFormFuncao({ ...formFuncao, nome: e.target.value })} /></Field><Field label="Prioridade na lista"><Input disabled={isFuncaoInstitucionalProtegida(editandoFuncao)} type="number" value={formFuncao.prioridade_lista} onChange={(e) => setFormFuncao({ ...formFuncao, prioridade_lista: Number(e.target.value) })} /></Field><Field label="Ícone"><EmojiSelect value={formFuncao.emoji} onChange={(emoji) => setFormFuncao({ ...formFuncao, emoji })} /></Field><Field label="Cor de destaque"><ColorInput value={formFuncao.cor} onChange={(cor) => setFormFuncao({ ...formFuncao, cor })} /></Field></div>
      </>
    </EntityModal>

    <EntityModal open={modalGrupoOpen} onClose={cancelarEdicaoGrupo} title={editandoGrupo ? `Editar grupo: ${editandoGrupo.nome}` : 'Novo Grupo de Tags'} description="Defina os dados do grupo de tags." loading={saveGrupo.isPending} onSave={salvarGrupo} preview={<PreviewBadge emoji={formGrupo.emoji} nome={formGrupo.nome || 'Novo grupo'} cor={formGrupo.cor} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Nome do grupo"><Input value={formGrupo.nome} onChange={(e) => setFormGrupo({ ...formGrupo, nome: e.target.value })} /></Field><Field label="Aplicabilidade"><AplicabilidadeSelect value={formGrupo.aplicabilidade} onChange={(v) => setFormGrupo({ ...formGrupo, aplicabilidade: v })} /></Field><Field label="Ícone"><EmojiSelect value={formGrupo.emoji} onChange={(emoji) => setFormGrupo({ ...formGrupo, emoji })} /></Field><Field label="Cor"><ColorInput value={formGrupo.cor} onChange={(cor) => setFormGrupo({ ...formGrupo, cor })} /></Field></div>
    </EntityModal>

    <EntityModal open={modalTagOpen} onClose={cancelarEdicaoTag} title={editandoTag ? `Editar tag: ${editandoTag.nome}` : 'Nova Tag Individual'} description="Configure a tag e seu grupo." loading={saveTag.isPending} onSave={salvarTag} preview={<PreviewBadge emoji={formTag.emoji} nome={formTag.nome || 'Nova tag'} cor={formTag.cor} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Grupo da tag"><select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={formTag.grupo_id || ''} onChange={(e) => setFormTag({ ...formTag, grupo_id: e.target.value })}><option value="">Sem grupo</option>{gruposAtivos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}</select></Field><Field label="Nome da tag"><Input value={formTag.nome} onChange={(e) => setFormTag({ ...formTag, nome: e.target.value })} /></Field><Field label="Aplicabilidade"><AplicabilidadeSelect value={formTag.aplicabilidade} onChange={(v) => setFormTag({ ...formTag, aplicabilidade: v })} /></Field><Field label="Ícone"><EmojiSelect value={formTag.emoji} onChange={(emoji) => setFormTag({ ...formTag, emoji })} /></Field><Field label="Tipo visual"><TipoVisualSelect value={formTag.tipo_visual} onChange={(v) => setFormTag({ ...formTag, tipo_visual: v })} /></Field><Field label="Cor"><ColorInput value={formTag.cor} onChange={(cor) => setFormTag({ ...formTag, cor })} /></Field></div>
    </EntityModal>

    <Dialog open={Boolean(tagParaArquivar)} onOpenChange={(open) => !open && setTagParaArquivar(null)}><DialogContent><DialogHeader><DialogTitle>Remover tag do catálogo</DialogTitle><DialogDescription>Se esta tag possuir histórico ou vínculos, ela será desativada para preservar os registros.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setTagParaArquivar(null)}>Cancelar</Button><Button disabled={desativarTagMutation.isPending} onClick={confirmarArquivamentoTag}>Desativar/Arquivar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(grupoParaArquivar)} onOpenChange={(open) => !open && setGrupoParaArquivar(null)}><DialogContent><DialogHeader><DialogTitle>Arquivar grupo do catálogo</DialogTitle><DialogDescription>Este grupo está sem tags. Para evitar erros de remoção física, ele será desativado e poderá ser reativado depois.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setGrupoParaArquivar(null)}>Cancelar</Button><Button disabled={desativarGrupoMutation.isPending} onClick={() => desativarGrupoMutation.mutate(grupoParaArquivar.id)}>Desativar/Arquivar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(grupoBloqueado)} onOpenChange={(open) => !open && setGrupoBloqueado(null)}><DialogContent><DialogHeader><DialogTitle>Grupo com tags vinculadas</DialogTitle><DialogDescription>Este grupo possui {grupoBloqueado?.totalTags || 0} tags. Para excluir o grupo, primeiro mova ou remova/desative as tags.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setGrupoBloqueado(null)}>Entendi</Button></DialogFooter></DialogContent></Dialog>
  </div>);
}

const filtrar = (itens, termo) => itens.filter((i) => String(i?.nome || '').toLowerCase().includes(String(termo || '').toLowerCase()));
const labelAplicabilidade = (v) => v === 'militar' ? 'Militar' : v === 'ferias' ? 'Férias' : 'Ambos';
function TabButton({ id, icon: Icon, label, activeTab, setActiveTab }) { const active = activeTab === id; return <button type="button" onClick={() => setActiveTab(id)} className={['inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition', active ? 'bg-white text-indigo-700 shadow border border-indigo-100' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'].join(' ')}><Icon className="w-4 h-4" />{label}</button>; }
function PreviewBadge({ emoji, nome, cor, fallback = 'Prévia' }) { return <div className="flex items-center gap-2"><span className="text-xs text-slate-400">Preview visual:</span><span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold" style={{ borderColor: cor || '#CBD5E1', backgroundColor: `${cor || '#E2E8F0'}22`, color: cor || '#334155' }}><IconeCatalogo value={emoji || '🏷️'} /><span>{nome || fallback}</span></span></div>; }
function Field({ label, children, className }) { return <label className={className}><span className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{label}</span>{children}</label>; }
function StatusBadge({ ativo }) { return <span className={['inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', ativo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'].join(' ')}>{ativo ? '✓ Ativo' : 'Inativo'}</span>; }
function ActionButton({ label, icon: Icon, onClick, variant = 'neutral' }) { const cls = variant === 'danger' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'; return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cls}`}><Icon className="w-3.5 h-3.5" />{label}</button>; }
function SearchInput({ value, onChange, placeholder }) { return <div className="relative w-64"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><Input value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" placeholder={placeholder} /></div>; }
function ListCard({ title, search, setSearch, searchPlaceholder, children }) { return <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="flex items-center justify-between px-6 py-4 border-b"><h2 className="font-semibold text-slate-900">{title}</h2><SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} /></div><div className="divide-y divide-slate-100">{children}</div></section>; }
function EmojiSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={value || '🏷️'} onChange={(e) => onChange(e.target.value)}>{OPCOES_ICONE_CATALOGO.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>; }
function AplicabilidadeSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={normalizarAplicabilidade(value)} onChange={(e) => onChange(e.target.value)}>{APLICABILIDADES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>; }
function TipoVisualSelect({ value, onChange }) { return <select className="w-full h-10 rounded-lg border border-slate-300 px-3 bg-white" value={value || 'chip'} onChange={(e) => onChange(e.target.value)}><option value="chip">Chip</option><option value="destaque">Destaque</option><option value="normal">Normal</option></select>; }
function ColorInput({ value, onChange }) { return <Input type="color" value={value || '#CBD5E1'} onChange={(e) => onChange(e.target.value)} className="h-10 p-1" />; }
function EntityModal({ open, onClose, title, description, preview, children, onSave, loading }) { return <Dialog open={open} onOpenChange={(next) => !next && onClose()}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="mb-4">{preview}</div>{children}<DialogFooter className="mt-6"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={loading} onClick={onSave}>{loading ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>; }
