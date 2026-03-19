import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FormField from '@/components/militar/FormField';

export default function RPSpecificFieldsExOfficio({
  formData,
  handleChange,
  formatarDataExtenso,
  atestadosMilitar = [],
}) {
  switch (formData.tipo_registro) {
    case 'Elogio Individual':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Elogio Individual</h3>
          <Label>Texto Complemento</Label>
          <Textarea value={formData.texto_complemento || ''} onChange={(e) => handleChange('texto_complemento', e.target.value)} className="mt-1.5" rows={4} />
        </div>
      );
    case 'Melhoria de Comportamento':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">Melhoria de Comportamento</h3>
          <FormField label="Data da Melhoria" name="data_melhoria" value={formData.data_melhoria || ''} onChange={handleChange} type="date" required />
          <div>
            <Label className="text-sm text-slate-700 font-medium">Comportamento Atual</Label>
            <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">{formData.comportamento_atual || '—'}</div>
          </div>
          <FormField label="Comportamento que Ingressa / Mantém" name="comportamento_ingressou" value={formData.comportamento_ingressou || ''} onChange={handleChange} type="select" options={['Excepcional', 'Ótimo', 'Bom']} required />
        </div>
      );
    case 'Punição':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">Punição</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Portaria" name="portaria" value={formData.portaria || ''} onChange={handleChange} required />
            <FormField label="Tipo" name="tipo_punicao" value={formData.tipo_punicao || ''} onChange={handleChange} type="select" options={['Prisão', 'Detenção', 'Repreensão', 'Advertência']} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data da Portaria" name="data_portaria" value={formData.data_portaria || ''} onChange={handleChange} type="date" required />
            <FormField label="Dias" name="dias_punicao" value={formData.dias_punicao || ''} onChange={handleChange} type="number" />
          </div>
          <FormField label="Data da Punição" name="data_punicao" value={formData.data_punicao || ''} onChange={handleChange} type="date" />
          <div>
            <Label className="text-sm text-slate-700 font-medium">Comportamento Inicial</Label>
            <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">{formData.comportamento_inicial || '—'}</div>
          </div>
          <div>
            <Label>Itens de Enquadramento</Label>
            <Textarea value={formData.itens_enquadramento || ''} onChange={(e) => handleChange('itens_enquadramento', e.target.value)} className="mt-1.5" rows={2} />
          </div>
          <FormField label="Comportamento que Ingressa / Mantém" name="comportamento_ingresso" value={formData.comportamento_ingresso || ''} onChange={handleChange} type="select" options={['Bom', 'Insuficiente', 'MAU']} />
          <FormField label="Graduação da Punição" name="graduacao_punicao" value={formData.graduacao_punicao || ''} onChange={handleChange} type="select" options={['Leve', 'Média', 'Grave']} />
        </div>
      );
    case 'Designação de Função':
    case 'Dispensa de Função':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">{formData.tipo_registro}</h3>
          <FormField label="Função" name="funcao" value={formData.funcao || ''} onChange={handleChange} required />
          <FormField label="Data" name="data_designacao" value={formData.data_designacao || ''} onChange={handleChange} type="date" required />
        </div>
      );
    case 'Ata JISO': {
      const finalidadesComAtestados = ['V.A.F', 'LTS', 'Atestado de Origem'];
      const mostrarAtestados = finalidadesComAtestados.includes(formData.finalidade_jiso);
      const atestadosJISOPendentes = atestadosMilitar.filter((a) => (a.necessita_jiso || a.fluxo_homologacao === 'jiso' || Number(a.dias || 0) > 15) && a.status === 'Ativo' && a.status_jiso !== 'Homologado pela JISO');
      const selectedIds = formData.atestados_jiso_ids || [];
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">JISO</h3>
          <FormField label="Finalidade" name="finalidade_jiso" value={formData.finalidade_jiso || ''} onChange={handleChange} type="select" options={['V.A.F', 'LTS', 'Reserva Remunerada', 'Atestado de Origem']} required />
          <FormField label="Seção JISO" name="secao_jiso" value={formData.secao_jiso || ''} onChange={handleChange} />
          <FormField label="Data da Ata" name="data_ata" value={formData.data_ata || ''} onChange={handleChange} type="date" required />
          <FormField label="NUP" name="nup" value={formData.nup || ''} onChange={handleChange} />
          <div>
            <Label>Parecer</Label>
            <Textarea value={formData.parecer_jiso || ''} onChange={(e) => handleChange('parecer_jiso', e.target.value)} className="mt-1.5" rows={3} />
          </div>
          {mostrarAtestados && (
            <div className="space-y-2">
              <Label className="block">Atestados do militar homologados por esta JISO</Label>
              {atestadosJISOPendentes.length === 0 ? <p className="text-sm text-slate-400">Nenhum atestado aguardando JISO.</p> : atestadosJISOPendentes.map((a) => (
                <label key={a.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={(e) => handleChange('atestados_jiso_ids', e.target.checked ? [...selectedIds, a.id] : selectedIds.filter((id) => id !== a.id))} />
                  <span className="text-sm">{a.dias} dias — {formatarDataExtenso(a.data_inicio)} até {formatarDataExtenso(a.data_termino)} — CID: {a.cid_10 || '—'}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'Homologação de Atestado': {
      const atestadosCurtos = atestadosMilitar.filter((a) => Number(a.dias || 0) <= 15 && !a.homologado_comandante);
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#1e3a5f]">Homologação de Atestado Médico</h3>
          {atestadosCurtos.length === 0 && <p className="text-sm text-slate-400">Nenhum atestado elegível para homologação.</p>}
          {atestadosCurtos.map((a) => (
            <label key={a.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <input type="radio" name="atestado_homologado" checked={formData.atestado_homologado_id === a.id} onChange={() => handleChange('atestado_homologado_id', a.id)} />
              <span className="text-sm">{a.dias} dias — {formatarDataExtenso(a.data_inicio)} até {formatarDataExtenso(a.data_termino)} — CID: {a.cid_10 || '—'} — {a.tipo_afastamento}</span>
            </label>
          ))}
        </div>
      );
    }
    default:
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Sem campos adicionais para este tipo.</p>
        </div>
      );
  }
}
