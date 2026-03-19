import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import FeriasSelector from '@/components/livro/FeriasSelector';
import FormField from '@/components/militar/FormField';
import { FERIAS_OPERACOES, getLivroOperacaoFeriasLabel, isTipoRegistroFerias } from '@/components/livro/feriasOperacaoUtils';

export default function RPSpecificFieldsLivro(props) {
  const {
    isEditing,
    originalActEntries,
    formData,
    handleChange,
    selectedFerias,
    handleFeriasSelect,
    livroOperacaoFerias,
    operacaoFeriasSelecionada,
    formatarDataExtenso,
    tipoAtualCustom,
    camposCustom,
    setCamposCustom,
  } = props;

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Dados originais do ato</h3>
            <p className="mt-1 text-sm text-amber-800">Os campos materiais permanecem bloqueados para impedir transformação do ato original.</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {originalActEntries.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isTipoRegistroFerias(formData.tipo_registro)) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{getLivroOperacaoFeriasLabel(livroOperacaoFerias || FERIAS_OPERACOES.INICIO)}</h3>
        <FeriasSelector
          militarId={formData.militar_id}
          value={formData.ferias_id}
          onChange={handleFeriasSelect}
          tipoRegistro={formData.tipo_registro}
          livroOperacaoFerias={livroOperacaoFerias}
          dataBase={formData.data_registro}
        />
        {selectedFerias && (
          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-800">
              Operação guiada em andamento: <strong>{getLivroOperacaoFeriasLabel(operacaoFeriasSelecionada)}</strong>.
            </div>
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

  switch (formData.tipo_registro) {
    case 'Licença Maternidade':
    case 'Prorrogação de Licença Maternidade':
    case 'Licença Paternidade':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{formData.tipo_registro}</h3>
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
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} placeholder="1ºSGBM/3°GBM" required />
              <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} placeholder="1° Grupamento de Bombeiros Militar" required />
            </div>
            <FormField label="Data da Transferência" name="data_transferencia" value={formData.data_transferencia} onChange={handleChange} type="date" required />
            <div>
              <Label className="text-sm font-medium text-slate-700">Publicação da Transferência</Label>
              <Input value={formData.publicacao_transferencia || ''} onChange={(e) => handleChange('publicacao_transferencia', e.target.value)} className="mt-1.5" />
            </div>
          </div>
        </div>
      );
    case 'Núpcias':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Núpcias</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Cônjuge" name="conjuge_nome" value={formData.conjuge_nome} onChange={handleChange} required />
            <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
          </div>
        </div>
      );
    case 'Luto':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">Luto</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Falecido(a)" name="falecido_nome" value={formData.falecido_nome} onChange={handleChange} required />
            <FormField label="Certidão de Óbito" name="falecido_certidao" value={formData.falecido_certidao} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Grau de Parentesco" name="grau_parentesco" value={formData.grau_parentesco} onChange={handleChange} type="select" options={['Ascendentes', 'Descendentes', 'Cônjuge', 'Irmão(ã)']} required />
            <FormField label="Data de Início" name="data_inicio" value={formData.data_inicio} onChange={handleChange} type="date" required />
          </div>
        </div>
      );
    case 'Cedência':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">Cedência</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Origem" name="origem" value={formData.origem} onChange={handleChange} required />
            <FormField label="Destino" name="destino" value={formData.destino} onChange={handleChange} required />
          </div>
          <FormField label="Data da Cedência" name="data_cedencia" value={formData.data_cedencia} onChange={handleChange} type="date" required />
          <div>
            <Label>OBS</Label>
            <Textarea value={formData.obs_cedencia} onChange={(e) => handleChange('obs_cedencia', e.target.value)} className="mt-1.5" rows={3} />
          </div>
        </div>
      );
    case 'Transferência para RR':
    case 'Trânsito':
    case 'Instalação':
    case 'Dispensa Recompensa':
    case 'Deslocamento Missão':
    case 'Curso/Estágio':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Preencha os dados específicos deste registro no fluxo RP.</p>
        </div>
      );
    default:
      if (!tipoAtualCustom) return null;
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{tipoAtualCustom.nome}</h3>
          <div className="space-y-4">
            {(tipoAtualCustom.campos || []).map((campo) => (
              <div key={campo.chave}>
                <Label className="text-sm font-medium text-slate-700">{campo.label}</Label>
                {campo.tipo === 'textarea' ? (
                  <Textarea className="mt-1.5" value={camposCustom[campo.chave] || ''} onChange={(e) => setCamposCustom((prev) => ({ ...prev, [campo.chave]: e.target.value }))} rows={3} />
                ) : (
                  <Input className="mt-1.5" type={campo.tipo === 'date' ? 'date' : campo.tipo === 'number' ? 'number' : 'text'} value={camposCustom[campo.chave] || ''} onChange={(e) => setCamposCustom((prev) => ({ ...prev, [campo.chave]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
      );
  }
}
