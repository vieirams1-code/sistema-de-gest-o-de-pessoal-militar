import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { aplicarTemplate, buildVarsLivro, abreviarPosto } from '@/components/utils/templateUtils';
import { reconciliarCadeiaFerias } from '@/components/ferias/reconciliacaoCadeiaFerias';

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
  tipo_transferencia: 'Entrada',
  publicacao_transferencia: '',
  motivo_dispensa: '',
  periodo_aquisitivo: '',
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

function getPeriodoSortKey(periodoRef, fallbackDate = '') {
  if (periodoRef) {
    const match = String(periodoRef).match(/(\d{4})\s*\/\s*(\d{4})/);
    if (match) {
      return Number(match[1]);
    }
  }

  if (fallbackDate) {
    const d = new Date(`${fallbackDate}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

function getOperacoesDisponiveisFerias(ferias) {
  if (!ferias) return ['Saída Férias'];
  if (ferias.status === 'Em Curso') return ['Retorno Férias', 'Interrupção de Férias'];
  if (ferias.status === 'Interrompida') return ['Nova Saída / Retomada'];
  return ['Saída Férias'];
}

function resolverOperacaoFerias(ferias) {
  return getOperacoesDisponiveisFerias(ferias)[0];
}


function calcularMetricasInterrupcao(ferias, dataInterrupcaoIso) {
  const diasNoMomento = Number(ferias?.dias || 0);
  const inicioBase = ferias?.data_inicio ? new Date(`${ferias.data_inicio}T00:00:00`) : null;
  const interrupcaoDate = dataInterrupcaoIso ? new Date(`${dataInterrupcaoIso}T00:00:00`) : null;

  let diasGozados = 0;
  if (inicioBase && interrupcaoDate && !Number.isNaN(inicioBase.getTime()) && !Number.isNaN(interrupcaoDate.getTime())) {
    const diffMs = interrupcaoDate.getTime() - inicioBase.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    diasGozados = Math.max(0, diffDias);
  }

  diasGozados = Math.min(diasGozados, diasNoMomento);
  const saldoRemanescente = Math.max(0, diasNoMomento - diasGozados);

  return { diasNoMomento, diasGozados, saldoRemanescente };
}

export default function CadastrarRegistroLivro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [selectedFerias, setSelectedFerias] = useState(null);
  const [operacaoFeriasSelecionada, setOperacaoFeriasSelecionada] = useState('Saída Férias');
  const [textoPublicacao, setTextoPublicacao] = useState('');
  const [usingCustomTemplate, setUsingCustomTemplate] = useState(false);

  // Buscar templates cadastrados
  const { data: templates = [] } = useQuery({
    queryKey: ['templates-texto'],
    queryFn: () => base44.entities.TemplateTexto.list(),
    staleTime: 30000,
  });

  // Buscar períodos aquisitivos do militar
  const { data: periodosAquisitivos = [] } = useQuery({
    queryKey: ['periodos-aquisitivos-livro', formData.militar_id],
    queryFn: () => base44.entities.PeriodoAquisitivo.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id,
    staleTime: 0,
  });


  const { data: tiposCustom = [] } = useQuery({
    queryKey: ['tipos-publicacao-custom-livro'],
    queryFn: () => base44.entities.TipoPublicacaoCustom.filter({ modulo: 'Livro', ativo: true }),
    staleTime: 30000,
  });

  // Dados extras para tipos customizados
  const [camposCustom, setCamposCustom] = useState({});

  const { data: registroEdicao } = useQuery({
    queryKey: ['registro-livro-edicao', id],
    queryFn: async () => {
      if (!id) return null;
      const list = await base44.entities.RegistroLivro.filter({ id });
      return list[0] || null;
    },
    enabled: !!id,
  });

  const { data: feriasEdicao } = useQuery({
    queryKey: ['ferias-edicao-livro', registroEdicao?.ferias_id],
    queryFn: async () => {
      if (!registroEdicao?.ferias_id) return null;
      const list = await base44.entities.Ferias.filter({ id: registroEdicao.ferias_id });
      return list[0] || null;
    },
    enabled: !!registroEdicao?.ferias_id,
  });

  useEffect(() => {
    if (!registroEdicao) return;

    setFormData((prev) => ({
      ...prev,
      ...registroEdicao,
    }));

    if (registroEdicao.tipo_registro && registroEdicao.tipo_registro !== 'Saída Férias') {
      setOperacaoFeriasSelecionada(registroEdicao.tipo_registro);
    }
  }, [registroEdicao]);

  useEffect(() => {
    if (!feriasEdicao) return;
    setSelectedFerias(feriasEdicao);
  }, [feriasEdicao]);

  const tipoRegistroEfetivo = formData.tipo_registro === 'Saída Férias'
    ? (selectedFerias ? operacaoFeriasSelecionada : 'Saída Férias')
    : formData.tipo_registro;

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
    const militarId = militar?.id || '';
    const militarNome = militar?.militar_nome || militar?.nome_completo || '';
    const militarPosto = militar?.militar_posto || militar?.posto_graduacao || '';
    const militarMatricula = militar?.militar_matricula || militar?.matricula || '';
    const militarSexo = militar?.sexo || '';

    setFormData(prev => ({
      ...prev,
      militar_id: militarId,
      militar_nome: militarNome,
      militar_posto: militarPosto,
      militar_matricula: militarMatricula,
      militar_sexo: militarSexo,
      ferias_id: '',
      dias: 0,
      data_inicio: '',
      data_termino: '',
      data_retorno: '',
      periodo_aquisitivo: '',
      dias_restantes: ''
    }));
    setSelectedFerias(null);
    setOperacaoFeriasSelecionada('Saída Férias');
  };

  const handleFeriasSelect = (ferias) => {
    const operacao = resolverOperacaoFerias(ferias);
    const hoje = new Date().toISOString().split('T')[0];
    let dataRegistro = formData.data_registro || hoje;

    if (operacao === 'Saída Férias') {
      dataRegistro = ferias.data_inicio || formData.data_registro || hoje;
    } else if (operacao === 'Retorno Férias') {
      dataRegistro = ferias.data_retorno || formData.data_registro || hoje;
    }

    setSelectedFerias(ferias);
    setOperacaoFeriasSelecionada(operacao);
    setFormData(prev => ({
      ...prev,
      ferias_id: ferias.id,
      data_registro: dataRegistro,
    }));
  };

  const handleOperacaoFeriasChange = (operacao) => {
    if (!selectedFerias) return;

    const hoje = new Date().toISOString().split('T')[0];
    let dataRegistro = formData.data_registro || hoje;

    if (operacao === 'Saída Férias') {
      dataRegistro = selectedFerias.data_inicio || formData.data_registro || hoje;
    } else if (operacao === 'Retorno Férias') {
      dataRegistro = selectedFerias.data_retorno || formData.data_registro || hoje;
    } else {
      dataRegistro = formData.data_registro || hoje;
    }

    setOperacaoFeriasSelecionada(operacao);
    setFormData(prev => ({
      ...prev,
      data_registro: dataRegistro,
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
    }
  }, [formData.tipo_registro]);

  useEffect(() => {
    gerarTextoPublicacao();
  }, [formData, selectedFerias, templates]);

  const gerarTextoPublicacao = () => {
    const abreviatura = abreviarPosto(formData.militar_posto);
    const postoNome = abreviatura ? `${abreviatura} QOBM` : '';
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
          posto: abreviatura,
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

    switch (tipoRegistroEfetivo) {
      case 'Saída Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Saída Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const abrevFerias = abreviarPosto(selectedFerias.militar_posto);
            const postoNomeFerias = abrevFerias ? `${abrevFerias} QOBM` : '';
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNomeFerias} ${selectedFerias.militar_nome}, matrícula ${selectedFerias.militar_matricula}, em ${formatarDataExtenso(selectedFerias.data_inicio)} entrará em gozo de férias regulamentares, ${selectedFerias.dias} (${numeroPorExtenso(selectedFerias.dias)}) dias, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Interrupção de Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const diasNoMomento = Number(selectedFerias.dias || 0);
          const inicioBase = selectedFerias.data_inicio ? new Date(`${selectedFerias.data_inicio}T00:00:00`) : null;
          const interrupcaoDate = formData.data_registro ? new Date(`${formData.data_registro}T00:00:00`) : null;
          let diasGozados = Number(selectedFerias.dias_gozados_interrupcao || 0);
          if (inicioBase && interrupcaoDate && !Number.isNaN(inicioBase.getTime()) && !Number.isNaN(interrupcaoDate.getTime())) {
            const diffMs = interrupcaoDate.getTime() - inicioBase.getTime();
            diasGozados = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
          }
          diasGozados = Math.min(diasGozados, diasNoMomento);
          const saldoRemanescente = Math.max(0, diasNoMomento - diasGozados);
          const vars = buildVarsLivro({
            ferias: selectedFerias,
            dataRegistro: formData.data_registro,
            periodo: periodoFerias,
            interrupcaoInfo: {
              dataInterrupcao: formData.data_registro,
              diasNoMomento,
              diasGozados,
              saldoRemanescente,
            },
          });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Interrupção de Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const abrevFerias = abreviarPosto(selectedFerias.militar_posto);
            const postoNomeFerias = abrevFerias ? `${abrevFerias} QOBM` : '';
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNomeFerias} ${selectedFerias.militar_nome}, matrícula ${selectedFerias.militar_matricula}, em ${formatarDataExtenso(formData.data_registro)}, teve interrompido o gozo de férias regulamentares, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Nova Saída / Retomada':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const saldoRetomada = Number(selectedFerias.saldo_remanescente ?? selectedFerias.dias ?? 0);
          const vars = buildVarsLivro({
            ferias: selectedFerias,
            dataRegistro: formData.data_registro,
            periodo: periodoFerias,
            interrupcaoInfo: { saldoRemanescente: saldoRetomada },
          });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Nova Saída / Retomada' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const abrevFerias = abreviarPosto(selectedFerias.militar_posto);
            const postoNomeFerias = abrevFerias ? `${abrevFerias} QOBM` : '';
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            const saldo = selectedFerias.saldo_remanescente ?? selectedFerias.dias ?? 0;
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNomeFerias} ${selectedFerias.militar_nome}, matrícula ${selectedFerias.militar_matricula}, em ${formatarDataExtenso(formData.data_registro)} reiniciará o gozo do saldo remanescente de férias regulamentares, ${saldo} (${numeroPorExtenso(Number(saldo))}) dias, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Retorno Férias':
        if (selectedFerias) {
          const periodoFerias = periodosAquisitivos.find(p => p.id === selectedFerias.periodo_aquisitivo_id);
          const vars = buildVarsLivro({ ferias: selectedFerias, dataRegistro: formData.data_registro, periodo: periodoFerias });
          const tmpl = templates.find(t => t.modulo === 'Livro' && t.tipo_registro === 'Retorno Férias' && t.ativo !== false);
          if (tmpl?.template) {
            texto = aplicarTemplate(tmpl.template, vars);
            setUsingCustomTemplate(true);
          } else {
            setUsingCustomTemplate(false);
            const abrevFerias = abreviarPosto(selectedFerias.militar_posto);
            const postoNomeFerias = abrevFerias ? `${abrevFerias} QOBM` : '';
            const periodoRef = selectedFerias.periodo_aquisitivo_ref || '';
            const fracionamento = selectedFerias.fracionamento || '';
            const tipoFeriaTexto = fracionamento ? `${fracionamento} de férias regulamentares` : 'férias regulamentares';
            texto = `A Comandante do 1° Grupamento de Bombeiros Militar torna público o Livro de Férias e Outras Concessões de Oficiais e Praças, cujo conteúdo segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNomeFerias} ${selectedFerias.militar_nome}, matrícula ${selectedFerias.militar_matricula}, em ${formatarDataExtenso(formData.data_registro)}, por término do gozo da ${tipoFeriaTexto}, ${selectedFerias.dias} (${numeroPorExtenso(selectedFerias.dias)}) dias, referente ao período aquisitivo ${periodoRef}.`;
          }
        }
        break;

      case 'Licença Maternidade': {
        const t = tentarTemplate('Licença Maternidade', { data_inicio: dataInicio, data_termino: dataTermino });
        if (t) { texto = t; break; }
        if (dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por término de ${dias} (${diasExtenso}) dias de Licença-Maternidade, acrescidos de 60 (sessenta) dias de prorrogação, a contar de ${dataInicio}, com término em ${dataTermino}.`;
        break;
      }

      case 'Licença Paternidade': {
        const t = tentarTemplate('Licença Paternidade', { data_inicio: dataInicio, data_termino: dataTermino });
        if (t) { texto = t; break; }
        if (dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 05 (cinco) dias de Licença-Paternidade, a contar de ${dataInicio}, com término em ${formatarDataExtenso(formData.data_termino || calcularDataTermino())}.`;
        break;
      }

      case 'Núpcias': {
        const tipoTexto = formData.inicio_termino === 'Início' ? 'início' : 'término';
        const t = tentarTemplate('Núpcias', { data_inicio: dataInicio, tipo_texto: tipoTexto });
        if (t) { texto = t; break; }
        if (formData.conjuge_nome && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${tipoTexto} de 08 (oito) dias de afastamento, por ter contraído matrimônio, a contar de ${dataInicio}.`;
        break;
      }

      case 'Luto': {
        const t = tentarTemplate('Luto', { data_inicio: dataInicio, data_termino: dataTermino, falecido_nome: formData.falecido_nome, falecido_certidao: formData.falecido_certidao, grau_parentesco: formData.grau_parentesco });
        if (t) { texto = t; break; }
        if (formData.falecido_nome && formData.falecido_certidao && formData.grau_parentesco && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por término de 08 (oito) dias de luto, a contar de ${dataInicio}, com término em ${dataTermino}, referente ao falecimento de ${formData.falecido_nome}, conforme Certidão de Óbito n. ${formData.falecido_certidao}, que segue anexa ao presente boletim.`;
        break;
      }

      case 'Cedência': {
        const t = tentarTemplate('Cedência', { origem: formData.origem, destino: formData.destino, data_cedencia: formatarDataExtenso(formData.data_cedencia) });
        if (t) { texto = t; break; }
        if (formData.origem && formData.destino && formData.data_cedencia) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do Militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ter sido cedido(a) do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${formatarDataExtenso(formData.data_cedencia)}.`;
        break;
      }

      case 'Transferência para RR': {
        const t = tentarTemplate('Transferência para RR', { origem: formData.origem, destino: formData.destino, documento_referencia: formData.documento_referencia, publicacao_transferencia: formData.publicacao_transferencia, data_transferencia: formatarDataExtenso(formData.data_transferencia) });
        if (t) { texto = t; break; }
        if (formData.documento_referencia && formData.data_transferencia) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ter sido transferido(a) do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${formatarDataExtenso(formData.data_transferencia)}, conforme ${formData.documento_referencia}.`;
        break;
      }

      case 'Transferência': {
        const t = tentarTemplate('Transferência', { origem: formData.origem, destino: formData.destino, publicacao_transferencia: formData.publicacao_transferencia, data_transferencia: formatarDataExtenso(formData.data_transferencia), tipo_transferencia: formData.tipo_transferencia });
        if (t) { texto = t; break; }
        if (formData.data_transferencia) {
          const origemTexto = formData.tipo_transferencia === 'Entrada' ? `do(a) ${formData.origem || '___'}` : `do(a) ${formData.origem || '___'}`;
          const destinoTexto = formData.tipo_transferencia === 'Entrada' ? `para o(a) ${formData.destino || '___'}` : `para o(a) ${formData.destino || '___'}`;
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do Militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ter sido transferido ${origemTexto} ${destinoTexto}, a contar de ${formatarDataExtenso(formData.data_transferencia)}${formData.publicacao_transferencia ? `, conforme ${formData.publicacao_transferencia}` : ''}.`;
        }
        break;
      }

      case 'Trânsito': {
        const t = tentarTemplate('Trânsito', { origem: formData.origem, destino: formData.destino, data_inicio: dataInicio });
        if (t) { texto = t; break; }
        if (formData.origem && formData.destino && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 30 (trinta) dias de trânsito, por ter sido movimentado do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${dataInicio}.`;
        break;
      }

      case 'Instalação': {
        const t = tentarTemplate('Instalação', { origem: formData.origem, destino: formData.destino, data_inicio: dataInicio });
        if (t) { texto = t; break; }
        if (formData.origem && formData.destino && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue: Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; 2º ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de 10 (dez) dias de instalação, por ter sido movimentado do(a) ${formData.origem} para o(a) ${formData.destino}, a contar de ${dataInicio}.`;
        break;
      }

      case 'Dispensa Recompensa': {
        const t = tentarTemplate('Dispensa Recompensa', { data_inicio: dataInicio, motivo_dispensa: formData.motivo_dispensa });
        if (t) { texto = t; break; }
        if (formData.motivo_dispensa && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por início de ${dias} (${diasExtenso}) dias de dispensa total do serviço e expediente, a título de recompensa, a contar de ${dataInicio}.`;
        break;
      }


      case 'Deslocamento Missão': {
        const dataRetornoMissao = formatarDataExtenso(formData.data_retorno);
        const t = tentarTemplate('Deslocamento Missão', { data_inicio: dataInicio, data_retorno: dataRetornoMissao, destino: formData.destino, missao_descricao: formData.missao_descricao, documento_referencia: formData.documento_referencia, inicio_termino: formData.inicio_termino });
        if (t) { texto = t; break; }
        if (formData.missao_descricao && formData.destino && dataInicio) texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${formData.inicio_termino === 'Início' ? 'início' : 'término'} de deslocamento para realização do(a) ${formData.missao_descricao}, conforme ${formData.documento_referencia}, a contar de ${dataInicio} ${formData.inicio_termino === 'Início' && dataRetornoMissao ? 'a ' + dataRetornoMissao : ''} em ${formData.destino}.`;
        break;
      }

      case 'Curso/Estágio': {
        const localTexto = formData.curso_local ? ` em ${formData.curso_local}` : '';
        const t = tentarTemplate('Curso/Estágio', { data_inicio: dataInicio, curso_nome: formData.curso_nome, curso_local: formData.curso_local, edicao_ano: formData.edicao_ano, documento_referencia: formData.documento_referencia, inicio_termino: formData.inicio_termino });
        if (t) { texto = t; break; }
        if (formData.curso_nome && formData.inicio_termino && dataInicio) {
          const eventoOuAno = formData.edicao_ano ? `, conforme ${formData.documento_referencia}, a contar de ${dataInicio}` : '';
          texto = `A Comandante do 1° Grupamento de Bombeiros Militar no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, torna público o Livro de Apresentação de Oficiais e Praças, conforme segue. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; ${postoNome} ${nomeCompleto}, matrícula ${matricula}, por ${formData.inicio_termino === 'Início' ? 'início' : 'término'} de deslocamento para realização do(a) ${formData.curso_nome}${localTexto}${eventoOuAno}.`;
        }
        break;
      }

      case 'Designação de Função':
      case 'Dispensa de Função': {
        const tipoLabel = formData.tipo_registro === 'Designação de Função' ? 'designado(a)' : 'dispensado(a)';
        const t = tentarTemplate(formData.tipo_registro, { funcao: formData.funcao || '', data_designacao: formatarDataExtenso(formData.data_designacao) });
        if (t) { texto = t; break; }
        if (formData.funcao && formData.data_designacao) texto = `${postoNome} ${nomeCompleto}, matrícula ${matricula}, ${tipoLabel} da função de ${formData.funcao}, a contar de ${formatarDataExtenso(formData.data_designacao)}.`;
        break;
      }
    }

    setTextoPublicacao(texto);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const metricasInterrupcao =
      tipoRegistroEfetivo === 'Interrupção de Férias' && selectedFerias
        ? calcularMetricasInterrupcao(selectedFerias, formData.data_registro)
        : null;

    const toNumOrUndef = (v) => (v !== '' && v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : undefined);

    const registroData = {
      ...formData,
      tipo_registro: tipoRegistroEfetivo,
      texto_publicacao: textoPublicacao,
      dias: toNumOrUndef(formData.dias),
      dias_evento: toNumOrUndef(formData.dias_evento),
      dias_restantes: toNumOrUndef(formData.dias_restantes),
      ...(metricasInterrupcao
        ? {
            dias_no_momento: metricasInterrupcao.diasNoMomento,
            dias_gozados: metricasInterrupcao.diasGozados,
            saldo_remanescente: metricasInterrupcao.saldoRemanescente,
          }
        : {}),
    };

    if (id) {
      await base44.entities.RegistroLivro.update(id, registroData);
    } else {
      await base44.entities.RegistroLivro.create(registroData);
    }


    if (formData.ferias_id) {
      await reconciliarCadeiaFerias({
        feriasId: formData.ferias_id,
        ferias: selectedFerias || null,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['registros-livro'] });
    queryClient.invalidateQueries({ queryKey: ['ferias'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos'] });
    queryClient.invalidateQueries({ queryKey: ['periodos-aquisitivos-livro'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    queryClient.invalidateQueries({ queryKey: ['publicacoes'] });
    
    setLoading(false);
    navigate(createPageUrl('Publicacoes'));
  };

  const renderSpecificFields = () => {
    if (formData.tipo_registro === 'Saída Férias') {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Férias</h3>

          <FeriasSelector
            militarId={formData.militar_id}
            value={formData.ferias_id}
            onChange={handleFeriasSelect}
            tipoRegistro={formData.tipo_registro}
          />

          {selectedFerias && (
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
                Ação operacional identificada para esta seleção: <strong>{operacaoFeriasSelecionada === 'Nova Saída / Retomada' ? 'Continuação de férias interrompida' : operacaoFeriasSelecionada === 'Interrupção de Férias' ? 'Interrupção de férias em curso' : operacaoFeriasSelecionada === 'Retorno Férias' ? 'Término de férias em curso' : 'Início de férias'}</strong>.
              </div>
              {selectedFerias.status === 'Em Curso' && (
                <div className="p-4 bg-white rounded-lg border border-slate-200">
                  <Label className="text-sm font-medium text-slate-700">Ação para férias em curso</Label>
                  <Select value={operacaoFeriasSelecionada} onValueChange={handleOperacaoFeriasChange}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Retorno Férias">Término</SelectItem>
                      <SelectItem value="Interrupção de Férias">Interrupção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Período Aquisitivo</p>
                    <p className="font-medium">{selectedFerias.periodo_aquisitivo_ref}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p className="font-medium">{selectedFerias.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Data Base</p>
                    <p className="font-medium">{formatarDataExtenso(selectedFerias.data_inicio)}</p>
                  </div>
                  {selectedFerias.saldo_remanescente != null && (
                    <div>
                      <p className="text-slate-500">Saldo Remanescente</p>
                      <p className="font-medium text-blue-700">{selectedFerias.saldo_remanescente} dias</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (tipoRegistroEfetivo) {
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

      case 'Transferência':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Transferência</h3>
            <div className="space-y-4">
              <FormField
                label="Tipo"
                name="tipo_transferencia"
                value={formData.tipo_transferencia}
                onChange={handleChange}
                type="select"
                options={['Entrada', 'Saída', 'Ex Officio']}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="1ºSGBM/3°GBM" required />
                <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="1° Grupamento de Bombeiros Militar" required />
              </div>
              <FormField label="Data da Transferência" name="data_transferencia" value={formData.data_transferencia} onChange={handleChange} type="date" required />
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


      case 'Deslocamento Missão':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Deslocamento para Missões</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
                <FormField label="Data de Retorno" name="data_retorno" value={formData.data_retorno} onChange={handleChange} type="date" />
              </div>
              <FormField label="Documento de Referência" name="documento_referencia" value={formData.documento_referencia} onChange={handleChange} placeholder="Ex: OS nº 001/2025" />
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

      

      default:
        // Verifica se é um tipo customizado
        if (tipoAtualCustom) {
          return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{tipoAtualCustom.nome}</h3>
              <div className="space-y-4">
                {(tipoAtualCustom.campos || []).map((campo) => (
                  <div key={campo.chave}>
                    <Label className="text-sm font-medium text-slate-700">
                      {campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {campo.tipo === 'textarea' ? (
                      <Textarea
                        className="mt-1.5"
                        value={camposCustom[campo.chave] || ''}
                        onChange={e => setCamposCustom(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <Input
                        className="mt-1.5"
                        type={campo.tipo === 'date' ? 'date' : campo.tipo === 'number' ? 'number' : 'text'}
                        value={camposCustom[campo.chave] || ''}
                        onChange={e => setCamposCustom(prev => ({ ...prev, [campo.chave]: e.target.value }))}
                        required={campo.obrigatorio}
                      />
                    )}
                  </div>
                ))}
                {(!tipoAtualCustom.campos || tipoAtualCustom.campos.length === 0) && (
                  <p className="text-sm text-slate-400">Nenhum campo adicional para este tipo.</p>
                )}
              </div>
            </div>
          );
        }
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
      { value: 'Licença Maternidade', label: 'Licença Maternidade', sexo: 'Feminino' },
      { value: 'Prorrogação de Licença Maternidade', label: 'Prorrogação de Licença Maternidade', sexo: 'Feminino' },
      { value: 'Licença Paternidade', label: 'Licença Paternidade', sexo: 'Masculino' },
      { value: 'Núpcias', label: 'Núpcias', sexo: null },
      { value: 'Luto', label: 'Luto', sexo: null },
      { value: 'Cedência', label: 'Cedência', sexo: null },
      { value: 'Transferência', label: 'Transferência', sexo: null },
      { value: 'Trânsito', label: 'Trânsito', sexo: null },
      { value: 'Instalação', label: 'Instalação', sexo: null },
      { value: 'Dispensa Recompensa', label: 'Dispensa como Recompensa', sexo: null },
      { value: 'Deslocamento Missão', label: 'Deslocamento para Missões', sexo: null },
      { value: 'Curso/Estágio', label: 'Cursos / Estágios / Capacitações', sexo: null },
    ];
    // Adicionar tipos customizados
    const customTipos = tiposCustom.map(t => ({ value: t.nome, label: t.nome, sexo: null }));
    return [...tipos, ...customTipos].filter(tipo => !tipo.sexo || tipo.sexo === formData.militar_sexo);
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
                  onMilitarSelect={handleMilitarSelect}
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
                setOperacaoFeriasSelecionada('Saída Férias');
                setFormData(prev => ({
                  ...prev,
                  ferias_id: '',
                  dias: 0,
                  data_inicio: '',
                  data_termino: '',
                  data_retorno: '',
                  periodo_aquisitivo: '',
                }));
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
              {['Licença Maternidade', 'Prorrogação de Licença Maternidade', 'Licença Paternidade'].includes(formData.tipo_registro) ? (
                <Textarea
                  value={textoPublicacao}
                  onChange={e => setTextoPublicacao(e.target.value)}
                  rows={6}
                  className="text-sm text-slate-700 leading-relaxed"
                />
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {textoPublicacao}
                  </p>
                </div>
              )}
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