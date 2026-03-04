import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  Shield
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Encerrado': 'bg-slate-100 text-slate-700 border-slate-200',
  'Cancelado': 'bg-red-100 text-red-700 border-red-200',
  'Prorrogado': 'bg-blue-100 text-blue-700 border-blue-200'
};

export default function AtestadoCard({ atestado, onEdit, onDelete, onView }) {
  const queryClient = useQueryClient();
  const [editingJiso, setEditingJiso] = useState(false);
  const [jisoDate, setJisoDate] = useState(atestado.data_jiso_agendada || '');
  const [savingJiso, setSavingJiso] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusInfo = () => {
    if (!atestado.data_retorno) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const retorno = new Date(atestado.data_retorno + 'T00:00:00');
    if (atestado.status === 'Encerrado' || atestado.status === 'Cancelado') return null;
    const diasRestantes = differenceInDays(retorno, hoje);
    if (diasRestantes < 0) return { icon: AlertCircle, text: 'Atrasado', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
    if (diasRestantes === 0) return { icon: Clock, text: 'Retorna hoje', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
    if (diasRestantes <= 3) return { icon: Clock, text: `Retorna em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
    return { icon: CheckCircle, text: `Retorna em ${diasRestantes} dias`, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' };
  };

  const handleSaveJiso = async () => {
    setSavingJiso(true);
    await base44.entities.Atestado.update(atestado.id, { data_jiso_agendada: jisoDate });
    queryClient.invalidateQueries({ queryKey: ['atestados'] });
    setSavingJiso(false);
    setEditingJiso(false);
  };

  const statusInfo = getStatusInfo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-200"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 truncate">
                {atestado.militar_posto && `${atestado.militar_posto} `}
                {atestado.militar_nome}
              </h3>
              {atestado.militar_matricula && (
                <p className="text-sm text-slate-500">Mat: {atestado.militar_matricula}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(atestado)}>
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(atestado)}>
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(atestado)} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={`${statusColors[atestado.status] || statusColors['Ativo']} border`}>
            {atestado.status || 'Ativo'}
          </Badge>
          {atestado.tipo_afastamento && (
            <Badge className="bg-blue-100 text-blue-700">{atestado.tipo_afastamento}</Badge>
          )}
          {atestado.necessita_jiso && (
            <Badge className="bg-purple-100 text-purple-700 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              JISO
            </Badge>
          )}
          {atestado.acompanhado && (
            <Badge variant="outline" className="border-pink-200 text-pink-700">
              Acompanhamento
            </Badge>
          )}
        </div>

        {statusInfo && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-3 ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
            <statusInfo.icon className={`w-4 h-4 ${statusInfo.color}`} />
            <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-slate-500">Início</p>
            <p className="font-medium text-slate-700">{formatDate(atestado.data_inicio)}</p>
          </div>
          <div>
            <p className="text-slate-500">Retorno</p>
            <p className="font-medium text-slate-700">{formatDate(atestado.data_retorno)}</p>
          </div>
          <div>
            <p className="text-slate-500">Dias</p>
            <p className="font-medium text-slate-700">{atestado.dias || 0} dias</p>
          </div>
          {atestado.cid_10 && (
            <div>
              <p className="text-slate-500">CID-10</p>
              <p className="font-medium text-slate-700">{atestado.cid_10}</p>
            </div>
          )}
        </div>

        {/* JISO agendada - editável inline */}
        {atestado.necessita_jiso && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <span className="text-xs font-medium text-purple-700">JISO Agendada:</span>
              {editingJiso ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="date"
                    value={jisoDate}
                    onChange={e => setJisoDate(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-0.5 text-xs flex-1"
                  />
                  <Button size="sm" className="h-6 px-2 text-xs bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleSaveJiso} disabled={savingJiso}>
                    {savingJiso ? '...' : 'OK'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingJiso(false)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-slate-700">
                    {atestado.data_jiso_agendada ? formatDate(atestado.data_jiso_agendada) : 'Não definida'}
                  </span>
                  <button onClick={() => setEditingJiso(true)} className="text-slate-400 hover:text-[#1e3a5f]" title="Editar data JISO">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {atestado.medico && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">Médico</p>
            <p className="text-sm font-medium text-slate-700">{atestado.medico}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}