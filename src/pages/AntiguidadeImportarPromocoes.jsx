import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { gerarPreviaImportacao, parseArquivoPromocoes } from '@/utils/antiguidade/importarPromocoes';

export default function AntiguidadeImportarPromocoes() {
  const [arquivo, setArquivo] = React.useState(null);
  const [processando, setProcessando] = React.useState(false);
  const [previa, setPrevia] = React.useState(null);
  const [importando, setImportando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [erro, setErro] = React.useState('');

  const processarPrevia = async () => {
    if (!arquivo) return;
    setProcessando(true);
    setErro('');
    setResultado(null);
    try {
      const rows = await parseArquivoPromocoes(arquivo);
      const [militares, historicos] = await Promise.all([
        base44.entities.Militar.filter({ status_cadastro: 'Ativo' }),
        base44.entities.HistoricoPromocao.list(),
      ]);
      setPrevia(gerarPreviaImportacao(rows, militares, historicos));
    } catch (e) {
      setErro(e?.message || 'Erro ao processar prévia de importação.');
    } finally {
      setProcessando(false);
    }
  };

  const importarValidos = async () => {
    if (!previa) return;
    setImportando(true);
    setErro('');
    try {
      let criados = 0;
      for (const item of previa.previas) {
        if (!item.podeImportar || !item.militar) continue;
        await base44.entities.HistoricoPromocao.create({
          militar_id: item.militar.id,
          posto_graduacao_anterior: item.militar.posto_graduacao || '',
          quadro_anterior: item.militar.quadro || '',
          posto_graduacao_novo: item.row.posto_graduacao_novo || '',
          quadro_novo: item.row.quadro_novo || '',
          data_promocao: item.dataPromocao,
          data_publicacao: item.row.data_publicacao || null,
          boletim_referencia: item.row.boletim_referencia || '',
          ato_referencia: item.row.ato_referencia || '',
          antiguidade_referencia_ordem: item.row.antiguidade_referencia_ordem ? Number(item.row.antiguidade_referencia_ordem) : null,
          antiguidade_referencia_id: item.row.antiguidade_referencia_id || '',
          origem_dado: 'importacao',
          status_registro: 'ativo',
          observacoes: item.row.observacoes || '',
        });
        criados += 1;
      }
      setResultado({ criados });
    } catch (e) {
      setErro(e?.message || 'Erro ao importar registros válidos.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[#1e3a5f]">Importar Promoções (Prévia e Confirmação)</h1>

      <Card>
        <CardHeader><CardTitle>Arquivo de importação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <input type="file" accept=".csv,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
          <div>
            <Button disabled={!arquivo || processando} onClick={processarPrevia}>{processando ? 'Processando...' : 'Processar prévia (dry-run)'}</Button>
          </div>
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
        </CardContent>
      </Card>

      {previa && (
        <Card>
          <CardHeader><CardTitle>Resumo da prévia</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {Object.entries(previa.resumo).map(([k, v]) => <div key={k}><strong>{k}</strong>: {v}</div>)}
            <div className="col-span-full mt-2">
              <Button onClick={importarValidos} disabled={importando || previa.resumo.prontosImportar === 0}>{importando ? 'Importando...' : 'Importar registros válidos'}</Button>
            </div>
            {resultado && <p className="col-span-full text-green-700 font-semibold">Importação concluída. Registros criados: {resultado.criados}</p>}
          </CardContent>
        </Card>
      )}

      {previa && (
        <Card>
          <CardHeader><CardTitle>Tabela de prévia por linha</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left"><th>Linha</th><th>Matrícula</th><th>Militar</th><th>Data promoção</th><th>Status</th></tr></thead>
                <tbody>
                  {previa.previas.map((item) => (
                    <tr key={`${item.row._linha}-${item.row.matricula}`} className="border-b align-top">
                      <td>{item.row._linha}</td>
                      <td>{item.row.matricula || '—'}</td>
                      <td>{item.militar?.nome_guerra || item.row.nome_guerra || '—'}</td>
                      <td>{item.row.data_promocao || '—'}</td>
                      <td>{item.status.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
