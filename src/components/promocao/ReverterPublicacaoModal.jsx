import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FRASE_CONFIRMACAO_REVERSAO_COMUM,
  MENSAGEM_BLOQUEIO_REVERSAO_CURSO,
} from '@/services/promocaoService';

const SELECT_VAZIO = '__vazio__';

export default function ReverterPublicacaoModal({
  open,
  onOpenChange,
  registro,
  nomeMilitar,
  originadaDeCurso,
  detectando,
  submitting,
  onConfirmar,
}) {
  const [frase, setFrase] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (!open) {
      setFrase('');
      setMotivo('');
      setObservacao('');
    }
  }, [open]);

  const fraseValida = frase.trim() === FRASE_CONFIRMACAO_REVERSAO_COMUM;
  const motivoValido = Boolean(motivo);

  // Decisão institucional: promoções originadas de Curso de Formação NÃO são
  // revertidas pela interface. O modal apenas informa e bloqueia a confirmação.
  const bloqueado = detectando
    || submitting
    || originadaDeCurso
    || !fraseValida
    || !motivoValido;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {originadaDeCurso ? 'Reversão não disponível' : 'ATENÇÃO'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {detectando && (
            <p className="text-slate-500">Verificando vínculo com Curso de Formação...</p>
          )}

          {!detectando && originadaDeCurso && (
            <Alert className="border-amber-300 bg-amber-50">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              <AlertTitle className="text-amber-800">Promoção originada de Curso de Formação</AlertTitle>
              <AlertDescription className="text-amber-800">
                {MENSAGEM_BLOQUEIO_REVERSAO_CURSO}
              </AlertDescription>
            </Alert>
          )}

          {!detectando && !originadaDeCurso && (
            <>
              <p>Você está revertendo uma promoção oficial.</p>
              <p>Esta ação poderá cancelar histórico oficial, restaurar posto/quadro anterior, alterar Prévia Geral e reabrir esta promoção para edição.</p>

              <Label>Digite: {FRASE_CONFIRMACAO_REVERSAO_COMUM}</Label>
              <Input
                value={frase}
                onChange={(event) => setFrase(event.target.value)}
                placeholder={FRASE_CONFIRMACAO_REVERSAO_COMUM}
              />

              <Label>Motivo obrigatório</Label>
              <Select value={motivo || SELECT_VAZIO} onValueChange={(value) => setMotivo(value === SELECT_VAZIO ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_VAZIO}>Selecione...</SelectItem>
                  <SelectItem value="Erro material">Erro material</SelectItem>
                  <SelectItem value="Retificação administrativa">Retificação administrativa</SelectItem>
                  <SelectItem value="Publicação indevida">Publicação indevida</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>

              <Label>Observações</Label>
              <Textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {originadaDeCurso ? 'Entendi' : 'Cancelar'}
          </Button>
          {!originadaDeCurso && (
            <Button
              variant="destructive"
              disabled={bloqueado}
              onClick={() => onConfirmar({
                registro,
                motivo,
                observacao,
                fraseConfirmacao: frase.trim(),
              })}
            >
              Confirmar reversão
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}