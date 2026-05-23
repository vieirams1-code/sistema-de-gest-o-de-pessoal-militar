import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calcularTentativasBulk } from '@/utils/funcoesTags/militarTagsBulk';
import { AlertCircle, Check, Search, Tags as TagsIcon, Users, X } from 'lucide-react';

function getTagNome(tag) {
  return tag?.nome || tag?.name || tag?.titulo || '';
}

function getTagEmoji(tag) {
  return tag?.emoji || tag?.icone || tag?.icon || '📋';
}

function getTagCor(tag) {
  return tag?.cor || tag?.color || '#6366F1';
}

function getTagGrupoId(tag) {
  return tag?.grupo_id || tag?.tag_grupo_id || tag?.grupoId || tag?.tagGrupoId || '';
}

function isTagAtiva(tag) {
  return tag?.ativo !== false && tag?.ativa !== false && tag?.status !== 'inativo';
}

function isGrupoAtivo(grupo) {
  return grupo?.ativo !== false && grupo?.ativa !== false && grupo?.status !== 'inativo';
}

function getGrupoNome(grupo) {
  return grupo?.nome || grupo?.name || 'Sem grupo';
}

function normalizarBusca(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function MilitarTagsBulkPanel({
  open,
  mode,
  onClose,
  selectedCount,
  selectedMilitares = [],
  tagsAtivas,
  gruposAtivos,
  tagsPresentes,
  onConfirm,
  loading,
}) {
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const [motivo, setMotivo] = useState('');

  const fonteTags = mode === 'remove' ? tagsPresentes.map((item) => item.tag).filter(Boolean) : (tagsAtivas || []);

  const gruposPorId = useMemo(() => new Map((gruposAtivos || []).map((grupo) => [String(grupo.id), grupo])), [gruposAtivos]);

  const tagsFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca.trim());

    return fonteTags.filter((tag) => {
      if (!tag || !isTagAtiva(tag)) return false;

      const grupoId = getTagGrupoId(tag);
      const grupo = grupoId ? gruposPorId.get(String(grupoId)) : null;
      if (grupoId && grupo && !isGrupoAtivo(grupo)) return false;

      const grupoNome = grupo ? getGrupoNome(grupo) : 'Sem grupo';
      if (!termo) return true;

      const textoBusca = normalizarBusca(`${getTagNome(tag)} ${getTagEmoji(tag)} ${grupoNome}`);
      return textoBusca.includes(termo);
    });
  }, [fonteTags, busca, gruposPorId]);

  const grupos = useMemo(() => {
    const mapa = new Map();

    tagsFiltradas.forEach((tag) => {
      const grupoId = getTagGrupoId(tag);
      const grupo = grupoId ? gruposPorId.get(String(grupoId)) : null;
      const nomeGrupo = grupo ? getGrupoNome(grupo) : 'Sem grupo';
      if (!mapa.has(nomeGrupo)) mapa.set(nomeGrupo, []);
      mapa.get(nomeGrupo).push(tag);
    });

    const prioridade = ['operacional', 'cursos', 'administrativo', 'sem grupo'];
    return [...mapa.entries()]
      .map(([nome, tags]) => ({ nome, tags }))
      .sort((a, b) => {
        const ai = prioridade.indexOf(normalizarBusca(a.nome));
        const bi = prioridade.indexOf(normalizarBusca(b.nome));
        const va = ai === -1 ? 99 : ai;
        const vb = bi === -1 ? 99 : bi;
        if (va !== vb) return va - vb;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [tagsFiltradas, gruposPorId]);

  const tagsSelecionadas = useMemo(() => {
    const ids = new Set(selecionadas.map(String));
    return tagsFiltradas.filter((tag) => ids.has(String(tag.id)));
  }, [selecionadas, tagsFiltradas]);

  if (!open) return null;

  const toggleTag = (tagId) => setSelecionadas((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <TagsIcon className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">{mode === 'remove' ? 'Remover tags' : 'Aplicar tags'}</h2>
          </div>
          <Button variant="ghost" onClick={onClose} className="inline-flex items-center gap-1">Fechar <X className="w-4 h-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Alvos selecionados ({selectedMilitares.length || selectedCount})
            </div>
            <div className="space-y-2">
              {selectedMilitares.slice(0, 3).map((militar) => (
                <div key={militar.id} className="flex items-start justify-between gap-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50/70">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{[militar.posto_grad, militar.nome_guerra || militar.nome].filter(Boolean).join(' - ') || militar.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{militar.nome_completo || militar.nome || 'Sem nome completo'}</p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{militar.matricula || '-'}</span>
                </div>
              ))}
              {selectedMilitares.length > 3 && <p className="text-xs text-slate-500">+ {selectedMilitares.length - 3} militares selecionados</p>}
            </div>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Buscar por nome ou grupo da tag..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {selecionadas.length > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold tracking-wider text-indigo-700 uppercase">Tags prontas para aplicação</p>
                <span className="text-xs font-medium text-indigo-700">{selecionadas.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tagsSelecionadas.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => toggleTag(String(tag.id))} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-100/40">
                    <span>{getTagEmoji(tag)}</span>
                    <span>{getTagNome(tag)}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {grupos.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma tag encontrada.</p>
              </div>
            ) : grupos.map((grupo) => (
              <div key={grupo.nome} className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1">{grupo.nome}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {grupo.tags.map((tag) => {
                    const id = String(tag.id);
                    const isSelected = selecionadas.includes(id);
                    const nome = getTagNome(tag);
                    const emoji = getTagEmoji(tag);
                    const cor = getTagCor(tag);
                    return (
                      <button key={id} type="button" onClick={() => toggleTag(id)} className={`text-left flex items-center p-3 rounded-xl border transition-all duration-200 w-full group ${isSelected ? 'border-indigo-500 bg-indigo-50/30 shadow-md ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm hover:bg-slate-50'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 mr-3 transition-transform group-hover:scale-105" style={{ backgroundColor: `${cor}15`, border: `1px solid ${cor}30` }}>{emoji}</div>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{nome}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent group-hover:border-slate-400'}`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 bg-white border-t border-slate-200 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Motivo da atribuição (opcional)</p>
          <Input placeholder="Descreva o motivo da ação" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="text-xs text-slate-500">{selectedCount} militar(es) × {selecionadas.length} tags = {calcularTentativasBulk(selectedCount, selecionadas.length)} vinculações</p>
          <Button className={`w-full ${selecionadas.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 hover:bg-slate-300 text-slate-500'}`} disabled={loading || selecionadas.length === 0} onClick={() => onConfirm({ tagIds: selecionadas, motivo })}>
            {mode === 'remove' ? 'Remover dos selecionados' : 'Aplicar aos selecionados'}
          </Button>
        </div>
      </div>
    </div>
  );
}
