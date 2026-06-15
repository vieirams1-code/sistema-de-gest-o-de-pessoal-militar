import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/components/auth/useCurrentUser';

/**
 * ImpersonationBanner — Sprint P0 Segurança
 * ---------------------------------------------------------------------
 * Banner persistente exibido em TODAS as rotas quando o usuário real
 * está agindo como outro usuário (modo usuário efetivo / impersonação).
 *
 * Informa claramente o usuário efetivo e o usuário autenticado real,
 * e oferece o botão "Encerrar impersonação".
 */
export default function ImpersonationBanner() {
  const {
    isImpersonating,
    effectiveUserEmail,
    authUserEmail,
    endImpersonation,
  } = useCurrentUser();

  const [encerrando, setEncerrando] = React.useState(false);

  if (!isImpersonating) return null;

  const handleEncerrar = async () => {
    setEncerrando(true);
    try {
      await endImpersonation();
    } finally {
      setEncerrando(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] w-full bg-amber-500 text-amber-950 shadow-md">
      <div className="mx-auto flex w-full max-w-none flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>
            Você está agindo como <strong>{effectiveUserEmail || '—'}</strong>. Usuário autenticado:{' '}
            <strong>{authUserEmail || '—'}</strong>.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleEncerrar}
          disabled={encerrando}
          className="border-amber-700 bg-amber-100 text-amber-900 hover:bg-amber-200"
        >
          <LogOut className="mr-1.5 h-4 w-4" />
          {encerrando ? 'Encerrando…' : 'Encerrar impersonação'}
        </Button>
      </div>
    </div>
  );
}