import React from 'react';
import { base44 } from '@/api/base44Client';
import gerarDiagnosticoAntiguidade from '@/utils/antiguidade/gerarDiagnosticoAntiguidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const CONFIG_PADRAO = {
  ordem_postos: ['CEL', 'TC', 'MAJ', 'CAP', '1TEN', '2TEN', 'ASP', 'ST', '1SGT', '2SGT', '3SGT', 'CB', 'SD'],
  ordem_quadros: ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QBMPT'],
};

function TabelaResumo({ titulo, dados }) {
  const entries = Object.entries(dados || {}).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody>
            {entries.map(([chave, valor]) => (
              <tr key={chave} className="border-b"><td className="py-1">{chave}</td><td className="py-1 text-right font-semibold">{valor}</td></tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function AntiguidadeDiagnostico() {
  const [loading, setLoading] = React.useState(true);
  const [diag, setDiag] = React.useState(null);
  const [erro, setErro] = React.useState('');

  React.useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      setErro('');
      try {
        const militares = await base44.entities.Militar.filter({ status_cadastro: 'Ativo' });
        let historicos = [];
        try {
          historicos = await base44.entities.HistoricoPromocao.list();
        } catch {
          historicos = [];
        }
        setDiag(gerarDiagnosticoAntiguidade(militares, historicos, CONFIG_PADRAO));
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar diagnóstico de antiguidade.');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  if (loading) return <div className="p-6">Carregando diagnóstico...</div>;
  if (erro) return <div className="p-6 text-red-600">{erro}</div>;

  const cards = [
    ['Total de militares ativos', diag.totalAtivos],
    ['Com posto/graduação', diag.comPostoGraduacao],
    ['Com quadro', diag.comQuadro],
    ['Com data de promoção', diag.comDataPromocao],
    ['Com antiguidade anterior', diag.comAntiguidadeAnterior],
    ['Aptos', diag.aptos],
    ['Pendentes', diag.pendentes],
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Cobertura de Dados para Antiguidade</h1>
        <Button disabled title="Disponível em lote futuro">Gerar lista rascunho (futuro)</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(([label, valor]) => (
          <Card key={label}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{valor}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TabelaResumo titulo="Pendências por motivo" dados={diag.pendentesPorMotivo} />
        <TabelaResumo titulo="Pendências por lotação" dados={diag.porLotacao} />
        <TabelaResumo titulo="Pendências por posto/graduação" dados={diag.porPosto} />
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de militares pendentes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th>Posto</th><th>Quadro</th><th>Nome de guerra</th><th>Nome completo</th><th>Matrícula</th><th>Lotação</th><th>Motivo</th></tr></thead>
              <tbody>
                {diag.pendentesDetalhes.map(({ militar, motivos }) => (
                  <tr key={militar.id} className="border-b">
                    <td>{militar.posto_graduacao || '—'}</td><td>{militar.quadro || '—'}</td><td>{militar.nome_guerra || '—'}</td><td>{militar.nome_completo || '—'}</td><td>{militar.matricula || '—'}</td><td>{militar.lotacao || '—'}</td><td>{motivos.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
