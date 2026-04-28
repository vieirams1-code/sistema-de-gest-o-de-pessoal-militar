import React from 'react';
import { User, MapPin, MoreVertical, Pencil, Trash2, Eye, ExternalLink } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion } from 'framer-motion';

const statusColors = {
  'Ativo': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Inativo': 'bg-slate-100 text-slate-700 border-slate-200',
  'Reserva': 'bg-amber-100 text-amber-700 border-amber-200',
  'Reforma': 'bg-blue-100 text-blue-700 border-blue-200',
  'Falecido': 'bg-red-100 text-red-700 border-red-200'
};

const postoAbreviado = {
  'Soldado': 'Sd',
  'Cabo': 'Cb',
  '3º Sargento': '3º Sgt',
  '2º Sargento': '2º Sgt',
  '1º Sargento': '1º Sgt',
  'Subtenente': 'ST',
  'Aspirante': 'Asp',
  '2º Tenente': '2º Ten',
  '1º Tenente': '1º Ten',
  'Capitão': 'Cap',
  'Major': 'Maj',
  'Tenente Coronel': 'TC',
  'Coronel': 'Cel'
};

import { useCurrentUser } from '@/components/auth/useCurrentUser';

export default function MilitarCard({ militar, onEdit, onDelete, onView, canEdit = true, canDelete = true }) {
  const { hasAccess, hasSelfAccess } = useCurrentUser();
  const canAccess = hasAccess(militar) || hasSelfAccess(militar);
  const lotacaoAtual = militar.lotacao_atual || militar.lotacao;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-200 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex gap-4">
          {/* Foto */}
          <div className="w-20 h-24 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
            {militar.foto ? (
              <img src={militar.foto} alt={militar.nome_completo} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {militar.posto_graduacao && (
                    <span className="text-sm font-bold text-[#1e3a5f]">
                      {postoAbreviado[militar.posto_graduacao] || militar.posto_graduacao}
                    </span>
                  )}
                  <h3 className="font-semibold text-slate-900 truncate">
                    {militar.nome_guerra || militar.nome_completo}
                  </h3>
                </div>
                {militar.nome_guerra && (
                  <p className="text-sm text-slate-500 truncate">{militar.nome_completo}</p>
                )}
              </div>

              {canAccess && (<DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                 <DropdownMenuItem onClick={() => onView(militar)}>
                  <Eye className="w-4 h-4 mr-2" />
                  Visualizar
                 </DropdownMenuItem>
                 {militar.link_alteracoes_anteriores && (
                   <DropdownMenuItem onClick={() => window.open(militar.link_alteracoes_anteriores, '_blank')}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Alterações Anteriores
                   </DropdownMenuItem>
                 )}
                 {canEdit && (
                  <DropdownMenuItem onClick={() => onEdit(militar)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                 )}
                 {canDelete && (
                  <DropdownMenuItem onClick={() => onDelete(militar)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                 )}
                </DropdownMenuContent>
              </DropdownMenu>)}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={`${statusColors[militar.status_cadastro] || statusColors['Ativo']} border`}>
                {militar.status_cadastro || 'Ativo'}
              </Badge>
              {lotacaoAtual && (
                <Badge variant="outline" className="text-slate-600">
                  <MapPin className="w-3 h-3 mr-1" />
                  {lotacaoAtual}
                </Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {militar.matricula && (
                <span>Mat: {militar.matricula}</span>
              )}
              {militar.quadro && (
                <span>{militar.quadro}</span>
              )}
            </div>
          </div>
        </div>

        {/* Funções */}
        {militar.funcoes && militar.funcoes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-1">
              {militar.funcoes.slice(0, 3).map((funcao, idx) => (
                <Badge key={idx} variant="secondary" className="bg-[#1e3a5f]/10 text-[#1e3a5f] text-xs">
                  {funcao}
                </Badge>
              ))}
              {militar.funcoes.length > 3 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-xs">
                  +{militar.funcoes.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
