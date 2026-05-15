import React from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { gerarPreviaImportacao, parseArquivoPromocoes } from '@/utils/antiguidade/importarPromocoes';
import {
  POSTOS_GRADUACOES,
  PROMOCAO_COLETIVA_TEXTO_CONFIRMACAO,
  PROMOCAO_COLETIVA_TIPO_HISTORICO,
  PROMOCAO_COLETIVA_TIPO_PREVISTO,
  PROMOCAO_HISTORICA_TEXTO_CONFIRMACAO,
  QUADROS,
  prepararRegistroPromocaoColetiva,
  resolverCopiaOrdemPromocaoAnterior,
  selecionarCandidatosPromocaoColetiva,
  validarLinhaPromocaoColetiva,
} from '@/components/antiguidade/promocaoHistoricaUtils';

const STATUS_ATIVO = 'ativo';

const DEFAULT_COLETIVA_FORM = {
  tipo_lancamento: PROMOCAO_COLETIVA_TIPO_PREVISTO,
  posto_graduacao_anterior: '',
  posto_graduacao_novo: '',
  quadro_novo: '',
  data_promocao: '',
  data_publicacao: '',
  boletim_referencia: '',
  ato_referencia: '',
  observacoes: '',
  copiar_ordem_promocao_anterior: false,
};

const DEFAULT_FORM = {
  militar_id: '',
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

  const [coletivaForm, setColetivaForm] = React.useState(DEFAULT_COLETIVA_FORM);
  const [historicosColetiva, setHistoricosColetiva] = React.useState([]);
  const [selecionadosColetiva, setSelecionadosColetiva] = React.useState([]);
  const [ordensColetiva, setOrdensColetiva] = React.useState({});
  const [confirmacaoColetiva, setConfirmacaoColetiva] = React.useState('');
  const [gravandoColetiva, setGravandoColetiva] = React.useState(false);
  const [feedbackColetiva, setFeedbackColetiva] = React.useState(null);
  const [alertasCopiaOrdemColetiva, setAlertasCopiaOrdemColetiva] = React.useState({});

  React.useEffect(() => {
    if (!['manual', 'coletiva'].includes(aba)) return;
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
    const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
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
      const [militaresAtivos, historicos] = await Promise.all([base44.entities.Militar.filter({ status_cadastro: 'Ativo' }), base44.entities.HistoricoPromocaoMilitarV2.list()]);
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
        await base44.entities.HistoricoPromocaoMilitarV2.create({ militar_id: item.militar.id, posto_graduacao_anterior: item.militar.posto_graduacao || '', quadro_anterior: item.militar.quadro || '', posto_graduacao_novo: item.row.posto_graduacao_novo || '', quadro_novo: item.row.quadro_novo || '', data_promocao: item.dataPromocao, data_publicacao: item.row.data_publicacao || null, boletim_referencia: item.row.boletim_referencia || '', ato_referencia: item.row.ato_referencia || '', antiguidade_referencia_ordem: item.row.antiguidade_referencia_ordem ? Number(item.row.antiguidade_referencia_ordem) : null, antiguidade_referencia_id: item.row.antiguidade_referencia_id || '', origem_dado: 'importacao', status_registro: STATUS_ATIVO, observacoes: item.row.observacoes || '' });
        criados += 1;
      }
      await atualizarDiagnostico();
      setResultado({ criados });
    } catch (e) { setErro(e?.message || 'Erro ao importar registros válidos.'); } finally { setImportando(false); }
  };

  const validarManual = async () => {
    if (!form.militar_id || !militarSelecionado?.posto_graduacao || !militarSelecionado?.quadro || !form.data_promocao) throw new Error('Preencha militar e data da promoção atual. Posto/quadro são obtidos do cadastro atual do militar.');
    const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
    const ativos = todos.filter((h) => h.status_registro === STATUS_ATIVO && h.militar_id === form.militar_id);
    const postoAtual = militarSelecionado.posto_graduacao || '';
    const quadroAtual = militarSelecionado.quadro || '';
    const dup = ativos.find((h) => h.posto_graduacao_novo === postoAtual && h.quadro_novo === quadroAtual && h.data_promocao === form.data_promocao);
    if (dup) throw new Error('Já existe registro ativo igual (militar, posto/graduação novo, data de promoção).');
    const divergente = ativos.find((h) => h.posto_graduacao_novo === postoAtual && h.quadro_novo === quadroAtual && h.data_promocao !== form.data_promocao);
    if (divergente) throw new Error('Existe registro ativo divergente para o mesmo militar/posto. Use retificação controlada.');
  };

  const lancarManual = async () => {
    setFeedbackManual('');
    await validarManual();
    await base44.entities.HistoricoPromocaoMilitarV2.create({
      ...form,
      posto_graduacao_novo: militarSelecionado?.posto_graduacao || '',
      quadro_novo: militarSelecionado?.quadro || '',
      origem_dado: 'manual',
      status_registro: STATUS_ATIVO,
      antiguidade_referencia_ordem: form.antiguidade_referencia_ordem ? Number(form.antiguidade_referencia_ordem) : null,
    });
    setFeedbackManual('Registro manual criado com sucesso.');
    await atualizarDiagnostico();
    await carregarHistorico(form.militar_id);
  };

  const retificarRegistro = async (registro) => {
    if (!motivoRetificacao.trim()) throw new Error('Informe motivo da retificação/cancelamento.');
    await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: 'retificado', observacoes: `${registro.observacoes || ''} | Retificado: ${motivoRetificacao}`.trim() });
    await base44.entities.HistoricoPromocaoMilitarV2.create({ ...registro, id: undefined, status_registro: STATUS_ATIVO, origem_dado: 'manual', observacoes: `${registro.observacoes || ''} | Novo registro por retificação: ${motivoRetificacao}`.trim() });
    setMotivoRetificacao('');
    await atualizarDiagnostico();
    await carregarHistorico(registro.militar_id);
  };

  const cancelarRegistro = async (registro) => {
    if (!motivoRetificacao.trim()) throw new Error('Informe motivo da retificação/cancelamento.');
    await base44.entities.HistoricoPromocaoMilitarV2.update(registro.id, { status_registro: 'cancelado', observacoes: `${registro.observacoes || ''} | Cancelado: ${motivoRetificacao}`.trim() });
    setMotivoRetificacao('');
    await atualizarDiagnostico();
    await carregarHistorico(registro.militar_id);
  };


  const tipoColetivaHistorico = coletivaForm.tipo_lancamento === PROMOCAO_COLETIVA_TIPO_HISTORICO;
  const textoConfirmacaoColetiva = tipoColetivaHistorico
    ? PROMOCAO_HISTORICA_TEXTO_CONFIRMACAO
    : PROMOCAO_COLETIVA_TEXTO_CONFIRMACAO;
  const rotuloTipoColetiva = tipoColetivaHistorico ? 'históricos ativos' : 'previstos';

  const candidatosColetiva = React.useMemo(() => selecionarCandidatosPromocaoColetiva({
    militares,
    postoOrigem: coletivaForm.posto_graduacao_anterior,
    tipoLancamento: coletivaForm.tipo_lancamento,
  }), [militares, coletivaForm.posto_graduacao_anterior, coletivaForm.tipo_lancamento]);

  React.useEffect(() => {
    if (aba !== 'coletiva') return;
    setSelecionadosColetiva(candidatosColetiva.map((m) => m.id));
  }, [aba, candidatosColetiva]);

  React.useEffect(() => {
    if (aba !== 'coletiva') return;
    const carregarHistoricosColetiva = async () => {
      const todos = await base44.entities.HistoricoPromocaoMilitarV2.list();
      setHistoricosColetiva(todos);
    };
    carregarHistoricosColetiva();
  }, [aba]);

  const linhasColetiva = React.useMemo(() => candidatosColetiva
    .map((militar) => ({
      militar,
      selecionado: selecionadosColetiva.includes(militar.id),
      validacao: validarLinhaPromocaoColetiva({
        militar,
        form: coletivaForm,
        historicos: historicosColetiva,
        ordem: ordensColetiva[militar.id],
      }),
    })), [candidatosColetiva, coletivaForm, historicosColetiva, ordensColetiva, selecionadosColetiva]);

  const linhasSelecionadasColetiva = React.useMemo(() => linhasColetiva.filter((linha) => linha.selecionado), [linhasColetiva]);

  const resumoColetiva = React.useMemo(() => ({
    selecionados: linhasSelecionadasColetiva.length,
    aptos: linhasSelecionadasColetiva.filter((linha) => linha.validacao.apto).length,
    bloqueados: linhasSelecionadasColetiva.filter((linha) => !linha.validacao.apto).length,
  }), [linhasSelecionadasColetiva]);

  const atualizarCampoColetiva = (campo, valor) => {
    setFeedbackColetiva(null);
    setColetivaForm((f) => ({ ...f, [campo]: valor }));
  };

  const aplicarCopiaOrdensAnteriores = React.useCallback(() => {
    if (!tipoColetivaHistorico) return;

    const proximasOrdens = {};
    const proximosAlertas = {};

    candidatosColetiva.forEach((militar) => {
      if (!selecionadosColetiva.includes(militar.id)) return;
      const copia = resolverCopiaOrdemPromocaoAnterior({
        militar,
        form: coletivaForm,
        historicos: historicosColetiva,
      });
      proximasOrdens[militar.id] = copia.ordem ? String(copia.ordem) : '';
      if (copia.alerta) proximosAlertas[militar.id] = copia.alerta;
    });

    setOrdensColetiva((ordensAtuais) => ({ ...ordensAtuais, ...proximasOrdens }));
    setAlertasCopiaOrdemColetiva(proximosAlertas);
  }, [candidatosColetiva, coletivaForm, historicosColetiva, selecionadosColetiva, tipoColetivaHistorico]);

  React.useEffect(() => {
    if (!coletivaForm.copiar_ordem_promocao_anterior || !tipoColetivaHistorico) {
      setAlertasCopiaOrdemColetiva({});
      return;
    }
    aplicarCopiaOrdensAnteriores();
  }, [aplicarCopiaOrdensAnteriores, coletivaForm.copiar_ordem_promocao_anterior, tipoColetivaHistorico]);

  const alternarSelecaoColetiva = (militarId) => {
    setSelecionadosColetiva((ids) => (ids.includes(militarId)
      ? ids.filter((id) => id !== militarId)
      : [...ids, militarId]));
  };

  const atualizarCopiaOrdemPromocaoAnterior = (marcado) => {
    atualizarCampoColetiva('copiar_ordem_promocao_anterior', marcado);
    if (!marcado) setAlertasCopiaOrdemColetiva({});
  };

  const gravarColetiva = async () => {
    setFeedbackColetiva(null);
    if (confirmacaoColetiva !== textoConfirmacaoColetiva) {
      setFeedbackColetiva({ erro: `Digite exatamente: ${textoConfirmacaoColetiva}` });
      return;
    }

    setGravandoColetiva(true);
    try {
      const historicosAtualizados = await base44.entities.HistoricoPromocaoMilitarV2.list();
      setHistoricosColetiva(historicosAtualizados);
      const linhasRevalidadas = candidatosColetiva
        .filter((m) => selecionadosColetiva.includes(m.id))
        .map((militar) => ({
          militar,
          validacao: validarLinhaPromocaoColetiva({
            militar,
            form: coletivaForm,
            historicos: historicosAtualizados,
            ordem: ordensColetiva[militar.id],
          }),
        }));
      const aptas = linhasRevalidadas.filter((linha) => linha.validacao.apto);
      const falhas = [];
      let criados = 0;

      for (const linha of aptas) {
        try {
          await base44.entities.HistoricoPromocaoMilitarV2.create(prepararRegistroPromocaoColetiva({
            militar: linha.militar,
            form: coletivaForm,
            historicos: historicosAtualizados,
            ordem: ordensColetiva[linha.militar.id],
          }));
          criados += 1;
        } catch (e) {
          falhas.push(`${linha.militar.nome_completo || linha.militar.id}: ${e?.message || 'erro ao criar'}`);
        }
      }

      await atualizarDiagnostico();
      setFeedbackColetiva({
        resumo: {
          totalSelecionado: linhasRevalidadas.length,
          totalApto: aptas.length,
          totalBloqueado: linhasRevalidadas.length - aptas.length,
          totalCriado: criados,
          falhas: falhas.length,
        },
        falhas,
      });
      setConfirmacaoColetiva('');
      const historicosDepois = await base44.entities.HistoricoPromocaoMilitarV2.list();
      setHistoricosColetiva(historicosDepois);
    } catch (e) {
      setFeedbackColetiva({ erro: e?.message || `Erro ao gravar promoção coletiva ${tipoColetivaHistorico ? 'histórica' : 'prevista'}.` });
    } finally {
      setGravandoColetiva(false);
    }
  };

  return <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold text-[#1e3a5f]">Promoções de Antiguidade</h1>
    <div className="flex gap-2">
      <Button variant={aba === 'importacao' ? 'default' : 'outline'} onClick={() => setAba('importacao')}>Importação</Button>
      <Button variant={aba === 'manual' ? 'default' : 'outline'} onClick={() => setAba('manual')}>Registrar promoção atual</Button>
      <Button variant={aba === 'coletiva' ? 'default' : 'outline'} onClick={() => setAba('coletiva')}>Promoção Coletiva</Button>
    </div>

    {aba === 'importacao' && <>{/* existing */}
      <Card><CardHeader><CardTitle>Arquivo de importação</CardTitle></CardHeader><CardContent className="space-y-4"><input type="file" accept=".csv,.xlsx" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /><div><Button disabled={!arquivo || processando} onClick={processarPrevia}>{processando ? 'Processando...' : 'Processar prévia (dry-run)'}</Button></div>{erro && <p className="text-red-600 text-sm">{erro}</p>}</CardContent></Card>
      {previa && <Card><CardHeader><CardTitle>Resumo da prévia</CardTitle></CardHeader><CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">{Object.entries(previa.resumo).map(([k, v]) => <div key={k}><strong>{k}</strong>: {v}</div>)}<div className="col-span-full mt-2"><Button onClick={importarValidos} disabled={importando || previa.resumo.prontosImportar === 0}>{importando ? 'Importando...' : 'Importar registros válidos'}</Button></div>{resultado && <p className="col-span-full text-green-700 font-semibold">Importação concluída. Registros criados: {resultado.criados}</p>}</CardContent></Card>}
    </>}


    {aba === 'coletiva' && <>
      <Card><CardHeader><CardTitle>Promoção Coletiva — lançamento previsto ou histórico</CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-slate-700">Este fluxo cria registros em HistoricoPromocaoMilitarV2 com origem coletiva. Não atualiza Militar, não efetiva cadastro funcional, não altera a Prévia Geral e não cria snapshot/lista oficial.</p>
        <div>
          <Label>Tipo de lançamento</Label>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <label className={`border rounded-md p-3 cursor-pointer ${!tipoColetivaHistorico ? 'bg-slate-100 border-slate-400' : ''}`}>
              <input className="mr-2" type="radio" name="tipo_lancamento_coletiva" value={PROMOCAO_COLETIVA_TIPO_PREVISTO} checked={!tipoColetivaHistorico} onChange={(e) => atualizarCampoColetiva('tipo_lancamento', e.target.value)} />
              <strong>Previsto/futuro</strong> — grava status_registro = "previsto".
            </label>
            <label className={`border rounded-md p-3 cursor-pointer ${tipoColetivaHistorico ? 'bg-amber-50 border-amber-400' : ''}`}>
              <input className="mr-2" type="radio" name="tipo_lancamento_coletiva" value={PROMOCAO_COLETIVA_TIPO_HISTORICO} checked={tipoColetivaHistorico} onChange={(e) => atualizarCampoColetiva('tipo_lancamento', e.target.value)} />
              <strong>Histórico/passado</strong> — grava status_registro = "ativo" sem alterar cadastro atual.
            </label>
          </div>
        </div>
        {tipoColetivaHistorico && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">Promoção histórica aceita militares hoje em posto superior ao destino histórico. O posto de origem é referência do ato; divergências com o posto atual geram alerta, não bloqueio.</p>}
        {tipoColetivaHistorico && <label className="flex items-start gap-2 text-sm border rounded-md p-3 bg-slate-50">
          <input type="checkbox" className="mt-1" checked={Boolean(coletivaForm.copiar_ordem_promocao_anterior)} onChange={(e) => atualizarCopiaOrdemPromocaoAnterior(e.target.checked)} />
          <span><strong>Copiar ordem da promoção anterior</strong><br />Busca a promoção ativa anterior segura mais próxima do mesmo militar e preenche a ordem para edição manual antes de salvar.</span>
        </label>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Posto/graduação de origem</Label><Input list="postos-promocao-coletiva" value={coletivaForm.posto_graduacao_anterior} onChange={(e) => atualizarCampoColetiva('posto_graduacao_anterior', e.target.value)} /></div>
          <div><Label>Posto/graduação de destino</Label><Input list="postos-promocao-coletiva" value={coletivaForm.posto_graduacao_novo} onChange={(e) => atualizarCampoColetiva('posto_graduacao_novo', e.target.value)} /></div>
          <div><Label>Quadro novo</Label><Input list="quadros-promocao-coletiva" value={coletivaForm.quadro_novo} onChange={(e) => atualizarCampoColetiva('quadro_novo', e.target.value)} /></div>
          <div><Label>Data da promoção</Label><Input type="date" value={coletivaForm.data_promocao} onChange={(e) => atualizarCampoColetiva('data_promocao', e.target.value)} /></div>
          <div><Label>Data da publicação</Label><Input type="date" value={coletivaForm.data_publicacao} onChange={(e) => atualizarCampoColetiva('data_publicacao', e.target.value)} /></div>
          <div><Label>Boletim</Label><Input value={coletivaForm.boletim_referencia} onChange={(e) => atualizarCampoColetiva('boletim_referencia', e.target.value)} /></div>
          <div><Label>Ato</Label><Input value={coletivaForm.ato_referencia} onChange={(e) => atualizarCampoColetiva('ato_referencia', e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Observações</Label><Input value={coletivaForm.observacoes} onChange={(e) => atualizarCampoColetiva('observacoes', e.target.value)} /></div>
        </div>
        <datalist id="postos-promocao-coletiva">{POSTOS_GRADUACOES.map((posto) => <option key={posto} value={posto} />)}</datalist>
        <datalist id="quadros-promocao-coletiva">{QUADROS.filter((quadro) => quadro !== 'QBMPT').map((quadro) => <option key={quadro} value={quadro} />)}</datalist>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><strong>Selecionados:</strong> {resumoColetiva.selecionados}</div>
          <div><strong>Aptos:</strong> {resumoColetiva.aptos}</div>
          <div><strong>Bloqueados:</strong> {resumoColetiva.bloqueados}</div>
        </div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Candidatos elegíveis</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="overflow-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th>Selecionar</th><th>Militar</th><th>Matrícula</th><th>Posto atual</th><th>Quadro atual</th><th>Lotação</th><th>Quadro anterior a gravar</th><th>Ordem</th><th>Alertas/Bloqueios</th><th>Ações</th></tr></thead><tbody>{linhasColetiva.map(({ militar, validacao, selecionado }) => <tr key={militar.id} className={`border-b align-top ${!selecionado ? 'bg-slate-50 text-slate-500' : validacao.apto ? '' : 'bg-red-50'}`}><td><input type="checkbox" checked={selecionado} onChange={() => alternarSelecaoColetiva(militar.id)} aria-label={`Selecionar ${militar.nome_completo || militar.nome_guerra || militar.id}`} /></td><td>{militar.nome_completo || militar.nome_guerra || 'Sem nome'}</td><td>{militar.matricula || '—'}</td><td>{militar.posto_graduacao || '—'}</td><td>{militar.quadro || '—'}</td><td>{militar.lotacao || '—'}</td><td>{validacao.quadroAnterior || '—'}</td><td><Input className="h-8 w-24" value={ordensColetiva[militar.id] || ''} onChange={(e) => setOrdensColetiva((o) => ({ ...o, [militar.id]: e.target.value }))} /></td><td>{alertasCopiaOrdemColetiva[militar.id] && <div className="text-amber-700">Alerta: {alertasCopiaOrdemColetiva[militar.id]}</div>}{validacao.bloqueios.map((b) => <div key={b} className="text-red-700">Bloqueio: {b}</div>)}{validacao.alertas.map((a) => <div key={a} className="text-amber-700">Alerta: {a}</div>)}</td><td><Button size="sm" variant="outline" onClick={() => alternarSelecaoColetiva(militar.id)}>{selecionado ? 'Remover' : 'Selecionar'}</Button></td></tr>)}</tbody></table></div>
        {!linhasColetiva.length && <p className="text-sm text-slate-600">Informe o posto de origem para listar militares ativos elegíveis. No tipo histórico, o filtro por posto atual é apenas auxiliar e não bloqueia militares atualmente mais graduados.</p>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Confirmação e gravação {tipoColetivaHistorico ? 'histórica' : 'prevista'}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm text-slate-700">Digite exatamente <strong>{textoConfirmacaoColetiva}</strong> para criar somente registros {rotuloTipoColetiva}. Nenhum lançamento coletivo altera Militar ou a Prévia Geral.</p>
        <Input value={confirmacaoColetiva} onChange={(e) => setConfirmacaoColetiva(e.target.value)} placeholder={textoConfirmacaoColetiva} />
        <Button disabled={gravandoColetiva || resumoColetiva.aptos === 0} onClick={gravarColetiva}>{gravandoColetiva ? 'Gravando...' : `Criar registros ${rotuloTipoColetiva}`}</Button>
        {feedbackColetiva?.erro && <p className="text-sm text-red-700">{feedbackColetiva.erro}</p>}
        {feedbackColetiva?.resumo && <div className="text-sm text-green-800 space-y-1"><p>Resumo: selecionados {feedbackColetiva.resumo.totalSelecionado}, aptos {feedbackColetiva.resumo.totalApto}, bloqueados {feedbackColetiva.resumo.totalBloqueado}, criados {feedbackColetiva.resumo.totalCriado}, falhas {feedbackColetiva.resumo.falhas}.</p>{feedbackColetiva.falhas?.map((falha) => <div key={falha} className="text-red-700">{falha}</div>)}</div>}
      </CardContent></Card>
    </>}

    {aba === 'manual' && <>
      <Card><CardHeader><CardTitle>Registrar promoção atual (manual)</CardTitle></CardHeader><CardContent className="space-y-4">
        <div><Label>Buscar militar</Label><Input value={buscaMilitar} onChange={(e) => setBuscaMilitar(e.target.value)} placeholder="Nome, nome de guerra, matrícula, lotação..." /></div>
        <div className="max-h-56 overflow-auto border rounded-md p-2 space-y-1">{militaresFiltrados.map((m) => <button key={m.id} className={`w-full text-left p-2 rounded ${form.militar_id === m.id ? 'bg-slate-100' : ''}`} onClick={() => { setForm((f) => ({ ...f, militar_id: m.id })); carregarHistorico(m.id); }}><div className="text-sm">{`${m.posto_graduacao || 'S/POSTO'} ${m.quadro || 'S/QUADRO'} ${m.nome_completo || ''} — ${m.matricula || 'S/MAT'} — ${m.lotacao || 'S/LOTAÇÃO'}`}</div><div className="text-xs"><strong>{m.nome_guerra || 'Sem nome de guerra'}</strong></div></button>)}</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Posto/graduação atual (somente leitura)" value={militarSelecionado?.posto_graduacao || ''} readOnly />
          <Input placeholder="Quadro atual (somente leitura)" value={militarSelecionado?.quadro || ''} readOnly />
          <Input type="date" value={form.data_promocao} onChange={(e) => setForm((f) => ({ ...f, data_promocao: e.target.value }))} />
          <Input type="date" value={form.data_publicacao} onChange={(e) => setForm((f) => ({ ...f, data_publicacao: e.target.value }))} />
          <Input placeholder="Boletim" value={form.boletim_referencia} onChange={(e) => setForm((f) => ({ ...f, boletim_referencia: e.target.value }))} />
          <Input placeholder="Ato" value={form.ato_referencia} onChange={(e) => setForm((f) => ({ ...f, ato_referencia: e.target.value }))} />
          <Input placeholder="Antiguidade ordem" value={form.antiguidade_referencia_ordem} onChange={(e) => setForm((f) => ({ ...f, antiguidade_referencia_ordem: e.target.value }))} />
          <Input placeholder="Antiguidade ID" value={form.antiguidade_referencia_id} onChange={(e) => setForm((f) => ({ ...f, antiguidade_referencia_id: e.target.value }))} />
        </div>
        <Input placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
        <p className="text-xs text-slate-600">Este lançamento não altera o posto ou graduação do militar. Apenas registra a data e referências da promoção atual já cadastrada.</p><div className="flex gap-2"><Button onClick={() => lancarManual().catch((e) => setFeedbackManual(e.message))}>Registrar promoção atual</Button></div>
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
