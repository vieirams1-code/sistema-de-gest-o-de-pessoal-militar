import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Pencil, 
  FileText, 
  Calendar,
  Clock,
  Stethoscope,
  FileSearch,
  ClipboardList,
  AlertCircle,
  CheckCircle,
  Download,
  History
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import AccessDenied from '@/components/auth/AccessDenied';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700',
  'Encerrado': 'bg-slate-100 text-slate-700',
  'Cancelado': 'bg-red-100 text-red-700',
  'Prorrogado': 'bg-blue-100 text-blue-700'
};

const tipoColors = {
  'Médico': 'bg-blue-100 text-blue-700',
  'Odontológico': 'bg-purple-100 text-purple-700',
  'Psicológico': 'bg-amber-100 text-amber-700',
  'Acompanhamento': 'bg-pink-100 text-pink-700',
  'Outro': 'bg-slate-100 text-slate-700'
};

function InfoItem({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-[#1e3a5f]">
          {Icon && <Icon className="w-5 h-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

export default function VerAtestado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const { canAccessModule, isLoading: loadingUser, isAccessResolved } = useCurrentUser();
  const hasAtestadosAccess = canAccessModule('atestados');

  const { data: atestado, isLoading } = useQuery({
    queryKey: ['atestado', id],
    queryFn: async () => {
      const list = await base44.entities.Atestado.filter({ id });
      return list[0] || null;
    },
    enabled: !!id
  });

  if (loadingUser || !isAccessResolved) return null;
  if (!hasAtestadosAccess) return <AccessDenied modulo="Atestados" />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!atestado) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Atestado não encontrado</p>
          <Button onClick={() => navigate(createPageUrl('Atestados'))}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return format(new Date(dateString + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return null;
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy");
  };

  // Calcular status do retorno
  const getRetornoStatus = () => {
    if (!atestado.data_retorno || atestado.status !== 'Ativo') return null;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const retorno = new Date(atestado.data_retorno + 'T00:00:00');
    const diasRestantes = differenceInDays(retorno, hoje);
    
    if (diasRestantes < 0) {
      return {
        icon: AlertCircle,
        text: `Atrasado (${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'})`,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      };
    } else if (diasRestantes === 0) {
      return {
        icon: Clock,
        text: 'Retorno previsto para hoje',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200'
      };
    } else {
      return {
        icon: CheckCircle,
        text: `Retorno em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200'
      };
    }
  };

  const retornoStatus = getRetornoStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Atestados'))}
              className="hover:bg-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Detalhes do Atestado</h1>
              <p className="text-slate-500 text-sm">Visualização completa do atestado médico</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarAtestado') + `?id=${atestado.id}`)}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>

        {/* Main Info Card */}
        <Card className="shadow-sm mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] p-6 text-white">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge className={statusColors[atestado.status] || statusColors['Ativo']}>
                    {atestado.status || 'Ativo'}
                  </Badge>
                  <Badge className={tipoColors[atestado.tipo] || tipoColors['Médico']}>
                    {atestado.tipo}
                  </Badge>
                  {atestado.acompanhado && (
                    <Badge className="bg-pink-100 text-pink-700">
                      Acompanhamento
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {atestado.militar_posto && `${atestado.militar_posto} `}
                  {atestado.militar_nome}
                </h2>
                {atestado.militar_matricula && (
                  <p className="text-white/80">Matrícula: {atestado.militar_matricula}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Status do Retorno */}
          {retornoStatus && (
            <div className={`flex items-center gap-3 px-6 py-4 border-b ${retornoStatus.bgColor} ${retornoStatus.borderColor}`}>
              <retornoStatus.icon className={`w-6 h-6 ${retornoStatus.color}`} />
              <span className={`font-semibold ${retornoStatus.color}`}>
                {retornoStatus.text}
              </span>
            </div>
          )}

          {/* Período */}
          <div className="p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Calendar className="w-5 h-5 mx-auto text-[#1e3a5f] mb-2" />
                <p className="text-xs text-slate-500 mb-1">Data de Início</p>
                <p className="font-bold text-slate-900">{formatShortDate(atestado.data_inicio)}</p>
              </div>
              <div className="text-center">
                <Clock className="w-5 h-5 mx-auto text-[#1e3a5f] mb-2" />
                <p className="text-xs text-slate-500 mb-1">Duração</p>
                <p className="font-bold text-slate-900">{atestado.dias} dias</p>
              </div>
              <div className="text-center">
                <Calendar className="w-5 h-5 mx-auto text-[#1e3a5f] mb-2" />
                <p className="text-xs text-slate-500 mb-1">Data de Término</p>
                <p className="font-bold text-slate-900">{formatShortDate(atestado.data_termino)}</p>
              </div>
              <div className="text-center">
                <CheckCircle className="w-5 h-5 mx-auto text-[#1e3a5f] mb-2" />
                <p className="text-xs text-slate-500 mb-1">Data de Retorno</p>
                <p className="font-bold text-slate-900">{formatShortDate(atestado.data_retorno)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dados do Médico */}
          {(atestado.medico || atestado.tipo) && (
            <Section title="Informações Médicas" icon={Stethoscope}>
              <div className="space-y-2">
                <InfoItem label="Médico Responsável" value={atestado.medico} />
                <InfoItem label="Tipo de Atestado" value={atestado.tipo} />
                {atestado.acompanhado && atestado.grau_parentesco && (
                  <InfoItem label="Grau de Parentesco" value={atestado.grau_parentesco} />
                )}
              </div>
            </Section>
          )}

          {/* CID-10 */}
          {(atestado.cid_10 || atestado.cid_descricao) && (
            <Section title="CID-10" icon={FileSearch}>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                {atestado.cid_10 && (
                  <p className="font-bold text-blue-900 mb-2">CID-10: {atestado.cid_10}</p>
                )}
                {atestado.cid_descricao && (
                  <p className="text-sm text-blue-700">{atestado.cid_descricao}</p>
                )}
              </div>
            </Section>
          )}

          {/* Arquivo */}
          {atestado.arquivo_atestado && (
            <Section title="Documento" icon={FileText}>
              <a
                href={atestado.arquivo_atestado}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
                  <Download className="w-6 h-6 text-[#1e3a5f]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Ver Atestado</p>
                  <p className="text-xs text-slate-500">Clique para abrir o arquivo</p>
                </div>
              </a>
            </Section>
          )}

          {/* JISO */}
          {atestado.necessita_jiso && (
            <Section title="JISO - Junta de Inspeção de Saúde" icon={ClipboardList}>
              <div className="space-y-2">
                {atestado.finalidade_jiso && (
                  <InfoItem label="Finalidade" value={atestado.finalidade_jiso} />
                )}
                {atestado.data_jiso && (
                  <InfoItem label="Data Agendada" value={formatShortDate(atestado.data_jiso)} icon={Calendar} />
                )}
                {atestado.resultado_jiso && (
                  <InfoItem label="Resultado" value={atestado.resultado_jiso} />
                )}
                {atestado.dias_jiso && (
                  <InfoItem label="Dias Definidos pela JISO" value={`${atestado.dias_jiso} dias`} />
                )}
                {atestado.ata_jiso && (
                  <InfoItem label="Número da Ata" value={atestado.ata_jiso} />
                )}
                {atestado.parecer_jiso && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">Parecer</p>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-slate-700">{atestado.parecer_jiso}</p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Controle BG */}
          {(atestado.bg || atestado.data_bg || atestado.publicacao_nota) && (
            <Section title="Controle de Publicação" icon={ClipboardList}>
              <div className="space-y-2">
                <InfoItem label="Boletim Geral (BG)" value={atestado.bg} />
                <InfoItem label="Data do BG" value={formatDate(atestado.data_bg)} icon={Calendar} />
                {atestado.publicacao_nota && (
                  <div className="flex items-center gap-2 text-emerald-600 py-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Publicado em nota</span>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        {/* Histórico de Decisões JISO */}
        {atestado.historico_jiso?.length > 0 && (
          <div className="mt-6">
            <Section title="Histórico de Decisões (Prorrogações / Cassações)" icon={History}>
              <div className="space-y-3">
                {atestado.historico_jiso.map((h, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border text-sm ${h.tipo === 'Prorrogação' ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${h.tipo === 'Prorrogação' ? 'text-blue-700' : 'text-red-700'}`}>
                        {h.tipo} de {h.dias_alterados} {h.dias_alterados === 1 ? 'dia' : 'dias'}
                      </span>
                      <span className="text-slate-500 text-xs">{formatShortDate(h.data_registro)}</span>
                    </div>
                    <p className="text-slate-700">{h.motivo}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      Novo término: <span className="font-medium">{formatShortDate(h.nova_data_termino)}</span>
                      {' · '}Novo retorno: <span className="font-medium">{formatShortDate(h.nova_data_retorno)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Notas e Observações */}
        {(atestado.nota_para_bg || atestado.texto_publicacao || atestado.das_escusas || atestado.retorno || atestado.observacoes) && (
          <div className="grid grid-cols-1 gap-6 mt-6">
            {atestado.nota_para_bg && (
              <Section title="Nota para BG">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{atestado.nota_para_bg}</p>
                </div>
              </Section>
            )}

            {atestado.texto_publicacao && (
              <Section title="Texto para Publicação">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{atestado.texto_publicacao}</p>
                </div>
              </Section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {atestado.das_escusas && (
                <Section title="Das Escusas">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{atestado.das_escusas}</p>
                  </div>
                </Section>
              )}

              {atestado.retorno && (
                <Section title="Informações de Retorno">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{atestado.retorno}</p>
                  </div>
                </Section>
              )}
            </div>

            {atestado.observacoes && (
              <Section title="Observações">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{atestado.observacoes}</p>
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}