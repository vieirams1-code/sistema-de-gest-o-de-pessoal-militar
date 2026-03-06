import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, RefreshCw } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays } from 'date-fns';
import { aplicarTemplate, buildVarsLivro, formatDateBR } from '@/components/utils/templateUtils';

import MilitarSelector from '@/components/atestado/MilitarSelector';
import FeriasSelector from '@/components/livro/FeriasSelector';
import FormField from '@/components/militar/FormField';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  militar_sexo: '',
  ferias_id: '',
  tipo_registro: 'Saída Férias',
  data_registro: new Date().toISOString().split('T')[0],
  dias: 0,
  data_inicio: '',
  data_termino: '',
  data_retorno: '',
  conjuge_nome: '',
  inicio_termino: 'Início',
  falecido_nome: '',
  falecido_certidao: '',
  grau_parentesco: '',
  origem: '',
  destino: '',
  data_cedencia: '',
  obs_cedencia: '',
  tipo_transferencia: 'A pedido',
  motivo_dispensa: '',
  periodo_aquisitivo: '',
  dias_restantes: '',
  curso_nome: '',
  curso_local: '',
  edicao_ano: '',
  missao_descricao: '',
  documento_referencia: '',
  documento_texto: '',
  data_transferencia: '',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status: 'Aguardando Nota',
  observacoes: ''
};

export default function CadastrarRegistroLivro() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);

  // Buscar templates cadastrados
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });

  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom-livro'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.filter({ modulo: 'Livro', ativo: true }),
    staleTime: 30000,
  });

  // Dados extras para tipos customizados
  const [camposCustom, setCamposCustom] = useState({});

  const handleChange = (name, value) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'nota_para_bg' || name === 'numero_bg' || name === 'data_bg') {
        const nota = name === 'nota_para_bg' ? value : updated.nota_para_bg;
        const numBg = name === 'numero_bg' ? value : updated.numero_bg;
        const dataBg = name === 'data_bg' ? value : updated.data_bg;
        if (numBg && dataBg) updated.status = 'Publicado';
        else if (nota) updated.status = 'Aguardando Publicação';
        else updated.status = 'Aguardando Nota';
      }
      return updated;
    });
  };

  const handleMilitarSelect = (militar) => {
    setFormData(prev => ({
      ...prev,
      militar_id: militar.id,
      militar_nome: militar.nome_completo,
      militar_posto: militar.posto_graduacao,
      militar_matricula: militar.matricula,
      militar_sexo: militar.sexo
    }));
    setSelectedFerias(null);
  };

  const handleFeriasSelect = (ferias) => {
    setSelectedFerias(ferias);
    const dataRegistro = formData.tipo_registro === 'Retorno Férias' ? ferias.data_retorno : ferias.data_inicio;
    setFormData(prev => ({
      ...prev,
      ferias_id: ferias.id,
      data_registro: dataRegistro
    }));
  };

  const formatarDataExtenso = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString + 'T00:00:00');
    const dia = data.getDate();
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
  };

  const numeroPorExtenso = (num) => {
    const numeros = {
      1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
      6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
      11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
      16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove', 20: 'vinte',
      21: 'vinte e um', 22: 'vinte e dois', 23: 'vinte e três', 24: 'vinte e quatro',
      25: 'vinte e cinco', 26: 'vinte e seis', 27: 'vinte e sete', 28: 'vinte e oito',
      29: 'vinte e nove', 30: 'trinta', 60: 'sessenta', 120: 'cento e vinte'
    };
    return numeros[num] || num.toString();
  };

  const calcularDataTermino = () => {
    if (formData.data_inicio && formData.dias > 0) {
      const inicio = new Date(formData.data_inicio + 'T00:00:00');
      const termino = addDays(inicio, formData.dias - 1);
      return termino.toISOString().split('T')[0];
    }
    return '';
  };

  useEffect(() => {
    const termino = calcularDataTermino();
    if (termino) {
      setFormData(prev => ({ ...prev, data_termino: termino }));
    }
  }, [formData.data_inicio, formData.dias]);

  useEffect(() => {
    if (formData.tipo_registro === 'Núpcias') {
      setFormData(prev => ({ ...prev, dias: 8 }));
    } else if (formData.tipo_registro === 'Luto') {
      setFormData(prev => ({ ...prev, dias: 8 }));
    } else if (formData.tipo_registro === 'Trânsito') {
      setFormData(prev => ({ ...prev, dias: 30 }));
    } else if (formData.tipo_registro === 'Instalação') {
      setFormData(prev => ({ ...prev, dias: 10 }));
    } else if (formData.tipo_registro === 'Licença Maternidade') {
      setFormData(prev => ({ ...prev, dias: 120 }));
    } else if (formData.tipo_registro === 'Licença Paternidade') {
      setFormData(prev => ({ ...prev, dias: 5 }));
    } else if (formData.tipo_registro === 'Dispensa Recompensa') {
      setFormData(prev => ({ ...prev, dias: 4 }));
    } else if (formData.tipo_registro === 'Dispensa Desconto Férias') {
      setFormData(prev => ({ ...prev, dias: 6 }));
    }
  }, [formData.tipo_registro]);

  useEffect(() => {
    gerarTextoPublicacao();
  }, [formData, selectedFerias, templates]);

  const gerarTextoPublicacao = () => {
    const postoNome = formData.militar_posto ? `${formData.militar_posto} QOBM` : '';
    const nomeCompleto = formData.militar_nome || '';
    const matricula = formData.militar_matricula || '';
    const dataRegistro = formatarDataExtenso(formData.data_registro);
    const dataInicio = formatarDataExtenso(formData.data_inicio);
    const dataTermino = formatarDataExtenso(formData.data_termino);
    const dias = formData.dias || 0;
    const diasExtenso = numeroPorExtenso(dias);

    // Helper: tenta usar template cadastrado primeiro
    const tentarTemplate = (tipoRegistro, varsExtras = {}) => {
      const tmpl = templates.find(
        t => t.modulo === 'Livro' && t.tipo_registro === tipoRegistro && t.ativo !== false
      );
      if (tmpl?.template) {
        const vars = {
          posto_nome: postoNome,
          nome_completo: nomeCompleto,
          matricula,
          data_registro: dataRegistro,
          data_inicio: dataInicio,
          data_termino: dataTermino,
          dias: String(dias),
          dias_extenso: diasExtenso,
          ...varsExtras,
        };
        setUsingCustomTemplate(true);
        return aplicarTemplate(tmpl.template, vars);
      }
      setUsingCustomTemplate(false);
      return null;
    };

    let texto = '';

    switch (formData.tipo_registro) {
      case 'Saída Férias':
        if (selectedFerias) {
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Saída Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, em ${formatarDataExtenso(selectedFerias.data_inicio)} entrará em gozo de férias regulamentares, ${selectedFerias.dias} (${numeroPorExtenso(selectedFerias.dias)}) dias, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Retorno Férias':
        if (selectedFerias) {
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Retorno Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            const fracionamento = selectedFerias.fracionamento || '';
            const tipoFeriaTexto = fracionamento ? `${fracionamento} de férias regulamentares` : 'férias regulamentares';
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, em ${formatarDataExtenso(formData.data_registro)}, por término do gozo da ${tipoFeriaTexto}, ${selectedFerias.dias} (${numeroPorExtenso(selectedFerias.dias)}) dias, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Licença Maternidade':
        if (dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por término de ${dias} (${diasExtenso}) dias de Licença-Maternidade, acrescidos de 60 (sessenta) dias de prorrogação, a contar de ${dataInicio}, com término em ${dataTermino}.`;
        }
        break;

      case 'Licença Paternidade':
        if (dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 05 (cinco) dias de Licença-Paternidade, a contar de ${dataInicio}, com término em ${formatarDataExtenso(formData.data_termino || calcularDataTermino())}.`;
        }
        break;

      case 'Núpcias':
        if (formData.conjuge_nome && dataInicio) {
          const tipoTexto = formData.inicio_termino === 'Início' ? 'início' : 'término';
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${tipoTexto} de 08 (oito) dias de afastamento, por ter contraído matrimônio, a contar de ${dataInicio}.`;
        }
        break;

      case 'Luto':
        if (formData.falecido_nome && formData.falecido_certidao && formData.grau_parentesco && dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por término de 08 (oito) dias de luto, a contar de ${dataInicio}, com término em ${dataTermino}, referente ao falecimento de ${formData.falecido_nome}, conforme Certidão de Óbito n. ${formData.falecido_certidao}, que segue anexa ao presente boletim.`;
        }
        break;

      case 'Cedência':
        if (formData.origem && formData.destino && formData.data_cedencia) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do Militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ter sido cedido(a) do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${formatarDataExtenso(formData.data_cedencia)}.`;
        }
        break;

      case 'Transferência para RR':
        if (formData.tipo_transferencia && formData.documento_referencia && formData.data_transferencia) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ter sido transferido(a) do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${formatarDataExtenso(formData.data_transferencia)}, conforme ${formData.documento_referencia}.`;
        }
        break;

      case 'Trânsito':
        if (formData.origem && formData.destino && dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 30 (trinta) dias de trânsito, por ter sido movimentado do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${dataInicio}.`;
        }
        break;

      case 'Instalação':
        if (formData.origem && formData.destino && dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 10 (dez) dias de instalação, por ter sido movimentado do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${dataInicio}.`;
        }
        break;

      case 'Dispensa Recompensa':
        if (formData.motivo_dispensa && dataInicio) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de ${dias} (${diasExtenso}) dias de dispensa total do serviço e expediente, a título de recompensa, a contar de ${dataInicio}.`;
        }
        break;

      case 'Dispensa Desconto Férias':
        if (formData.periodo_aquisitivo && dataInicio) {
          const diasRestantes = formData.dias_restantes || '';
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de ${dias} (${diasExtenso}) dias de Dispensa para Desconto em Férias a contar de ${dataInicio}, referentes ao período aquisitivo de ${formData.periodo_aquisitivo}, restando ${diasRestantes} dias.`;
        }
        break;

      case 'Deslocamento Missão':
        if (formData.missao_descricao && formData.destino && dataInicio && formData.data_retorno) {
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${formData.inicio_termino === 'Início' ? 'início' : 'término'} de deslocamento para realização do(a) ${formData.missao_descricao}, conforme ${formData.documento_referencia}, a contar de ${dataInicio} ${formData.inicio_termino === 'Início' ? 'a ' + formatarDataExtenso(formData.data_retorno) : ''} em ${formData.destino}.`;
        }
        break;

      case 'Curso/Estágio':
        if (formData.curso_nome && formData.inicio_termino && dataInicio) {
          const eventoOuAno = formData.edicao_ano ? `, conforme ${formData.documento_referencia}, a contar de ${dataInicio}` : '';
          const localTexto = formData.curso_local ? ` em ${formData.curso_local}` : '';
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º Ten ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${formData.inicio_termino === 'Início' ? 'início' : 'término'} de deslocamento para realização do(a) ${formData.curso_nome}${localTexto}${eventoOuAno}.`;
        }
        break;
    }

    setTextoPublicacao(texto);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const registroData = {
      ...formData,
      texto_publicacao: textoPublicacao,
      dias: formData.dias !== '' && formData.dias !== undefined ? Number(formData.dias) : undefined,
      dias_restantes: formData.dias_restantes !== '' && formData.dias_restantes !== undefined ? Number(formData.dias_restantes) : undefined,
    };
    
    await base44.entities.RegistroLivro.create(registroData);

    if (formData.ferias_id) {
      if (formData.tipo_registro === 'Retorno Férias') {
        await base44.entities.Ferias.update(formData.ferias_id, {
          status: 'Gozada',
          data_retorno_registrada: new Date().toISOString()
        });
      } else if (formData.tipo_registro === 'Saída Férias') {
        await base44.entities.Ferias.update(formData.ferias_id, {
          status: 'Em Curso',
          data_saida_registrada: new Date().toISOString()
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    
    setLoading(false);
    navigate(createPageUrl('Publicacoes'));
  };

  const renderSpecificFields = () => {
    const tipoNecessitaFerias = ['Saída Férias', 'Retorno Férias'].includes(formData.tipo_registro);

    if (tipoNecessitaFerias) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Férias</h3>
          
          <div className="mb-4">
            <Label className="text-sm font-medium text-slate-700">Tipo - Férias</Label>
            <Select value={formData.tipo_registro} onValueChange={(v) => handleChange('tipo_registro', v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Saída Férias">Início de Férias</SelectItem>
                <SelectItem value="Retorno Férias">Retorno de Férias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FeriasSelector
            militarId={formData.militar_id}
            value={formData.ferias_id}
            onChange={handleFeriasSelect}
            tipoRegistro={formData.tipo_registro}
          />

          {selectedFerias && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Período Aquisitivo</p>
                  <p className="font-medium">{selectedFerias.periodo_aquisitivo_ref}</p>
                </div>
                <div>
                  <p className="text-slate-500">Data de Início</p>
                  <p className="font-medium">{formatarDataExtenso(selectedFerias.data_inicio)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (formData.tipo_registro) {
      case 'Licença Maternidade':
      case 'Prorrogação de Licença Maternidade':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{formData.tipo_registro}</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              <FormField label="Data de Término" name="data_termino" value={formData.data_termino} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Licença Paternidade':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Licença Paternidade</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              <FormField label="Data de Término" name="data_termino" value={formData.data_termino} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Núpcias':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Núpcias</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Cônjuge" name="conjuge_nome" value={formData.conjuge_nome} onChange={handleChange} placeholder="Nome do cônjuge" required />
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              </div>
            </div>
          </div>
        );

      case 'Luto':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Luto</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Falecido(a)"
                  name="falecido_nome"
                  value={formData.falecido_nome}
                  onChange={handleChange}
                  placeholder="Nome do falecido"
                  required
                />
                <FormField
                  label="Certidão de Óbito"
                  name="falecido_certidao"
                  value={formData.falecido_certidao}
                  onChange={handleChange}
                  placeholder="Número da certidão"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Grau de Parentesco (BM e Cônjuge)"
                  name="grau_parentesco"
                  value={formData.grau_parentesco}
                  onChange={handleChange}
                  type="select"
                  options={['Ascendentes', 'Descendentes', 'Cônjuge', 'Irmão(ã)']}
                  required
                />
                <FormField
                  label="Data de Início"
                  name="data_inicio"
                  value={formData.data_inicio}
                  onChange={handleChange}
                  type="date"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 'Cedência':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Cedência</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Origem"
                  name="origem"
                  value={formData.origem}
                  onChange={handleChange}
                  placeholder="Unidade de origem"
                  required
                />
                <FormField
                  label="Destino"
                  name="destino"
                  value={formData.destino}
                  onChange={handleChange}
                  placeholder="Unidade de destino"
                  required
                />
              </div>
              <FormField
                label="Data da Cedência"
                name="data_cedencia"
                value={formData.data_cedencia}
                onChange={handleChange}
                type="date"
                required
              />
              <div>
                <Label>OBS</Label>
                <Textarea
                  value={formData.obs_cedencia}
                  onChange={(e) => handleChange('obs_cedencia', e.target.value)}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'Transferência para RR':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Transferência para Reserva Remunerada</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" />
              </div>
              <FormField label="Data de Transferência" name="data_transferencia" value={formData.data_transferencia} onChange={handleChange} type="date" required />
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Publicação da Transferência
                  <span className="ml-2 text-xs text-slate-400 font-normal">(Ex: DOEMS nº XX.XXX de XX de XXX de XXXX)</span>
                </Label>
                <Input
                  value={formData.publicacao_transferencia || ''}
                  onChange={(e) => handleChange('publicacao_transferencia', e.target.value)}
                  className="mt-1.5"
                  placeholder="DOEMS nº XX.XXX de XX de XXX de XXXX"
                />
              </div>
            </div>
          </div>
        );

      case 'Trânsito':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Trânsito</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" required />
              </div>
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Instalação':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Instalação</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="Unidade de origem" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="Unidade de destino" required />
              </div>
              <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      case 'Dispensa Recompensa':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dispensa como Recompensa</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Dias" name="dias" value={formData.dias} onChange={handleChange} type="number" required />
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
              </div>
              <div>
                <Label>Motivo</Label>
                <Textarea value={formData.motivo_dispensa} onChange={(e) => handleChange('motivo_dispensa', e.target.value)} className="mt-1.5" rows={2} placeholder="Motivo da dispensa..." />
              </div>
            </div>
          </div>
        );

      case 'Dispensa Desconto Férias':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dispensa com Desconto em Férias</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Início / Término"
                  name="inicio_termino"
                  value={formData.inicio_termino}
                  onChange={handleChange}
                  type="select"
                  options={['Início', 'Término']}
                  required
                />
                <FormField
                  label="Período Aquisitivo"
                  name="periodo_aquisitivo"
                  value={formData.periodo_aquisitivo}
                  onChange={handleChange}
                  placeholder="Ex: 2023/2024"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  label="Data de Início"
                  name="data_inicio"
                  value={formData.data_inicio}
                  onChange={handleChange}
                  type="date"
                  required
                />
                <FormField
                  label="Dias"
                  name="dias"
                  value={formData.dias}
                  onChange={handleChange}
                  type="number"
                  required
                />
                <FormField
                  label="Dias Restantes"
                  name="dias_restantes"
                  value={formData.dias_restantes}
                  onChange={handleChange}
                  type="number"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 'Deslocamento Missão':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Deslocamento para Missões</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
                <FormField label="Data de Retorno" name="data_retorno" value={formData.data_retorno} onChange={handleChange} type="date" />
              </div>
              <div>
                <Label>Descrição da Missão</Label>
                <Textarea value={formData.missao_descricao} onChange={(e) => handleChange('missao_descricao', e.target.value)} className="mt-1.5" rows={2} placeholder="Ex: CMAUT/2025" />
              </div>
            </div>
          </div>
        );

      case 'Curso/Estágio':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Cursos / Estágios / Capacitações</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
                <FormField label="Edição ou Ano" name="edicao_ano" value={formData.edicao_ano} onChange={handleChange} placeholder="Ex: 2025" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Cursos" name="curso_nome" value={formData.curso_nome} onChange={handleChange} placeholder="Ex: CMAUT/2025" required />
                <FormField label="Localidade de Realização" name="curso_local" value={formData.curso_local} onChange={handleChange} placeholder="Ex: Manaus" />
              </div>
            </div>
          </div>
        );

      case 'Designação de Função':
      case 'Dispensa de Função':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{formData.tipo_registro}</h3>
            <div className="space-y-4">
              <FormField label="Função" name="funcao" value={formData.funcao || ''} onChange={handleChange} placeholder="Ex: Auxiliar B1" required />
              <FormField label="Data" name="data_designacao" value={formData.data_designacao || ''} onChange={handleChange} type="date" required />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const tipoAtualCustom = tiposCustom.find(t => t.nome === formData.tipo_registro);

  // Gerar texto para tipo customizado
  useEffect(() => {
    if (!tipoAtualCustom) return;
    const vars = {
      posto_nome: formData.militar_posto ? `${formData.militar_posto} QOBM` : '',
      nome_completo: formData.militar_nome || '',
      matricula: formData.militar_matricula || '',
      data_registro: formatarDataExtenso(formData.data_registro),
      data_inicio: formatarDataExtenso(formData.data_inicio),
      data_termino: formatarDataExtenso(formData.data_termino),
      ...(camposCustom),
    };
    let texto = tipoAtualCustom.template || '';
    Object.entries(vars).forEach(([k, v]) => {
      texto = texto.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
    });
    setTextoPublicacao(texto);
  }, [tipoAtualCustom, formData, camposCustom]);

  const tiposFiltrados = () => {
    const tipos = [
      { value: 'Saída Férias', label: 'Férias', sexo: null },
      { value: 'Retorno Férias', label: 'Retorno de Férias', sexo: null },
      { value: 'Licença Maternidade', label: 'Licença Maternidade', sexo: 'Feminino' },
      { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', sexo: 'Feminino' },
      { value: 'Licença Paternidade', label: 'Licença Paternidade', sexo: 'Masculino' },
      { value: 'Núpcias', label: 'Núpcias', sexo: null },
      { value: 'Luto', label: 'Luto', sexo: null },
      { value: 'Cedência', label: 'Cedência', sexo: null },
      { value: 'Transferência para RR', label: 'Transferência para RR', sexo: null },
      { value: 'Trânsito', label: 'Trânsito', sexo: null },
      { value: 'Instalação', label: 'Instalação', sexo: null },
      { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', sexo: null },
      { value: 'Dispensa Desconto Férias', label: 'Dispensa com Desconto em Férias', sexo: null },
      { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', sexo: null },
      { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', sexo: null },
      { value: 'Designação de Função', label: 'Designação de Função', sexo: null },
      { value: 'Dispensa de Função', label: 'Dispensa de Função', sexo: null },
    ];
    return tipos.filter(tipo => !tipo.sexo || tipo.sexo === formData.militar_sexo);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Cadastrar Livro</h1>
              <p className="text-slate-500 text-sm">Registro de livro</p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.militar_id}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white px-6"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={(name, value) => handleChange(name, value)}
                  onMilitarSelect={(data) => {
                    setFormData(prev => ({
                      ...prev,
                      militar_id: data.id || prev.militar_id,
                      militar_nome: data.militar_nome || data.nome_completo,
                      militar_posto: data.militar_posto || data.posto_graduacao,
                      militar_matricula: data.militar_matricula || data.matricula,
                      militar_sexo: data.sexo
                    }));
                  }}
                />
              </div>
              <FormField
                label="Data"
                name="data_registro"
                value={formData.data_registro}
                onChange={handleChange}
                type="date"
                required
              />
            </div>
          </div>

          {/* Tipo de Registro */}
          {formData.militar_id && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <Label className="text-sm font-medium text-slate-700">Tipo de Registro</Label>
              <Select value={formData.tipo_registro} onValueChange={(v) => {
                handleChange('tipo_registro', v);
                setSelectedFerias(null);
              }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposFiltrados().map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Campos Específicos */}
          {formData.militar_id && renderSpecificFields()}

          {/* Texto para Publicação */}
          {textoPublicacao && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-slate-700">Texto para publicação</Label>
                {usingCustomTemplate && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Template personalizado aplicado
                  </span>
                )}
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {textoPublicacao}
                </p>
              </div>
            </div>
          )}

          {/* Publicação e Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Publicação e Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Nota para BG"
                name="nota_para_bg"
                value={formData.nota_para_bg}
                onChange={handleChange}
                placeholder="Ex: 001/2025"
              />
              <div>
                <Label className="text-sm font-medium text-slate-700">Status</Label>
                <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">
                  {formData.status || 'Aguardando Nota'}
                </div>
              </div>
              <FormField
                label="Número do BG"
                name="numero_bg"
                value={formData.numero_bg}
                onChange={handleChange}
              />
              <FormField
                label="Data do BG"
                name="data_bg"
                value={formData.data_bg}
                onChange={handleChange}
                type="date"
              />
            </div>
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Observações para Alterações</h3>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => handleChange('observacoes', e.target.value)}
              className="border-slate-200"
              rows={4}
              placeholder="Observações gerais..."
            />
          </div>
        </form>
      </div>
    </div>
  );
}