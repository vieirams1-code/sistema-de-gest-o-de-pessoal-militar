import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer, Settings, X } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchScopedMilitares } from '@/services/getScopedMilitaresClient';
import { selecionarPromocaoAtualEAnteriores } from '@/utils/antiguidade/selecionarPromocaoAtual';
import DocumentoMilitarPreview from '@/components/documentosMilitares/DocumentoMilitarPreview';
import DocumentoMilitarPrintRoot from '@/components/documentosMilitares/DocumentoMilitarPrintRoot';
import { MODULO_DOCUMENTOS_MILITARES } from '@/services/documentosMilitares/documentoMilitarVarsService';
import {
  filtrarTemplatesDocumentosMilitares,
  identificarCamposTemplateDocumentoMilitar,
  renderizarDocumentoMilitarIndividual,
} from '@/services/documentosMilitares/gerarDocumentoMilitarService';
import {
  carregarDocumentoMilitarPrintConfig,
  salvarDocumentoMilitarPrintConfig,
} from '@/services/documentosMilitares/documentoMilitarPrintConfig';
import { normalizarSignatarioMilitar } from '@/services/documentosMilitares/documentoMilitarSignatarioService';

function formatarRotuloCampo(chave) {
  return String(chave || '')
    .split('_')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

export default function GerarDocumentoMilitarModal({ militar, onClose }) {
  const [templateId, setTemplateId] = useState('');
  const [camposManuais, setCamposManuais] = useState({});
  const [configImpressao, setConfigImpressao] = useState(() => carregarDocumentoMilitarPrintConfig());
  const [tituloDocumento, setTituloDocumento] = useState('');
  const [configurandoImpressao, setConfigurandoImpressao] = useState(false);
  const [buscaSignatario, setBuscaSignatario] = useState('');
  const { data: templatesRecebidos = [], isLoading, isError } = useQuery({
    queryKey: ['templates-documentos-militares'],
    queryFn: () => base44.entities.TemplateTexto.filter({ modulo: MODULO_DOCUMENTOS_MILITARES }, '-created_date'),
  });
  const { data: historicoPromocoes = [] } = useQuery({
    queryKey: ['documentos-militares-historico-promocao', militar?.id || ''],
    queryFn: () => base44.entities.HistoricoPromocaoMilitarV2.filter({ militar_id: militar.id }, '-data_promocao'),
    enabled: Boolean(militar?.id),
    staleTime: 60 * 1000,
  });
  const militarComPromocao = useMemo(() => {
    if (!militar) return militar;
    const selecao = selecionarPromocaoAtualEAnteriores({ historicoPromocoes, militar });
    const promocaoAtual = selecao?.promocaoAtual || null;
    if (!promocaoAtual?.data_promocao) return militar;
    return { ...militar, historico_promocao_atual: { data: promocaoAtual.data_promocao } };
  }, [militar, historicoPromocoes]);
  const { data: militaresSignatarios = [], isFetching: isFetchingSignatarios } = useQuery({
    queryKey: ['documentos-militares-signatarios', buscaSignatario.trim()],
    queryFn: async () => {
      const { militares } = await fetchScopedMilitares({
        search: buscaSignatario.trim(),
        statusCadastro: 'Ativo',
        limit: 50,
        offset: 0,
        includeFoto: false,
      });
      return militares;
    },
    enabled: configurandoImpressao,
    staleTime: 2 * 60 * 1000,
  });
  const templates = useMemo(
    () => filtrarTemplatesDocumentosMilitares(templatesRecebidos),
    [templatesRecebidos]
  );
  const templateSelecionado = templates.find((template) => String(template.id) === templateId) || null;
  const camposDinamicos = useMemo(
    () => identificarCamposTemplateDocumentoMilitar(templateSelecionado?.template),
    [templateSelecionado?.template]
  );
  const previa = useMemo(() => renderizarDocumentoMilitarIndividual({
    template: templateSelecionado?.template,
    militar: militarComPromocao,
    camposManuais,
  }), [templateSelecionado?.template, militarComPromocao, camposManuais]);

  useEffect(() => {
    setCamposManuais({});
  }, [templateId]);

  function atualizarConfigImpressao(campo, valor) {
    setConfigImpressao((atual) => ({ ...atual, [campo]: valor }));
  }

  function selecionarMilitarSignatario(militarSelecionado) {
    const signatario = normalizarSignatarioMilitar(militarSelecionado);
    setConfigImpressao((atual) => ({
      ...atual,
      ...signatario,
    }));
    setBuscaSignatario('');
  }

  function salvarConfigImpressao() {
    setConfigImpressao(salvarDocumentoMilitarPrintConfig(configImpressao));
    setConfigurandoImpressao(false);
  }

  function cancelarConfigImpressao() {
    setConfigImpressao(carregarDocumentoMilitarPrintConfig());
    setConfigurandoImpressao(false);
  }

  const ativarModoImpressao = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('documento-militar-printing');
    }
  }, []);

  const desativarModoImpressao = useCallback(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('documento-militar-printing');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    window.addEventListener('beforeprint', ativarModoImpressao);
    window.addEventListener('afterprint', desativarModoImpressao);

    return () => {
      window.removeEventListener('beforeprint', ativarModoImpressao);
      window.removeEventListener('afterprint', desativarModoImpressao);
      desativarModoImpressao();
    };
  }, [ativarModoImpressao, desativarModoImpressao]);

  function imprimirDocumentoMilitar() {
    ativarModoImpressao();
    window.print();
    window.setTimeout(desativarModoImpressao, 500);
  }

  return (
    <>
    <div className="documento-militar-modal-print-root fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="documento-militar-modal-dialog flex max-h-[calc(100vh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        <div className="documento-militar-no-print flex items-center justify-between border-b p-4 sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#1e3a5f]">
              <FileText className="h-5 w-5" />
              Gerar Documento Militar
            </h2>
            <p className="mt-1 text-sm text-slate-500">Prévia individual somente para leitura. Nenhum documento será salvo.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar modal">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="documento-militar-modal-body grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-6">
          <div className="documento-militar-no-print space-y-5">
            <div>
              <Label className="text-sm font-medium">Template</Label>
              {isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Carregando templates...</p>
              ) : isError ? (
                <p className="mt-2 text-sm text-red-600">Não foi possível carregar os templates.</p>
              ) : templates.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Nenhum template de Documento Militar foi encontrado. Cadastre um template em Templates de Texto.
                </p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.nome || template.tipo_registro || 'Template sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {templateSelecionado && camposDinamicos.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Este template não possui campos manuais. A prévia foi preenchida diretamente com os dados da ficha.
              </p>
            )}

            {camposDinamicos.length > 0 && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Campos do documento</h3>
                  <p className="mt-1 text-xs text-slate-500">Campos não preenchidos continuam visíveis na prévia.</p>
                </div>
                {camposDinamicos.map((campo) => (
                  <div key={campo}>
                    <Label htmlFor={`campo-documento-${campo}`} className="text-sm font-medium">
                      {formatarRotuloCampo(campo)}
                    </Label>
                    <Textarea
                      id={`campo-documento-${campo}`}
                      className="mt-1.5 min-h-16 resize-y"
                      rows={2}
                      value={camposManuais[campo] || ''}
                      onChange={(event) => setCamposManuais((atuais) => ({ ...atuais, [campo]: event.target.value }))}
                      placeholder={`Informe ${formatarRotuloCampo(campo).toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="documento-militar-preview-panel min-h-[320px] rounded-xl border border-slate-200 bg-slate-100 p-4">
            <div className="documento-militar-no-print mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Prévia institucional para impressão</h3>
              <Button variant="ghost" size="sm" onClick={() => setConfigurandoImpressao((atual) => !atual)}>
                <Settings className="mr-1.5 h-4 w-4" />
                Configurar impressão
              </Button>
            </div>

            {configurandoImpressao && (
              <div className="documento-militar-no-print mb-4 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
                <h4 className="font-semibold text-slate-700">Configuração local da impressão</h4>
                <p className="mt-1 text-xs text-slate-500">Estas preferências ficam salvas somente neste navegador.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {[
                    ['mostrarCabecalho', 'Mostrar cabeçalho'],
                    ['mostrarBrasao', 'Mostrar brasão legado quando disponível'],
                    ['mostrarAssinatura', 'Mostrar assinatura'],
                    ['mostrarRodape', 'Mostrar rodapé institucional'],
                  ].map(([campo, rotulo]) => (
                    <label key={campo} className="flex items-center gap-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={configImpressao[campo]}
                        onChange={(event) => atualizarConfigImpressao(campo, event.target.checked)}
                      />
                      {rotulo}
                    </label>
                  ))}
                  {[
                    ['orgaoLinha1', 'Órgão - linha 1'],
                    ['orgaoLinha2', 'Órgão - linha 2'],
                    ['orgaoLinha3', 'Órgão - linha 3'],
                    ['orgaoLinha4', 'Órgão - linha 4'],
                    ['orgaoLinha5', 'Órgão - linha 5'],
                    ['tituloDocumentoPadrao', 'Título padrão'],
                    ['imagemCabecalhoSrc', 'Imagem institucional (URL ou data URL)'],
                    ['cidadePadrao', 'Cidade padrão'],
                    ['rodapeLinha1', 'Rodapé - linha 1'],
                    ['rodapeLinha2', 'Rodapé - linha 2'],
                  ].map(([campo, rotulo]) => (
                    <div key={campo}>
                      <Label htmlFor={`config-impressao-${campo}`}>{rotulo}</Label>
                      <Input
                        id={`config-impressao-${campo}`}
                        className="mt-1"
                        value={configImpressao[campo]}
                        onChange={(event) => atualizarConfigImpressao(campo, event.target.value)}
                      />
                    </div>
                  ))}

                  <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                    Para usar imagem institucional, informe uma URL ou data URL. Imagens externas podem não carregar se o navegador bloquear o acesso.
                  </div>
                  <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Label htmlFor="busca-signatario-documento">Selecionar militar signatário</Label>
                    <Input
                      id="busca-signatario-documento"
                      className="mt-1"
                      value={buscaSignatario}
                      onChange={(event) => setBuscaSignatario(event.target.value)}
                      placeholder="Buscar por nome, matrícula, CPF ou RG..."
                    />
                    <div className="mt-2 max-h-40 space-y-1 overflow-auto">
                      {isFetchingSignatarios ? (
                        <p className="text-xs text-slate-500">Buscando militares...</p>
                      ) : militaresSignatarios.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum militar encontrado no escopo atual.</p>
                      ) : militaresSignatarios.map((item) => {
                        const signatario = normalizarSignatarioMilitar(item);
                        const rotulo = [item.posto_graduacao, item.nome_guerra || item.nome_completo].filter(Boolean).join(' ');
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-white"
                            onClick={() => selecionarMilitarSignatario(item)}
                          >
                            <span className="font-medium">{rotulo || signatario.nomeSignatario || 'Militar sem nome'}</span>
                            {signatario.matriculaSignatario && <span className="text-slate-500"> • Mat {signatario.matriculaSignatario}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {[
                    ['nomeSignatario', 'Nome do signatário'],
                    ['cargoSignatario', 'Cargo do signatário'],
                    ['matriculaSignatario', 'Matrícula do signatário'],
                  ].map(([campo, rotulo]) => (
                    <div key={campo}>
                      <Label htmlFor={`config-impressao-${campo}`}>{rotulo}</Label>
                      <Input
                        id={`config-impressao-${campo}`}
                        className="mt-1"
                        value={configImpressao[campo]}
                        onChange={(event) => atualizarConfigImpressao(campo, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelarConfigImpressao}>Cancelar</Button>
                  <Button size="sm" onClick={salvarConfigImpressao}>Salvar preferências</Button>
                </div>
              </div>
            )}

            {templateSelecionado && (
              <div className="documento-militar-no-print mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <Label htmlFor="titulo-documento-militar">Título do documento</Label>
                <Input
                  id="titulo-documento-militar"
                  className="mt-1"
                  value={tituloDocumento}
                  onChange={(event) => setTituloDocumento(event.target.value)}
                  placeholder={configImpressao.tituloDocumentoPadrao || 'DOCUMENTO MILITAR'}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Se ficar vazio, a prévia usa o título padrão da configuração local.
                </p>
              </div>
            )}

            {templateSelecionado ? (
              <div className="documento-militar-screen-preview documento-militar-no-print overflow-x-auto">
                <DocumentoMilitarPreview texto={previa} config={configImpressao} tituloDocumento={tituloDocumento} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Selecione um template para visualizar a prévia.</p>
            )}
          </div>
        </div>

        <div className="documento-militar-no-print flex justify-end gap-2 border-t px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={imprimirDocumentoMilitar} disabled={!previa.trim()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
    </div>
    {templateSelecionado && (
      <DocumentoMilitarPrintRoot
        texto={previa}
        config={configImpressao}
        tituloDocumento={tituloDocumento}
      />
    )}
    </>
  );
}