import React from 'react';
import { UserCheck, Building2 } from 'lucide-react';
import MilitarSelector from '@/components/atestado/MilitarSelector';

/**
 * Card de seleção do militar de destino para o novo fluxo simplificado
 * de Migração de Alterações Legado.
 *
 * - Reaproveita o MilitarSelector escopado (getScopedMilitares).
 * - Não usa Militar.list() global.
 * - Exibe nome, posto/graduação, matrícula e lotação após a seleção.
 */
export default function SelecaoMilitarDestino({
  militarId,
  militarSnapshot,
  onChangeMilitarId,
  onMilitarSelect,
  disabled = false,
}) {
  const handleChange = (_field, novoId) => {
    if (disabled) return;
    onChangeMilitarId(novoId || '');
  };

  const handleMilitarSelect = (snapshot) => {
    if (disabled) return;
    if (onMilitarSelect) onMilitarSelect(snapshot || null);
  };

  const posto = militarSnapshot?.posto_graduacao || militarSnapshot?.militar_posto || '';
  const nome = militarSnapshot?.nome_completo || militarSnapshot?.militar_nome || '';
  const matricula = militarSnapshot?.militar_matricula_atual
    || militarSnapshot?.matricula
    || militarSnapshot?.militar_matricula
    || '';
  const lotacao = militarSnapshot?.lotacao || militarSnapshot?.estrutura_nome || '';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Militar de destino da importação</h2>
          <p className="text-sm text-slate-500">
            Selecione o militar antes de enviar a planilha. Todas as alterações da planilha
            serão vinculadas a este militar.
          </p>
          <p className="text-xs text-slate-400">
            O sistema não tenta mais identificar o militar automaticamente pela planilha.
          </p>
        </div>
      </div>

      <MilitarSelector
        value={militarId || ''}
        onChange={handleChange}
        onMilitarSelect={handleMilitarSelect}
      />

      {militarId && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold mb-1">Destino confirmado</p>
          <p>
            {posto ? `${posto} ` : ''}
            {nome || '—'}
          </p>
          <p className="text-xs text-emerald-800">
            Matrícula: {matricula || '—'}
          </p>
          {lotacao && (
            <p className="text-xs text-emerald-800 flex items-center gap-1 mt-1">
              <Building2 className="w-3 h-3" /> {lotacao}
            </p>
          )}
        </div>
      )}
    </div>
  );
}