import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calcularTentativasBulk, agruparTagsPorGrupo } from '@/utils/funcoesTags/militarTagsBulk';
import { getTagGrupoId } from '@/utils/funcoesTags/contratoCampos';
import { Tags, X } from 'lucide-react';

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

  const grupos = useMemo(() => {
    const agrupadas = agruparTagsPorGrupo(tagsFiltradas, gruposAtivos);
    const prioridade = ['operacional', 'cursos', 'administrativo', 'sem grupo'];
    return [...agrupadas].sort((a, b) => {
      const ai = prioridade.indexOf(String(a?.nome || '').toLowerCase());
      const bi = prioridade.indexOf(String(b?.nome || '').toLowerCase());
      const va = ai === -1 ? 99 : ai;
      const vb = bi === -1 ? 99 : bi;
      if (va !== vb) return va - vb;
      return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR');
    });
  }, [tagsFiltradas, gruposAtivos]);
  const mapaPresenca = useMemo(() => new Map(tagsPresentes.map((item) => [String(item.tagId), item.presentes])), [tagsPresentes]);

  if (!open) return null;

  const toggle = (tagId) => setSelecionadas((prev) => prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold inline-flex items-center gap-2"><Tags className="w-5 h-5 text-slate-600" />{mode === 'remove' ? 'Remover tags' : 'Aplicar tags'}</h3>
          <Button variant="ghost" onClick={onClose} className="inline-flex items-center gap-1"><X className="w-4 h-4" />Fechar</Button>
        </div>
        <div className="px-4 py-3 border-b bg-slate-50 text-sm text-slate-700">Alvos selecionados: <strong>{selectedCount}</strong> {selectedCount === 1 ? 'militar' : 'militares'}</div>
        <div className="p-4 border-b"><Input placeholder="Buscar por nome da tag, emoji ou grupo" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div className="flex-1 overflow-auto space-y-3 p-4 pb-32">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="border rounded-xl p-3">
              <p className="text-sm font-semibold text-slate-700">{grupo.emoji} {grupo.nome}</p>
              <div className="mt-2 space-y-2">
                {grupo.tags.map((tag) => {
                  const id = String(tag.id);
                  const checked = selecionadas.includes(id);
                  return (
                    <button key={id} type="button" className={`w-full text-left flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm ${checked ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`} onClick={() => toggle(id)}>
                      <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center">{tag.emoji || '🏷️'}</span>{tag.nome}</span>
                      <span className={`w-4 h-4 rounded-full border-2 ${checked ? 'border-slate-900 bg-slate-900' : 'border-slate-300'}`} />
                      {mode === 'remove' && <span className="text-xs text-slate-500">presente em {mapaPresenca.get(id) || 0}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="fixed bottom-0 right-0 w-full max-w-xl bg-white border-t p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">Tags prontas para aplicação: <strong>{selecionadas.length}</strong></p>
          <Input placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className="text-xs text-slate-500">{selectedCount} militares × {selecionadas.length} tags = {calcularTentativasBulk(selectedCount, selecionadas.length)} tentativas</p>
          <Button className="w-full" disabled={loading || selecionadas.length === 0} onClick={() => onConfirm({ tagIds: selecionadas, motivo })}>
            {mode === 'remove' ? 'Remover dos selecionados' : 'Aplicar aos selecionados'}
          </Button>
        </div>
      </div>
    </div>
  );
}
