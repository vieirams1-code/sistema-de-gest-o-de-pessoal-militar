import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Calendar, User, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';

const numeroPorExtenso = (num) => {
  const numeros = {
    1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',
    11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze',16:'dezesseis',17:'dezessete',
    18:'dezoito',19:'dezenove',20:'vinte',21:'vinte e um',22:'vinte e dois',23:'vinte e três',
    24:'vinte e quatro',25:'vinte e cinco',26:'vinte e seis',27:'vinte e sete',28:'vinte e oito',
    29:'vinte e nove',30:'trinta',60:'sessenta',120:'cento e vinte'
  };
  return numeros[num] || num.toString();
};

const formatDate = (ds) => {
  if (!ds) return '';
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
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

  useEffect(() => {
    if (ferias && tipoInicial) {
      setTipoRegistro(tipoInicial);
      const dataDefault = tipoInicial === 'Retorno Férias' ? ferias.data_retorno : ferias.data_inicio;
      setDataRegistro(dataDefault || new Date().toISOString().split('T')[0]);
    }
  }, [ferias, tipoInicial, open]);

  useEffect(() => {
    if (!ferias) return;
    gerarTexto();
  }, [ferias, tipoRegistro, dataRegistro]);

  const gerarTexto = () => {
    if (!ferias) return;
    const postoNome = ferias.militar_posto ? `${ferias.militar_posto} QOBM` : '';
    const nome = ferias.militar_nome || '';
    const mat = ferias.militar_matricula || '';
    const periodoRef = ferias.periodo_aquisitivo_ref || '';
    const dias = ferias.dias || 0;
    const diasExt = numeroPorExtenso(dias);
    const fracao = ferias.fracionamento || '';

    let texto = '';
    if (tipoRegistro === 'Saída Férias') {
      texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nome}, matrícula ${mat}, em ${formatDate(ferias.data_inicio)} entrará em gozo de férias regulamentares, ${dias} (${diasExt}) dias, referente ao período aquisitivo ${periodoRef}.`;
    } else if (tipoRegistro === 'Retorno Férias') {
      const tipoFeriaTexto = fracao ? `${fracao} de férias regulamentares` : 'férias regulamentares';
      texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nome}, matrícula ${mat}, em ${formatDate(dataRegistro)}, por término do gozo da ${tipoFeriaTexto}, ${dias} (${diasExt}) dias, referente ao período aquisitivo ${periodoRef}.`;
    }
    setTextoGerado(texto);
  };

  const calcularStatus = () => {
    if (numeroBg && dataBg) return 'Publicado';
    if (notaBg) return 'Aguardando Publicação';
    return 'Aguardando Nota';
  };

  const handleSalvar = async () => {
    if (!ferias || !dataRegistro) return;
    setLoading(true);

    const registro = {
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
    };

    await base44.entities.RegistroLivro.create(registro);

    // Atualizar status das férias
    if (tipoRegistro === 'Saída Férias') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Em Curso',
        data_saida_registrada: new Date().toISOString()
      });
    } else if (tipoRegistro === 'Retorno Férias') {
      await base44.entities.Ferias.update(ferias.id, {
        status: 'Gozada',
        data_retorno_registrada: new Date().toISOString()
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
          {/* Info do militar e férias */}
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
                <p className="font-medium text-slate-700">{formatDate(ferias.data_inicio)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs">Retorno Previsto</p>
                <p className="font-medium text-slate-700">{formatDate(ferias.data_retorno)}</p>
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
              <div>
                <p className="text-slate-400 text-xs">Status Atual</p>
                <p className="font-medium text-slate-700">{ferias.status}</p>
              </div>
            </div>
          </div>

          {/* Tipo de registro */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
            <Select value={tipoRegistro} onValueChange={setTipoRegistro}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Saída Férias">Início de Férias (Saída)</SelectItem>
                <SelectItem value="Retorno Férias">Retorno de Férias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data do registro */}
          <div>
            <Label className="text-sm font-medium text-slate-700">Data do Registro <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={dataRegistro}
              onChange={e => setDataRegistro(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Texto gerado */}
          {textoGerado && (
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">Texto para Publicação (gerado automaticamente)</Label>
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