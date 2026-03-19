import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FormField from '@/components/militar/FormField';

export default function RPSpecificFieldsExOfficio({
  tipoRegistro,
  formData,
  handleChange,
  camposCustom,
  setCamposCustom,
  tiposCustom,
  atestadosMilitar,
  todasPublicacoesFormatadas,
  publicacoesElegiveis,
  formatarDataExtenso,
}) {
  const publicacoesDisponiveis = publicacoesElegiveis || todasPublicacoesFormatadas.filter(p => p.numero_bg && p.data_bg);

  switch (tipoRegistro) {
    case 'Elogio Individual':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Elogio Individual</h3>
          <div className="space-y-4">
            <div>
              <Label>Texto Complemento</Label>
              <Textarea
                value={formData.texto_complemento}
                onChange={(e) => handleChange('texto_complemento', e.target.value)}
                className="mt-1.5"
                rows={4}
                placeholder="pela dedicação e esforço demonstrados..."
              />
            </div>
          </div>
        </div>
      );

    case 'Melhoria de Comportamento':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Melhoria de Comportamento</h3>
          <div className="space-y-4">
            <FormField
              label="Data da Melhoria"
              name="data_melhoria"
              value={formData.data_melhoria}
              onChange={handleChange}
              type="date"
              required
            />
            <div>
              <Label className="text-sm text-slate-700 font-medium">Comportamento Atual</Label>
              <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">
                {formData.comportamento_atual || '—'}
              </div>
            </div>
            <FormField
              label="Comportamento que Ingressa / Mantém"
              name="comportamento_ingressou"
              value={formData.comportamento_ingressou}
              onChange={handleChange}
              type="select"
              options={['Excepcional', 'Ótimo', 'Bom']}
              required
            />
          </div>
        </div>
      );

    case 'Punição':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Punição</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Portaria"
                name="portaria"
                value={formData.portaria}
                onChange={handleChange}
                placeholder="001/1GBM/2025"
                required
              />
              <FormField
                label="Tipo"
                name="tipo_punicao"
                value={formData.tipo_punicao}
                onChange={handleChange}
                type="select"
                options={['Prisão', 'Detenção', 'Repreensão', 'Advertência']}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Data da Portaria"
                name="data_portaria"
                value={formData.data_portaria}
                onChange={handleChange}
                type="date"
                required
              />
              <FormField
                label="Dias"
                name="dias_punicao"
                value={formData.dias_punicao}
                onChange={handleChange}
                type="number"
              />
            </div>
            <FormField
              label="Data da Punição"
              name="data_punicao"
              value={formData.data_punicao}
              onChange={handleChange}
              type="date"
            />
            <div>
              <Label className="text-sm text-slate-700 font-medium">Comportamento Inicial</Label>
              <div className="mt-1.5 px-3 py-2 border rounded-md bg-slate-50 text-slate-600 text-sm">
                {formData.comportamento_inicial || '—'}
              </div>
            </div>
            <div>
              <Label>Itens de Enquadramento</Label>
              <Textarea
                value={formData.itens_enquadramento}
                onChange={(e) => handleChange('itens_enquadramento', e.target.value)}
                className="mt-1.5"
                rows={2}
                placeholder="3 e 5"
              />
            </div>
            <FormField
              label="Comportamento que Ingressa / Mantém"
              name="comportamento_ingresso"
              value={formData.comportamento_ingresso}
              onChange={handleChange}
              type="select"
              options={['Bom', 'Insuficiente', 'MAU']}
            />
            <FormField
              label="Graduação da Punição"
              name="graduacao_punicao"
              value={formData.graduacao_punicao}
              onChange={handleChange}
              type="select"
              options={['Leve', 'Média', 'Grave']}
            />
          </div>
        </div>
      );

    case 'Geral':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Geral</h3>
          <div className="space-y-4">
            <FormField
              label="Subtipo Geral"
              name="subtipo_geral"
              value={formData.subtipo_geral}
              onChange={handleChange}
              placeholder="Assunto da publicação"
            />
            <FormField
              label="Data do fato"
              name="data_fato"
              value={formData.data_fato}
              onChange={handleChange}
              type="date"
            />
            <div>
              <Label>Texto para Publicação</Label>
              <Textarea
                value={formData.texto_base}
                onChange={(e) => handleChange('texto_base', e.target.value)}
                className="mt-1.5"
                rows={8}
                placeholder="Digite o texto completo da publicação..."
              />
            </div>
          </div>
        </div>
      );

    case 'Designação de Função':
    case 'Dispensa de Função':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{formData.tipo}</h3>
          <div className="space-y-4">
            <FormField
              label="Função"
              name="funcao"
              value={formData.funcao}
              onChange={handleChange}
              placeholder="Auxiliar B1"
              required
            />
            <FormField
              label="Data"
              name="data_designacao"
              value={formData.data_designacao}
              onChange={handleChange}
              type="date"
              required
            />
          </div>
        </div>
      );

    case 'Ata JISO': {
      const finalidadesComAtestados = ['V.A.F', 'LTS', 'Atestado de Origem'];
      const mostrarAtestados = finalidadesComAtestados.includes(formData.finalidade_jiso);
      const atestadosJISOPendentes = atestadosMilitar.filter(a =>
        (a.necessita_jiso || a.fluxo_homologacao === 'jiso' || Number(a.dias || 0) > 15) &&
        a.status === 'Ativo' &&
        a.status_jiso !== 'Homologado pela JISO'
      );
      const selectedIds = formData.atestados_jiso_ids || [];
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">JISO</h3>
          <div className="space-y-4">
            <FormField label="Finalidade" name="finalidade_jiso" value={formData.finalidade_jiso} onChange={handleChange} type="select" options={['V.A.F', 'LTS', 'Reserva Remunerada', 'Atestado de Origem']} required />
            <FormField label="Seção JISO" name="secao_jiso" value={formData.secao_jiso} onChange={handleChange} placeholder="62/JISO/2025" />
            <FormField label="Data da Ata" name="data_ata" value={formData.data_ata} onChange={handleChange} type="date" required />
            <FormField label="NUP" name="nup" value={formData.nup} onChange={handleChange} placeholder="31.001.005-12" />
            <div>
              <Label>Parecer</Label>
              <Textarea value={formData.parecer_jiso} onChange={(e) => handleChange('parecer_jiso', e.target.value)} className="mt-1.5" rows={3} placeholder="Apto" />
            </div>
            {mostrarAtestados && (
              <div>
                <Label className="block mb-2">Atestados do militar homologados por esta JISO</Label>
                {atestadosJISOPendentes.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum atestado aguardando JISO.</p>
                ) : (
                  <div className="space-y-2">
                    {atestadosJISOPendentes.map(a => (
                      <label key={a.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(a.id)}
                          onChange={e => {
                            const ids = e.target.checked ? [...selectedIds, a.id] : selectedIds.filter(id => id !== a.id);
                            handleChange('atestados_jiso_ids', ids);
                          }}
                        />
                        <span className="text-sm">{a.dias} dias — {formatarDataExtenso(a.data_inicio)} até {formatarDataExtenso(a.data_termino)} — CID: {a.cid_10 || '—'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'Homologação de Atestado': {
      const atestadosCurtos = atestadosMilitar.filter(a => a.dias <= 15 && !a.homologado_comandante);
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Homologação de Atestado Médico</h3>
          <p className="text-sm text-slate-500 mb-4">Somente atestados de até 15 dias não homologados.</p>
          <div className="space-y-2">
            {atestadosCurtos.length === 0 && <p className="text-sm text-slate-400">Nenhum atestado elegível para homologação.</p>}
            {atestadosCurtos.map(a => (
              <label key={a.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="atestado_homologado"
                  checked={formData.atestado_homologado_id === a.id}
                  onChange={() => handleChange('atestado_homologado_id', a.id)}
                />
                <span className="text-sm">{a.dias} dias — {formatarDataExtenso(a.data_inicio)} até {formatarDataExtenso(a.data_termino)} — CID: {a.cid_10 || '—'} — {a.tipo_afastamento}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    case 'Transcrição de Documentos':
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Transcrição de Documentos</h3>
          <div className="space-y-4">
            <FormField
              label="Documento"
              name="documento"
              value={formData.documento}
              onChange={handleChange}
              placeholder="Ofício 001"
              required
            />
            <FormField
              label="Data do Documento"
              name="data_documento"
              value={formData.data_documento}
              onChange={handleChange}
              type="date"
              required
            />
            <div>
              <Label>Assunto</Label>
              <Textarea
                value={formData.assunto}
                onChange={(e) => handleChange('assunto', e.target.value)}
                className="mt-1.5"
                rows={2}
                placeholder="TESTE"
              />
            </div>
          </div>
        </div>
      );

    case 'Apostila': {
      const pubRef = publicacoesDisponiveis.find(p => p.id === formData.publicacao_referencia_id);
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Apostila</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Publicação a Apostilar <span className="text-red-500">*</span></Label>
              <Select value={formData.publicacao_referencia_id} onValueChange={v => {
                const pub = publicacoesDisponiveis.find(p => p.id === v);
                handleChange('publicacao_referencia_id', v);
                handleChange('publicacao_referencia_origem_tipo', pub?.origem_tipo || '');
                handleChange('publicacao_referencia_tipo_label', pub?.tipo_label || '');
                handleChange('publicacao_referencia_numero_bg', pub?.numero_bg || '');
                handleChange('publicacao_referencia_data_bg', pub?.data_bg || '');
                handleChange('publicacao_referencia_nota', pub?.nota_para_bg || '');
                handleChange('texto_errado', pub?.texto_publicacao || '');
              }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione a publicação a corrigir..." />
                </SelectTrigger>
                <SelectContent>
                  {publicacoesDisponiveis.length === 0 && (
                    <SelectItem value="_none" disabled>Nenhuma publicação publicada encontrada para este militar</SelectItem>
                  )}
                  {publicacoesDisponiveis.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tipo_label} — BG {p.numero_bg} ({p.data_bg ? formatarDataExtenso(p.data_bg) : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pubRef && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                <p><span className="font-medium">Publicação:</span> {pubRef.tipo_label} — {pubRef.militar_nome}</p>
                {pubRef.numero_bg && <p><span className="font-medium">BG Nº:</span> {pubRef.numero_bg} de {formatarDataExtenso(pubRef.data_bg)}</p>}
                {pubRef.nota_para_bg && <p><span className="font-medium">Nota:</span> {pubRef.nota_para_bg}</p>}
              </div>
            )}
            <div>
              <Label className="text-sm font-medium text-slate-700">Texto Errado (edite para deixar apenas a parte incorreta)</Label>
              <Textarea
                value={formData.texto_errado || ''}
                onChange={e => handleChange('texto_errado', e.target.value)}
                rows={4}
                className="mt-1.5 font-mono text-sm"
                placeholder="Cole aqui o trecho com erro..."
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">Texto Novo (correto)</Label>
              <Textarea
                value={formData.texto_novo || ''}
                onChange={e => handleChange('texto_novo', e.target.value)}
                rows={4}
                className="mt-1.5"
                placeholder="Digite o texto correto..."
              />
            </div>
          </div>
        </div>
      );
    }

    case 'Tornar sem Efeito': {
      const pubRefTSE = publicacoesDisponiveis.find(p => p.id === formData.publicacao_referencia_id);
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Tornar sem Efeito</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">Publicação a Tornar sem Efeito <span className="text-red-500">*</span></Label>
              <Select value={formData.publicacao_referencia_id} onValueChange={v => {
                const pub = publicacoesDisponiveis.find(p => p.id === v);
                handleChange('publicacao_referencia_id', v);
                handleChange('publicacao_referencia_origem_tipo', pub?.origem_tipo || '');
                handleChange('publicacao_referencia_tipo_label', pub?.tipo_label || '');
                handleChange('publicacao_referencia_numero_bg', pub?.numero_bg || '');
                handleChange('publicacao_referencia_data_bg', pub?.data_bg || '');
                handleChange('publicacao_referencia_nota', pub?.nota_para_bg || '');
                handleChange('militar_id', pub?.militar_id || formData.militar_id);
                handleChange('militar_nome', pub?.militar_nome || formData.militar_nome);
                handleChange('militar_posto', pub?.militar_posto || formData.militar_posto);
                handleChange('militar_matricula', pub?.militar_matricula || formData.militar_matricula);
              }}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione a publicação a tornar sem efeito..." />
                </SelectTrigger>
                <SelectContent>
                  {publicacoesDisponiveis.length === 0 && (
                    <SelectItem value="_none" disabled>Nenhuma publicação publicada encontrada para este militar</SelectItem>
                  )}
                  {publicacoesDisponiveis.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.tipo_label} — BG {p.numero_bg} ({p.data_bg ? formatarDataExtenso(p.data_bg) : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pubRefTSE && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                <p><span className="font-medium">Publicação:</span> {pubRefTSE.tipo_label} — {pubRefTSE.militar_nome}</p>
                {pubRefTSE.numero_bg && <p><span className="font-medium">BG Nº:</span> {pubRefTSE.numero_bg} de {formatarDataExtenso(pubRefTSE.data_bg)}</p>}
                {pubRefTSE.nota_para_bg && <p><span className="font-medium">Nota:</span> {pubRefTSE.nota_para_bg}</p>}
                {pubRefTSE.texto_publicacao && (
                  <div className="mt-2">
                    <p className="font-medium mb-1">Texto original:</p>
                    <p className="italic text-red-600 line-clamp-3">{pubRefTSE.texto_publicacao}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    default: {
      const tipoCustom = tiposCustom.find(t => t.nome === tipoRegistro);
      if (tipoCustom) {
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">{tipoCustom.nome}</h3>
            <div className="space-y-4">
              {(tipoCustom.campos || []).map((campo) => (
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
            </div>
          </div>
        );
      }
      return null;
    }
  }
}
