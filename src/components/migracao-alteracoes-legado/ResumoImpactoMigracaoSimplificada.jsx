import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

export default function ResumoImpactoMigracaoSimplificada({ linhas = [] }) {
  const stats = useMemo(() => {
    const calc = {
      total: linhas.length,
      publicado: 0,
      aguardando: 0,
      erro: 0,
      duplicadaNaPlanilha: 0,
      recusada: 0,
      importar: 0,
      naoImportar: 0,
      semTexto: 0,
      semNota: 0,
      jaImportada: 0,
    };

    linhas.forEach((linha) => {
      const statusPub = String(linha.status_publicacao || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, '_');

      if (statusPub === 'PUBLICADO') calc.publicado += 1;
      if (statusPub === 'AGUARDANDO_PUBLICACAO') calc.aguardando += 1;

      if (linha.statusSimplificado === 'erro') calc.erro += 1;
      if (linha.recusada) calc.recusada += 1;

      const isPronta = linha.statusSimplificado === 'pronta';
      const willImport = isPronta && !linha.recusada;

      if (willImport) {
        calc.importar += 1;
      } else {
        calc.naoImportar += 1;
      }

      if (!linha.texto_publicado?.trim()) calc.semTexto += 1;
      if (!linha.numero_nota?.trim()) calc.semNota += 1;

      if (linha.statusSimplificado === 'duplicada') {
        if (linha.erros?.some((e) => e.toLowerCase().includes('já importada'))) {
          calc.jaImportada += 1;
        } else {
          calc.duplicadaNaPlanilha += 1;
        }
      }
    });

    return calc;
  }, [linhas]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1e3a5f]">Impacto da Importação</h2>
        <p className="text-sm text-slate-500 mt-1">
          Serão importadas <strong>{stats.importar}</strong> alterações para o militar selecionado.<br />
          <strong>{stats.naoImportar}</strong> alterações não serão importadas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Lido</p>
          <p className="text-2xl font-bold text-slate-700">{stats.total}</p>
          <div className="mt-2 text-xs text-slate-500 flex justify-between">
            <span>Publicado: {stats.publicado}</span>
            <span>Aguardando: {stats.aguardando}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Serão Importadas
          </p>
          <p className="text-2xl font-bold text-emerald-700">{stats.importar}</p>
        </div>

        <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Não Serão Importadas
          </p>
          <p className="text-2xl font-bold text-amber-700">{stats.naoImportar}</p>
        </div>

        <div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
          <p className="text-xs font-medium text-rose-600 uppercase tracking-wider mb-1 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Com Erro
          </p>
          <p className="text-2xl font-bold text-rose-700">{stats.erro}</p>
        </div>
      </div>

      {stats.naoImportar > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 text-sm">
          <p className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            Consolidação de problemas e bloqueios
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600">
            {stats.semTexto > 0 && <li>&bull; {stats.semTexto} sem texto publicado</li>}
            {stats.semNota > 0 && <li>&bull; {stats.semNota} sem número da nota</li>}
            {stats.duplicadaNaPlanilha > 0 && <li>&bull; {stats.duplicadaNaPlanilha} duplicadas na planilha</li>}
            {stats.jaImportada > 0 && <li>&bull; {stats.jaImportada} já importadas anteriormente</li>}
            {stats.recusada > 0 && <li>&bull; {stats.recusada} recusadas manualmente</li>}
          </ul>
        </div>
      )}
    </div>
  );
}