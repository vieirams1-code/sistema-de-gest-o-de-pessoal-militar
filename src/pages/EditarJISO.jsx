import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Calendar, FileText } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { addDays, format as formatDate } from 'date-fns';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

export default function EditarJISO() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const atestadoId = searchParams.get('atestado_id');
  const queryClient = useQueryClient();
  const { canAccessModule, isLoading, isAccessResolved } = useCurrentUser();
  const hasAtestadosAccess = canAccessModule('atestados');
  const isAccessPending = isLoading || !isAccessResolved;


  const [formData, setFormData] = useState({
    data_jiso: '',
    secao_jiso: '',
    finalidade_jiso: '',
    nup: '',
    resultado_jiso: '',
    dias_jiso: '',
    ata_jiso: '',
    parecer_jiso: '',
    status: 'Aguardando Realização',
    observacoes: ''
  });

  const { data: atestado, isLoading: loadingAtestado } = useQuery({
    queryKey: ['atestado', atestadoId],
    queryFn: async () => {
      const list = await base44.entities.Atestado.filter({ id: atestadoId });
      return list[0];
    },
    enabled: !!atestadoId && hasAtestadosAccess,
  });

  const { data: jiso, isLoading: loadingJISO } = useQuery({
    queryKey: ['jiso', atestadoId],
    queryFn: async () => {
      const list = await base44.entities.JISO.filter({ atestado_id: atestadoId });
      return list[0];
    },
    enabled: !!atestadoId && hasAtestadosAccess,
  });

  useEffect(() => {
    if (jiso) {
      setFormData({
        data_jiso: jiso.data_jiso || '',
        secao_jiso: jiso.secao_jiso || '',
        finalidade_jiso: jiso.finalidade_jiso || '',
        nup: jiso.nup || '',
        resultado_jiso: jiso.resultado_jiso || '',
        dias_jiso: jiso.dias_jiso || '',
        ata_jiso: jiso.ata_jiso || '',
        parecer_jiso: jiso.parecer_jiso || '',
        status: jiso.status || 'Aguardando Realização',
        observacoes: jiso.observacoes || ''
      });
    }
  }, [jiso]);

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const gerarTextoPublicacao = () => {
    if (!atestado || !formData.ata_jiso) return '';
    
    const formatarData = (dataStr) => {
      if (!dataStr) return '';
      const [ano, mes, dia] = dataStr.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    const postoNome = atestado.militar_posto ? `${atestado.militar_posto} QOBM` : '';
    const nomeCompleto = atestado.militar_nome || '';
    const matricula = atestado.militar_matricula || '';

    return `A Comandante do 1° Grupamento de Bombeiros Militar torna público o seguinte: JISO ${formData.secao_jiso || ''}, realizada em ${formatarData(formData.data_jiso)}, com finalidade de ${formData.finalidade_jiso || ''}, NUP: ${formData.nup || ''}, Ata n° ${formData.ata_jiso}. Parecer: ${formData.parecer_jiso || ''}. ${postoNome} ${nomeCompleto}, matrícula ${matricula}. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se.`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const jisoData = {
      atestado_id: atestadoId,
      militar_id: atestado.militar_id,
      militar_nome: atestado.militar_nome,
      militar_posto: atestado.militar_posto,
      militar_matricula: atestado.militar_matricula,
      ...formData,
      dias_original: atestado.dias,
      dias_jiso: formData.dias_jiso ? parseInt(formData.dias_jiso) : null,
      texto_publicacao: gerarTextoPublicacao()
    };

    if (jiso) {
      await base44.entities.JISO.update(jiso.id, jisoData);
    } else {
      await base44.entities.JISO.create(jisoData);
    }

    // Atualizar atestado com novos dados da JISO
    if (formData.dias_jiso && atestado.data_inicio) {
      const diasJiso = parseInt(formData.dias_jiso);
      const dataInicio = new Date(atestado.data_inicio + 'T00:00:00');
      const dataTerminoJiso = addDays(dataInicio, diasJiso - 1);
      const dataRetornoJiso = addDays(dataTerminoJiso, 1);

      await base44.entities.Atestado.update(atestadoId, {
        dias_original: atestado.dias,
        dias_jiso: diasJiso,
        data_termino_jiso: formatDate(dataTerminoJiso, 'yyyy-MM-dd'),
        data_retorno_jiso: formatDate(dataRetornoJiso, 'yyyy-MM-dd'),
        jiso_id: jiso?.id
      });
    }

    queryClient.invalidateQueries({ queryKey: ['atestados-jiso'] });
    queryClient.invalidateQueries({ queryKey: ['jisos'] });
    queryClient.invalidateQueries({ queryKey: ['atestado'] });
    queryClient.invalidateQueries({ queryKey: ['jiso'] });
    
    navigate(createPageUrl('AgendarJISO'));
  };


  if (isAccessPending) {
    return null;
  }

  if (!hasAtestadosAccess) {
    return <AccessDenied modulo="Atestados" />;
  }

  if (loadingAtestado || loadingJISO) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!atestado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500">Atestado não encontrado</p>
          <Button onClick={() => navigate(createPageUrl('AgendarJISO'))} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const textoPublicacao = gerarTextoPublicacao();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('AgendarJISO'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {jiso ? 'Editar JISO' : 'Registrar JISO'}
              </h1>
              <p className="text-slate-500 text-sm">
                {atestado.militar_posto} {atestado.militar_nome}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
          >
            <Save className="w-5 h-5 mr-2" />
            Salvar
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Atestado Original */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Dados do Atestado Original</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Dias Originais</p>
                <p className="font-medium text-lg">{atestado.dias} dias</p>
              </div>
              <div>
                <p className="text-slate-500">Data Início</p>
                <p className="font-medium">
                  {atestado.data_inicio ? formatDate(new Date(atestado.data_inicio + 'T00:00:00'), 'dd/MM/yyyy') : '-'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Tipo Afastamento</p>
                <p className="font-medium">{atestado.tipo_afastamento}</p>
              </div>
            </div>
          </div>

          {/* Dados da JISO */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Dados da JISO
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data da JISO <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.data_jiso}
                    onChange={(e) => handleChange('data_jiso', e.target.value)}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label>Seção JISO</Label>
                  <Input
                    value={formData.secao_jiso}
                    onChange={(e) => handleChange('secao_jiso', e.target.value)}
                    placeholder="Ex: qwe"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Finalidade <span className="text-red-500">*</span></Label>
                  <Select value={formData.finalidade_jiso} onValueChange={(v) => handleChange('finalidade_jiso', v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="V.A.F">V.A.F</SelectItem>
                      <SelectItem value="LTS">LTS</SelectItem>
                      <SelectItem value="Reserva Remunerada">Reserva Remunerada</SelectItem>
                      <SelectItem value="Atestado de Origem">Atestado de Origem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>NUP</Label>
                  <Input
                    value={formData.nup}
                    onChange={(e) => handleChange('nup', e.target.value)}
                    placeholder="Número do NUP"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Número da Ata <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.ata_jiso}
                    onChange={(e) => handleChange('ata_jiso', e.target.value)}
                    placeholder="Ex: 001/2025"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label>Resultado da JISO</Label>
                  <Select value={formData.resultado_jiso} onValueChange={(v) => handleChange('resultado_jiso', v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Homologado">Homologado</SelectItem>
                      <SelectItem value="Diminuído">Diminuído</SelectItem>
                      <SelectItem value="Prorrogado">Prorrogado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.resultado_jiso && (
                <div>
                  <Label>Dias Definidos pela JISO <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={formData.dias_jiso}
                    onChange={(e) => handleChange('dias_jiso', e.target.value)}
                    placeholder="Quantidade de dias"
                    className="mt-1.5"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Este valor substituirá os {atestado.dias} dias originais do atestado
                  </p>
                </div>
              )}

              <div>
                <Label>Parecer da JISO <span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.parecer_jiso}
                  onChange={(e) => handleChange('parecer_jiso', e.target.value)}
                  placeholder="Parecer detalhado da junta..."
                  className="mt-1.5 min-h-24"
                  required
                />
              </div>

              <div>
                <Label>Status da JISO</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aguardando Realização">Aguardando Realização</SelectItem>
                    <SelectItem value="Realizada">Realizada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => handleChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais..."
                  className="mt-1.5 min-h-20"
                />
              </div>
            </div>
          </div>

          {/* Texto para Publicação */}
          {textoPublicacao && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Texto Gerado para Publicação (Ata JISO)
              </h3>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {textoPublicacao}
                </p>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
