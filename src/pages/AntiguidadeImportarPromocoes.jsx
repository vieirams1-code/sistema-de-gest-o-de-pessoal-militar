import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { gerarPreviaImportacao, parseArquivoPromocoes } from '@/utils/antiguidade/importarPromocoes';

const STATUS_ATIVO = 'ativo';

const DEFAULT_FORM = {
  militar_id: '', posto_graduacao_anterior: '', quadro_anterior: '', posto_graduacao_novo: '', quadro_novo: '',
  data_promocao: '', data_publicacao: '', boletim_referencia: '', ato_referencia: '', antiguidade_referencia_ordem: '',
  antiguidade_referencia_id: '', observacoes: '',
};

export default function AntiguidadeImportarPromocoes() {
  const [aba, setAba] = React.useState('importacao');
  const [arquivo, setArquivo] = React.useState(null);
  const [processando, setProcessando] = React.useState(false);
  const [previa, setPrevia] = React.useState(null);
  const [importando, setImportando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [erro, setErro] = React.useState('');

  const [militares, setMilitares] = React.useState([]);
  const [buscaMilitar, setBuscaMilitar] = React.useState('');
  const [form, setForm] = React.useState(DEFAULT_FORM);
  const [historico, setHistorico] = React.useState([]);
  const [feedbackManual, setFeedbackManual] = React.useState('');
  const [motivoRetificacao, setMotivoRetificacao] = React.useState('');

  React.useEffect(() => {
    if (aba !== 'manual') return;
    const carregar = async () => {
      const militaresAtivos = await base44.entities.Militar.filter({ status_cadastro: 'Ativo' });
      setMilitares(militaresAtivos);
    };
    carregar();
  }, [aba]);

  const militarSelecionado = React.useMemo(() => militares.find((m) => m.id === form.militar_id) || null, [militares, form.militar_id]);

  const militaresFiltrados = React.useMemo(() => {
    const q = buscaMilitar.trim().toLowerCase();
    if (!q) return militares.slice(0, 25);
    return militares.filter((m) => [m.nome_completo, m.nome_guerra, m.matricula, m.lotacao, m.posto_graduacao, m.quadro].some((v) => String(v || '').toLowerCase().includes(q))).slice(0, 25);
  }, [militares, buscaMilitar]);

  const carregarHistorico = async (militarId) => {
    if (!militarId) return;
    const todos = await base44.entities.HistoricoPromocao.list();
    const hist = todos.filter((h) => h.militar_id === militarId).sort((a, b) => String(b.data_promocao || '').localeCompare(String(a.data_promocao || '')));
    setHistorico(hist);
  };

  const atualizarDiagnostico = async () => {
    await queryClientInstance.invalidateQueries({ queryKey: ['antiguidade-diagnostico'] });
  };

  const processarPrevia = async () => {
    if (!arquivo) return;
    setProcessando(true);
    setErro('');
    setResultado(null);
    try {
      const rows = await parseArquivoPromocoes(arquivo);
      const [militaresAtivos, historicos] = await Promise.all([base44.entities.Militar.filter({ status_cadastro: 'Ativo' }), base44.entities.HistoricoPromocao.list()]);
      setPrevia(gerarPreviaImportacao(rows, militaresAtivos, historicos));
    } catch (e) { setErro(e?.message || 'Erro ao processar prévia de importação.'); } finally { setProcessando(false); }
  };

  const importarValidos = async () => {
    if (!previa) return;
    setImportando(true);
    setErro('');
    try {
      let criados = 0;
      for (const item of previa.previas) {
        if (!item.podeImportar || !item.militar) continue;
        await base44.entities.HistoricoPromocao.create({ militar_id: item.militar.id, posto_graduacao_anterior: item.militar.posto_graduacao || '', quadro_anterior: item.militar.quadro || '', posto_graduacao_novo: item.row.posto_graduacao_novo || '', quadro_novo: item.row.quadro_novo || '', data_promocao: item.dataPromocao, data_publicacao: item.row.data_publicacao || null, boletim_referencia: item.row.boletim_referencia || '', ato_referencia: item.row.ato_referencia || '', antiguidade_referencia_ordem: item.row.antiguidade_referencia_ordem ? Number(item.row.antiguidade_referencia_ordem) : null, antiguidade_referencia_id: item.row.antiguidade_referencia_id || '', origem_dado: 'importacao', status_registro: STATUS_ATIVO, observacoes: item.row.observacoes || '' });
        criados += 1;
      }
      await atualizarDiagnostico();
      setResultado({ criados });
    } catch (e) { setErro(e?.message || 'Erro ao importar registros válidos.'); } finally { setImportando(false); }
  };

  const validarManual = async () => {
    if (!form.militar_id || !form.posto_graduacao_novo || !form.quadro_novo || !form.data_promocao) throw new Error('Preencha militar, posto/graduação novo, quadro novo e data de promoção.');
    const todos = await base44.entities.HistoricoPromocao.list();
    const ativos = todos.filter((h) => h.status_registro === STATUS_ATIVO && h.militar_id === form.militar_id);
    const dup = ativos.find((h) => h.posto_graduacao_novo === form.posto_graduacao_novo && h.data_promocao === form.data_promocao);
    if (dup) throw new Error('Já existe registro ativo igual (militar, posto/graduação novo, data de promoção).');
    const divergente = ativos.find((h) => h.posto_graduacao_novo === form.posto_graduacao_novo && h.data_promocao !== form.data_promocao);
    if (divergente) throw new Error('Existe registro ativo divergente para o mesmo militar/posto. Use retificação controlada.');
  };

  const lancarManual = async () => {
    setFeedbackManual('');
    await validarManual();
    await base44.entities.HistoricoPromocao.create({ ...form, origem_dado: 'manual', status_registro: STATUS_ATIVO, antiguidade_referencia_ordem: form.antiguidade_referencia_ordem ? Number(form.antiguidade_referencia_ordem) : null });
    setFeedbackManual('Registro manual criado com sucesso.');
    await atualizarDiagnostico();
    await carregarHistorico(form.militar_id);
  };

  const retificarRegistro = async (registro) => {
    if (!motivoRetificacao.trim()) throw new Error('Informe motivo da retificação/cancelamento.');
    await base44.entities.HistoricoPromocao.update(registro.id, { status_registro: 'retificado', observacoes: `${registro.observacoes || ''} | Retificado: ${motivoRetificacao}`.trim() });
    await base44.entities.HistoricoPromocao.create({ ...registro, id: undefined, status_registro: STATUS_ATIVO, origem_dado: 'manual', observacoes: `${registro.observacoes || ''} | Novo registro por retificação: ${motivoRetificacao}`.trim() });
    setMotivoRetificacao('');
    await atualizarDiagnostico();
    await carregarHistorico(registro.militar_id);
  };

  const cancelarRegistro = async (registro) => {
    if (!motivoRetificacao.trim()) throw new Error('Informe motivo da retificação/cancelamento.');
    await base44.entities.HistoricoPromocao.update(registro.id, { status_registro: 'cancelado', observacoes: `${registro.observacoes || ''} | Cancelado: ${motivoRetificacao}`.trim() });
    setMotivoRetificacao('');
    await atualizarDiagnostico();
    await carregarHistorico(registro.militar_id);
  };

  return <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold text-[#1e3a5f]">Promoções de Antiguidade</h1>
    <div className="flex gap-2">
      <Button variant={aba === 'importacao' ? 'default' : 'outline'} onClick={() => setAba('importacao')}>Importação</Button>
      <Button variant={aba === 'manual' ? 'default' : 'outline'} onClick={() => setAba('manual')}>Lançamento Manual</Button>
    </div>

    {aba === 'importacao' && <>{/* existing */}
      <Card><CardHeader><CardTitle>Arquivo de importação</CardTitle></CardHeader><CardContent className="space-y-4"><input type="file" accept=".csv,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /><div><Button disabled={!arquivo || processando} onClick={processarPrevia}>{processando ? 'Processando...' : 'Processar prévia (dry-run)'}</Button></div>{erro && <p className="text-red-600 text-sm">{erro}</p>}</CardContent></Card>
      {previa && <Card><CardHeader><CardTitle>Resumo da prévia</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">{Object.entries(previa.resumo).map(([k, v]) => <div key={k}><strong>{k}</strong>: {v}</div>)}<div className="col-span-full mt-2"><Button onClick={importarValidos} disabled={importando || previa.resumo.prontosImportar === 0}>{importando ? 'Importando...' : 'Importar registros válidos'}</Button></div>{resultado && <p className="col-span-full text-green-700 font-semibold">Importação concluída. Registros criados: {resultado.criados}</p>}</CardContent></Card>}
    </>}

    {aba === 'manual' && <>
      <Card><CardHeader><CardTitle>Lançamento manual individual</CardTitle></CardHeader><CardContent className="space-y-4">
        <div><Label>Buscar militar</Label><Input value={buscaMilitar} onChange={(e) => setBuscaMilitar(e.target.value)} placeholder="Nome, nome de guerra, matrícula, lotação..." /></div>
        <div className="max-h-56 overflow-auto border rounded-md p-2 space-y-1">{militaresFiltrados.map((m) => <button key={m.id} className={`w-full text-left p-2 rounded ${form.militar_id === m.id ? 'bg-slate-100' : ''}`} onClick={() => { setForm((f) => ({ ...f, militar_id: m.id, posto_graduacao_anterior: m.posto_graduacao || '', quadro_anterior: m.quadro || '' })); carregarHistorico(m.id); }}><div className="text-sm">{`${m.posto_graduacao || 'S/POSTO'} ${m.quadro || 'S/QUADRO'} ${m.nome_completo || ''} — ${m.matricula || 'S/MAT'} — ${m.lotacao || 'S/LOTAÇÃO'}`}</div><div className="text-xs"><strong>{m.nome_guerra || 'Sem nome de guerra'}</strong></div></button>)}</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Posto/graduação novo" value={form.posto_graduacao_novo} onChange={(e) => setForm((f) => ({ ...f, posto_graduacao_novo: e.target.value }))} />
          <Input placeholder="Quadro novo" value={form.quadro_novo} onChange={(e) => setForm((f) => ({ ...f, quadro_novo: e.target.value }))} />
          <Input type="date" value={form.data_promocao} onChange={(e) => setForm((f) => ({ ...f, data_promocao: e.target.value }))} />
          <Input type="date" value={form.data_publicacao} onChange={(e) => setForm((f) => ({ ...f, data_publicacao: e.target.value }))} />
          <Input placeholder="Boletim" value={form.boletim_referencia} onChange={(e) => setForm((f) => ({ ...f, boletim_referencia: e.target.value }))} />
          <Input placeholder="Ato" value={form.ato_referencia} onChange={(e) => setForm((f) => ({ ...f, ato_referencia: e.target.value }))} />
          <Input placeholder="Antiguidade ordem" value={form.antiguidade_referencia_ordem} onChange={(e) => setForm((f) => ({ ...f, antiguidade_referencia_ordem: e.target.value }))} />
          <Input placeholder="Antiguidade ID" value={form.antiguidade_referencia_id} onChange={(e) => setForm((f) => ({ ...f, antiguidade_referencia_id: e.target.value }))} />
        </div>
        <Input placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
        <div className="flex gap-2"><Button onClick={() => lancarManual().catch((e) => setFeedbackManual(e.message))}>Lançar promoção manual</Button></div>
        {militarSelecionado && <p className="text-xs text-slate-600">Militar selecionado: {militarSelecionado.nome_completo}</p>}
        {feedbackManual && <p className="text-sm text-blue-700">{feedbackManual}</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Histórico de promoções do militar</CardTitle></CardHeader><CardContent className="space-y-3">
        <Input placeholder="Motivo obrigatório para retificar/cancelar" value={motivoRetificacao} onChange={(e) => setMotivoRetificacao(e.target.value)} />
        <div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th>Status</th><th>Posto ant.</th><th>Posto novo</th><th>Quadro</th><th>Data</th><th>Boletim/Ato</th><th>Antiguidade ordem</th><th>Origem</th><th>Observações</th><th>Ações</th></tr></thead><tbody>{historico.map((h) => <tr key={h.id} className="border-b"><td>{h.status_registro}</td><td>{h.posto_graduacao_anterior || '—'}</td><td>{h.posto_graduacao_novo || '—'}</td><td>{h.quadro_novo || '—'}</td><td>{h.data_promocao || '—'}</td><td>{h.boletim_referencia || h.ato_referencia || '—'}</td><td>{h.antiguidade_referencia_ordem ?? '—'}</td><td>{h.origem_dado || '—'}</td><td>{h.observacoes || '—'}</td><td className="space-x-1"><Button size="sm" variant="outline" disabled={h.status_registro !== STATUS_ATIVO} onClick={() => retificarRegistro(h).catch((e) => setFeedbackManual(e.message))}>Retificar</Button><Button size="sm" variant="destructive" disabled={h.status_registro !== STATUS_ATIVO} onClick={() => cancelarRegistro(h).catch((e) => setFeedbackManual(e.message))}>Cancelar</Button></td></tr>)}</tbody></table></div>
      </CardContent></Card>
    </>}
  </div>;
}
