import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import IconeCatalogo from '@/components/funcoes-tags/IconeCatalogo';
import { AlertCircle, Check, Loader2, Search, Tags as TagsIcon, Users, X } from 'lucide-react';
import { normalizarAplicabilidade } from '@/utils/funcoesTags/normalizacao';

function isAtivo(item) {
  return item?.ativo !== false && item?.ativa !== false && item?.status !== 'inativo';
}

function normalizar(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getTagNome(tag) {
  return tag?.nome || tag?.name || tag?.titulo || '';
}

function getTagEmoji(tag) {
  return tag?.emoji || tag?.icone || tag?.icon || '🏷️';
}

function getTagCor(tag) {
  return tag?.cor || tag?.color || '#6366F1';
}

function getTagGrupoId(tag) {
  return tag?.grupo_id || tag?.tag_grupo_id || tag?.grupoId || tag?.tagGrupoId || '';
}

function isAplicavelEmFerias(tag) {
  const valor = normalizarAplicabilidade(tag?.aplicabilidade);
  return valor === 'ferias' || valor === 'todos';
}

export default function FeriasTagsBulkPanel({
  open,
  onClose,
  selectedFerias = [],
  tagsStatusById = {},
  onConfirm,
  loading = false,
  saving = false,
  resultadoOperacao = null,
}) {
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const [tagsEditadas, setTagsEditadas] = useState([]);
  const [motivo, setMotivo] = useState('');

  const { data: tags = [] } = useQuery({
    queryKey: ['funcoes-tags', 'tags'],
    enabled: open,
    queryFn: () => base44.entities.Tag.list('ordem_exibicao'),
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ['funcoes-tags', 'grupos'],
    enabled: open,
    queryFn: () => base44.entities.TagGrupo.list('ordem_exibicao'),
  });

  const gruposPorId = useMemo(() => new Map(grupos.map((g) => [String(g.id), g])), [grupos]);

  const tagsFiltradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return tags.filter((tag) => {
      if (!isAtivo(tag) || !isAplicavelEmFerias(tag)) return false;
      const grupoId = getTagGrupoId(tag);
      const grupo = grupoId ? gruposPorId.get(String(grupoId)) : null;
      if (grupo && !isAtivo(grupo)) return false;
      if (!termo) return true;
      const texto = normalizar(`${getTagNome(tag)} ${getTagEmoji(tag)} ${grupo?.nome || 'Sem grupo'}`);
      return texto.includes(termo);
    });
  }, [tags, gruposPorId, busca]);

  const gruposExibicao = useMemo(() => {
    const mapa = new Map();
    tagsFiltradas.forEach((tag) => {
      const grupoId = getTagGrupoId(tag);
      const nomeGrupo = grupoId ? (gruposPorId.get(String(grupoId))?.nome || 'Sem grupo') : 'Sem grupo';
      if (!mapa.has(nomeGrupo)) mapa.set(nomeGrupo, []);
      mapa.get(nomeGrupo).push(tag);
    });
    return [...mapa.entries()].map(([nome, tagsDoGrupo]) => ({ nome, tags: tagsDoGrupo }));
  }, [tagsFiltradas, gruposPorId]);

  const tagsSelecionadas = useMemo(() => {
    const ids = new Set(selecionadas.map(String));
    return tagsFiltradas.filter((tag) => ids.has(String(tag.id)));
  }, [selecionadas, tagsFiltradas]);

  const statusEfetivoById = useMemo(() => {
    const selecionadasSet = new Set(selecionadas.map(String));
    const editadasSet = new Set(tagsEditadas.map(String));
    const mapa = {};

    tagsFiltradas.forEach((tag) => {
      const tagId = String(tag.id);
      if (selecionadasSet.has(tagId)) {
        mapa[tagId] = 'all';
        return;
      }

      if (!editadasSet.has(tagId)) {
        mapa[tagId] = tagsStatusById[tagId] || 'none';
        return;
      }

      mapa[tagId] = 'none';
    });

    return mapa;
  }, [tagsFiltradas, tagsStatusById, selecionadas, tagsEditadas]);

  useEffect(() => {
    if (!open) return;
    const iniciais = Object.entries(tagsStatusById)
      .filter(([, status]) => status === 'all')
      .map(([tagId]) => String(tagId));
    setSelecionadas(iniciais);
    setTagsEditadas([]);
    setMotivo('');
  }, [open, tagsStatusById]);

  if (!open) return null;

  const isLocked = loading || saving;
  const toggleTag = (tagId) => {
    setSelecionadas((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
    setTagsEditadas((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" onClick={isLocked ? undefined : onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><TagsIcon className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold text-slate-800">Gerenciar tags</h2>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={isLocked} className="inline-flex items-center gap-1">Fechar <X className="w-4 h-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Férias selecionadas ({selectedFerias.length})
            </div>
            <div className="space-y-2">
              {selectedFerias.slice(0, 3).map((ferias) => (
                <div key={ferias.id} className="flex items-start justify-between gap-2 border border-slate-100 rounded-lg p-2.5 bg-slate-50/70">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{[ferias.militar_posto, ferias.militar_nome].filter(Boolean).join(' - ') || `Férias #${ferias.id}`}</p>
                    <p className="text-xs text-slate-500 truncate">{ferias.periodo_aquisitivo_ref || ferias.periodo_aquisitivo || 'Sem período aquisitivo'}</p>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{ferias.militar_matricula_label || ferias.militar_matricula || '-'}</span>
                </div>
              ))}
              {selectedFerias.length > 3 && <p className="text-xs text-slate-500">+ {selectedFerias.length - 3} férias selecionadas</p>}
            </div>
          </div>

          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} disabled={isLocked} placeholder="Buscar por nome ou grupo da tag..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all" />
          </div>

          {selecionadas.length > 0 && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold tracking-wider text-indigo-700 uppercase">Tags definidas para ficar em todas</p>
                <span className="text-xs font-medium text-indigo-700">{selecionadas.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tagsSelecionadas.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => toggleTag(String(tag.id))} disabled={isLocked} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs border-indigo-300 bg-indigo-50 text-indigo-800">
                    <IconeCatalogo value={getTagEmoji(tag)} />
                    <span>{getTagNome(tag)}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {gruposExibicao.length === 0 ? <div className="text-center py-8 text-slate-400"><AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>Nenhuma tag encontrada.</p></div> : gruposExibicao.map((grupo) => (
              <div key={grupo.nome} className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1">{grupo.nome}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {grupo.tags.map((tag) => {
                    const id = String(tag.id);
                    const status = statusEfetivoById[id] || 'none';
                    const isSelected = status === 'all';
                    const isPartial = status === 'some';
                    const cor = getTagCor(tag);
                    return (
                      <button key={id} type="button" onClick={() => toggleTag(id)} disabled={isLocked} className={`text-left flex items-center p-3 rounded-xl border transition-all duration-200 w-full group ${isPartial ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-300' : isSelected ? 'border-indigo-300 bg-indigo-50 text-indigo-800 shadow-md ring-1' : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50/40'}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 mr-3" style={{ backgroundColor: `${cor}15`, border: `1px solid ${cor}30` }}><IconeCatalogo value={getTagEmoji(tag)} /></div>
                        <div className="flex-1 min-w-0 pr-2"><div className="text-sm font-medium truncate">{getTagNome(tag)}</div>{isPartial && <div className="text-[11px] text-amber-700 font-medium mt-0.5">Parcial</div>}</div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : isPartial ? 'bg-amber-100 border-amber-400 text-amber-700' : 'border-slate-300 text-transparent group-hover:border-slate-400'}`}><Check className="w-3.5 h-3.5" /></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {resultadoOperacao && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-700">{resultadoOperacao.aplicadas} aplicada(s), {resultadoOperacao.removidas} removida(s), {resultadoOperacao.semAlteracao} sem alteração, {resultadoOperacao.falhas.length} falha(s).</p>
              {resultadoOperacao.falhas.length > 0 && <ul className="list-disc pl-5 space-y-1 text-xs text-red-700">{resultadoOperacao.falhas.map((falha, idx) => <li key={`${falha.ferias_id}-${falha.tag_id}-${idx}`}>Tag {falha.tag_nome || `#${falha.tag_id}`} em {falha.ferias_nome || `Férias #${falha.ferias_id}`}: {falha.motivo}</li>)}</ul>}
            </div>
          )}
        </div>

        <div className="shrink-0 bg-white border-t border-slate-200 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Motivo da atribuição (opcional)</p>
          <Input placeholder="Descreva o motivo da ação" value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={isLocked} />
          <p className="text-xs text-slate-500">{selectedFerias.length} férias × {selecionadas.length} tags definidas = {selectedFerias.length * selecionadas.length} alvo(s) de atualização</p>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading || saving} onClick={() => onConfirm({ finalSelectedTagIds: selecionadas, motivo })}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar alterações'}
          </Button>
        </div>
      </div>
    </div>
  );
}
