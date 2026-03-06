import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, User, FileText, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aplicarTemplate, buildVarsLivro, formatDateBR, abreviarPosto } from '@/components/utils/templateUtils';

const extNum = (n) => {
  const nums = [,'um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove','vinte','vinte e um','vinte e dois','vinte e três','vinte e quatro','vinte e cinco','vinte e seis','vinte e sete','vinte e oito','vinte e nove','trinta'];
  return nums[n] || String(n);
};

// Textos padrão hardcoded (fallback quando não há template cadastrado)
const TEXTOS_PADRAO = {
  'Saída Férias': (ferias) => {
    const abrev = abreviarPosto(ferias.militar_posto);
    const postoNome = abrev ? `${abrev} QOBM` : '';
    const dias = ferias.dias || 0;
    return `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${ferias.militar_nome || ''}, matrícula ${ferias.militar_matricula || ''}, em ${formatDateBR(ferias.data_inicio)} entrará em gozo de férias regulamentares, ${dias} (${extNum(dias)}) dias, referente ao período aquisitivo ${ferias.periodo_aquisitivo_ref || ''}.`;
  },
  'Retorno Férias': (ferias, dataRegistro) => {
    const abrev = abreviarPosto(ferias.militar_posto);
    const postoNome = abrev ? `${abrev} QOBM` : '';
    const dias = ferias.dias || 0;
    const tipoFeriaTexto = ferias.fracionamento ? `${ferias.fracionamento} de férias regulamentares` : 'férias regulamentares';
    return `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${ferias.militar_nome || ''}, matrícula ${ferias.militar_matricula || ''}, em ${formatDateBR(dataRegistro)}, por término do gozo da ${tipoFeriaTexto}, ${dias} (${extNum(dias)}) dias, referente ao período aquisitivo ${ferias.periodo_aquisitivo_ref || ''}.`;
  },
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
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);

  // Buscar templates cadastrados
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });

  // Buscar período aquisitivo para ter as datas completas
  const { data: periodosAquisitivos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos', ferias?.militar_id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: ferias?.militar_id }),
    enabled: !!ferias?.militar_id,
    staleTime: 60000,
  });

  useEffect(() => {
    if (ferias && open) {
      setTipoRegistro(tipoInicial || 'Saída Férias');
      const dataDefault = tipoInicial === 'Retorno Férias' ? ferias.data_retorno : ferias.data_inicio;
      setDataRegistro(dataDefault || new Date().toISOString().split('T')[0]);
      setNotaBg('');
      setNumeroBg('');
      setDataBg('');
      setObservacoes('');
    }
  }, [ferias, tipoInicial, open]);

  useEffect(() => {
    if (!ferias || !dataRegistro) return;
    gerarTexto();
  }, [ferias, tipoRegistro, dataRegistro, templates, periodosAquisitivos]);

  const gerarTexto = () => {
    if (!ferias) return;

    // Buscar período aquisitivo para datas completas
    const periodo = periodosAquisitivos.find(p => p.id === ferias.periodo_aquisitivo_id);

    // 1. Procurar template cadastrado ativo para este tipo
    const templateCadastrado = templates.find(
      t => t.modulo === 'Livro' && t.tipo_registro === tipoRegistro && t.ativo !== false
    );

    if (templateCadastrado?.template) {
      const vars = buildVarsLivro({ ferias, dataRegistro, periodo });
      const texto = aplicarTemplate(templateCadastrado.template, vars);
      setTextoGerado(texto);
      setUsingCustomTemplate(true);
    } else {
      // 2. Fallback: texto padrão hardcoded
      const gerador = TEXTOS_PADRAO[tipoRegistro];
      const texto = gerador ? gerador(ferias, dataRegistro) : '';
      setTextoGerado(texto);
      setUsingCustomTemplate(false);
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

    await base44.entities.RegistroLivro.create({
      militar_id: ferias.militar_id,
      militar_nome: ferias.militar_nome,
      militar_posto: ferias.militar_posto,
      militar_matricula: ferias.militar_matricula,
      ferias_id: ferias.id,
      tipo_registro: tipoRegistro,
      data_registro: dataRegistro,
      dias: ferias.dias,
      texto_publicacao: textoGerado,
      nota_para_bg: notaBg,
      numero_bg: numeroBg,
      data_bg: dataBg || undefined,
      status: calcularStatus(),
      observacoes,
    });

    if (tipoRegistro === 'Saída Férias') {
      await base44.entities.Ferias.update(ferias.id, { status: 'Em Curso', data_saida_registrada: new Date().toISOString() });
    } else if (tipoRegistro === 'Retorno Férias') {
      await base44.entities.Ferias.update(ferias.id, { status: 'Gozada', data_retorno_registrada: new Date().toISOString() });
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
          {/* Info militar/férias */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-800">{ferias.militar_posto} {ferias.militar_nome}</span>
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
                <p className="text-slate-400 text-xs">Dias</p>
                <p className="font-medium text-slate-700">{ferias.dias}</p>
              </div>
              {ferias.fracionamento && (
                <div>
                  <p className="text-slate-400 text-xs">Fração</p>
                  <p className="font-medium text-slate-700">{ferias.fracionamento}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tipo de registro */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
            <Select value={tipoRegistro} onValueChange={setTipoRegistro}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Saída Férias">Início de Férias (Saída)</SelectItem>
                <SelectItem value="Retorno Férias">Retorno de Férias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data do registro */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Data do Registro <span className="text-red-500">*</span></Label>
            <Input type="date" value={dataRegistro} onChange={e => setDataRegistro(e.target.value)} className="mt-1.5" />
          </div>

          {/* Texto gerado */}
          {textoGerado && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-slate-700">Texto para Publicação</Label>
                {usingCustomTemplate && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Template personalizado aplicado
                  </span>
                )}
              </div>
              <Textarea
                value={textoGerado}
                onChange={e => setTextoGerado(e.target.value)}
                rows={5}
                className="text-sm bg-blue-50 border-blue-200"
              />
              <p className="text-xs text-slate-400 mt-1">Você pode editar o texto antes de salvar.</p>
            </div>
          )}

          {/* Publicação */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Publicação (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Nota para BG</Label>
                <Input value={notaBg} onChange={e => setNotaBg(e.target.value)} placeholder="001/2025" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Número do BG</Label>
                <Input value={numeroBg} onChange={e => setNumeroBg(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Data do BG</Label>
                <Input type="date" value={dataBg} onChange={e => setDataBg(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Status</Label>
                <div className="mt-1 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">{calcularStatus()}</div>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1.5" placeholder="Observações..." />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
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