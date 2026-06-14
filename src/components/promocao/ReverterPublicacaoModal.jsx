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
  FRASE_CONFIRMACAO_REVERSAO_EXCEPCIONAL,
} from '@/services/promocaoService';

const SELECT_VAZIO = '__vazio__';

export default function ReverterPublicacaoModal({
  open,
  onOpenChange,
  registro,
  nomeMilitar,
  originadaDeCurso,
  detectando,
  podeReverterExcepcional,
  pendente,
  submitting,
  onConfirmar,
}) {
  const [frase, setFrase] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [modoAdmin, setModoAdmin] = useState(false);

  useEffect(() => {
    if (!open) {
      setFrase('');
      setMotivo('');
      setObservacao('');
      setModoAdmin(false);
    }
  }, [open]);

  const fraseEsperada = originadaDeCurso
    ? FRASE_CONFIRMACAO_REVERSAO_EXCEPCIONAL
    : FRASE_CONFIRMACAO_REVERSAO_COMUM;

  const fraseValida = frase.trim() === fraseEsperada;
  const motivoValido = Boolean(motivo);
  const modoAdminValido = originadaDeCurso ? modoAdmin : true;
  const semPermissaoExcepcional = originadaDeCurso && !podeReverterExcepcional;

  const bloqueado = detectando
    || submitting
    || !fraseValida
    || !motivoValido
    || !modoAdminValido
    || semPermissaoExcepcional;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {originadaDeCurso ? 'Reversão excepcional de promoção' : 'ATENÇÃO'}
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
                A reversão afetará a publicação da promoção e o cadastro militar, mas <strong>não reincluirá automaticamente</strong> o militar no curso.
                <br />
                O participante ficará com status <strong>pendente_reanalise</strong> e exigirá decisão administrativa manual.
              </AlertDescription>
            </Alert>
          )}

          {!detectando && semPermissaoExcepcional && (
            <Alert variant="destructive">
              <AlertTitle>Permissão necessária</AlertTitle>
              <AlertDescription>
                Você não possui a permissão <strong>Reverter Promoção Excepcional</strong> exigida para reverter promoções originadas de curso.
              </AlertDescription>
            </Alert>
          )}

          {!originadaDeCurso && (
            <>
              <p>Você está revertendo uma promoção oficial.</p>
              <p>Esta ação poderá cancelar histórico oficial, restaurar posto/quadro anterior, alterar Prévia Geral e reabrir esta promoção para edição.</p>
            </>
          )}

          {pendente && (
            <p className="font-medium text-amber-700">
              Este participante já está em pendente_reanalise; a reversão repetirá os efeitos administrativos.
            </p>
          )}

          {originadaDeCurso && (
            <label className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={modoAdmin}
                onChange={(event) => setModoAdmin(event.target.checked)}
                disabled={semPermissaoExcepcional}
              />
              <span className="text-rose-800">
                <strong>Ativar Modo Admin para esta reversão.</strong> Confirmo assumir o risco desta ação administrativa excepcional de alto impacto.
              </span>
            </label>
          )}

          <Label>Digite: {fraseEsperada}</Label>
          <Input
            value={frase}
            onChange={(event) => setFrase(event.target.value)}
            placeholder={fraseEsperada}
            disabled={semPermissaoExcepcional}
          />

          <Label>Motivo obrigatório</Label>
          <Select value={motivo || SELECT_VAZIO} onValueChange={(value) => setMotivo(value === SELECT_VAZIO ? '' : value)} disabled={semPermissaoExcepcional}>
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
          <Textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} disabled={semPermissaoExcepcional} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={bloqueado}
            onClick={() => onConfirmar({
              registro,
              motivo,
              observacao,
              modoAdmin: originadaDeCurso ? modoAdmin : false,
              fraseConfirmacao: frase.trim(),
            })}
          >
            {originadaDeCurso ? 'Confirmar reversão excepcional' : 'Confirmar reversão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}