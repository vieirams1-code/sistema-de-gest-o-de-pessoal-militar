import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import FormField from '@/components/militar/FormField';
import FeriasSelector from '@/components/livro/FeriasSelector';
import { getLivroOperacaoFeriasLabel, isTipoRegistroFerias } from '@/components/livro/feriasOperacaoUtils';

export default function RPSpecificFieldsLivro({
  tipoRegistro,
  formData,
  handleChange,
  selectedFerias,
  handleFeriasSelect,
  livroOperacaoFerias,
  operacaoFeriasSelecionada,
  formatarDataExtenso,
  isEditing,
  registroEdicao,
  originalActEntries,
}) {
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

  if (isTipoRegistroFerias(tipoRegistro)) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{getLivroOperacaoFeriasLabel(livroOperacaoFerias)}</h3>

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

  switch (tipoRegistro) {
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
      return null;
  }
}
