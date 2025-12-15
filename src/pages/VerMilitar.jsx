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
  User, 
  Briefcase, 
  FileText, 
  Building, 
  Phone, 
  Heart, 
  MapPin, 
  GraduationCap,
  Calendar,
  Mail,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700',
  'Inativo': 'bg-slate-100 text-slate-700',
  'Reserva': 'bg-amber-100 text-amber-700',
  'Reforma': 'bg-blue-100 text-blue-700',
  'Falecido': 'bg-red-100 text-red-700'
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

export default function VerMilitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const { data: militar, isLoading } = useQuery({
    queryKey: ['militar', id],
    queryFn: async () => {
      const list = await base44.entities.Militar.filter({ id });
      return list[0] || null;
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!militar) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Militar não encontrado</p>
          <Button onClick={() => navigate(createPageUrl('Militares'))}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (date) => {
    if (!date) return null;
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

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
              <h1 className="text-2xl font-bold text-[#1e3a5f]">Ficha do Militar</h1>
              <p className="text-slate-500 text-sm">Visualização completa dos dados</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('CadastrarMilitar') + `?id=${militar.id}`)}
            className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>

        {/* Profile Header */}
        <Card className="shadow-sm mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d4a6f] p-6 text-white">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-32 h-40 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                {militar.foto ? (
                  <img src={militar.foto} alt={militar.nome_completo} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-white/50" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge className={statusColors[militar.status_cadastro] || statusColors['Ativo']}>
                    {militar.status_cadastro || 'Ativo'}
                  </Badge>
                  {militar.condicao && (
                    <Badge variant="outline" className="border-white/30 text-white">
                      {militar.condicao}
                    </Badge>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {militar.posto_graduacao && `${militar.posto_graduacao} `}
                  {militar.nome_guerra || militar.nome_completo}
                </h2>
                {militar.nome_guerra && (
                  <p className="text-white/80">{militar.nome_completo}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-4 text-sm text-white/80">
                  {militar.matricula && <span>Matrícula: {militar.matricula}</span>}
                  {militar.quadro && <span>Quadro: {militar.quadro}</span>}
                  {militar.lotacao && <span>Lotação: {militar.lotacao}</span>}
                </div>
                {militar.funcoes && militar.funcoes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {militar.funcoes.map((funcao, idx) => (
                      <Badge key={idx} className="bg-white/20 text-white hover:bg-white/30">
                        {funcao}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dados Funcionais */}
          <Section title="Dados Funcionais" icon={Briefcase}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem label="Nome de Guerra" value={militar.nome_guerra} />
              <InfoItem label="Matrícula" value={militar.matricula} />
              <InfoItem label="Posto/Graduação" value={militar.posto_graduacao} />
              <InfoItem label="Quadro" value={militar.quadro} />
              <InfoItem label="Data de Inclusão" value={formatDate(militar.data_inclusao)} icon={Calendar} />
              <InfoItem label="Comportamento" value={militar.comportamento} />
              <InfoItem label="Condição" value={militar.condicao} />
              <InfoItem label="Cedência" value={militar.cedencia} />
              <InfoItem label="Origem/Destino" value={militar.origem_destino} />
            </div>
          </Section>

          {/* Dados Pessoais */}
          <Section title="Dados Pessoais" icon={User}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem label="Data de Nascimento" value={formatDate(militar.data_nascimento)} icon={Calendar} />
              <InfoItem label="Sexo" value={militar.sexo} />
              <InfoItem label="Estado Civil" value={militar.estado_civil} />
              <InfoItem label="Tipo Sanguíneo" value={militar.tipo_sanguineo} />
              <InfoItem label="Religião" value={militar.religiao} />
              <InfoItem label="Escolaridade" value={militar.escolaridade} />
              <InfoItem label="Naturalidade" value={militar.naturalidade} />
              <InfoItem label="UF Naturalidade" value={militar.naturalidade_uf} />
              <InfoItem label="Etnia" value={militar.etnia} />
            </div>
          </Section>

          {/* Filiação */}
          <Section title="Filiação" icon={Heart}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem label="Nome do Pai" value={militar.nome_pai} />
              <InfoItem label="Nome da Mãe" value={militar.nome_mae} />
            </div>
          </Section>

          {/* Documentos */}
          <Section title="Documentos" icon={FileText}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem label="CPF" value={militar.cpf} />
              <InfoItem label="RG" value={militar.rg} />
              <InfoItem label="Órgão Expedidor" value={militar.orgao_expedidor_rg} />
              <InfoItem label="UF RG" value={militar.uf_rg} />
              <InfoItem label="CNH Categoria" value={militar.cnh_categoria} />
              <InfoItem label="CNH Número" value={militar.cnh_numero} />
              <InfoItem label="Validade CNH" value={formatDate(militar.cnh_validade)} icon={Calendar} />
            </div>
          </Section>

          {/* Dados Bancários */}
          <Section title="Dados Bancários" icon={CreditCard}>
            <div className="grid grid-cols-3 gap-x-4">
              <InfoItem label="Banco" value={militar.banco} />
              <InfoItem label="Agência" value={militar.agencia} />
              <InfoItem label="Conta" value={militar.conta} />
            </div>
          </Section>

          {/* Contatos */}
          <Section title="Contatos" icon={Phone}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem label="Telefone" value={militar.telefone} icon={Phone} />
              <InfoItem label="Email Particular" value={militar.email_particular} icon={Mail} />
              <InfoItem label="Email Funcional" value={militar.email_funcional} icon={Mail} />
            </div>
          </Section>

          {/* Dados Antropométricos */}
          <Section title="Dados Antropométricos" icon={User}>
            <div className="grid grid-cols-3 gap-x-4">
              <InfoItem label="Altura" value={militar.altura ? `${militar.altura} m` : null} />
              <InfoItem label="Peso" value={militar.peso ? `${militar.peso} kg` : null} />
              <InfoItem label="Etnia" value={militar.etnia} />
            </div>
          </Section>

          {/* Endereço */}
          <Section title="Endereço" icon={MapPin}>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoItem 
                label="Endereço" 
                value={militar.logradouro ? `${militar.logradouro}, ${militar.numero_endereco || 'S/N'}` : null} 
                icon={MapPin} 
              />
              <InfoItem label="Complemento" value={militar.complemento} />
              <InfoItem label="Bairro" value={militar.bairro} />
              <InfoItem label="CEP" value={militar.cep} />
              <InfoItem label="Cidade" value={militar.cidade} />
              <InfoItem label="UF" value={militar.uf} />
            </div>
          </Section>

          {/* Habilidades e Cursos */}
          {(militar.habilidades?.length > 0 || militar.cursos?.length > 0) && (
            <Section title="Habilidades e Cursos" icon={GraduationCap}>
              {militar.habilidades?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Habilidades</p>
                  <div className="flex flex-wrap gap-2">
                    {militar.habilidades.map((h, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-[#1e3a5f]/10 text-[#1e3a5f]">
                        {h}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {militar.cursos?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Cursos</p>
                  <div className="flex flex-wrap gap-2">
                    {militar.cursos.map((c, idx) => (
                      <Badge key={idx} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}