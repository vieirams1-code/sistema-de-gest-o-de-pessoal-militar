import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Search, Tags as TagsIcon, X } from 'lucide-react';

function isAtivo(item) {
  return item?.ativo !== false && item?.ativa !== false && item?.status !== 'inativo';
}

function isAplicavelEmFerias(tag) {
  const valor = String(tag?.aplicabilidade || '').trim().toLowerCase();
  return !valor || valor === 'ferias' || valor === 'férias' || valor === 'todos' || valor === 'ambos';
}

function normalizar(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function FeriasTagsBulkPanel({
  open,
  onClose,
  selectedFerias = [],
  tagsStatusById = {},
  onConfirm,
  loading = false,
  saving = false,
}) {
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);

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
      const grupo = tag?.tag_grupo_id ? gruposPorId.get(String(tag.tag_grupo_id)) : null;
      if (grupo && !isAtivo(grupo)) return false;
      if (!termo) return true;
      const texto = normalizar(`${tag.nome || ''} ${tag.emoji || ''} ${grupo?.nome || 'Sem grupo'}`);
      return texto.includes(termo);
    });
  }, [tags, gruposPorId, busca]);

  const gruposExibicao = useMemo(() => {
    const mapa = new Map();
    tagsFiltradas.forEach((tag) => {
      const nomeGrupo = tag?.tag_grupo_id ? (gruposPorId.get(String(tag.tag_grupo_id))?.nome || 'Sem grupo') : 'Sem grupo';
      if (!mapa.has(nomeGrupo)) mapa.set(nomeGrupo, []);
      mapa.get(nomeGrupo).push(tag);
    });
    return [...mapa.entries()].map(([nome, items]) => ({ nome, items }));
  }, [tagsFiltradas, gruposPorId]);

  useEffect(() => {
    if (!open) return;
    const iniciais = Object.entries(tagsStatusById)
      .filter(([, status]) => status === 'all')
      .map(([tagId]) => String(tagId));
    setSelecionadas(iniciais);
  }, [open, tagsStatusById]);

  if (!open) return null;

  const isLocked = loading || saving;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" onClick={isLocked ? undefined : onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><TagsIcon className="w-5 h-5" /> Gerenciar tags</h2>
          <Button variant="ghost" disabled={isLocked} onClick={onClose}>Fechar <X className="w-4 h-4 ml-1" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/60">
          <div className="bg-white border rounded-lg p-3">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Férias selecionadas ({selectedFerias.length})</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFerias.map((f) => (
                <div key={f.id} className="text-sm border rounded-md p-2 bg-slate-50">
                  <p className="font-medium text-slate-700">{f.militar_nome || 'Militar'}</p>
                  <p className="text-xs text-slate-500">{f.periodo_aquisitivo_ref || `Férias #${f.id}`}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2 border rounded-lg" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tag por nome, emoji ou grupo" />
          </div>

          {gruposExibicao.map((grupo) => (
            <div key={grupo.nome} className="bg-white border rounded-lg p-3">
              <p className="text-xs uppercase font-semibold text-slate-500 mb-2">{grupo.nome}</p>
              <div className="flex flex-wrap gap-2">
                {grupo.items.map((tag) => {
                  const checked = selecionadas.includes(String(tag.id));
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => setSelecionadas((prev) => checked ? prev.filter((id) => id !== String(tag.id)) : [...prev, String(tag.id)])}
                      className={`px-2.5 py-1.5 rounded-full border text-xs ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-300 text-slate-700'}`}
                    >
                      {tag.emoji || '🏷️'} {tag.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-white">
          <Button className="w-full" disabled={isLocked} onClick={() => onConfirm({ finalSelectedTagIds: selecionadas })}>Salvar alterações</Button>
        </div>
      </div>
    </div>
  );
}
