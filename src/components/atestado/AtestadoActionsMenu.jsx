import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Pencil, Download, CheckCircle, BookOpen, FileText, Link2, Trash2 } from 'lucide-react';
import { calcStatusPublicacao, isPublicacaoAtestadoAtiva } from './atestadoPublicacaoHelpers';

export default function AtestadoActionsMenu({
  atestado,
  handlers,
  permissoes,
  estados,
  publicacoesVinculadas = [],
}) {
  const navigate = useNavigate();
  const { canAccessAction } = useCurrentUser();
  const canDownloadAttachments = canAccessAction('baixar_anexos_atestados');
  const canViewSensitive = canAccessAction('ver_dados_sensiveis_atestado');
  const canGerirJiso = canAccessAction('gerir_jiso');
  const canRegistrarDecisaoJiso = canAccessAction('registrar_decisao_jiso');
  const canPublicarAtaJiso = canAccessAction('publicar_ata_jiso');
  const canAccessJiso = canGerirJiso || canRegistrarDecisaoJiso || canPublicarAtaJiso;

  const {
    onView,
    onEdit,
    onDelete,
    onOpenHomologacao,
    onOpenAtaJiso,
  } = handlers;

  const { canEdit, canDelete } = permissoes;

  const {
    hasPublicacaoVinculada,
    mensagemBloqueioPublicacao,
    podePublicarHomologacao,
    hasHomologacaoAtiva,
    isFluxoJiso,
    statusDocumentalAtaJiso,
    bloquearEdicaoPublicacaoNoCard = false,
  } = estados;

  const abrirCentralJiso = () => {
    const atestadoId = String(atestado?.id || '').trim();
    if (!atestadoId) {
      toast.error('Não foi possível identificar o atestado para abrir a JISO.');
      return;
    }
    navigate(`${createPageUrl('AgendarJISO')}?atestado_id=${encodeURIComponent(atestadoId)}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onView?.(atestado)}><Eye className="w-4 h-4 mr-2" />Visualizar</DropdownMenuItem>

        {canEdit && (
          <DropdownMenuItem
            onClick={() => {
              if (hasPublicacaoVinculada) {
                if (mensagemBloqueioPublicacao) alert(mensagemBloqueioPublicacao);
                return;
              }
              onEdit?.(atestado);
            }}
            disabled={hasPublicacaoVinculada}
            title={hasPublicacaoVinculada ? 'Edição bloqueada: há publicação/nota vinculada.' : ''}
          >
            <Pencil className="w-4 h-4 mr-2" />
            {hasPublicacaoVinculada ? 'Editar (bloqueado por publicação vinculada)' : 'Editar'}
          </DropdownMenuItem>
        )}

        {atestado?.arquivo_atestado && canDownloadAttachments && canViewSensitive && (
          <DropdownMenuItem onClick={() => {
            if (!canDownloadAttachments || !canViewSensitive) {
              toast.error('Você não tem permissão para baixar anexos médicos.');
              return;
            }
            window.open(atestado.arquivo_atestado, '_blank');
          }}>
            <Download className="w-4 h-4 mr-2 text-slate-600" />Baixar atestado anexado
          </DropdownMenuItem>
        )}
        {atestado?.arquivo_ata_jiso && canDownloadAttachments && canViewSensitive && (
          <DropdownMenuItem onClick={() => {
            if (!canDownloadAttachments || !canViewSensitive) {
              toast.error('Você não tem permissão para baixar anexos médicos.');
              return;
            }
            window.open(atestado.arquivo_ata_jiso, '_blank');
          }}>
            <Download className="w-4 h-4 mr-2 text-purple-600" />Baixar Ata JISO
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {canAccessJiso && (
          <DropdownMenuItem onClick={abrirCentralJiso}>
            <Link2 className="w-4 h-4 mr-2 text-indigo-600" />
            {canGerirJiso ? 'Gerar / Vincular JISO' : 'Abrir Central JISO'}
          </DropdownMenuItem>
        )}

        {podePublicarHomologacao && (
          <DropdownMenuItem onClick={() => onOpenHomologacao?.()} disabled={hasHomologacaoAtiva}>
            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
            {hasHomologacaoAtiva ? 'Homologação já gerada' : 'Publicar Homologação'}
          </DropdownMenuItem>
        )}

        {isFluxoJiso && (
          <DropdownMenuItem
            onClick={() => onOpenAtaJiso?.()}
            disabled={statusDocumentalAtaJiso?.bloqueiaNovaPublicacao}
            title={statusDocumentalAtaJiso?.bloqueiaNovaPublicacao ? 'Já existe uma nota/publicação ativa para esta Ata JISO.' : ''}
          >
            <BookOpen className="w-4 h-4 mr-2 text-purple-600" />
            {statusDocumentalAtaJiso?.bloqueiaNovaPublicacao ? 'Já existe uma nota/publicação ativa para esta Ata JISO.' : 'Publicar ata JISO'}
          </DropdownMenuItem>
        )}

        {publicacoesVinculadas.filter(isPublicacaoAtestadoAtiva).map((p) => {
          if (bloquearEdicaoPublicacaoNoCard && p.tipo === 'Homologação de Atestado') {
            return (
              <DropdownMenuItem key={p.id} disabled title="A edição da homologação vinculada deve ser feita no módulo de publicações.">
                <FileText className="w-4 h-4 mr-2 text-slate-400" />
                <span className="truncate">Homologação vinculada — edição bloqueada neste card</span>
              </DropdownMenuItem>
            );
          }

          if (bloquearEdicaoPublicacaoNoCard && p.tipo === 'Ata JISO' && calcStatusPublicacao(p) === 'Publicado') {
            return (
              <DropdownMenuItem key={p.id} disabled title="Ata JISO consolidada/publicada: edição bloqueada neste card.">
                <FileText className="w-4 h-4 mr-2 text-slate-400" />
                <span className="truncate">{statusDocumentalAtaJiso?.texto} — edição bloqueada neste card</span>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem key={p.id} onClick={() => window.open(createPageUrl('CadastrarPublicacao') + `?id=${p.id}`, '_blank')}>
              <FileText className="w-4 h-4 mr-2 text-blue-500" />
              <span className="truncate">{p.tipo} — {p.status}</span>
            </DropdownMenuItem>
          );
        })}

        {canDelete && (
          <DropdownMenuItem
            onClick={() => {
              if (hasPublicacaoVinculada) {
                if (mensagemBloqueioPublicacao) alert(mensagemBloqueioPublicacao);
                return;
              }
              onDelete?.(atestado);
            }}
            disabled={hasPublicacaoVinculada}
            title={hasPublicacaoVinculada ? 'Exclusão bloqueada: há publicação/nota vinculada.' : ''}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {hasPublicacaoVinculada ? 'Excluir (bloqueado por publicação vinculada)' : 'Excluir'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
