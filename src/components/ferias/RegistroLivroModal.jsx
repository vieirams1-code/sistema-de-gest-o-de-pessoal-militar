import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, User, FileText, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aplicarTemplate, buildVarsLivro, formatDateBR } from '@/components/utils/templateUtils';
import { addDays, differenceInDays, format } from 'date-fns';

const NOMES_OPERACIONAIS = {
  'Saída Férias': 'Início',
  'Retorno Férias': 'Término',
  'Interrupção de Férias': 'Interrupção',
  'Nova Saída / Retomada': 'Continuação',
};

export default function RegistroLivroModal({ open, onClose, ferias, tipoInicial }) {
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState(tipoInicial || 'Saída Férias');
  const [dataRegistro, setDataRegistro] = useState('');
  const [notaBg, setNotaBg] = useState('');
  const [numeroBg, setNumeroBg] = useState('');
  const [dataBg, setDataBg] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [textoGerado, setTextoGerado] = useState('');
  const [semTemplate, setSemTemplate] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });

  const { data: periodosAquisitivos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos', ferias?.militar_id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: ferias?.militar_id }),
    enabled: !!ferias?.militar_id,
    staleTime: 60000,
  });

  useEffect(() => {
    if (ferias && open) {
      setTipoRegistro(tipoInicial || 'Saída Férias');

      const hoje = new Date().toISOString().split('T')[0];
      const dataDefault =
        tipoInicial === 'Retorno Férias'
          ? ferias.data_retorno || hoje
          : tipoInicial === 'Interrupção de Férias'
            ? hoje
            : tipoInicial === 'Nova Saída / Retomada'
              ? hoje
              : ferias.data_inicio || hoje;

      setDataRegistro(dataDefault);
      setNotaBg('');
      setNumeroBg('');
      setDataBg('');
      setObservacoes('');
    }
  }, [ferias, tipoInicial, open]);

  const indicadores = useMemo(() => {
    if (!ferias || !dataRegistro) return null;

    if (tipoRegistro === 'Interrupção de Férias') {
      if (!ferias.data_inicio) return null;

      const inicio = new Date(ferias.data_inicio + 'T00:00:00');
      const interrupcao = new Date(dataRegistro + 'T00:00:00');
      const diasGozados = Math.max(0, differenceInDays(interrupcao, inicio));
      const saldoRemanescente = Math.max(0, (ferias.dias || 0) - diasGozados);

      return {
        diasGozados,
        saldoRemanescente,
      };
    }

    if (tipoRegistro === 'Nova Saída / Retomada') {
      const saldo = Number(ferias.saldo_remanescente || 0);
      const dataFim = saldo > 0 ? format(addDays(new Date(dataRegistro + 'T00:00:00'), saldo - 1), 'yyyy-MM-dd') : '';
      const dataRetorno = saldo > 0 ? format(addDays(new Date(dataRegistro + 'T00:00:00'), saldo), 'yyyy-MM-dd') : '';

      return {
        saldoRetomado: saldo,
        novaDataFim: dataFim,
        novaDataRetorno: dataRetorno,
      };
    }

    return null;
  }, [ferias, dataRegistro, tipoRegistro]);

  useEffect(() => {
    if (!ferias || !dataRegistro) return;
    gerarTexto();
  }, [ferias, tipoRegistro, dataRegistro, templates, periodosAquisitivos, indicadores?.saldoRetomado]);

  const gerarTexto = () => {
    if (!ferias) return;

    const periodo = periodosAquisitivos.find((p) => p.id === ferias.periodo_aquisitivo_id);

    const templateCadastrado = templates.find(
      (t) => t.modulo === 'Livro' && t.tipo_registro === tipoRegistro && t.ativo !== false
    );

    if (templateCadastrado?.template) {
      const vars = buildVarsLivro({
        ferias: {
          ...ferias,
          dias:
            tipoRegistro === 'Nova Saída / Retomada' && indicadores?.saldoRetomado != null
              ? indicadores.saldoRetomado
              : ferias.dias,
        },
        dataRegistro,
        periodo,
      });

      const texto = aplicarTemplate(templateCadastrado.template, vars);
      setTextoGerado(texto);
      setSemTemplate(false);
    } else {
      setTextoGerado('');
      setSemTemplate(true);
    }
  };

  const calcularStatus = () => {
    if (numeroBg && dataBg) return 'Publicado';
    if (notaBg) return 'Aguardando Publicação';
    return 'Aguardando Nota';
  };

  const handleSalvar = async () => {
    if (!ferias || !dataRegistro) return;
    setLoading(true);

    const diasRegistro =
      tipoRegistro === 'Nova Saída / Retomada' && indicadores?.saldoRetomado != null
        ? indicadores.saldoRetomado
        : ferias.dias;

    await base44.entities.RegistroLivro.create({
      militar_id: ferias.militar_id,
      militar_nome: ferias.militar_nome,
      militar_posto: ferias.militar_posto,
      militar_matricula: ferias.militar_matricula,
      ferias_id: ferias.id,
      tipo_registro: tipoRegistro,
      data_registro: dataRegistro,
      dias: diasRegistro,
      dias_gozados: tipoRegistro === 'Interrupção de Férias' ? indicadores?.diasGozados : undefined,
      saldo_remanescente:
        tipoRegistro === 'Interrupção de Férias'
          ? indicadores?.saldoRemanescente
          : tipoRegistro === 'Nova Saída / Retomada'
            ? indicadores?.saldoRetomado
            : undefined,
      texto_publicacao: textoGerado,
      nota_para_bg: notaBg,
      numero_bg: numeroBg,
      data_bg: dataBg || undefined,
      status: calcularStatus(),
      observacoes,
    });

    if (tipoRegistro === 'Saída Férias') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Em Curso',
      });
    } else if (tipoRegistro === 'Retorno Férias') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Gozada',
        saldo_remanescente: 0,
      });
    } else if (tipoRegistro === 'Interrupção de Férias') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Interrompida',
        data_interrupcao: dataRegistro,
        dias_gozados_interrupcao: indicadores?.diasGozados ?? 0,
        saldo_remanescente: indicadores?.saldoRemanescente ?? 0,
      });
    } else if (tipoRegistro === 'Nova Saída / Retomada') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Em Curso',
        data_inicio: dataRegistro,
        data_fim: indicadores?.novaDataFim || ferias.data_fim,
        data_retorno: indicadores?.novaDataRetorno || ferias.data_retorno,
        dias: indicadores?.saldoRetomado ?? ferias.dias,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
    queryClient.invalidateQueries({ queryKey: ['registros-livro-all'] });

    setLoading(false);
    onClose();
  };

  if (!ferias) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1e3a5f]">
            <FileText className="w-5 h-5" />
            Registrar no Livro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-800">
                {ferias.militar_posto} {ferias.militar_nome}
              </span>
              <span className="text-slate-400 text-sm">Mat: {ferias.militar_matricula}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs">Período Aquisitivo</p>
                <p className="font-medium text-slate-700">{ferias.periodo_aquisitivo_ref || '-'}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs">Início das Férias</p>
                <p className="font-medium text-slate-700">{formatDateBR(ferias.data_inicio)}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs">Retorno Previsto</p>
                <p className="font-medium text-slate-700">{formatDateBR(ferias.data_retorno)}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs">
                  {tipoRegistro === 'Nova Saída / Retomada' ? 'Saldo Atual' : 'Dias'}
                </p>
                <p className="font-medium text-slate-700">
                  {tipoRegistro === 'Nova Saída / Retomada'
                    ? (ferias.saldo_remanescente ?? ferias.dias)
                    : ferias.dias}
                </p>
              </div>

              {ferias.fracionamento && (
                <div>
                  <p className="text-slate-400 text-xs">Fração</p>
                  <p className="font-medium text-slate-700">{ferias.fracionamento}</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
            <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-700 text-sm font-medium">
              {NOMES_OPERACIONAIS[tipoRegistro] || tipoRegistro}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700">
              Data do Registro <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={dataRegistro}
              onChange={(e) => setDataRegistro(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {tipoRegistro === 'Interrupção de Férias' && indicadores && (
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
              <p className="text-sm font-semibold text-orange-700 mb-3">Resumo da Interrupção</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-orange-500 text-xs">Dias gozados</p>
                  <p className="font-semibold text-orange-700">{indicadores.diasGozados}d</p>
                </div>
                <div>
                  <p className="text-blue-500 text-xs">Saldo remanescente</p>
                  <p className="font-semibold text-blue-700">{indicadores.saldoRemanescente}d</p>
                </div>
              </div>
            </div>
          )}

          {tipoRegistro === 'Nova Saída / Retomada' && indicadores && (
            <div className="bg-teal-50 rounded-lg border border-teal-200 p-4">
              <p className="text-sm font-semibold text-teal-700 mb-3">Resumo da Continuação</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-teal-500 text-xs">Saldo retomado</p>
                  <p className="font-semibold text-teal-700">{indicadores.saldoRetomado}d</p>
                </div>
                <div>
                  <p className="text-teal-500 text-xs">Novo fim</p>
                  <p className="font-semibold text-teal-700">{formatDateBR(indicadores.novaDataFim)}</p>
                </div>
                <div>
                  <p className="text-teal-500 text-xs">Novo retorno</p>
                  <p className="font-semibold text-teal-700">{formatDateBR(indicadores.novaDataRetorno)}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium text-slate-700">Texto para Publicação</Label>

            {semTemplate ? (
              <div className="mt-1.5 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Nenhum template cadastrado para <strong>"{tipoRegistro}"</strong> no módulo Livro.
                  Cadastre um template em <strong>Templates de Texto</strong> para gerar o texto automaticamente.
                </span>
              </div>
            ) : (
              <>
                <Textarea
                  value={textoGerado}
                  onChange={(e) => setTextoGerado(e.target.value)}
                  rows={5}
                  className="mt-1.5 text-sm bg-blue-50 border-blue-200"
                />
                <p className="text-xs text-slate-400 mt-1">Você pode editar o texto antes de salvar.</p>
              </>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Publicação (opcional)</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Nota para BG</Label>
                <Input
                  value={notaBg}
                  onChange={(e) => setNotaBg(e.target.value)}
                  placeholder="001/2025"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Número do BG</Label>
                <Input
                  value={numeroBg}
                  onChange={(e) => setNumeroBg(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Data do BG</Label>
                <Input
                  type="date"
                  value={dataBg}
                  onChange={(e) => setDataBg(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-600">Status</Label>
                <div className="mt-1 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">
                  {calcularStatus()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="mt-1.5"
              placeholder="Observações..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>

            <Button
              onClick={handleSalvar}
              disabled={loading || !dataRegistro}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar Registro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}