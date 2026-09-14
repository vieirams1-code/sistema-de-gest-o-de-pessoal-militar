import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  PhoneOff,
  RefreshCw,
  Send,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const erroTexto = (erro, fallback) =>
  erro?.response?.data?.error || erro?.data?.error || erro?.message || fallback;

const unwrap = (resposta) => resposta?.data?.data ?? resposta?.data ?? resposta ?? {};

const normalizar = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const STATUS_LABEL = {
  EM_PREPARACAO: 'Preparando fila',
  EM_PROCESSAMENTO: 'Em processamento',
  CONCLUIDO: 'Concluído',
  CONCLUIDO_COM_FALHAS: 'Concluído com pendências',
  FALHOU: 'Falhou',
};

const DEST_LABEL = {
  PENDENTE: 'Pendente',
  ENVIANDO: 'Enviando',
  ENVIADO: 'Enviado',
  FALHA: 'Falha',
  SEM_CONTATO: 'Sem telefone',
};

function formatarDataHora(value) {
  if (!value) return '-';
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

function Stat({ label, value, tone = 'slate' }) {
  const classes = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${classes[tone] || classes.slate}`}>
      <div className="text-2xl font-black">{Number(value || 0)}</div>
      <div className="mt-0.5 text-xs font-semibold">{label}</div>
    </div>
  );
}

export default function CampanhaFeriasWhatsAppCard({ campanha, canSend = false }) {
  const [preview, setPreview] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [envioProcessando, setEnvioProcessando] = useState(null);
  const [feedback, setFeedback] = useState({ tipo: '', texto: '' });
  const [detalhes, setDetalhes] = useState(null);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  const portalLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/Portal`;
  }, []);

  const campanhaAberta = normalizar(campanha?.status) === 'aberta_coleta';
  const ultimoEnvio = historico?.[0] || null;
  const podeDisparar = canSend
    && campanhaAberta
    && Boolean(preview?.whatsapp_configurado)
    && Number(preview?.publico?.com_telefone || 0) > 0
    && !processando;

  const carregarPreview = async ({ silencioso = false } = {}) => {
    if (!campanha?.id || !canSend || !portalLink) return;
    if (!silencioso) setLoading(true);
    try {
      const resposta = await base44.functions.invoke('campanhaFeriasWhatsApp', {
        acao: 'PREVIEW',
        campanha_id: campanha.id,
        link_portal: portalLink,
      });
      const dados = unwrap(resposta);
      setPreview(dados);
      setHistorico(dados.historico || []);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível preparar a comunicação por WhatsApp.') });
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    setPreview(null);
    setHistorico([]);
    setDetalhes(null);
    setMostrarDetalhes(false);
    setFeedback({ tipo: '', texto: '' });
    carregarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campanha?.id, canSend, portalLink]);

  const processarFila = async (envioId) => {
    if (!envioId || processando) return;
    setProcessando(true);
    setEnvioProcessando((atual) => atual || { id: envioId, status: 'EM_PROCESSAMENTO' });
    try {
      for (let rodada = 0; rodada < 200; rodada += 1) {
        const resposta = await base44.functions.invoke('campanhaFeriasWhatsApp', {
          acao: 'PROCESSAR_LOTE',
          campanha_id: campanha.id,
          envio_id: envioId,
          tamanho_lote: 8,
        });
        const dados = unwrap(resposta);
        if (dados.envio) setEnvioProcessando(dados.envio);
        if (!dados.ha_pendentes) {
          setFeedback({
            tipo: dados.envio?.total_falhas > 0 || dados.envio?.total_sem_contato > 0 ? 'aviso' : 'sucesso',
            texto: dados.envio?.total_falhas > 0 || dados.envio?.total_sem_contato > 0
              ? 'Disparo concluído. Há destinatários com falha ou sem telefone; consulte o histórico abaixo.'
              : 'Disparo concluído com sucesso.',
          });
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'O processamento da fila foi interrompido. A fila foi preservada e pode ser continuada.') });
    } finally {
      setProcessando(false);
      await carregarPreview({ silencioso: true });
    }
  };

  const iniciarEnvio = async () => {
    if (!podeDisparar) return;
    setFeedback({ tipo: '', texto: '' });
    try {
      const resposta = await base44.functions.invoke('campanhaFeriasWhatsApp', {
        acao: 'CRIAR_ENVIO',
        campanha_id: campanha.id,
        link_portal: portalLink,
      });
      const dados = unwrap(resposta);
      const envio = dados.envio;
      if (!envio?.id) throw new Error('A fila foi criada sem identificador de envio.');
      setConfirmando(false);
      setEnvioProcessando(envio);
      setFeedback({ tipo: 'sucesso', texto: 'Fila criada. O envio está sendo processado em lotes.' });
      void processarFila(envio.id);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível iniciar o disparo.') });
      await carregarPreview({ silencioso: true });
    }
  };

  const continuarEnvio = async (envioId) => {
    setFeedback({ tipo: '', texto: '' });
    void processarFila(envioId);
  };

  const reenviarFalhas = async (envioId) => {
    if (!envioId || processando) return;
    setFeedback({ tipo: '', texto: '' });
    try {
      const resposta = await base44.functions.invoke('campanhaFeriasWhatsApp', {
        acao: 'REENVIAR_FALHAS',
        campanha_id: campanha.id,
        envio_id: envioId,
      });
      const dados = unwrap(resposta);
      if (!dados.reenfileirados) {
        setFeedback({ tipo: 'sucesso', texto: 'Não há falhas de envio para reenviar.' });
        return;
      }
      setFeedback({ tipo: 'sucesso', texto: `${dados.reenfileirados} falha(s) recolocada(s) na fila.` });
      void processarFila(envioId);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível reenviar as falhas.') });
    }
  };

  const alternarDetalhes = async (envioId) => {
    if (mostrarDetalhes && detalhes?.envio_atual?.id === envioId) {
      setMostrarDetalhes(false);
      return;
    }
    setLoading(true);
    try {
      const resposta = await base44.functions.invoke('campanhaFeriasWhatsApp', {
        acao: 'HISTORICO',
        campanha_id: campanha.id,
        envio_id: envioId,
      });
      const dados = unwrap(resposta);
      setDetalhes(dados);
      setMostrarDetalhes(true);
    } catch (erro) {
      setFeedback({ tipo: 'erro', texto: erroTexto(erro, 'Não foi possível carregar os destinatários do envio.') });
    } finally {
      setLoading(false);
    }
  };

  if (!canSend) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-700" />
            <h2 className="font-bold text-slate-900">Comunicação por WhatsApp</h2>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Envia aos militares incluídos nesta campanha o prazo, o link do Portal do Militar e a orientação para recadastramento e escolha de férias.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => carregarPreview()} disabled={loading || processando}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar prévia
        </Button>
      </div>

      {feedback.texto && (
        <div className={`mt-4 rounded-xl border p-3 text-sm ${
          feedback.tipo === 'erro'
            ? 'border-red-200 bg-red-50 text-red-700'
            : feedback.tipo === 'aviso'
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {feedback.texto}
        </div>
      )}

      {!campanhaAberta && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Novos disparos e reenvios ficam disponíveis somente enquanto a campanha estiver em coleta.</span>
        </div>
      )}

      {preview && !preview.whatsapp_configurado && (
        <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>A integração Evolution/WhatsApp não está configurada nos secrets da aplicação. Nenhuma mensagem será disparada até a configuração estar disponível.</span>
        </div>
      )}

      {loading && !preview ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />Calculando o público da campanha...
        </div>
      ) : preview ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Militares na campanha" value={preview.publico?.total} />
            <Stat label="Com WhatsApp válido" value={preview.publico?.com_telefone} tone="emerald" />
            <Stat label="Sem telefone válido" value={preview.publico?.sem_telefone} tone={preview.publico?.sem_telefone ? 'amber' : 'slate'} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Mensagem que será enviada</div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{preview.mensagem_exemplo}</pre>
            <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Link automático: <span className="break-all font-medium text-slate-700">{preview.link_portal}</span>
            </div>
          </div>

          {processando && envioProcessando && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <Loader2 className="h-4 w-4 animate-spin" />Processando fila de WhatsApp
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <Stat label="Enviados" value={envioProcessando.total_enviados} tone="emerald" />
                <Stat label="Falhas" value={envioProcessando.total_falhas} tone={envioProcessando.total_falhas ? 'red' : 'slate'} />
                <Stat label="Sem contato" value={envioProcessando.total_sem_contato} tone={envioProcessando.total_sem_contato ? 'amber' : 'slate'} />
                <Stat label="Total" value={envioProcessando.total_destinatarios} />
              </div>
            </div>
          )}

          <div className="mt-4">
            {!confirmando ? (
              <Button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={!podeDisparar}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                <Send className="mr-1.5 h-4 w-4" />Enviar WhatsApp aos militares
              </Button>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="font-bold text-amber-950">Confirmar disparo?</div>
                <p className="mt-1 text-sm text-amber-900">
                  Serão preparadas {preview.publico?.com_telefone || 0} mensagens. {preview.publico?.sem_telefone || 0} militar(es) sem telefone válido serão registrados como pendência e não receberão mensagem.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={iniciarEnvio} className="bg-emerald-700 hover:bg-emerald-800">
                    <Send className="mr-1.5 h-4 w-4" />Confirmar e iniciar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {historico.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-bold text-slate-900">Histórico de disparos</h3>
          <div className="mt-3 space-y-2">
            {historico.slice(0, 5).map((envio) => {
              const emAndamento = ['EM_PREPARACAO', 'EM_PROCESSAMENTO'].includes(envio.status);
              return (
                <div key={envio.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{STATUS_LABEL[envio.status] || envio.status}</span>
                        {envio.status === 'CONCLUIDO' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {envio.total_sem_contato > 0 && <PhoneOff className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatarDataHora(envio.created_date || envio.inicio_em)} · {envio.total_enviados || 0} enviados · {envio.total_falhas || 0} falhas · {envio.total_sem_contato || 0} sem telefone
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {emAndamento && !processando && (
                        <Button type="button" size="sm" variant="outline" onClick={() => continuarEnvio(envio.id)}>
                          <RefreshCw className="mr-1.5 h-4 w-4" />Continuar envio
                        </Button>
                      )}
                      {Number(envio.total_falhas || 0) > 0 && campanhaAberta && !processando && (
                        <Button type="button" size="sm" variant="outline" onClick={() => reenviarFalhas(envio.id)}>
                          <RefreshCw className="mr-1.5 h-4 w-4" />Reenviar falhas
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => alternarDetalhes(envio.id)}>
                        {mostrarDetalhes && detalhes?.envio_atual?.id === envio.id
                          ? <ChevronUp className="mr-1 h-4 w-4" />
                          : <ChevronDown className="mr-1 h-4 w-4" />}
                        Destinatários
                      </Button>
                    </div>
                  </div>

                  {mostrarDetalhes && detalhes?.envio_atual?.id === envio.id && (
                    <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
                      <table className="min-w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-100 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-bold">Militar</th>
                            <th className="px-3 py-2 font-bold">Telefone</th>
                            <th className="px-3 py-2 font-bold">Status</th>
                            <th className="px-3 py-2 font-bold">Tentativas</th>
                            <th className="px-3 py-2 font-bold">Último erro</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {(detalhes.destinatarios || []).map((dest) => (
                            <tr key={dest.id}>
                              <td className="px-3 py-2">
                                <div className="font-semibold text-slate-800">{dest.militar_nome}</div>
                                <div className="text-slate-500">{[dest.posto_graduacao, dest.nome_guerra].filter(Boolean).join(' ')}</div>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{dest.telefone || '-'}</td>
                              <td className="px-3 py-2 font-semibold text-slate-700">{DEST_LABEL[dest.status] || dest.status}</td>
                              <td className="px-3 py-2 text-slate-600">{dest.tentativas || 0}</td>
                              <td className="max-w-xs px-3 py-2 text-slate-600">{dest.ultimo_erro || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ultimoEnvio?.status === 'EM_PROCESSAMENTO' && !processando && (
        <p className="mt-3 text-xs text-slate-500">
          A fila é persistente. Se o processamento tiver sido interrompido, use “Continuar envio”; mensagens já concluídas não serão reenviadas.
        </p>
      )}
    </section>
  );
}
