import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ArrowLeft, User, Briefcase, FileText, Building, Phone, Heart, MapPin, GraduationCap } from 'lucide-react';
import { createPageUrl } from '@/utils';

import FormSection from '@/components/militar/FormSection';
import FormField from '@/components/militar/FormField';
import PhotoUpload from '@/components/militar/PhotoUpload';
import TagInput from '@/components/militar/TagInput';
import FuncaoSelector from '@/components/militar/FuncaoSelector';
import TempoServico from '@/components/militar/TempoServico';
import AlertasContrato from '@/components/militar/AlertasContrato';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';
import { garantirImplantacaoHistoricoComportamento, registrarMarcoHistoricoComportamento } from '@/services/justicaDisciplinaService';
import { adicionarNovaMatriculaMilitar, atualizarMilitarSemTrocarMatricula, criarMilitarComMatricula, formatarMatriculaPadrao } from '@/services/militarIdentidadeService';
import { getQuadrosCompativeis, isPostoOficial, isQuadroCompativel } from '@/utils/postoQuadroCompatibilidade';
import { enriquecerMilitarComMatriculas, isMilitarMesclado, montarIndiceMatriculas } from '@/services/matriculaMilitarViewService';

const initialFormData = {
  nome_completo: '',
  foto: '',
  status_cadastro: 'Ativo',
  situacao_militar: 'Ativa',
  funcao: '',
  lotacao: '',
  condicao: '',
  destino: '',
  nome_guerra: '',
  matricula: '',
  subgrupamento_id: '',
  subgrupamento_nome: '',
  posto_graduacao: '',
  quadro: '',
  data_inclusao: '',
  comportamento: 'Bom',
  data_nascimento: '',
  sexo: '',
  estado_civil: '',
  tipo_sanguineo: '',
  religiao: '',
  escolaridade: '',
  curso_superior: '',
  pos_graduacao: [],
  mestrado: '',
  doutorado: '',
  naturalidade: '',
  naturalidade_uf: '',
  nome_pai: '',
  nome_mae: '',
  rg: '',
  orgao_expedidor_rg: '',
  uf_rg: '',
  cnh_categoria: '',
  cnh_validade: '',
  cnh_numero: '',
  cpf: '',
  banco: '',
  agencia: '',
  conta: '',
  email_particular: '',
  telefone: '',
  email_funcional: '',
  altura: '',
  peso: '',
  etnia: '',
  logradouro: '',
  numero_endereco: '',
  cep: '',
  bairro: '',
  cidade: '',
  uf: '',
  complemento: '',
  habilidades: [],
  link_alteracoes_anteriores: ''
};

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const POSTOS_GRADUACOES = [
  // Oficiais
  { value: 'Coronel', label: 'Coronel (Cel)', grupo: 'Oficiais' },
  { value: 'Tenente Coronel', label: 'Tenente Coronel (TC)', grupo: 'Oficiais' },
  { value: 'Major', label: 'Major (Maj)', grupo: 'Oficiais' },
  { value: 'Capitão', label: 'Capitão (Cap)', grupo: 'Oficiais' },
  { value: '1º Tenente', label: '1º Tenente (1º Ten)', grupo: 'Oficiais' },
  { value: '2º Tenente', label: '2º Tenente (2º Ten)', grupo: 'Oficiais' },
  { value: 'Aspirante', label: 'Aspirante (Asp Of)', grupo: 'Oficiais' },
  // Praças
  { value: 'Subtenente', label: 'Subtenente (ST)', grupo: 'Praças' },
  { value: '1º Sargento', label: '1º Sargento (1º Sgt)', grupo: 'Praças' },
  { value: '2º Sargento', label: '2º Sargento (2º Sgt)', grupo: 'Praças' },
  { value: '3º Sargento', label: '3º Sargento (3º Sgt)', grupo: 'Praças' },
  { value: 'Cabo', label: 'Cabo (CB)', grupo: 'Praças' },
  { value: 'Soldado', label: 'Soldado (SD)', grupo: 'Praças' },
];

const QUADROS_FIXOS = ['QOBM', 'QAOBM', 'QOEBM', 'QOSAU', 'QBMP-1.a', 'QBMP-1.b', 'QBMP-2', 'QBMPT'];

const onlyDigits = (value = '') => String(value).replace(/\D/g, '');

const formatMatricula = (value = '') => {
  const digits = onlyDigits(value).slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const isValidCPF = (value = '') => {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base, factor) => {
    let total = 0;
    for (let i = 0; i < base.length; i += 1) {
      total += parseInt(base[i], 10) * (factor - i);
    }
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  const d2 = calcDigit(digits.slice(0, 10), 11);

  return d1 === parseInt(digits[9], 10) && d2 === parseInt(digits[10], 10);
};

export default function CadastrarMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const queryClient = useQueryClient();
  const { isAdmin, subgrupamentoId, subgrupamentoTipo, user, canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasMilitaresAccess = canAccessModule('militares');

  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(false);
  const [comportamentoOriginal, setComportamentoOriginal] = useState(null);
  const [avisoCompatibilidadeQuadro, setAvisoCompatibilidadeQuadro] = useState('');
  const [novaMatricula, setNovaMatricula] = useState('');
  const [novoTipoMatricula, setNovoTipoMatricula] = useState('Secundária');
  const [novoMotivoMatricula, setNovoMotivoMatricula] = useState('Atualização administrativa');
  const [novaDataInicio, setNovaDataInicio] = useState('');


  const { data: editingMilitar, isLoading: loadingEdit } = useQuery({
    queryKey: ['militar', editId],
    queryFn: async () => {
      if (!editId) return null;
      const list = await base44.entities.Militar.filter({ id: editId });
      return list[0] || null;
    },
    enabled: !!editId,
    onSuccess: (data) => {
      if (data) {
        setFormData({ ...initialFormData, ...data, matricula: formatMatricula(data.matricula) });
      }
    }
  });

  React.useEffect(() => {
    if (editingMilitar) {
      setFormData({ ...initialFormData, ...editingMilitar, matricula: formatMatricula(editingMilitar.matricula) });
      setComportamentoOriginal(editingMilitar.comportamento || null);
    }
  }, [editingMilitar]);

  const { data: matriculasMilitar = [] } = useQuery({
    queryKey: ['militar-matriculas-edicao', editId],
    queryFn: () => base44.entities.MatriculaMilitar.filter({ militar_id: editId }, '-data_inicio'),
    enabled: !!editId,
  });
  const militarDetalhado = React.useMemo(() => {
    if (!editingMilitar) return null;
    const indice = montarIndiceMatriculas(matriculasMilitar);
    return enriquecerMilitarComMatriculas(editingMilitar, indice);
  }, [editingMilitar, matriculasMilitar]);
  const militarMesclado = isMilitarMesclado(militarDetalhado || editingMilitar);

  const [motivoComportamento, setMotivoComportamento] = useState('');
  const quadrosCompativeis = getQuadrosCompativeis(formData.posto_graduacao, QUADROS_FIXOS);

  const handleChange = (name, value) => {
    if (name === 'matricula') {
      setFormData(prev => ({ ...prev, matricula: formatMatricula(value) }));
      return;
    }

    if (name === 'posto_graduacao') {
      const quadroAtual = formData.quadro;
      const precisaLimparQuadro = quadroAtual && !isQuadroCompativel(value, quadroAtual);
      setFormData((prev) => ({
        ...prev,
        posto_graduacao: value,
        quadro: precisaLimparQuadro ? '' : prev.quadro,
      }));
      setAvisoCompatibilidadeQuadro(
        precisaLimparQuadro
          ? `O quadro "${quadroAtual}" foi removido porque não é compatível com o posto/graduação selecionado.`
          : '',
      );
      return;
    }

    if (name === 'quadro') {
      if (!isQuadroCompativel(formData.posto_graduacao, value)) {
        setAvisoCompatibilidadeQuadro(
          `O quadro "${value}" não é compatível com o posto/graduação selecionado.`,
        );
        return;
      }
      setAvisoCompatibilidadeQuadro('');
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId && militarMesclado) {
      window.alert('Cadastro mesclado: edição operacional bloqueada. Consulte o cadastro de destino.');
      return;
    }

    const matriculaDigits = onlyDigits(formData.matricula);
    if (matriculaDigits.length !== 9) {
      window.alert('Matrícula inválida. Use o formato 108.747-021.');
      return;
    }

    const cpfDigits = onlyDigits(formData.cpf);
    if (cpfDigits && !isValidCPF(cpfDigits)) {
      window.alert('CPF inválido.');
      return;
    }

    if (!isQuadroCompativel(formData.posto_graduacao, formData.quadro)) {
      const categoria = isPostoOficial(formData.posto_graduacao) ? 'oficial' : 'praça';
      const quadrosPermitidos = getQuadrosCompativeis(formData.posto_graduacao, QUADROS_FIXOS).join(', ');
      window.alert(
        `Combinação inválida: o posto/graduação selecionado é ${categoria} e só permite os quadros: ${quadrosPermitidos}.`,
      );
      return;
    }

    setLoading(true);

    const dataToSave = {
      ...formData,
      matricula: formatarMatriculaPadrao(formData.matricula),
      altura: formData.altura ? parseFloat(formData.altura) : null,
      peso: formData.peso ? parseFloat(formData.peso) : null
    };

    // Preencher subgrupamento automaticamente para usuários não-admin
    if (!editId && !isAdmin && subgrupamentoId) {
      dataToSave.subgrupamento_id = subgrupamentoId;
      dataToSave.subgrupamento_nome = user?.subgrupamento_nome || '';
    }

    let militarId = editId;
    try {
      if (editId) {
        await atualizarMilitarSemTrocarMatricula(editId, dataToSave, { resolvidoPor: user?.email || '' });
      } else {
        const criado = await criarMilitarComMatricula(dataToSave, { origemRegistro: 'cadastro_manual', criadoPor: user?.email || '' });
        militarId = criado.id;
      }
    } catch (error) {
      setLoading(false);
      window.alert(error?.message || 'Falha ao salvar militar.');
      return;
    }

    if (!editId && militarId) {
      await garantirImplantacaoHistoricoComportamento({
        militarId,
        comportamentoAtual: formData.comportamento || 'Bom',
        origemTipo: 'Militar',
        origemId: militarId,
        createdBy: user?.email || '',
      });
    } else if (editId && formData.comportamento !== comportamentoOriginal && militarId) {
      await garantirImplantacaoHistoricoComportamento({
        militarId,
        comportamentoAtual: comportamentoOriginal || 'Bom',
        origemTipo: 'Militar',
        origemId: militarId,
        createdBy: user?.email || '',
      });
      await registrarMarcoHistoricoComportamento({
        militarId,
        dataVigencia: new Date().toISOString().slice(0, 10),
        comportamentoAnterior: comportamentoOriginal || 'Bom',
        comportamento: formData.comportamento || 'Bom',
        motivoMudanca: motivoComportamento || 'Revisão manual de comportamento no cadastro do militar.',
        origemTipo: 'Militar',
        origemId: militarId,
        observacoes: motivoComportamento || '',
        createdBy: user?.email || '',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['militares'] });
    setLoading(false);
    navigate(createPageUrl('Militares'));
  };

  const handleAdicionarNovaMatricula = async () => {
    if (!editId) return;
    const matriculaDigits = onlyDigits(novaMatricula);
    if (matriculaDigits.length !== 9) {
      window.alert('Informe uma matrícula válida para inclusão (formato 108.747-021).');
      return;
    }

    try {
      setLoading(true);
      await adicionarNovaMatriculaMilitar({
        militarId: editId,
        matricula: novaMatricula,
        tipoMatricula: novoTipoMatricula,
        motivo: novoMotivoMatricula || 'Atualização administrativa',
        origemRegistro: 'acao_administrativa',
        dataInicio: novaDataInicio,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['militar', editId] }),
        queryClient.invalidateQueries({ queryKey: ['militar-matriculas-edicao', editId] }),
        queryClient.invalidateQueries({ queryKey: ['militares'] }),
      ]);
      setNovaMatricula('');
      setNovoTipoMatricula('Secundária');
      setNovoMotivoMatricula('Atualização administrativa');
      setNovaDataInicio('');
      window.alert('Nova matrícula adicionada com sucesso e marcada como matrícula atual. A matrícula anterior foi preservada no histórico.');
    } catch (error) {
      window.alert(error?.message || 'Falha ao adicionar nova matrícula.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser || !isAccessResolved) return null;
  if (!hasMilitaresAccess) return <AccessDenied modulo="Efetivo" />;

  if (loadingEdit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Militares'))}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {editId ? 'Editar Militar' : 'Cadastrar Militar'}
              </h1>
              <p className="text-slate-500 text-sm">
                Preencha os dados do militar
              </p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.nome_completo || !formData.matricula || (Boolean(editId) && militarMesclado)}
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
          <FormSection title="Identificação" icon={User} defaultOpen={true}>
            <div className="flex flex-col md:flex-row gap-6">
              <PhotoUpload value={formData.foto} onChange={handleChange} />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  label="Nome Completo"
                  name="nome_completo"
                  value={formData.nome_completo}
                  onChange={handleChange}
                  required
                  className="md:col-span-2"
                />
                <FormField
                  label="Status do Cadastro"
                  name="status_cadastro"
                  value={formData.status_cadastro}
                  onChange={handleChange}
                  type="select"
                  options={['Ativo', 'Inativo']}
                />
                <FormField
                  label="Situação Militar"
                  name="situacao_militar"
                  value={formData.situacao_militar}
                  onChange={handleChange}
                  type="select"
                  options={['Ativa', 'Reserva Remunerada', 'Reformado', 'Designado', 'Convocado']}
                />
                <FuncaoSelector
                  value={formData.funcao}
                  onChange={handleChange}
                  name="funcao"
                />
                <FormField
                  label="Condição"
                  name="condicao"
                  value={formData.condicao}
                  onChange={handleChange}
                  type="select"
                  options={['Efetivo', 'Adido', 'Agregado', 'Cedido', 'À Disposição']}
                />
                {['Adido', 'Agregado', 'Cedido', 'À Disposição'].includes(formData.condicao) && (
                  <FormField
                    label="Destino"
                    name="destino"
                    value={formData.destino}
                    onChange={handleChange}
                    className="md:col-span-2"
                  />
                )}
              </div>
            </div>
          </FormSection>

          {/* Alertas de contrato para edição */}
          {editId && (
            <div className="space-y-2">
              <AlertasContrato militarId={editId} />
              {formData.data_inclusao && (
                <TempoServico dataInclusao={formData.data_inclusao} />
              )}
              {militarMesclado && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Cadastro mesclado: edição geral bloqueada para evitar operação sobre registro já consolidado.
                </div>
              )}
            </div>
          )}

          {editId && isAdmin && !militarMesclado && (
            <FormSection title="Ação Administrativa: Adicionar nova matrícula" icon={FileText} defaultOpen={true}>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Este fluxo adiciona uma nova matrícula e a marca como atual, preservando automaticamente as matrículas anteriores no histórico.
                </p>
                {!!militarDetalhado?.matriculas_historico?.length && (
                  <div className="space-y-2">
                    {militarDetalhado.matriculas_historico.map((mat) => (
                      <div key={mat.id || `${mat.matricula}-${mat.data_inicio}`} className={`rounded-md border px-3 py-2 text-xs ${mat.is_atual ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <p className="font-semibold text-slate-700">{mat.matricula_formatada || mat.matricula} {mat.is_atual ? '(Atual)' : ''}</p>
                        <p className="text-slate-500">
                          Tipo: {mat.tipo_matricula || '—'} • Situação: {mat.situacao || '—'} • Início: {mat.data_inicio || '—'} • Fim: {mat.data_fim || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FormField label="Nova matrícula" name="nova_matricula" value={novaMatricula} onChange={(_, value) => setNovaMatricula(formatMatricula(value))} required />
                  <FormField label="Tipo" name="tipo_matricula" value={novoTipoMatricula} onChange={(_, value) => setNovoTipoMatricula(value)} type="select" options={['Secundária', 'Principal', 'Temporária']} />
                  <FormField label="Data de início" name="data_inicio_matricula" value={novaDataInicio} onChange={(_, value) => setNovaDataInicio(value)} type="date" />
                  <FormField label="Motivo" name="motivo_matricula" value={novoMotivoMatricula} onChange={(_, value) => setNovoMotivoMatricula(value)} />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={handleAdicionarNovaMatricula} disabled={loading || !novaMatricula} className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white">
                    Adicionar nova matrícula
                  </Button>
                </div>
              </div>
            </FormSection>
          )}

          {/* Dados Funcionais */}
          <FormSection title="Dados Funcionais" icon={Briefcase} defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Nome de Guerra"
                name="nome_guerra"
                value={formData.nome_guerra}
                onChange={handleChange}
              />
              <FormField
                label="Matrícula"
                name="matricula"
                value={editId ? (militarDetalhado?.matricula_atual || formData.matricula) : formData.matricula}
                onChange={handleChange}
                required
                disabled={!!editId}
                hint={editId ? 'Troca direta bloqueada. Use a ação administrativa "Adicionar nova matrícula".' : ''}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Posto/Graduação</label>
                <Select value={formData.posto_graduacao} onValueChange={(v) => handleChange('posto_graduacao', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_header_oficiais" disabled className="font-semibold text-slate-400 text-xs uppercase">— Oficiais —</SelectItem>
                    {POSTOS_GRADUACOES.filter(p => p.grupo === 'Oficiais').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                    <SelectItem value="_header_pracas" disabled className="font-semibold text-slate-400 text-xs uppercase">— Praças —</SelectItem>
                    {POSTOS_GRADUACOES.filter(p => p.grupo === 'Praças').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormField
                label="Quadro"
                name="quadro"
                value={formData.quadro}
                onChange={handleChange}
                type="select"
                options={quadrosCompativeis}
                hint={avisoCompatibilidadeQuadro}
              />
              <FormField
                label="Data de Inclusão"
                name="data_inclusao"
                value={formData.data_inclusao}
                onChange={handleChange}
                type="date"
              />
              <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Comportamento</label>
              {isPostoOficial(formData.posto_graduacao) ? (
                <div className="px-3 py-2 border rounded-md bg-slate-100 text-slate-400 text-sm italic">
                  Não aplicável para Oficiais
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FormField
                      label=""
                      name="comportamento"
                      value={formData.comportamento}
                      onChange={handleChange}
                      type="select"
                      options={['Excepcional', 'Ótimo', 'Bom', 'Insuficiente', 'MAU']}
                    />
                  </div>
                </div>
              )}
              {!isPostoOficial(formData.posto_graduacao) && formData.comportamento !== comportamentoOriginal && comportamentoOriginal !== null && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-slate-600">Motivo da alteração <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={motivoComportamento}
                    onChange={e => setMotivoComportamento(e.target.value)}
                    placeholder="Descreva o motivo da alteração do comportamento..."
                    className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  />
                </div>
              )}
              </div>
            </div>
          </FormSection>

          {/* Dados Pessoais */}
          <FormSection title="Dados Pessoais" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                label="Data de Nascimento"
                name="data_nascimento"
                value={formData.data_nascimento}
                onChange={handleChange}
                type="date"
              />
              <FormField
                label="Sexo"
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                type="select"
                options={['Masculino', 'Feminino']}
              />
              <FormField
                label="Estado Civil"
                name="estado_civil"
                value={formData.estado_civil}
                onChange={handleChange}
                type="select"
                options={['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável']}
              />
              <FormField
                label="Tipo Sanguíneo"
                name="tipo_sanguineo"
                value={formData.tipo_sanguineo}
                onChange={handleChange}
                type="select"
                options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
              />
              <FormField
                label="Religião"
                name="religiao"
                value={formData.religiao}
                onChange={handleChange}
              />
              <FormField
                label="Escolaridade"
                name="escolaridade"
                value={formData.escolaridade}
                onChange={handleChange}
                type="select"
                options={['Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-Graduação', 'Mestrado', 'Doutorado']}
              />
              {['Ensino Superior Completo', 'Pós-Graduação', 'Mestrado', 'Doutorado'].includes(formData.escolaridade) && (
                <>
                  <FormField
                    label="Curso Superior"
                    name="curso_superior"
                    value={formData.curso_superior}
                    onChange={handleChange}
                    placeholder="Ex: Engenharia Civil"
                  />
                  <div className="md:col-span-2">
                    <TagInput
                      label="Pós-Graduações"
                      name="pos_graduacao"
                      value={formData.pos_graduacao}
                      onChange={handleChange}
                      placeholder="Adicionar pós-graduação..."
                    />
                  </div>
                  {['Mestrado', 'Doutorado'].includes(formData.escolaridade) && (
                    <FormField
                      label="Mestrado"
                      name="mestrado"
                      value={formData.mestrado}
                      onChange={handleChange}
                      placeholder="Área do mestrado"
                    />
                  )}
                  {formData.escolaridade === 'Doutorado' && (
                    <FormField
                      label="Doutorado"
                      name="doutorado"
                      value={formData.doutorado}
                      onChange={handleChange}
                      placeholder="Área do doutorado"
                    />
                  )}
                </>
              )}
              <FormField
                label="Naturalidade"
                name="naturalidade"
                value={formData.naturalidade}
                onChange={handleChange}
              />
              <FormField
                label="Naturalidade UF"
                name="naturalidade_uf"
                value={formData.naturalidade_uf}
                onChange={handleChange}
                type="select"
                options={UFS}
              />
            </div>
          </FormSection>

          {/* Filiação */}
          <FormSection title="Filiação" icon={Heart}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Nome do Pai"
                name="nome_pai"
                value={formData.nome_pai}
                onChange={handleChange}
              />
              <FormField
                label="Nome da Mãe"
                name="nome_mae"
                value={formData.nome_mae}
                onChange={handleChange}
              />
            </div>
          </FormSection>

          {/* Documentação */}
          <FormSection title="Documentação" icon={FileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="RG" name="rg" value={formData.rg} onChange={handleChange} />
              <FormField label="Órgão Expedidor" name="orgao_expedidor_rg" value={formData.orgao_expedidor_rg} onChange={handleChange} />
              <FormField label="UF RG" name="uf_rg" value={formData.uf_rg} onChange={handleChange} type="select" options={UFS} />
              <FormField label="CPF" name="cpf" value={formData.cpf} onChange={handleChange} />
            </div>
          </FormSection>

          {/* Habilitação */}
          <FormSection title="Habilitação" icon={GraduationCap}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="CNH Número" name="cnh_numero" value={formData.cnh_numero} onChange={handleChange} />
              <FormField label="CNH Categoria" name="cnh_categoria" value={formData.cnh_categoria} onChange={handleChange} type="select" options={['A', 'B', 'C', 'D', 'E']} />
              <FormField label="Validade CNH" name="cnh_validade" value={formData.cnh_validade} onChange={handleChange} type="date" />
            </div>
          </FormSection>

          {/* Contato */}
          <FormSection title="Contato" icon={Phone}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} />
              <FormField label="E-mail Particular" name="email_particular" value={formData.email_particular} onChange={handleChange} />
              <FormField label="E-mail Funcional" name="email_funcional" value={formData.email_funcional} onChange={handleChange} className="md:col-span-2" />
            </div>
          </FormSection>

          {/* Endereço */}
          <FormSection title="Endereço" icon={MapPin}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField label="CEP" name="cep" value={formData.cep} onChange={handleChange} />
              <FormField label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} className="md:col-span-2" />
              <FormField label="Número" name="numero_endereco" value={formData.numero_endereco} onChange={handleChange} />
              <FormField label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} />
              <FormField label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} />
              <FormField label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} />
              <FormField label="UF" name="uf" value={formData.uf} onChange={handleChange} type="select" options={UFS} />
            </div>
          </FormSection>

          {/* Informações Bancárias */}
          <FormSection title="Informações Bancárias" icon={Building}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Banco" name="banco" value={formData.banco} onChange={handleChange} />
              <FormField label="Agência" name="agencia" value={formData.agencia} onChange={handleChange} />
              <FormField label="Conta" name="conta" value={formData.conta} onChange={handleChange} />
            </div>
          </FormSection>

          {/* Informações Físicas */}
          <FormSection title="Informações Físicas" icon={Heart}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Altura (m)" name="altura" value={formData.altura} onChange={handleChange} type="number" step="0.01" />
              <FormField label="Peso (kg)" name="peso" value={formData.peso} onChange={handleChange} type="number" step="0.1" />
              <FormField label="Etnia" name="etnia" value={formData.etnia} onChange={handleChange} type="select" options={['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada']} />
            </div>
          </FormSection>

          {/* Habilidades */}
          <FormSection title="Habilidades e Cursos" icon={GraduationCap}>
            <TagInput
              label="Habilidades"
              name="habilidades"
              value={formData.habilidades}
              onChange={handleChange}
              placeholder="Adicionar habilidade..."
            />
          </FormSection>
        </form>
      </div>
    </div>
  );
}
