import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, X } from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODULO_DOCUMENTOS_MILITARES } from '@/services/documentosMilitares/documentoMilitarVarsService';
import {
  filtrarTemplatesDocumentosMilitares,
  identificarCamposTemplateDocumentoMilitar,
  renderizarDocumentoMilitarIndividual,
} from '@/services/documentosMilitares/gerarDocumentoMilitarService';

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
  const { data: templatesRecebidos = [], isLoading, isError } = useQuery({
    queryKey: ['templates-documentos-militares'],
    queryFn: () => base44.entities.TemplateTexto.filter({ modulo: MODULO_DOCUMENTOS_MILITARES }, '-created_date'),
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
    militar,
    camposManuais,
  }), [templateSelecionado?.template, militar, camposManuais]);

  useEffect(() => {
    setCamposManuais({});
  }, [templateId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-6">
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

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="space-y-5">
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
                    <Input
                      id={`campo-documento-${campo}`}
                      className="mt-1.5"
                      value={camposManuais[campo] || ''}
                      onChange={(event) => setCamposManuais((atuais) => ({ ...atuais, [campo]: event.target.value }))}
                      placeholder={`Informe ${formatarRotuloCampo(campo).toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[320px] rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Prévia renderizada</h3>
            {templateSelecionado ? (
              <div className="mt-3 min-h-[260px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                {previa}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Selecione um template para visualizar a prévia.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
