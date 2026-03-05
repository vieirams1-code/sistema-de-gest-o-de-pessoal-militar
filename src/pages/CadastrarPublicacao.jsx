import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

import MilitarSelector from '@/components/atestado/MilitarSelector';
import FormField from '@/components/militar/FormField';

const initialFormData = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  tipo: 'Elogio Individual',
  ferias_interrompida_id: '',
  dias_gozados_interrupcao: '',
  data_interrupcao: '',
  data_publicacao: new Date().toISOString().split('T')[0],
  texto_base: '',
  texto_complemento: '',
  texto_publicacao: '',
  data_melhoria: '',
  comportamento_atual: '',
  comportamento_ingressou: '',
  portaria: '',
  tipo_punicao: '',
  data_portaria: '',
  dias_punicao: '',
  data_punicao: '',
  comportamento_inicial: '',
  itens_enquadramento: '',
  comportamento_ingresso: '',
  graduacao_punicao: '',
  subtipo_geral: '',
  data_fato: '',
  tipo_designacao: 'Dispensa',
  funcao: '',
  data_designacao: '',
  finalidade_jiso: '',
  secao_jiso: '',
  data_ata: '',
  nup: '',
  parecer_jiso: '',
  documento: '',
  data_documento: '',
  assunto: '',
  arquivo_url: '',
  nota_para_bg: '',
  numero_bg: '',
  data_bg: '',
  status: 'Aguardando Nota',
  observacoes: ''
};

export default function CadastrarPublicacao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const publicacaoId = searchParams.get('id');

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Configs - comandante
  const { data: configs = [] } = useQuery({
    queryKey: ['config-unidade'],
    queryFn: () => base44.entities.ConfiguracaoUnidade.list()
  });
  const { data: militaresAll = [] } = useQuery({
    queryKey: ['militares-selector-pub'],
    queryFn: () => base44.entities.Militar.list()
  });
  const comandanteConfig = configs.find(c => c.chave === 'comandante_id');
  const comandante = militaresAll.find(m => m.id === comandanteConfig?.valor);
  const artigo = comandante?.sexo === 'Feminino' ? 'A' : 'O';

  // Militar selecionado para puxar comportamento
  const { data: militarSelecionado } = useQuery({
    queryKey: ['militar-pub', formData.militar_id],
    queryFn: async () => { const r = await base44.entities.Militar.filter({ id: formData.militar_id }); return r[0]; },
    enabled: !!formData.militar_id
  });

  // Quando selecionar militar, puxar comportamento atual para os campos de comportamento
  useEffect(() => {
    if (!militarSelecionado) return;
    const comp = militarSelecionado.comportamento || '';
    setFormData(prev => ({
      ...prev,
      comportamento_inicial: comp,
      comportamento_atual: comp,
    }));
  }, [militarSelecionado?.id]);

  // Férias em curso para interrupção
  const { data: feriasEmCurso = [] } = useQuery({
    queryKey: ['ferias-em-curso', formData.militar_id],
    queryFn: () => base44.entities.Ferias.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id && formData.tipo === 'Interrupção de Férias',
    select: (data) => data.filter(f => f.status === 'Em Curso' || f.status === 'Prevista')
  });

  // Atestados do militar para JISO / homologação
  const { data: atestadosMilitar = [] } = useQuery({
    queryKey: ['atestados-militar-pub', formData.militar_id],
    queryFn: () => base44.entities.Atestado.filter({ militar_id: formData.militar_id }),
    enabled: !!formData.militar_id
  });

  const { data: publicacaoExistente, isLoading: loadingPublicacao } = useQuery({
    queryKey: ['publicacao-ex-officio', publicacaoId],
    queryFn: async () => {
      const result = await base44.entities.PublicacaoExOfficio.filter({ id: publicacaoId });
      return result[0];
    },
    enabled: !!publicacaoId
  });

  useEffect(() => {
    if (publicacaoExistente) {
      setFormData(publicacaoExistente);
    }
  }, [publicacaoExistente]);

  const handleChange = (name, value) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Status automático baseado nos campos de publicação
      if (name === 'nota_para_bg' || name === 'numero_bg' || name === 'data_bg') {
        const nota = name === 'nota_para_bg' ? value : updated.nota_para_bg;
        const numBg = name === 'numero_bg' ? value : updated.numero_bg;
        const dataBg = name === 'data_bg' ? value : updated.data_bg;
        if (numBg && dataBg) {
          updated.status = 'Publicado';
        } else if (nota) {
          updated.status = 'Aguardando Publicação';
        } else {
          updated.status = 'Aguardando Nota';
        }
      }
      return updated;
    });
  };

  const formatarDataExtenso = (dataString) => {
    if (!dataString) return '';
    const data = new Date(dataString + 'T00:00:00');
    const dia = data.getDate();
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
  };

  useEffect(() => {
    gerarTextoPublicacao();
  }, [formData]);

  const gerarTextoPublicacao = () => {
    const postoNome = formData.militar_posto ? `${formData.militar_posto} QBMP-1.a` : '';
    const nomeCompleto = formData.militar_nome || '';
    const matricula = formData.militar_matricula || '';
    const cmd = `${artigo} Comandante do 1° Grupamento de Bombeiros Militar`;
    let texto = '';

    switch (formData.tipo) {
      case 'Elogio Individual':
        if (formData.texto_base && formData.texto_complemento) {
          texto = `${cmd}, no uso das atribuições que lhe confere o art. 140, §1°, "c" e §2°, da Lei Complementar nº 053, de 30 de agosto de 1990 (Estatuto PMMS), em vigor nesta Corporação, c/c art. 67, I, e art. 68, "a" e "b", do Decreto nº 1.260, de 2 de outubro de 1981, Regulamento Disciplinar da PMMS, em vigor no CBMMS, resolve elogiar e externar sinceros cumprimentos ao ${postoNome} ${nomeCompleto}, matrícula ${matricula}, ${formData.texto_complemento}`;
        }
        break;

      case 'Melhoria de Comportamento':
        if (formData.data_melhoria && formData.comportamento_atual && formData.comportamento_ingressou) {
          texto = `${cmd}, de acordo com o art. 51, § 1° c/c art. 52, inciso I, ambos do Decreto nº 1.260/1981, resolve: conceder melhoria de comportamento, a contar de ${formatarDataExtenso(formData.data_melhoria)}, ao militar a seguir: ${postoNome} ${nomeCompleto}, matrícula n. ${matricula}, por ter completado 08 (oito) meses sucessivos sem sofrer punição, melhorando o comportamento do último para o excepcional.`;
        }
        break;

      case 'Punição':
        if (formData.portaria && formData.tipo_punicao) {
          texto = `${cmd} no uso das atribuições que lhe confere o art. 140, § 1°, "c" e § 2°, "a" e "b", e inc. V do Decreto nº 1.260, de 02 de outubro de 1981, torna pública a Solução PAD instaurado pela Portaria n° ${formData.portaria} de ${formatarDataExtenso(formData.data_portaria)} e respectiva nota de punição, cujos conteúdos seguem em anexo, onde penaliza: ${postoNome} ${nomeCompleto}, mat. ${matricula}, com: ${formData.tipo_punicao} de ${formData.dias_punicao} dias, incurso em: ${formData.itens_enquadramento} transgressão ${formData.graduacao_punicao || ''}, Ingresso no comportamento ${formData.comportamento_ingresso}. A ${formData.tipo_punicao === 'Prisão' ? 'Prisão' : 'Detenção'} será cumprida no 1/1° GBM/CBMMS: 1) Notificar o militar punido; 2) Fazer constar nas observações do Livro de Férias e Outras Concessões.`;
        }
        break;

      case 'Geral':
        texto = formData.texto_base || '';
        break;

      case 'Designação / Dispensa de Função':
        if (formData.tipo_designacao && formData.funcao && formData.data_designacao) {
          const acao = formData.tipo_designacao === 'Dispensa' ? 'dispensar' : 'designar';
          const preposicao = formData.tipo_designacao === 'Dispensa' ? 'da' : 'para exercer a';
          texto = `${cmd}, no uso de suas atribuições e conforme o §1°, "d" e §2°, "d" nº 2, do art. 5º, do Decreto nº 1.093, de 12 de junho de 1981 (Regulamento de Movimentação de Oficiais e Praças) c/c o QODE aprovado pela Portaria nº 199/BM-1 de 02 de fevereiro de 2016, resolve: ${acao} ${artigo === 'A' ? 'a' : 'o'} ${postoNome} ${nomeCompleto}, matrícula ${matricula}, ${preposicao} função de ${formData.funcao}, a contar de ${formatarDataExtenso(formData.data_designacao)}.`;
        }
        break;

      case 'Ata JISO':
        if (formData.finalidade_jiso && formData.data_ata) {
          texto = `${cmd}, no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, resolve: tornar público que recebeu a Ata de Inspeção de Saúde Sessão Nº ${formData.secao_jiso}, de ${formatarDataExtenso(formData.data_ata)}, pertencente ao: ${postoNome} ${nomeCompleto}, matrícula ${matricula}, inspecionado para fins de ${formData.finalidade_jiso}, conf. NUP Nº ${formData.nup}, com o parecer: ${formData.parecer_jiso}.`;
        }
        break;

      case 'Transcrição de Documentos':
        if (formData.documento && formData.data_documento) {
          texto = `${cmd} torna público o recebimento do(a) ${formData.documento}, de ${formatarDataExtenso(formData.data_documento)}, ${formData.assunto}, cujo conteúdo segue anexo ao presente Boletim. Em consequência: (1) Ciente; (2) Publicar.`;
        }
        break;

      case 'Homologação de Atestado': {
        const at = atestadosMilitar.find(a => a.id === formData.atestado_homologado_id);
        if (at) {
          const diasExtenso = { 1:'um',2:'dois',3:'três',4:'quatro',5:'cinco',6:'seis',7:'sete',8:'oito',9:'nove',10:'dez',11:'onze',12:'doze',13:'treze',14:'quatorze',15:'quinze' };
          texto = `${cmd}, no uso das atribuições que lhe confere o art. 49, II, do Decreto nº 5.698, de 21 de novembro de 1990, homologa o afastamento médico do ${postoNome} ${nomeCompleto}, matrícula ${matricula}, pelo período de ${at.dias} (${diasExtenso[at.dias] || at.dias}) dias, ${at.tipo_afastamento?.toLowerCase() || ''}, a contar de ${formatarDataExtenso(at.data_inicio)}, com término em ${formatarDataExtenso(at.data_termino)}. Em consequência: (1) Ao Chefe da B-1: proceder nos assentamentos do militar; (2) publique-se.`;
        }
        break;
      }
    }

    setFormData(prev => ({ ...prev, texto_publicacao: texto }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      handleChange('arquivo_url', result.file_url);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      ...formData,
      dias_punicao: formData.dias_punicao !== '' && formData.dias_punicao !== undefined && formData.dias_punicao !== null
        ? Number(formData.dias_punicao)
        : undefined,
    };

    let savedId = publicacaoId;
    if (publicacaoId) {
      await base44.entities.PublicacaoExOfficio.update(publicacaoId, dataToSave);
    } else {
      const saved = await base44.entities.PublicacaoExOfficio.create(dataToSave);
      savedId = saved.id;
    }

    // Marcar atestados homologados para Ata JISO
    if (formData.tipo === 'Ata JISO' && formData.atestados_jiso_ids?.length) {
      for (const aid of formData.atestados_jiso_ids) {
        await base44.entities.Atestado.update(aid, {
          status_jiso: 'Homologado pela JISO',
          status_publicacao: 'Publicado'
        });
      }
    }

    // Marcar atestado homologado para Homologação de Atestado
    if (formData.tipo === 'Homologação de Atestado' && formData.atestado_homologado_id) {
      await base44.entities.Atestado.update(formData.atestado_homologado_id, {
        homologado_comandante: true,
        status_jiso: 'Homologado pelo Comandante',
        status_publicacao: 'Publicado'
      });
    }

    // Atualizar comportamento do militar
    if (formData.militar_id) {
      let novoComportamento = null;
      let motivoHistorico = null;
      if (formData.tipo === 'Melhoria de Comportamento' && formData.comportamento_ingressou) {
        novoComportamento = formData.comportamento_ingressou;
        motivoHistorico = 'Melhoria de Comportamento';
      } else if (formData.tipo === 'Punição' && formData.comportamento_ingresso) {
        novoComportamento = formData.comportamento_ingresso;
        motivoHistorico = 'Punição';
      }
      if (novoComportamento) {
        const militaresResult = await base44.entities.Militar.filter({ id: formData.militar_id });
        const militarAtual = militaresResult[0];
        if (militarAtual && militarAtual.comportamento !== novoComportamento) {
          await base44.entities.Militar.update(formData.militar_id, { comportamento: novoComportamento });
          await base44.entities.HistoricoComportamento.create({
            militar_id: formData.militar_id,
            militar_nome: formData.militar_nome,
            comportamento_anterior: militarAtual.comportamento || null,
            comportamento_novo: novoComportamento,
            motivo: motivoHistorico,
            publicacao_id: savedId,
            data_alteracao: formData.data_publicacao || new Date().toISOString().split('T')[0],
            observacoes: `Publicação Ex Officio - ${formData.tipo}`
          });
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ['publicacoes-ex-officio'] });
    queryClient.invalidateQueries({ queryKey: ['militares'] });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    setLoading(false);
    navigate(createPageUrl('Publicacoes'));
  };

  const renderSpecificFields = () => {
    switch (formData.tipo) {
      case 'Elogio Individual':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Elogio Individual</h3>
            <div className="space-y-4">
              <div>
                <Label>Texto Base</Label>
                <Textarea
                  value={formData.texto_base}
                  onChange={(e) => handleChange('texto_base', e.target.value)}
                  className="mt-1.5"
                  rows={5}
                  placeholder="A Comandante do 1° Grupamento de Bombeiros Militar..."
                />
              </div>
              <div>
                <Label>Texto Complemento</Label>
                <Textarea
                  value={formData.texto_complemento}
                  onChange={(e) => handleChange('texto_complemento', e.target.value)}
                  className="mt-1.5"
                  rows={3}
                  placeholder="É um cara muito bom"
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

      case 'Designação / Dispensa de Função':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Designação / Dispensa de Função</h3>
            <div className="space-y-4">
              <FormField
                label="Tipo"
                name="tipo_designacao"
                value={formData.tipo_designacao}
                onChange={handleChange}
                type="select"
                options={['Dispensa', 'Designação']}
                required
              />
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
        const atestadosJISOPendentes = atestadosMilitar.filter(a => a.necessita_jiso && a.status === 'Ativo' && a.status_jiso !== 'Homologado pela JISO');
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
                          <span className="text-sm">{a.dias} dias — {a.data_inicio} até {a.data_termino} — CID: {a.cid_10 || '—'}</span>
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
                  <span className="text-sm">{a.dias} dias — {a.data_inicio} até {a.data_termino} — CID: {a.cid_10 || '—'} — {a.tipo_afastamento}</span>
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
              <div>
                <Label>Arquivo</Label>
                <div className="mt-1.5">
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                    className="cursor-pointer"
                  />
                  {uploadingFile && <p className="text-sm text-slate-500 mt-2">Enviando arquivo...</p>}
                  {formData.arquivo_url && (
                    <p className="text-sm text-green-600 mt-2">Arquivo anexado</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loadingPublicacao) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                {publicacaoId ? 'Editar' : 'Cadastrar'} Publicação
              </h1>
              <p className="text-slate-500 text-sm">Publicação Ex Offício</p>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-[#1e3a5f] mb-4">Identificação</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <MilitarSelector
                  value={formData.militar_id}
                  onChange={handleChange}
                  onMilitarSelect={(data) => {
                    setFormData(prev => ({
                      ...prev,
                      militar_id: data.id || prev.militar_id,
                      militar_nome: data.militar_nome || data.nome_completo,
                      militar_posto: data.militar_posto || data.posto_graduacao,
                      militar_matricula: data.militar_matricula || data.matricula
                    }));
                  }}
                />
              </div>
              <FormField
                label="Data"
                name="data_publicacao"
                value={formData.data_publicacao}
                onChange={handleChange}
                type="date"
                required
              />
            </div>
          </div>

          {formData.militar_id && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <Label className="text-sm font-medium text-slate-700">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => handleChange('tipo', v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Elogio Individual">Elogio Individual</SelectItem>
                  <SelectItem value="Melhoria de Comportamento">Melhoria de Comportamento</SelectItem>
                  <SelectItem value="Punição">Punição</SelectItem>
                  <SelectItem value="Geral">Geral</SelectItem>
                  <SelectItem value="Designação / Dispensa de Função">Designação / Dispensa de Função</SelectItem>
                  <SelectItem value="Ata JISO">Ata JISO</SelectItem>
                  <SelectItem value="Transcrição de Documentos">Transcrição de Documentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.militar_id && renderSpecificFields()}

          {formData.texto_publicacao && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Texto para publicação
              </Label>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {formData.texto_publicacao}
                </p>
              </div>
            </div>
          )}

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