import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { calcularTentativasBulk, agruparTagsPorGrupo } from '@/utils/funcoesTags/militarTagsBulk';
import { getTagGrupoId } from '@/utils/funcoesTags/contratoCampos';

export default function MilitarTagsBulkPanel({
  open,
  mode,
  onClose,
  selectedCount,
  tagsAtivas,
  gruposAtivos,
  tagsPresentes,
  onConfirm,
  loading,
}) {
  const [busca, setBusca] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const [motivo, setMotivo] = useState('');

  const fonteTags = mode === 'remove' ? tagsPresentes.map((item) => item.tag) : tagsAtivas;
  const tagsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const gruposPorId = new Map((gruposAtivos || []).map((grupo) => [String(grupo.id), grupo]));

    return fonteTags.filter((tag) => {
      const grupoId = getTagGrupoId(tag) || 'sem-grupo';
      const grupoNome = grupoId === 'sem-grupo'
        ? 'Sem grupo'
        : gruposPorId.get(String(grupoId))?.nome || 'Sem grupo';

      const texto = [tag.nome, tag.emoji, grupoNome].join(' ').toLowerCase();
      return !termo || texto.includes(termo);
    });
  }, [fonteTags, busca, gruposAtivos]);

  const grupos = useMemo(() => agruparTagsPorGrupo(tagsFiltradas, gruposAtivos), [tagsFiltradas, gruposAtivos]);
  const mapaPresenca = useMemo(() => new Map(tagsPresentes.map((item) => [String(item.tagId), item.presentes])), [tagsPresentes]);

  if (!open) return null;

  const toggle = (tagId) => setSelecionadas((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l shadow-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{mode === 'remove' ? 'Remover tags' : 'Aplicar tags'}</h3>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
        <Input placeholder="Buscar tag" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <div className="flex-1 overflow-auto space-y-2">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="border rounded-lg p-2">
              <p className="text-sm font-medium">{grupo.emoji} {grupo.nome}</p>
              <div className="mt-2 space-y-2">
                {grupo.tags.map((tag) => {
                  const id = String(tag.id);
                  const checked = selecionadas.includes(id);
                  return (
                    <label key={id} className="flex items-center justify-between gap-2 text-sm cursor-pointer">
                      <span className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={() => toggle(id)} />{tag.emoji || '🏷️'} {tag.nome}</span>
                      {mode === 'remove' && <span className="text-xs text-slate-500">presente em {mapaPresenca.get(id) || 0}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <Input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <p className="text-xs text-slate-500">{selectedCount} militares × {selecionadas.length} tags = {calcularTentativasBulk(selectedCount, selecionadas.length)} tentativas</p>
        {mode === 'apply' && <p className="text-xs text-slate-500">Duplicidades serão ignoradas</p>}
        <Button disabled={loading || selecionadas.length === 0} onClick={() => onConfirm({ tagIds: selecionadas, motivo })}>
          {mode === 'remove' ? 'Remover dos selecionados' : 'Aplicar aos selecionados'}
        </Button>
      </div>
    </div>
  );
}
